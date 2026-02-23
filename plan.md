# Virtual AI Band — Project Plan

> **Hackathon Project** | Next.js · DigitalOcean Gradient SDK · Web Audio API · Tone.js  
> **Status:** Planning Phase  
> **Constraint:** Pages Router only. No external backend. All server logic lives in `pages/api/`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Libraries](#2-tech-stack--libraries)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [API Route Design](#4-api-route-design)
5. [Agent Personas & System Prompts](#5-agent-personas--system-prompts)
6. [Implementation Phases](#6-implementation-phases)
7. [File & Directory Structure](#7-file--directory-structure)
8. [Key Risks & Mitigations](#8-key-risks--mitigations)

---

## 1. Project Overview

**Virtual AI Band** is a browser-native application where a human guitarist records a 30–60 second backing track (jazz, pop, or blues chord progressions) directly in the browser. The recording is sent to a Multi-Agent AI system powered by the **DigitalOcean Gradient SDK**. Three specialized agents — a **Producer**, a **Bass Player**, and a **Drummer** — collaborate in real time to analyze the uploaded audio context and co-compose an accompaniment.

The final output is twofold:
- A **"Terminal"** panel on the UI that displays the agents' inner monologue and inter-agent dialogue in a hacker-style, typewriter-effect stream.
- A **synthesized audio playback** layer built with **Tone.js** that plays the AI-generated bass and drum MIDI sequences in perfect sync with the original guitar recording.

The entire experience runs inside a single **monolithic Next.js application** — no separate backend, no external server, no Docker containers.

---

## 2. Tech Stack & Libraries

### Core Framework
| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 14+** (Pages Router) | `pages/` directory only. No App Router. |
| Language | **TypeScript** | Strict mode enabled |
| Styling | **Tailwind CSS** | Dark/hacker theme, monospace fonts |

### Frontend / Audio
| Library | Purpose |
|---|---|
| **Web Audio API** (native) | Accessing `getUserMedia`, driving `MediaRecorder` to capture microphone input |
| **Tone.js** (`tone`) | Synthesizing MIDI-like note sequences for bass and drum tracks; scheduling playback with precise timing |
| **React** (via Next.js) | Component-based UI, state management with `useState` / `useReducer` / `useRef` |

### AI / Backend
| Library | Purpose |
|---|---|
| **DigitalOcean Gradient SDK** (`@digitalocean/gradient-js` or equivalent) | Instantiating and orchestrating the Multi-Agent pipeline inside Next.js API Routes |
| **Next.js API Routes** (`pages/api/`) | Serverless-style RPC layer; isolates secrets from the client; proxies all Gradient SDK calls |

### Dev / Tooling
| Tool | Purpose |
|---|---|
| `dotenv` / `.env.local` | Secure storage of `GRADIENT_API_KEY` |
| `zod` | Runtime schema validation of AI JSON output |
| `eslint` + `prettier` | Code quality |

---

## 3. Architecture & Data Flow

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  [Mic Input] ──► MediaRecorder ──► audioBlob (WebM/OGG)        │
│                                          │                      │
│                       FormData({ audio: audioBlob })            │
│                                          │                      │
│                            POST /api/orchestrate-band           │
└──────────────────────────────────────────┼──────────────────────┘
                                           │  HTTP Request
                            ───────────────▼───────────────
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS SERVER (pages/api/)                   │
│                                                                 │
│  1. Parse multipart form, receive audioBlob                     │
│  2. Convert blob → base64 or extract metadata for LLM context  │
│  3. Instantiate Gradient SDK client (using GRADIENT_API_KEY)    │
│  4. Trigger Producer Agent with audio context + task brief      │
│  5. Producer directs Bass Agent → generates bass sequence       │
│  6. Producer directs Drum Agent → generates drum sequence       │
│  7. Agents exchange messages (logged)                           │
│  8. Aggregate: { logs[], midi_data{} }                          │
│  9. Validate output with Zod schema                             │
│  10. Return JSON response                                       │
└──────────────────────────────────────────┬──────────────────────┘
                                           │  JSON Response
                            ───────────────▼───────────────
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  [Terminal UI] ◄── logs[] ── typewriter effect (char-by-char)  │
│                                                                 │
│  [Tone.js Engine]                                               │
│    ├── Load audioBlob into AudioBuffer (guitar track)          │
│    ├── Schedule bass notes from midi_data.bass[]               │
│    └── Schedule drum hits from midi_data.drums[]               │
│                        │                                        │
│                   Tone.Transport.start()                        │
│                        │                                        │
│              [Synchronized Playback] 🎸🥁🎵                     │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Data Flow

**Step 1 — Capture**  
User clicks "Record". The browser calls `navigator.mediaDevices.getUserMedia({ audio: true })`. A `MediaRecorder` instance captures the stream and accumulates `Blob` chunks into a `audioChunks[]` array.

**Step 2 — Stop & Package**  
On "Stop", `MediaRecorder.stop()` is called. The chunks are merged into a single `Blob` (type `audio/webm;codecs=opus` or `audio/ogg`). The blob is attached to a `FormData` object.

**Step 3 — POST to API Route**  
`fetch('/api/orchestrate-band', { method: 'POST', body: formData })`. The request carries the audio blob, tempo (BPM) provided by the user, and genre selection.

**Step 4 — Server-side Processing**  
The API route handler parses the multipart body (using `formidable` or Next.js built-in body handling), extracts the audio, and constructs a structured musical context string (tempo, genre, duration, key if provided) to pass as the agent prompt.

**Step 5 — Multi-Agent Orchestration**  
The Gradient SDK spawns the agent pipeline. The Producer acts as the orchestrator, passing task definitions to Bass and Drum agents sequentially or in parallel depending on SDK capabilities.

**Step 6 — Response Assembly**  
All agent messages and tool outputs are collected into `logs[]`. The final structured outputs (note sequences) are assembled into `midi_data`. The response is validated against a Zod schema before being sent.

**Step 7 — Frontend Rendering**  
The JSON response is received. `logs` are fed into the Terminal component with a `setInterval`-based typewriter. `midi_data` is passed to the Tone.js scheduler which maps notes to synthesized instruments and fires them against `Tone.Transport`.

---

## 4. API Route Design

### Endpoint

```
POST /api/orchestrate-band
Content-Type: multipart/form-data
```

### Request Payload

| Field | Type | Description |
|---|---|---|
| `audio` | `File` (Blob) | The recorded audio file (WebM/OGG, max ~10MB) |
| `bpm` | `string` (numeric) | Tempo in beats per minute, e.g. `"120"` |
| `genre` | `string` | Musical genre: `"jazz"`, `"pop"`, `"blues"` |
| `key` | `string` (optional) | Key signature, e.g. `"C major"`, `"A minor"` |
| `durationSeconds` | `string` (numeric) | Recording length, e.g. `"45"` |

### Security — API Key Handling

The DigitalOcean Gradient API key **must never be exposed to the client**. It is loaded exclusively on the server:

```typescript
// pages/api/orchestrate-band.ts
const gradientClient = new GradientClient({
  apiKey: process.env.GRADIENT_API_KEY, // loaded from .env.local, never sent to browser
});
```

`.env.local` is git-ignored. The key is accessed only within the `pages/api/` handler scope. Next.js guarantees that `process.env` values without the `NEXT_PUBLIC_` prefix are never bundled into the client.

### Response JSON Schema

The API route must return a response conforming to this schema:

```json
{
  "success": true,
  "logs": [
    "[Producer] Analyzing track context: 120 BPM, jazz, C major, 45s duration.",
    "[Producer → Bass] Generate a walking bass line. Root notes: C, F, G, Am. Quarter-note feel.",
    "[Bass] Understood. Composing 4-bar walking bass pattern...",
    "[Bass → Producer] Done. 32 notes generated across 4 bars.",
    "[Producer → Drums] Generate a jazz ride pattern with snare on 2 and 4.",
    "[Drums] Composing ride cymbal + snare pattern for 4 bars...",
    "[Drums → Producer] Done. 64 events generated.",
    "[Producer] Compilation complete. Sending to frontend."
  ],
  "midi_data": {
    "bpm": 120,
    "total_bars": 4,
    "bass": [
      { "bar": 1, "beat": 1, "note": "C2", "duration": "4n", "velocity": 90 },
      { "bar": 1, "beat": 2, "note": "E2", "duration": "4n", "velocity": 75 },
      { "bar": 1, "beat": 3, "note": "G2", "duration": "4n", "velocity": 80 },
      { "bar": 1, "beat": 4, "note": "A2", "duration": "4n", "velocity": 70 }
    ],
    "drums": [
      { "bar": 1, "beat": 1, "instrument": "kick",   "velocity": 100 },
      { "bar": 1, "beat": 1.5, "instrument": "hihat", "velocity": 60 },
      { "bar": 1, "beat": 2,   "instrument": "snare", "velocity": 90 },
      { "bar": 1, "beat": 2.5, "instrument": "hihat", "velocity": 55 },
      { "bar": 1, "beat": 3,   "instrument": "kick",  "velocity": 85 },
      { "bar": 1, "beat": 3.5, "instrument": "hihat", "velocity": 60 },
      { "bar": 1, "beat": 4,   "instrument": "snare", "velocity": 88 },
      { "bar": 1, "beat": 4.5, "instrument": "hihat", "velocity": 55 }
    ]
  }
}
```

### Error Response Schema

```json
{
  "success": false,
  "error": "Agent pipeline failed: <reason>",
  "logs": ["[System] Fatal error encountered during Bass Agent processing."]
}
```

### Zod Validation Schema (to be implemented in `lib/schemas.ts`)

```typescript
import { z } from 'zod';

const BassNoteSchema = z.object({
  bar:      z.number().int().positive(),
  beat:     z.number().positive(),
  note:     z.string().regex(/^[A-G]#?[0-9]$/),
  duration: z.enum(['1n', '2n', '4n', '8n', '16n', '4n.']),
  velocity: z.number().min(0).max(127),
});

const DrumHitSchema = z.object({
  bar:        z.number().int().positive(),
  beat:       z.number().positive(),
  instrument: z.enum(['kick', 'snare', 'hihat', 'ride', 'crash', 'tom']),
  velocity:   z.number().min(0).max(127),
});

export const BandOutputSchema = z.object({
  success:  z.literal(true),
  logs:     z.array(z.string()),
  midi_data: z.object({
    bpm:        z.number().positive(),
    total_bars: z.number().int().positive(),
    bass:       z.array(BassNoteSchema),
    drums:      z.array(DrumHitSchema),
  }),
});
```

### API Route Config

```typescript
// Required to handle multipart/form-data (disable default body parser)
export const config = {
  api: {
    bodyParser: false,
  },
};
```

---

## 5. Agent Personas & System Prompts

All agents are instantiated via the DigitalOcean Gradient SDK. Each agent has a fixed **System Prompt** that constrains its role and output format.

---

### Agent 1: The Producer

**Role:** Orchestrator. Receives the full musical context, decomposes the task, assigns work to Bass and Drum agents, and assembles the final output.

**System Prompt Logic:**
```
You are "The Producer", an expert music arranger and band director AI.
You receive a musical context (tempo, genre, key, duration) and coordinate
a bass player and a drummer to generate a tight accompaniment.

Your responsibilities:
1. Analyze the context and determine the harmonic structure and feel.
2. Send a clear, specific directive to the Bass Agent describing the walking 
   bass line or groove needed (root notes, rhythm feel, style).
3. Send a clear, specific directive to the Drum Agent describing the groove 
   pattern needed (ride pattern, snare placement, kick pattern).
4. Collect their outputs and verify they are musically coherent.
5. Return a synthesis in the final structured JSON format.

Always respond with structured reasoning. Begin each message with your agent 
tag: [Producer].
```

---

### Agent 2: The Bass Player

**Role:** Generates the bass note sequence in response to the Producer's directive.

**System Prompt Logic:**
```
You are "The Bass Player", a professional session bassist AI specializing in 
jazz, pop, and blues walking bass lines and grooves.

When given a directive from The Producer, you must:
1. Compose a musically appropriate bass line matching the tempo, key, and style.
2. Output your result as a strict JSON array of note objects.
3. Each note object must have: bar (int), beat (float), note (e.g. "C2"), 
   duration (Tone.js format: "4n", "8n"), velocity (0-127).
4. Generate exactly enough notes to fill the requested number of bars.
5. Begin all messages with your agent tag: [Bass].

Do NOT include any prose outside the JSON array in your final answer.
Output format:
[{ "bar": 1, "beat": 1, "note": "C2", "duration": "4n", "velocity": 90 }, ...]
```

---

### Agent 3: The Drummer

**Role:** Generates the drum hit sequence in response to the Producer's directive.

**System Prompt Logic:**
```
You are "The Drummer", a professional session drummer AI specializing in 
tight, musical grooves across jazz, pop, and blues styles.

When given a directive from The Producer, you must:
1. Compose a rhythmically appropriate drum pattern matching the tempo and style.
2. Output your result as a strict JSON array of drum hit objects.
3. Each hit object must have: bar (int), beat (float), instrument 
   (one of: "kick", "snare", "hihat", "ride", "crash", "tom"), velocity (0-127).
4. Generate exactly enough hits to fill the requested number of bars.
5. Begin all messages with your agent tag: [Drums].

Do NOT include any prose outside the JSON array in your final answer.
Output format:
[{ "bar": 1, "beat": 1, "instrument": "kick", "velocity": 100 }, ...]
```

---

### Agent Interaction Model

```
┌──────────────────────────────────────────────────┐
│                  GRADIENT SDK                    │
│                                                  │
│  [Context + Task]                                │
│        │                                         │
│        ▼                                         │
│  ┌─────────────┐   directive    ┌─────────────┐  │
│  │  Producer   │ ─────────────► │ Bass Agent  │  │
│  │   Agent     │ ◄───────────── │             │  │
│  │             │   bass JSON    └─────────────┘  │
│  │             │                                  │
│  │             │   directive    ┌─────────────┐  │
│  │             │ ─────────────► │ Drum Agent  │  │
│  │             │ ◄───────────── │             │  │
│  └─────────────┘   drum JSON    └─────────────┘  │
│        │                                         │
│        ▼                                         │
│  { logs[], midi_data{} }                         │
└──────────────────────────────────────────────────┘
```

---

## 6. Implementation Phases

---

### Phase 1: Project Setup, UI Shell & Web Audio Recording

**Goal:** Have a working UI with audio recording capability. No AI integration yet.

#### Steps

1. **Install dependencies**
   ```bash
   npm install tone zod formidable
   npm install -D @types/formidable
   ```

2. **Configure Tailwind** for a dark, monospace, hacker aesthetic.
   - Background: `#0a0a0a` or `zinc-950`
   - Accent: green (`green-400`) for terminal text
   - Monospace font: `JetBrains Mono` or `Fira Code` via Google Fonts

3. **Build the main page layout** (`pages/index.tsx`)
   - **Left Panel:** "Studio" — Record button, waveform visualizer (canvas), BPM/Genre/Key controls, playback of recorded audio.
   - **Right Panel:** "Terminal" — Scrollable log output area, status badges (IDLE / RECORDING / PROCESSING / PLAYING).

4. **Implement `useAudioRecorder` hook** (`hooks/useAudioRecorder.ts`)
   - Call `navigator.mediaDevices.getUserMedia({ audio: true })`
   - Initialize `MediaRecorder` with `audio/webm;codecs=opus`
   - Accumulate `ondataavailable` chunks into a ref
   - On stop: merge chunks into a `Blob`, create an object URL, expose `audioBlob` and `audioUrl` to the component
   - Expose: `startRecording()`, `stopRecording()`, `audioBlob`, `audioUrl`, `isRecording`, `durationSeconds`

5. **Implement Waveform Visualizer**
   - Use `AnalyserNode` from Web Audio API
   - `requestAnimationFrame` loop draws the waveform on a `<canvas>` element in real time during recording

6. **Manual playback test:** User should be able to record and hear their guitar back through an `<audio>` element.

---

### Phase 2: Tone.js Engine & Mock API Integration

**Goal:** Build the entire playback engine and UI rendering pipeline against a hardcoded mock response. This phase makes Phase 4 trivial and lets you demo the full experience without burning API credits.

#### Steps

1. **Create the Tone.js engine** (`lib/toneEngine.ts`)

   ```typescript
   // lib/toneEngine.ts
   import * as Tone from 'tone';

   // Bass synthesizer: sawtooth wave with envelope
   const bassSynth = new Tone.Synth({
     oscillator: { type: 'sawtooth' },
     envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.5 },
   }).toDestination();

   // Drum sampler: use Tone.MembraneSynth for kick, MetalSynth for hihat
   const kickSynth  = new Tone.MembraneSynth().toDestination();
   const snareSynth = new Tone.NoiseSynth({ envelope: { decay: 0.1 } }).toDestination();
   const hihatSynth = new Tone.MetalSynth({ envelope: { decay: 0.05 } }).toDestination();

   export function scheduleBand(midiData: BandMidiData) {
     Tone.Transport.cancel(); // clear previous schedule
     Tone.Transport.bpm.value = midiData.bpm;

     midiData.bass.forEach(note => {
       const time = `${note.bar - 1}:${note.beat - 1}:0`;
       Tone.Transport.schedule(t => {
         bassSynth.triggerAttackRelease(note.note, note.duration, t, note.velocity / 127);
       }, time);
     });

     midiData.drums.forEach(hit => {
       const time = `${hit.bar - 1}:${hit.beat - 1}:0`;
       Tone.Transport.schedule(t => {
         if (hit.instrument === 'kick')  kickSynth.triggerAttackRelease('C1', '8n', t);
         if (hit.instrument === 'snare') snareSynth.triggerAttackRelease('8n', t);
         if (hit.instrument === 'hihat') hihatSynth.triggerAttackRelease('16n', t);
       }, time);
     });
   }

   export async function startPlayback(audioBlob: Blob) {
     await Tone.start(); // must be called after user gesture
     const arrayBuffer = await audioBlob.arrayBuffer();
     const audioBuffer = await Tone.getContext().rawContext.decodeAudioData(arrayBuffer);
     const player = new Tone.Player(audioBuffer).toDestination();
     player.sync().start(0);
     Tone.Transport.start();
   }
   ```

2. **Create a mock API fixture** (`lib/mockApiResponse.ts`)  
   Hardcode a full valid response matching the JSON schema from Section 4. This is what the frontend will use during Phase 2.

3. **Build the Terminal UI component** (`components/AgentTerminal.tsx`)
   - Receives `logs: string[]` prop
   - Uses a `useEffect` + `setInterval` to reveal characters one-by-one (typewriter effect)
   - Green text (`text-green-400`) on dark background, auto-scrolls to bottom
   - Shows a blinking cursor `█` at the end of the current line

4. **Wire it all together in `pages/index.tsx`** using the mock data:
   - "Generate Band" button → calls `scheduleBand(mockData.midi_data)`
   - Simultaneously starts the Terminal typewriter with `mockData.logs`
   - "Play" button → calls `startPlayback(audioBlob)`

5. **End of Phase 2 checkpoint:** Full demo-able experience with zero API calls.

---

### Phase 3: Next.js API Route & DigitalOcean Gradient SDK Integration

**Goal:** Replace the mock with real AI. Build `pages/api/orchestrate-band.ts`.

#### Steps

1. **Add environment variable**
   ```bash
   # .env.local
   GRADIENT_API_KEY=your_do_gradient_api_key_here
   ```

2. **Research and install the Gradient SDK**
   ```bash
   npm install @digitalocean/gradient-js  
   # (or the correct package name per DigitalOcean docs)
   ```

3. **Create `pages/api/orchestrate-band.ts`**

   ```typescript
   import type { NextApiRequest, NextApiResponse } from 'next';
   import formidable from 'formidable';
   import { GradientClient } from '@digitalocean/gradient-js';
   import { BandOutputSchema } from '../../lib/schemas';

   export const config = { api: { bodyParser: false } };

   export default async function handler(req: NextApiRequest, res: NextApiResponse) {
     if (req.method !== 'POST') return res.status(405).end();

     // 1. Parse form data
     const form = formidable({});
     const [fields] = await form.parse(req);
     const bpm    = Number(fields.bpm?.[0] ?? 120);
     const genre  = fields.genre?.[0] ?? 'jazz';
     const key    = fields.key?.[0] ?? 'C major';
     const duration = Number(fields.durationSeconds?.[0] ?? 30);

     // 2. Build musical context string for the Producer
     const musicalContext = `
       BPM: ${bpm}, Genre: ${genre}, Key: ${key}, Duration: ${duration}s.
       Generate a 4-bar accompaniment (bass + drums).
     `;

     // 3. Initialize Gradient client
     const client = new GradientClient({ apiKey: process.env.GRADIENT_API_KEY });

     // 4. Orchestrate agents (pseudo-code — adapt to actual Gradient SDK API)
     const logs: string[] = [];

     const producerResult = await client.agents.run('producer-agent-id', {
       messages: [{ role: 'user', content: musicalContext }],
       onMessage: (msg: string) => logs.push(msg),
     });

     // 5. Parse and validate
     const parsed = BandOutputSchema.safeParse({
       success: true,
       logs,
       midi_data: JSON.parse(producerResult.output),
     });

     if (!parsed.success) {
       return res.status(500).json({ success: false, error: 'Invalid agent output', logs });
     }

     return res.status(200).json(parsed.data);
   }
   ```

4. **Create agent configurations** in DigitalOcean Gradient dashboard:
   - Define Producer, Bass, and Drum agents with their system prompts from Section 5.
   - Note their agent IDs and store them in `.env.local`.

5. **Handle streaming (optional enhancement):**  
   If the Gradient SDK supports streaming responses, consider using a streaming API route and `ReadableStream` to push logs to the frontend progressively rather than waiting for the full response. This dramatically improves perceived performance.

---

### Phase 4: Audio Sync, JSON Parsing, and UI Polish

**Goal:** Synchronize the guitar recording with generated MIDI, handle edge cases, and polish the hacker UI.

#### Steps

1. **Replace mock with real API call** in `pages/index.tsx`
   ```typescript
   const formData = new FormData();
   formData.append('audio', audioBlob, 'recording.webm');
   formData.append('bpm', String(bpm));
   formData.append('genre', genre);
   formData.append('key', selectedKey);
   formData.append('durationSeconds', String(durationSeconds));

   const response = await fetch('/api/orchestrate-band', {
     method: 'POST',
     body: formData,
   });
   const data = await response.json();
   ```

2. **Synchronize Tone.js with guitar audio**
   - Decode the recorded `audioBlob` into an `AudioBuffer`
   - Load it into a `Tone.Player`, attach it to `Tone.Transport` via `.sync().start(0)`
   - Call `scheduleBand(data.midi_data)` to schedule bass and drums
   - `Tone.Transport.start()` fires everything simultaneously — guitar, bass, drums

3. **Tone.js timing precision:**
   - Use `Tone.Transport.schedule()` with Tone's bar:beat:sixteenth notation
   - Convert `(bar, beat)` from `midi_data` → `"${bar-1}:${beat-1}:0"` (Tone uses 0-indexed bars)
   - Ensure `Tone.Transport.bpm.value` is set to `midi_data.bpm` before scheduling

4. **Terminal typewriter effect polish** (`components/AgentTerminal.tsx`)
   - Each log line appears character by character at ~30ms/char interval
   - Color-code agent tags: `[Producer]` in yellow, `[Bass]` in cyan, `[Drums]` in magenta
   - Blinking cursor between lines
   - Auto-scroll to the latest line using a `bottomRef` and `scrollIntoView()`

5. **Loading state & UX**
   - While API is processing: show a pulsing spinner or animated "Thinking..." in the terminal
   - Disable the "Generate" button during processing
   - Show status badges: `● IDLE` → `● RECORDING` → `● PROCESSING` → `● READY` → `● PLAYING`

6. **Error handling**
   - If the API returns `success: false`, display the error in the terminal in red
   - Provide a "Retry" button that re-sends the same audio blob

7. **Volume controls**
   - Independent gain nodes for guitar, bass, and drums using `Tone.Volume`
   - Three sliders in the UI for mix control

8. **Transport controls**
   - Play / Pause / Stop buttons
   - `Tone.Transport.pause()` / `Tone.Transport.stop()` (stop also calls `Tone.Transport.cancel()` to clear schedule)

---

## 7. File & Directory Structure

Target project structure upon completion:

```
my-ai-band/
├── .env.local                    # GRADIENT_API_KEY (git-ignored)
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── plan.md                       # This document
│
├── public/
│   └── fonts/                    # JetBrains Mono if self-hosted
│
├── src/
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── index.tsx             # Main app page
│   │   └── api/
│   │       └── orchestrate-band.ts  # The core API route
│   │
│   ├── components/
│   │   ├── StudioPanel.tsx       # Recording controls, waveform canvas, playback
│   │   ├── AgentTerminal.tsx     # Typewriter terminal log display
│   │   ├── TransportControls.tsx # Play/Pause/Stop + volume sliders
│   │   └── StatusBadge.tsx       # IDLE/RECORDING/PROCESSING/PLAYING indicator
│   │
│   ├── hooks/
│   │   ├── useAudioRecorder.ts   # MediaRecorder abstraction
│   │   └── useTypewriter.ts      # Character-by-character text reveal
│   │
│   ├── lib/
│   │   ├── toneEngine.ts         # Tone.js synth setup + scheduleBand() + startPlayback()
│   │   ├── schemas.ts            # Zod schemas for API response validation
│   │   └── mockApiResponse.ts    # Hardcoded mock for Phase 2 testing
│   │
│   └── styles/
│       └── globals.css
```

---

## 8. Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gradient SDK produces malformed JSON from agents | Medium | Zod validation + retry logic with a fallback to mock data |
| LLM hallucination generates out-of-range note names | Medium | Regex validation in Zod schema; clamp `velocity` 0–127 |
| Audio sync drift between guitar and Tone.js | Medium | Both driven by `Tone.Transport`; ensure `Tone.start()` is called before loading `AudioBuffer` |
| `getUserMedia` permission denied | Low | Catch `NotAllowedError`, show clear UI prompt explaining mic access requirement |
| Large audio blob causes API route timeout (Vercel 10s limit) | High | Compress audio before upload; do NOT send the audio blob to the LLM (only send metadata: BPM, genre, key, duration); keep API route fast |
| `formidable` incompatibility with Next.js edge runtime | Low | Ensure API route uses **Node.js runtime** (default for Pages Router), not Edge runtime |
| Tone.js `AudioContext` suspended on load | Low | Always call `Tone.start()` inside a user gesture handler (click/tap event) |

---

> **Next Step:** Begin Phase 1 implementation. Start with `npm install`, Tailwind dark theme config, and the `useAudioRecorder` hook.
