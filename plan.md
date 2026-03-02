# Virtual AI Band — Project Plan

> **Hackathon Project** | Next.js · Groq / DigitalOcean Gradient · Web Audio API · Tone.js  
> **Status:** Phase 5 — Enhanced Input Modes & Full Production Board  
> **Constraint:** Pages Router only. No external backend. All server logic lives in `pages/api/`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Libraries](#2-tech-stack--libraries)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [API Route Design](#4-api-route-design)
5. [Agent Personas & System Prompts](#5-agent-personas--system-prompts)
6. [Implementation Phases (Completed)](#6-implementation-phases-completed)
7. [Phase 5 — Enhanced Input & Production Board](#7-phase-5--enhanced-input--production-board)
8. [File & Directory Structure](#8-file--directory-structure)
9. [Key Risks & Mitigations](#9-key-risks--mitigations)

---

## 1. Project Overview

**Virtual AI Band** is a browser-native music production application. Users provide creative input — a **demo recording**, **lyrics**, or a **text description** — and AI agents compose a full multi-track arrangement. The output is rendered through a **GarageBand-style production board** where each instrument track (melody, bass, drums, keys, vocals) can be independently soloed, muted, and mixed.

### What's Already Built (Phases 1–4)

- Microphone recording via `useAudioRecorder` hook
- Multi-agent AI pipeline (Producer → Bass → Drums) via Groq / DigitalOcean
- Tone.js playback engine with synths, per-track volume, and looping
- SSE streaming of agent logs to a typewriter terminal UI
- Mock mode for offline development
- Transport controls (play / pause / stop) and per-track volume faders

### What's New (Phase 5)

- **Multi-modal input**: users can submit a mic recording, upload an audio file, paste lyrics, or type a free-text prompt
- **Expanded instrument set**: melody/lead, chords/keys, and (stretch) vocal melody — in addition to existing bass & drums
- **Per-track mute/solo/volume**: a GarageBand-style mixer strip for every track
- **Visual timeline / piano-roll**: horizontal bars showing each track's MIDI events
- **Export**: download the full mix as WAV or individual MIDI-like JSON per track

---

## 2. Tech Stack & Libraries

### Core (unchanged)

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (Pages Router) |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind CSS v4** (dark/retro theme) |
| AI | **Groq SDK** / **OpenAI SDK** (DigitalOcean Gradient) |
| Audio | **Tone.js** + **Web Audio API** |
| Validation | **Zod** |

### New Dependencies (Phase 5)

| Package | Purpose |
|---|---|
| `audiobuffer-to-wav` | Export mix to WAV for download |
| *(no new deps required for lyrics/text input — vanilla React forms)* | — |

---

## 3. Architecture & Data Flow

### Updated High-Level Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Client)                           │
│                                                                      │
│  INPUT MODE (user picks one):                                        │
│    🎤 Record mic → audioBlob                                         │
│    📁 Upload audio file → audioBlob                                  │
│    📝 Paste lyrics → lyricsText                                      │
│    💬 Text description → promptText                                  │
│                                                                      │
│  FormData:                                                           │
│    audio?      (Blob, optional)                                      │
│    lyrics?     (string, optional)                                    │
│    prompt?     (string, optional)                                    │
│    bpm         (number)                                              │
│    genre       (string)                                              │
│    key         (string)                                              │
│    bars        (number, default 4)                                   │
│    tracks[]    (selected instrument tracks)                          │
│                                                                      │
│         POST /api/orchestrate-band                                   │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
              ─────────────────▼─────────────────
┌───────────────────────────────────────────────────────────────────────┐
│                  NEXT.JS SERVER (pages/api/)                         │
│                                                                      │
│  1. Parse multipart form (audio, lyrics, prompt, params)             │
│  2. Build unified creative brief from whichever input was given      │
│  3. Producer Agent → analyzes brief, issues directives               │
│  4. For each requested track, spawn an agent:                        │
│       Bass Agent      → bass MIDI JSON                               │
│       Drums Agent     → drums MIDI JSON                              │
│       Melody Agent    → melody MIDI JSON   (NEW)                     │
│       Keys Agent      → chords MIDI JSON   (NEW)                     │
│       Vocal Agent     → vocal melody JSON  (NEW, stretch)            │
│  5. Validate all with Zod, assemble result                           │
│  6. Stream SSE events (progress, logs, final result)                 │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
              ─────────────────▼─────────────────
┌───────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────┐                │
│  │  PRODUCTION BOARD (GarageBand-style)              │                │
│  │                                                   │                │
│  │  TRACK        MUTE  SOLO  VOL     TIMELINE        │                │
│  │  ─────        ────  ────  ───     ────────        │                │
│  │  🎸 Guitar     M     S    ▓▓▓▓   ██░░██░░██      │                │
│  │  🎹 Melody     M     S    ▓▓▓    ░██░░██░░█      │                │
│  │  🎹 Keys       M     S    ▓▓▓▓   █░░░█░░░█       │                │
│  │  🎸 Bass       M     S    ▓▓▓▓   ██░██░██░       │                │
│  │  🥁 Drums      M     S    ▓▓▓    ░██░██░██       │                │
│  │  🎤 Vocal      M     S    ▓▓     ░░██░░██░       │                │
│  │                                                   │                │
│  │  [▶ PLAY]  [⏸ PAUSE]  [■ STOP]  [⬇ EXPORT WAV]  │                │
│  └──────────────────────────────────────────────────┘                │
│                                                                      │
│  Tone.js Engine:                                                     │
│    Each track → Synth → Volume → Mute gate → Compressor → Dest      │
│    Guitar track → Player (from audioBlob) → same chain               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. API Route Design

### Endpoint (updated)

```
POST /api/orchestrate-band
Content-Type: multipart/form-data
```

### Request Payload (updated)

| Field | Type | Required | Description |
|---|---|---|---|
| `audio` | `File` (Blob) | No* | Recorded or uploaded audio file |
| `lyrics` | `string` | No* | Song lyrics (the AI will interpret mood, structure, syllable rhythm) |
| `prompt` | `string` | No* | Free-text description (e.g. "chill lo-fi beat with jazzy chords") |
| `bpm` | `string` | Yes | Tempo in BPM |
| `genre` | `string` | Yes | Genre: jazz, pop, blues, funk, bossa nova, lo-fi, rock |
| `key` | `string` | Yes | Key signature |
| `bars` | `string` | No | Number of bars (default 4) |
| `tracks` | `string` | No | Comma-separated list of requested tracks: `bass,drums,melody,keys,vocal` (default `bass,drums`) |
| `durationSeconds` | `string` | No | Recording length (only when audio is provided) |

> *At least one of `audio`, `lyrics`, or `prompt` must be provided.

### Updated Response Schema

```json
{
  "success": true,
  "logs": ["..."],
  "midi_data": {
    "bpm": 120,
    "total_bars": 4,
    "bass":   [{ "bar": 1, "beat": 1, "note": "C2", "duration": "4n", "velocity": 90 }],
    "drums":  [{ "bar": 1, "beat": 1, "instrument": "kick", "velocity": 100 }],
    "melody": [{ "bar": 1, "beat": 1, "note": "E4", "duration": "8n", "velocity": 85 }],
    "keys":   [{ "bar": 1, "beat": 1, "notes": ["C3","E3","G3"], "duration": "2n", "velocity": 75 }],
    "vocal":  [{ "bar": 1, "beat": 1, "note": "G4", "duration": "4n", "velocity": 80, "syllable": "la" }]
  }
}
```

---

## 5. Agent Personas & System Prompts

### Existing Agents (unchanged)

- **Producer** — orchestrator, receives musical context, issues directives to all agents
- **Bass Player** — walking / grooved bass lines (16 notes across 4 bars)
- **Drummer** — rhythmic patterns (32–48 hits across 4 bars)

### New Agents

---

#### Agent 4: The Melodist

**Role:** Generates a lead melody line that fits over the harmony.

**System Prompt:**
```
You are "The Melodist", a professional lead instrumentalist AI.

Your ONLY output is this exact JSON structure. No markdown, no explanation:
{"data":[
  {"bar":1,"beat":1,"note":"E4","duration":"8n","velocity":85},
  {"bar":1,"beat":1.5,"note":"G4","duration":"8n","velocity":78},
  ...
]}

STRICT RULES:
1. Output 16-32 note objects total (4-8 per bar).
2. bar: integer 1-4 only.
3. beat: 1, 1.5, 2, 2.5, 3, 3.5, 4, or 4.5.
4. note: octave 4 or 5 ONLY (e.g. "E4", "G5"). Stay in the given key.
5. duration: "4n" "8n" "16n" "4n." "8n." only.
6. velocity: integer 70-100.
7. Mix stepwise motion (C4→D4→E4) with small leaps (C4→E4). No leaps > octave.
8. First note of bar 1 should be a chord tone (root, 3rd, or 5th).
9. DO NOT write anything outside the JSON.
```

---

#### Agent 5: The Keys Player

**Role:** Generates chord voicings / comping patterns.

**System Prompt:**
```
You are "The Keys Player", a professional keyboard/piano AI.

Your ONLY output is this exact JSON structure. No markdown, no explanation:
{"data":[
  {"bar":1,"beat":1,"notes":["C3","E3","G3"],"duration":"2n","velocity":75},
  {"bar":1,"beat":3,"notes":["C3","E3","G3"],"duration":"2n","velocity":70},
  ...
]}

STRICT RULES:
1. Output 8-16 chord objects total (2-4 per bar).
2. bar: integer 1-4 only.
3. beat: 1, 2, 3, or 4.
4. notes: array of 3-4 note names in octave 3-4 (e.g. ["C3","E3","G3","B3"]).
5. duration: "1n" "2n" "4n" only. Prefer half notes ("2n") for sustained chords.
6. velocity: integer 60-85.
7. Use inversions for smooth voice leading between chords.
8. DO NOT write anything outside the JSON.
```

---

#### Agent 6: The Vocalist (stretch goal)

**Role:** Generates a vocal melody line matched to lyrics (if provided).

**System Prompt:**
```
You are "The Vocalist", a professional singer AI.

If lyrics are provided, map each syllable to a pitch and rhythm.
If no lyrics, generate a "la la la" vocal melody.

Your ONLY output is this exact JSON structure:
{"data":[
  {"bar":1,"beat":1,"note":"G4","duration":"4n","velocity":80,"syllable":"hel"},
  {"bar":1,"beat":2,"note":"A4","duration":"4n","velocity":78,"syllable":"lo"},
  ...
]}

STRICT RULES:
1. Output 8-24 note objects total.
2. bar: integer 1-4 only.
3. note: octave 3-5 only. Stay in the given key.
4. duration: "4n" "8n" "2n" "4n." only.
5. velocity: integer 70-95.
6. syllable: one syllable per note, taken from lyrics in order.
7. Phrasing should feel natural — leave breathing gaps between phrases.
8. DO NOT write anything outside the JSON.
```

---

### Updated Agent Interaction

```
                     ┌──────────────┐
                     │   Producer   │
                     └──────┬───────┘
              ┌─────┬──────┼──────┬───────┐
              ▼     ▼      ▼      ▼       ▼
           [Bass] [Drums] [Melody] [Keys] [Vocal]
              │     │      │      │       │
              └─────┴──────┴──────┴───────┘
                           │
                    { midi_data }
```

### Updated Producer System Prompt

The Producer's system prompt must be extended with two new directive fields:

```
{
  "producer_logs": [...],
  "bass_directive": "...",
  "drums_directive": "...",
  "melody_directive": "Play a lyrical melody outlining Dm7→G7→Cmaj7→Am7 in octave 4-5.",
  "keys_directive": "Comp with 7th-chord voicings: Dm7, G7, Cmaj7, Am7. Half-note rhythm.",
  "vocal_directive": "Sing the lyrics over the changes. Emphasize downbeats.",
  "chord_roots": ["D","G","C","A"],
  "feel": "swing"
}
```

The `ProducerDirectiveSchema` in `schemas.ts` must be updated to include the optional new fields.

---

## 6. Implementation Phases (Completed)

> Phases 1–4 are **done**. See git history for details.

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Project setup, UI shell, audio recording | ✅ Done |
| Phase 2 | Tone.js engine, mock API, terminal UI | ✅ Done |
| Phase 3 | API route, Groq/Gradient multi-agent pipeline | ✅ Done |
| Phase 4 | Audio sync, volume control, UI polish | ✅ Done |

---

## 7. Phase 5 — Enhanced Input & Production Board

This is the active development phase. It has **6 sub-phases** designed to be implemented incrementally.

---

### Phase 5.1: Multi-Modal Input Form

**Goal:** Replace the "record only" studio panel with a tabbed input form that accepts mic recording, file upload, lyrics, or text prompt.

#### New Component: `InputForm.tsx`

```
┌──────────────────────────────────────────────────┐
│  🎤 Record  |  📁 Upload  |  📝 Lyrics  |  💬 Prompt │  ← tab bar
├──────────────────────────────────────────────────┤
│                                                  │
│  [Tab-specific content area]                     │
│                                                  │
│  ── Session Parameters ──────────────────────    │
│  BPM: [120]   Genre: [jazz ▼]   Key: [C maj ▼]  │
│  Bars: [4]                                       │
│                                                  │
│  ── Track Selection ─────────────────────────    │
│  ☑ Bass  ☑ Drums  ☐ Melody  ☐ Keys  ☐ Vocal     │
│                                                  │
│  [ ⬡ GENERATE BAND ]                             │
└──────────────────────────────────────────────────┘
```

#### Steps

1. **Create `src/components/InputForm.tsx`**
   - Tabbed interface with 4 modes: Record | Upload | Lyrics | Prompt
   - **Record tab**: reuse existing `StudioPanel` recording logic (waveform viz, start/stop/clear, duration display)
   - **Upload tab**: `<input type="file" accept="audio/*">` → reads file into an `audioBlob` state. Show filename + duration after selection.
   - **Lyrics tab**: `<textarea>` for multi-line lyrics. Character counter (max 2000). Placeholder: "Paste your lyrics here..."
   - **Prompt tab**: `<textarea>` for free-text. Placeholder: "Describe the music you want... e.g. 'chill lo-fi beat with jazzy piano chords and a gentle bass line'"
   - All tabs share common **session parameters** below the tab content:
     - BPM spinner (40–240, default 120)
     - Genre dropdown (jazz, pop, blues, funk, bossa nova, lo-fi, rock)
     - Key dropdown (C major, G major, ... A minor, etc.)
     - Bars spinner (2–16, default 4)
   - **Track selection checkboxes**: bass (default on), drums (default on), melody, keys, vocal
     - Vocal checkbox only enabled when lyrics tab is active (or lyrics text is non-empty)

2. **Refactor `src/components/StudioPanel.tsx`**
   - Extract the recording controls + waveform canvas into a smaller `RecordingControls` sub-component that `InputForm` can embed in its Record tab
   - Keep `StudioPanel` as a thin wrapper if needed for backwards compatibility, or retire it

3. **Update `src/pages/index.tsx`**
   - Add new state: `lyrics: string`, `prompt: string`, `selectedTracks: string[]`, `bars: number`, `inputMode: 'record'|'upload'|'lyrics'|'prompt'`
   - Replace `<StudioPanel>` with `<InputForm>`
   - Update `handleGenerate()`:
     ```typescript
     const formData = new FormData();
     if (audioBlob)  formData.append('audio', audioBlob, 'recording.webm');
     if (lyrics)     formData.append('lyrics', lyrics);
     if (prompt)     formData.append('prompt', prompt);
     formData.append('bpm', String(bpm));
     formData.append('genre', genre);
     formData.append('key', musicalKey);
     formData.append('bars', String(bars));
     formData.append('tracks', selectedTracks.join(','));
     if (durationSeconds) formData.append('durationSeconds', String(durationSeconds));
     ```
   - Remove the old guard `if (!audioBlob && !useMock)` — replace with `if (!audioBlob && !lyrics && !prompt && !useMock)`

4. **Update `src/pages/api/orchestrate-band.ts`**
   - Parse new fields from FormData: `lyrics`, `prompt`, `tracks`
   - Build unified `musicalContext`:
     ```typescript
     let briefParts = [`Tempo: ${bpm} BPM, Genre: ${genre}, Key: ${key}`];
     if (lyrics)  briefParts.push(`LYRICS:\n${lyrics}`);
     if (prompt)  briefParts.push(`USER DIRECTION: ${prompt}`);
     if (audio)   briefParts.push(`Audio recording provided (${duration}s).`);
     const musicalContext = briefParts.join('\n\n');
     ```
   - Validate: at least one of audio/lyrics/prompt must be present

#### Files Changed

| File | Action |
|---|---|
| `src/components/InputForm.tsx` | **NEW** |
| `src/components/StudioPanel.tsx` | Refactor (extract recording controls) |
| `src/pages/index.tsx` | Update state + form integration |
| `src/pages/api/orchestrate-band.ts` | Parse new fields, build unified brief |

---

### Phase 5.2: Expanded Zod Schemas & New Agent Tracks

**Goal:** Add Zod schemas and system prompts for melody, keys, and vocal tracks.

#### Steps

1. **Update `src/lib/schemas.ts`** — add new note schemas:

   ```typescript
   export const MelodyNoteSchema = z.object({
     bar:      z.number().int().positive(),
     beat:     z.number().positive(),
     note:     z.string().regex(/^[A-G]#?[0-9]$/),
     duration: z.enum(['1n','2n','4n','8n','16n','4n.','8n.']),
     velocity: z.number().min(0).max(127),
   });

   export const KeysChordSchema = z.object({
     bar:      z.number().int().positive(),
     beat:     z.number().positive(),
     notes:    z.array(z.string().regex(/^[A-G]#?[0-9]$/)).min(2).max(5),
     duration: z.enum(['1n','2n','4n','8n','4n.']),
     velocity: z.number().min(0).max(127),
   });

   export const VocalNoteSchema = z.object({
     bar:      z.number().int().positive(),
     beat:     z.number().positive(),
     note:     z.string().regex(/^[A-G]#?[0-9]$/),
     duration: z.enum(['1n','2n','4n','8n','16n','4n.','8n.']),
     velocity: z.number().min(0).max(127),
     syllable: z.string().max(20).optional(),
   });
   ```

2. **Update `MidiDataSchema`** — make new tracks optional:

   ```typescript
   export const MidiDataSchema = z.object({
     bpm:        z.number().positive(),
     total_bars: z.number().int().positive(),
     bass:       z.array(BassNoteSchema),
     drums:      z.array(DrumHitSchema),
     melody:     z.array(MelodyNoteSchema).optional(),
     keys:       z.array(KeysChordSchema).optional(),
     vocal:      z.array(VocalNoteSchema).optional(),
   });
   ```

3. **Update `ProducerDirectiveSchema`** — add optional new directive fields:

   ```typescript
   export const ProducerDirectiveSchema = z.object({
     producer_logs:     z.array(z.string()),
     bass_directive:    z.string(),
     drums_directive:   z.string(),
     melody_directive:  z.string().optional(),
     keys_directive:    z.string().optional(),
     vocal_directive:   z.string().optional(),
     chord_roots:       z.array(z.string()),
     feel:              z.string(),
   });
   ```

4. **Add system prompts** for Melody, Keys, and Vocal agents in `orchestrate-band.ts` (see Section 5 above)

5. **Add agent call logic** — conditionally call each agent based on `tracks[]` parameter:

   ```typescript
   const requestedTracks = (fields.tracks?.[0] ?? 'bass,drums').split(',');

   // Always call bass & drums
   // ...existing code...

   if (requestedTracks.includes('melody')) {
     sse(res, { type: 'progress', step: nextStep++, label: 'Melodist composing lead...' });
     const melodyRaw = await callArrayAgent(client, MELODY_SYSTEM, melodyUserPrompt, model);
     melodyNotes = JSON.parse(melodyRaw);
   }

   if (requestedTracks.includes('keys')) {
     sse(res, { type: 'progress', step: nextStep++, label: 'Keys Player voicing chords...' });
     const keysRaw = await callArrayAgent(client, KEYS_SYSTEM, keysUserPrompt, model);
     keysChords = JSON.parse(keysRaw);
   }

   if (requestedTracks.includes('vocal') && lyrics) {
     sse(res, { type: 'progress', step: nextStep++, label: 'Vocalist mapping lyrics...' });
     const vocalRaw = await callArrayAgent(client, VOCAL_SYSTEM, vocalUserPrompt, model);
     vocalNotes = JSON.parse(vocalRaw);
   }
   ```

6. **Update `GEN_STEPS`** in `index.tsx` to be dynamic based on selected tracks

#### Files Changed

| File | Action |
|---|---|
| `src/lib/schemas.ts` | Add MelodyNote, KeysChord, VocalNote schemas; update MidiData + ProducerDirective |
| `src/pages/api/orchestrate-band.ts` | Add 3 new system prompts + conditional agent calls |
| `src/lib/mockApiResponse.ts` | Add mock melody/keys/vocal data |
| `src/pages/index.tsx` | Dynamic `GEN_STEPS` |

---

### Phase 5.3: Tone.js Engine — New Instruments

**Goal:** Add synths for melody, keys, and vocal tracks. Add per-track mute/solo.

#### Steps

1. **Add new synths to `src/lib/toneEngine.ts`**:

   ```typescript
   // Melody — bright FM lead
   let _melodySynth: InstanceType<ToneModule['FMSynth']> | null = null;
   let _melodyVol:   InstanceType<ToneModule['Volume']>  | null = null;

   // Keys — warm polyphonic pad
   let _keysSynth:   InstanceType<ToneModule['PolySynth']> | null = null;
   let _keysVol:     InstanceType<ToneModule['Volume']>    | null = null;

   // Vocal — AM synth with vocal-ish timbre
   let _vocalSynth:  InstanceType<ToneModule['AMSynth']>  | null = null;
   let _vocalVol:    InstanceType<ToneModule['Volume']>   | null = null;
   ```

   Initialize them in `getSynths()`:
   ```typescript
   if (!_melodyVol)  _melodyVol  = new Tone.Volume(-6).connect(_masterComp);
   if (!_keysVol)    _keysVol    = new Tone.Volume(-8).connect(_masterComp);
   if (!_vocalVol)   _vocalVol   = new Tone.Volume(-4).connect(_masterComp);

   if (!_melodySynth) {
     _melodySynth = new Tone.FMSynth({
       harmonicity: 3,
       modulationIndex: 10,
       envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3 },
     }).connect(_melodyVol);
   }

   if (!_keysSynth) {
     _keysSynth = new Tone.PolySynth(Tone.Synth, {
       oscillator: { type: 'sine' },
       envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 },
     }).connect(_keysVol);
     _keysSynth.maxPolyphony = 6;
   }

   if (!_vocalSynth) {
     _vocalSynth = new Tone.AMSynth({
       harmonicity: 2.5,
       envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.4 },
     }).connect(_vocalVol);
   }
   ```

2. **Update `scheduleBand()`** to schedule new tracks:

   ```typescript
   // Melody Part
   if (midiData.melody?.length) {
     const melodyEvents = midiData.melody.map(note => ({
       time: `${note.bar - 1}:${note.beat - 1}:0`,
       note: note.note,
       duration: note.duration,
       velocity: note.velocity / 127,
     }));
     _melodyPart = new Tone.Part((t, ev) => {
       melodySynth.triggerAttackRelease(ev.note, ev.duration, t, ev.velocity);
     }, melodyEvents);
     _melodyPart.loop = true;
     _melodyPart.loopEnd = loopEnd;
     _melodyPart.start(0);
   }

   // Keys Part (PolySynth — pass notes array)
   if (midiData.keys?.length) {
     const keysEvents = midiData.keys.map(chord => ({
       time: `${chord.bar - 1}:${chord.beat - 1}:0`,
       notes: chord.notes,
       duration: chord.duration,
       velocity: chord.velocity / 127,
     }));
     _keysPart = new Tone.Part((t, ev) => {
       keysSynth.triggerAttackRelease(ev.notes, ev.duration, t, ev.velocity);
     }, keysEvents);
     _keysPart.loop = true;
     _keysPart.loopEnd = loopEnd;
     _keysPart.start(0);
   }

   // Vocal Part
   if (midiData.vocal?.length) {
     const vocalEvents = midiData.vocal.map(note => ({
       time: `${note.bar - 1}:${note.beat - 1}:0`,
       note: note.note,
       duration: note.duration,
       velocity: note.velocity / 127,
     }));
     _vocalPart = new Tone.Part((t, ev) => {
       vocalSynth.triggerAttackRelease(ev.note, ev.duration, t, ev.velocity);
     }, vocalEvents);
     _vocalPart.loop = true;
     _vocalPart.loopEnd = loopEnd;
     _vocalPart.start(0);
   }
   ```

3. **Add mute/solo functions**:

   ```typescript
   type TrackName = 'guitar' | 'bass' | 'drums' | 'melody' | 'keys' | 'vocal';

   const volumeNodes: Record<TrackName, InstanceType<ToneModule['Volume']> | null> = {
     guitar: _guitarVol, bass: _bassVol, drums: _drumsVol,
     melody: _melodyVol, keys: _keysVol, vocal: _vocalVol,
   };

   export async function setTrackMute(track: TrackName, muted: boolean): Promise<void> {
     await getSynths();
     const vol = volumeNodes[track];
     if (vol) vol.mute = muted;
   }

   export async function setTrackSolo(track: TrackName, solo: boolean): Promise<void> {
     await getSynths();
     // If solo-ing a track, mute all others; if un-solo-ing, unmute all
     if (solo) {
       for (const [name, vol] of Object.entries(volumeNodes)) {
         if (vol) vol.mute = name !== track;
       }
     } else {
       for (const vol of Object.values(volumeNodes)) {
         if (vol) vol.mute = false;
       }
     }
   }
   ```

4. **Update `setVolume()`** to handle `melody`, `keys`, `vocal` track names

5. **Update `stopPlayback()`** to dispose new Parts

#### Files Changed

| File | Action |
|---|---|
| `src/lib/toneEngine.ts` | Add 3 synths, 3 volumes, scheduling, mute/solo |

---

### Phase 5.4: Production Board UI (GarageBand-style Mixer)

**Goal:** Build a visual mixer/production board with per-track mute/solo/volume and a mini timeline.

#### Steps

1. **Create `src/components/ProductionBoard.tsx`**
   - Container that renders a `TrackStrip` for each active track
   - Embedded transport buttons (play/pause/stop)
   - Export buttons (WAV / MIDI JSON)
   - Playhead progress bar synced to `Tone.Transport`

2. **Create `src/components/TrackStrip.tsx`**
   - Single-row component for one track
   - Props: `name, icon, color, muted, solo, volume, midiEvents[], onMute, onSolo, onVolume`
   - Layout: `[icon + name] [M] [S] [volume slider] [mini timeline]`
   - Mute button toggles between muted (dim) and active (bright)
   - Solo button highlights when active, auto-mutes others

3. **Create `src/components/MiniTimeline.tsx`**
   - SVG-based horizontal bar visualizing note events as colored rectangles
   - Props: `events: {startBeat, durationBeats}[], color, totalBeats, playheadPct`
   - Each note event draws a small rectangle at the correct horizontal position
   - A white vertical line represents the playhead
   - Optionally: show syllable text above vocal notes

4. **Create `src/hooks/usePlayhead.ts`**
   ```typescript
   export function usePlayhead(): number {
     const [pct, setPct] = useState(0);
     useEffect(() => {
       let raf: number;
       const tick = () => {
         // Dynamic import to avoid SSR
         import('tone').then(Tone => {
           setPct(Tone.getTransport().progress * 100);
         });
         raf = requestAnimationFrame(tick);
       };
       raf = requestAnimationFrame(tick);
       return () => cancelAnimationFrame(raf);
     }, []);
     return pct;
   }
   ```

5. **Update `src/pages/index.tsx`**
   - Add track state management:
     ```typescript
     type TrackState = { muted: boolean; solo: boolean; volume: number };
     const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({
       guitar: { muted: false, solo: false, volume: 0 },
       bass:   { muted: false, solo: false, volume: 0 },
       drums:  { muted: false, solo: false, volume: 0 },
       melody: { muted: false, solo: false, volume: 0 },
       keys:   { muted: false, solo: false, volume: 0 },
       vocal:  { muted: false, solo: false, volume: 0 },
     });
     ```
   - Replace the footer `<TransportControls>` with `<ProductionBoard>`
   - Wire mute/solo/volume handlers to `toneEngine` functions

#### Files Changed

| File | Action |
|---|---|
| `src/components/ProductionBoard.tsx` | **NEW** |
| `src/components/TrackStrip.tsx` | **NEW** |
| `src/components/MiniTimeline.tsx` | **NEW** |
| `src/hooks/usePlayhead.ts` | **NEW** |
| `src/pages/index.tsx` | Integrate production board, track state |
| `src/components/TransportControls.tsx` | May retire or merge |

---

### Phase 5.5: Export Functionality

**Goal:** Let users download their creation as WAV or MIDI JSON.

#### Steps

1. **WAV export — offline render** in `src/lib/toneEngine.ts`:

   ```typescript
   export async function exportToWav(midiData: MidiData, audioBlob?: Blob): Promise<Blob> {
     const Tone = await getTone();
     const barsSeconds = (midiData.total_bars * 4 * 60) / midiData.bpm;
     const offline = new Tone.OfflineContext(2, barsSeconds + 0.5, 44100);

     // Recreate synths in offline context
     // Schedule all events
     // Render
     const buffer = await offline.render();

     // Convert AudioBuffer → WAV using audiobuffer-to-wav
     const wavArrayBuffer = audioBufferToWav(buffer);
     return new Blob([wavArrayBuffer], { type: 'audio/wav' });
   }
   ```

2. **MIDI JSON export** in `src/lib/exportHelpers.ts`:

   ```typescript
   export function downloadMidiJson(midiData: MidiData, filename = 'ai-band-midi.json') {
     const json = JSON.stringify(midiData, null, 2);
     const blob = new Blob([json], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url; a.download = filename; a.click();
     URL.revokeObjectURL(url);
   }
   ```

3. **UI** — add export buttons to `ProductionBoard.tsx`:
   - "⬇ WAV" — triggers offline render, shows progress spinner, then downloads
   - "⬇ MIDI" — instant JSON download

#### Files Changed

| File | Action |
|---|---|
| `src/lib/toneEngine.ts` | Add `exportToWav()` |
| `src/lib/exportHelpers.ts` | **NEW** — `downloadMidiJson()`, WAV encoding |
| `src/components/ProductionBoard.tsx` | Add export buttons + loading state |
| `package.json` | Add `audiobuffer-to-wav` dependency |

---

### Phase 5.6: Lyrics-Aware Generation & Vocal Track (Stretch Goal)

**Goal:** When lyrics are provided, the AI considers syllable count, phrasing, and emotional tone to shape the arrangement and generates a vocal melody.

#### Steps

1. **Update Producer prompt** to incorporate lyrics analysis:
   - Pre-process lyrics on the server: count lines, estimate syllables per line, detect verse/chorus patterns
   - Pass this metadata to the Producer agent alongside the lyrics text
   - Producer outputs `vocal_directive` with syllable-to-bar mapping hints

2. **Add Vocal Agent** to the pipeline (see system prompt in Section 5):
   - Only activated when `tracks` includes `vocal` AND lyrics are non-empty
   - Input: lyrics text + Producer's vocal directive + musical context
   - Output: `{bar, beat, note, duration, velocity, syllable}[]`

3. **Update Tone.js vocal scheduling** — already handled in Phase 5.3

4. **Update `MiniTimeline` for vocal track** — render syllable text labels above note blocks

5. **Update mock data** with lyrics-based mock example

#### Files Changed

| File | Action |
|---|---|
| `src/pages/api/orchestrate-band.ts` | Lyrics pre-processing, vocal agent call |
| `src/lib/mockApiResponse.ts` | Lyrics-based mock data |
| `src/components/MiniTimeline.tsx` | Syllable label rendering |

---

## 8. File & Directory Structure

Target project structure after Phase 5 completion:

```
my-ai-band/
├── .env.local                       # API keys (git-ignored)
├── next.config.ts
├── tsconfig.json
├── package.json
├── plan.md                          # This document
│
├── public/
│   └── fonts/
│
├── src/
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── index.tsx                # Main app — input form + production board
│   │   └── api/
│   │       └── orchestrate-band.ts  # Multi-agent API (bass, drums, melody, keys, vocal)
│   │
│   ├── components/
│   │   ├── InputForm.tsx            # NEW — tabbed multi-modal input
│   │   ├── ProductionBoard.tsx      # NEW — GarageBand-style mixer
│   │   ├── TrackStrip.tsx           # NEW — single track row (mute/solo/vol/timeline)
│   │   ├── MiniTimeline.tsx         # NEW — SVG note event visualizer
│   │   ├── AgentTerminal.tsx        # Existing — typewriter log display
│   │   ├── StudioPanel.tsx          # Existing — refactored as recording sub-component
│   │   ├── TransportControls.tsx    # Existing — may merge into ProductionBoard
│   │   └── StatusBadge.tsx          # Existing
│   │
│   ├── hooks/
│   │   ├── useAudioRecorder.ts      # Existing
│   │   ├── useTypewriter.ts         # Existing
│   │   └── usePlayhead.ts           # NEW — Tone.Transport progress tracker
│   │
│   ├── lib/
│   │   ├── toneEngine.ts            # Updated — new synths, mute/solo, export
│   │   ├── schemas.ts               # Updated — melody, keys, vocal schemas
│   │   ├── mockApiResponse.ts       # Updated — full 5-track mock
│   │   └── exportHelpers.ts         # NEW — WAV encoding + JSON download
│   │
│   └── styles/
│       └── globals.css
```

---

## 9. Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM generates out-of-key melody notes | High | Post-process: snap notes to nearest pitch in the diatonic scale of the key |
| Chord voicings from Keys agent are dissonant | Medium | Provide explicit voicing examples in prompt; Zod validation on notes array size |
| Lyrics syllable mapping misaligns with beats | Medium | Pre-process lyrics server-side: count syllables per line, pass count to Vocal agent |
| Too many sequential agent calls → slow latency | Medium | Run Bass + Drums in parallel (independent); run Melody + Keys + Vocal after Producer |
| Offline WAV render freezes the browser | Low | Use `OfflineAudioContext`; show progress; limit to 8 bars max |
| PolySynth chord scheduling causes glitches | Low | Limit to 4-note voicings; stagger attack by 5ms for natural feel |
| Mobile browser AudioContext restrictions | Medium | Gate all Tone.js init behind user gesture; call `Tone.start()` on first click |
| Large uploaded audio files | Low | Limit upload to 10MB; reject and show error if exceeded |
| LLM wraps output in markdown fences | Medium | `extractJSON()` already handles this — same approach for new agents |

---

## Implementation Priority (Hackathon Sprint)

For maximum demo impact, implement in this order:

| Priority | Phase | Est. Time | Impact |
|---|---|---|---|
| 1 | **5.1 — Input Form** | ~2h | Unlocks lyrics + text prompt (the key differentiator) |
| 2 | **5.2 — Schemas + Agents** | ~2h | Generates melody + keys tracks |
| 3 | **5.3 — Tone.js instruments** | ~1.5h | Makes new tracks audible |
| 4 | **5.4 — Production Board** | ~3h | The visual "wow factor" GarageBand UI |
| 5 | **5.5 — Export** | ~1.5h | Judges can download a WAV |
| 6 | **5.6 — Vocal track** | ~2h | Stretch goal — impressive if shipped |

> **Total estimate:** ~12 hours for all 6 sub-phases.  
> **MVP for hackathon demo:** Phases 5.1–5.4 (~8.5 hours).

---

> **Next Step:** Begin Phase 5.1 — create `InputForm.tsx` with tabbed multi-modal input and track selection.
