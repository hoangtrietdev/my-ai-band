import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { ProducerDirectiveSchema, MidiDataSchema, MidiData } from '@/lib/schemas';

/**
 * Disable the default body parser so formidable can handle multipart/form-data.
 */
export const config = {
  api: { bodyParser: false },
};

// ─── Feature Flag ─────────────────────────────────────────────────────────────

const IS_GROQ = process.env.IS_GROQ === 'true';

// ─── Client factory ────────────────────────────────────────────────────────────

type AIClient = OpenAI | Groq;

interface ClientBundle {
  client: AIClient;
  model:  string;
}

function getClient(): ClientBundle {
  if (IS_GROQ) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('IS_GROQ=true but GROQ_API_KEY is not set.');
    const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    return { client: new Groq({ apiKey }), model };
  }
  const apiKey  = process.env.GRADIENT_API_KEY;
  const baseURL = process.env.GRADIENT_BASE_URL ?? 'https://api.openai.com/v1';
  if (!apiKey) throw new Error('GRADIENT_API_KEY is not set.');
  const model = process.env.GRADIENT_MODEL ?? 'gpt-4o-mini';
  return { client: new OpenAI({ apiKey, baseURL }), model };
}

// ─── Genre music theory guide ──────────────────────────────────────────────────

function genreGuide(genre: string, key: string): string {
  const g = genre.toLowerCase();
  if (g === 'jazz') return `
JAZZ GUIDE for ${key}:
• Chord progression: ii-V-I-vi in ${key}. Example C major: Dm7→G7→Cmaj7→Am7
• Bass (WALKING): ONE note per beat (4 per bar), moving stepwise through chord tones.
  Example in C (bar1=Dm7): D2→F2→A2→C3. Each bar starts on the chord ROOT.
• Drums (SWING): ride on beats 1,2,3,4 every bar. Snare on 2&4. Kick on 1&3 lightly.
  Per-bar minimum: 4 ride + 2 snare + 2 kick = 8 events.`;
  if (g === 'blues') return `
BLUES GUIDE for ${key}:
• Chord progression: I7 for 4 bars (shuffle all on tonic). Example C blues: C7,C7,C7,C7
• Bass (SHUFFLE): Root-fifth walk with blue note. Example C: C2→E2→G2→Bb2 per bar.
• Drums (SHUFFLE): hihat on 1,2,3,4. Kick on 1&3. Snare on 2&4.
  Per-bar minimum: 4 hihat + 2 snare + 2 kick = 8 events.`;
  if (g === 'funk') return `
FUNK GUIDE for ${key}:
• Chord progression: I7-IV7-I7-V7 in ${key}. Tight dominant 7ths.
• Bass (16TH FUNK): Syncopated. Beat 1=root, beat 2.5=fifth, beat 3=root, beat 3.5=fifth.
  Example C: C2@1, G2@2.5, C2@3, G2@3.5. Only 4 notes per bar with those exact beats.
• Drums (16TH FUNK): hihat every 0.5 beat (1,1.5,2,2.5,3,3.5,4,4.5). Kick on 1&3.5. Snare on 2&4.
  Per-bar minimum: 8 hihat + 2 snare + 2 kick = 12 events.`;
  if (g === 'bossa nova') return `
BOSSA NOVA GUIDE for ${key}:
• Chord progression: Imaj7-vi7-ii7-V7 in ${key}. Smooth jazz harmony.
• Bass (MINIMAL): Only 2 notes per bar. Beat 1=root (half note), beat 3=fifth (half note).
  Example C: C2@1 dur:2n, G2@3 dur:2n. Repeat same pattern each bar.
• Drums (BOSSA CLAVE): hihat on beat 1. Snare/rim on beat 2. Snare/rim on beat 3.5.
  Per-bar: hihat@1 + snare@2 + snare@3.5 = 3 events per bar (very sparse!).`;
  return `
POP GUIDE for ${key}:
• Chord progression: I-V-vi-IV in ${key}. Example C: C→G→Am→F
• Bass (ROOT-MOTION): Root on beat 1 (half note), root again on beat 3 (half note).
  Simple and locked. Example C: C2@1 dur:2n, C2@3 dur:2n.
• Drums (4-ON-FLOOR): hihat on beats 1,2,3,4. Kick on 1&3. Snare on 2&4.
  Per-bar minimum: 4 hihat + 2 kick + 2 snare = 8 events.`;
}

// ─── Improved system prompts ──────────────────────────────────────────────────

const PRODUCER_SYSTEM = `
You are "The Producer" — a professional music arranger AI.

Your ONLY output is a single JSON object — no markdown, no code fences, no prose before or after:
{
  "producer_logs": [
    "[Producer] Analyzing 120 BPM jazz in C major...",
    "[Producer] Choosing ii-V-I-vi: Dm7→G7→Cmaj7→Am7",
    "[Producer → Bass] Walk chord tones, root on beat 1 each bar.",
    "[Producer → Drums] Jazz ride groove, snare 2&4, kick 1&3."
  ],
  "bass_directive": "Play walking quarter notes. Bar1=Dm7: D2 F2 A2 C3. Bar2=G7: G2 B2 D3 F2. Bar3=Cmaj7: C2 E2 G2 B2. Bar4=Am7: A2 C3 E3 G2.",
  "drums_directive": "Ride on beats 1,2,3,4 every bar. Snare on beat 2 and beat 4. Kick on beat 1 and beat 3. Repeat same pattern all 4 bars.",
  "melody_directive": "Play a lyrical melody outlining Dm7→G7→Cmaj7→Am7 in octave 4-5. Mix stepwise motion with small leaps.",
  "keys_directive": "Comp with 7th-chord voicings: Dm7, G7, Cmaj7, Am7. Half-note rhythm, smooth voice leading.",
  "vocal_directive": "Sing the lyrics over the changes. Emphasize downbeats. Leave breathing gaps.",
  "chord_roots": ["D", "G", "C", "A"],
  "feel": "swing"
}

RULES:
1. chord_roots = EXACTLY one root per bar — only the ROOT LETTER (no "m", no "maj7").
2. feel must be exactly one of: swing, straight, shuffle, bossa nova, 16th funk
3. bass_directive: include ACTUAL note names (e.g. "D2 F2 A2 C3") for every bar.
4. drums_directive: include ACTUAL beat numbers for kick, snare, hihat/ride.
5. melody_directive: include guidance about octave range, melodic motion, and key note targets. If not requested, set to empty string "".
6. keys_directive: include chord voicings and rhythm guidance. If not requested, set to empty string "".
7. vocal_directive: include syllable mapping hints if lyrics are provided. If not requested, set to empty string "".
8. producer_logs: 4 entries exactly as shown above format.
9. DO NOT output anything except the JSON object.
`.trim();

const BASS_SYSTEM = `
You are "The Bass Player" — a professional session bassist AI.

Your ONLY output is this exact JSON structure. No markdown, no explanation, no text outside the JSON:
{"data":[
  {"bar":1,"beat":1,"note":"D2","duration":"4n","velocity":90},
  {"bar":1,"beat":2,"note":"F2","duration":"4n","velocity":78},
  {"bar":1,"beat":3,"note":"A2","duration":"4n","velocity":82},
  {"bar":1,"beat":4,"note":"C3","duration":"4n","velocity":72},
  {"bar":2,"beat":1,"note":"G2","duration":"4n","velocity":92},
  {"bar":2,"beat":2,"note":"B2","duration":"4n","velocity":76},
  {"bar":2,"beat":3,"note":"D3","duration":"4n","velocity":80},
  {"bar":2,"beat":4,"note":"F2","duration":"4n","velocity":70},
  {"bar":3,"beat":1,"note":"C2","duration":"4n","velocity":95},
  {"bar":3,"beat":2,"note":"E2","duration":"4n","velocity":74},
  {"bar":3,"beat":3,"note":"G2","duration":"4n","velocity":80},
  {"bar":3,"beat":4,"note":"B2","duration":"4n","velocity":68},
  {"bar":4,"beat":1,"note":"A2","duration":"4n","velocity":90},
  {"bar":4,"beat":2,"note":"C3","duration":"4n","velocity":75},
  {"bar":4,"beat":3,"note":"E3","duration":"4n","velocity":78},
  {"bar":4,"beat":4,"note":"G2","duration":"4n","velocity":70}
]}

STRICT RULES (follow exactly):
1. Output EXACTLY 16 note objects total (4 per bar, beats 1-2-3-4).
2. bar: integer 1, 2, 3, or 4 only.
3. beat: 1, 2, 3, or 4 for walking/pop/blues/jazz. For funk: use 1, 2.5, 3, 3.5. For bossa nova: 1 and 3 only (8 total notes, duration "2n").
4. note: letter + optional # + octave digit. Valid: "C2" "Eb2" "F#2" "Bb2" "G3". Bass lives in octave 2.
5. duration: "4n" "2n" "8n" "4n." "8n." only.
6. velocity: integer 70-105.
7. Every bar starts on beat 1 with the chord root.
8. DO NOT write anything outside the JSON.
`.trim();

const DRUMS_SYSTEM = `
You are "The Drummer" — a professional session drummer AI.

Your ONLY output is this exact JSON structure. No markdown, no explanation, no text outside the JSON:
{"data":[
  {"bar":1,"beat":1,"instrument":"kick","velocity":110},
  {"bar":1,"beat":1,"instrument":"hihat","velocity":80},
  {"bar":1,"beat":2,"instrument":"hihat","velocity":75},
  {"bar":1,"beat":2,"instrument":"snare","velocity":100},
  {"bar":1,"beat":3,"instrument":"kick","velocity":105},
  {"bar":1,"beat":3,"instrument":"hihat","velocity":75},
  {"bar":1,"beat":4,"instrument":"hihat","velocity":72},
  {"bar":1,"beat":4,"instrument":"snare","velocity":98},
  {"bar":2,"beat":1,"instrument":"kick","velocity":110},
  {"bar":2,"beat":1,"instrument":"hihat","velocity":80},
  ... (same pattern repeated for bars 2, 3, 4)
]}

STRICT RULES (follow exactly):
1. Generate between 32 and 48 drum hit objects total (8-12 per bar × 4 bars).
2. bar: integer 1, 2, 3, or 4 only.
3. beat: 1, 1.5, 2, 2.5, 3, 3.5, 4, or 4.5 only. NEVER 5 or higher.
4. instrument: ONLY one of: "kick" "snare" "hihat" "ride" "crash" "tom".
5. velocity: integer 65-127.
6. EVERY bar MUST have ALL of the following:
   - kick on beat 1 (mandatory)
   - snare on beat 2 (mandatory backbeat)
   - snare on beat 4 (mandatory backbeat)
   - hihat or ride on beats 1, 2, 3, 4 (mandatory clock)
7. Bars 2, 3, 4 must be IDENTICAL copies of bar 1.
8. DO NOT write anything outside the JSON.
`.trim();

// ─── NEW AGENT PROMPTS ──────────────────────────────────────────────────────

const MELODY_SYSTEM = `
You are "The Melodist" — a professional lead instrumentalist AI.

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
`.trim();

const KEYS_SYSTEM = `
You are "The Keys Player" — a professional keyboard/piano AI.

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
`.trim();

const VOCAL_SYSTEM = `
You are "The Vocalist" — a professional singer AI.

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
6. syllable: one syllable per note. If lyrics are given, use syllables from the lyrics in order. If not, use "la", "da", "ooh", "aah", "mmm".
7. Leave breathing gaps between phrases (don't fill every beat).
8. DO NOT write anything outside the JSON.
`.trim();

// ─── JSON extraction helper ──────────────────────────────────────────────────
// Handles cases where the model wraps JSON in markdown fences or adds prose

function extractJSON(raw: string): string {
  const s = raw.trim();
  // 1. Try direct parse first
  try { JSON.parse(s); return s; } catch {}
  // 2. Strip ```json ... ``` or ``` ... ``` fences
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { JSON.parse(fenced[1].trim()); return fenced[1].trim(); } catch {}
  }
  // 3. Extract outermost { ... }
  const objStart = s.indexOf('{');
  const objEnd   = s.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const slice = s.slice(objStart, objEnd + 1);
    try { JSON.parse(slice); return slice; } catch {}
  }
  // 4. Extract outermost [ ... ]
  const arrStart = s.indexOf('[');
  const arrEnd   = s.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    const slice = s.slice(arrStart, arrEnd + 1);
    try { JSON.parse(slice); return slice; } catch {}
  }
  return s; // return raw and let caller throw a descriptive error
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

type SSEEvent =
  | { type: 'log';      line:  string }
  | { type: 'progress'; step:  number; label: string }
  | { type: 'result';   midi_data: MidiData }
  | { type: 'error';    error: string };

function sse(res: NextApiResponse, event: SSEEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── AI call helpers ──────────────────────────────────────────────────────────

async function callAgent(
  client: AIClient,
  systemPrompt: string,
  userMessage: string,
  model: string,
): Promise<string> {
  // NOTE: response_format is intentionally omitted — not supported by all providers
  // (e.g. Digital Ocean Llama endpoints). We rely on prompt engineering + extractJSON.
  const completion = await (client as OpenAI).chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.3,
    max_tokens:  2048,
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  return extractJSON(raw);
}

async function callArrayAgent(
  client: AIClient,
  systemPrompt: string,
  userMessage: string,
  model: string,
): Promise<string> {
  const wrapped = systemPrompt + '\n\nFINAL REMINDER: Output ONLY the JSON object {"data":[...]}. No text before or after.';
  // NOTE: response_format omitted — not universally supported
  const completion = await (client as OpenAI).chat.completions.create({
    model,
    messages: [
      { role: 'system', content: wrapped     },
      { role: 'user',   content: userMessage },
    ],
    temperature: 0.2,
    max_tokens:  3500,
  });
  const raw    = extractJSON(completion.choices[0]?.message?.content ?? '{"data":[]}')
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Agent returned non-JSON: ${raw.slice(0, 300)}`);
  }
  if (Array.isArray(parsed))                          return JSON.stringify(parsed);
  if (parsed && Array.isArray((parsed as {data?: unknown}).data)) return JSON.stringify((parsed as {data: unknown[]}).data);
  throw new Error(`Agent JSON missing "data" array. Got: ${raw.slice(0, 300)}`);
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache, no-transform');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    // 1. Parse form
    const form     = formidable({ maxFileSize: 15 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const bpm      = Number(fields.bpm?.[0]            ?? 120);
    const genre    =        fields.genre?.[0]           ?? 'jazz';
    const key      =        fields.key?.[0]             ?? 'C major';
    const duration = Number(fields.durationSeconds?.[0] ?? 30);
    const bars     = Math.min(Math.max(Number(fields.bars?.[0] ?? 4), 2), 16);
    const lyrics   =        fields.lyrics?.[0]          ?? '';
    const prompt   =        fields.prompt?.[0]          ?? '';
    const requestedTracks = (fields.tracks?.[0] ?? 'bass,drums').split(',').map(s => s.trim()).filter(Boolean);
    const hasAudio = !!(files.audio && files.audio.length > 0);

    // Validate at least one input
    if (!hasAudio && !lyrics && !prompt) {
      sse(res, { type: 'error', error: 'Please provide audio, lyrics, or a text prompt.' });
      res.end();
      return;
    }

    // Determine total steps for progress
    let totalSteps = 3; // producer + compile + always bass&drums
    if (requestedTracks.includes('melody')) totalSteps++;
    if (requestedTracks.includes('keys'))   totalSteps++;
    if (requestedTracks.includes('vocal'))  totalSteps++;

    // Log session header
    sse(res, { type: 'log', line: `[System] ──────── SESSION START ────────────────────` });
    sse(res, { type: 'log', line: `[System] BPM: ${bpm}  |  Genre: ${genre.toUpperCase()}  |  Key: ${key}` });
    sse(res, { type: 'log', line: `[System] Duration: ${duration}s  |  Bars: ${bars}  |  Loop: ON` });
    sse(res, { type: 'log', line: `[System] AI backend: ${IS_GROQ ? 'Groq (' + (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile') + ')' : 'OpenAI (' + (process.env.GRADIENT_MODEL ?? 'gpt-4o-mini') + ')'}` });
    sse(res, { type: 'log', line: `[System] ─────────────────────────────────────────────` });

    // 2. Build context
    const guide = genreGuide(genre, key);
    const briefParts = [
      `TASK: Arrange a tight ${bars}-bar loop for a solo guitarist to improvise over.`,
      `This pattern will LOOP continuously, so it must be consistent and groovy.`,
      ``,
      `SESSION:`,
      `- Tempo: ${bpm} BPM`,
      `- Genre: ${genre}`,
      `- Key: ${key}`,
      `- Duration: ~${duration}s per pass`,
      `- Requested tracks: ${requestedTracks.join(', ')}`,
    ];
    if (lyrics) {
      briefParts.push('', `LYRICS (use these to shape melody, vocal phrasing, and overall mood):`, lyrics);
    }
    if (prompt) {
      briefParts.push('', `USER DIRECTION: ${prompt}`);
    }
    if (hasAudio) {
      briefParts.push('', `Audio recording provided (${duration}s).`);
    }
    briefParts.push('', guide, '', `Produce an arrangement that sounds like real ${genre} music — locked rhythm section, clear harmony.`);
    const musicalContext = briefParts.join('\n');

    const { client, model } = getClient();

    // ── STEP 1: Producer ──────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: 1, label: 'Producer analyzing session...' });
    sse(res, { type: 'log',      line:  `[Producer] Analyzing ${genre} @ ${bpm} BPM in ${key}...` });

    const producerRaw = await callAgent(client, PRODUCER_SYSTEM, musicalContext, model);

    let directive;
    try {
      directive = ProducerDirectiveSchema.parse(JSON.parse(producerRaw));
    } catch {
      throw new Error(`Producer returned invalid JSON: ${producerRaw.slice(0, 300)}`);
    }

    directive.producer_logs.forEach((l: string) => sse(res, { type: 'log', line: l }));
    sse(res, { type: 'log', line: `[Producer] Chords: ${directive.chord_roots.join(' → ')} | Feel: ${directive.feel}` });

    let currentStep = 2;

    // ── STEP 2: Bass ──────────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: currentStep, label: 'Bass Player composing groove...' });
    sse(res, { type: 'log',      line:  `[Producer → Bass] ${directive.bass_directive.slice(0, 100)}...` });

    const bassUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${key} | ${bpm} BPM | Feel: ${directive.feel}
CHORD ROOTS: Bar1=${directive.chord_roots[0]}, Bar2=${directive.chord_roots[1]}, Bar3=${directive.chord_roots[2]}, Bar4=${directive.chord_roots[3]}

DIRECTIVE: ${directive.bass_directive}

${guide}

REQUIREMENT: Generate EXACTLY 16 note objects in {"data":[...]} format.
- Bar1 beat1 MUST be {"bar":1,"beat":1,"note":"${directive.chord_roots[0]}2","duration":"4n","velocity":90}
- Bar2 beat1 MUST be {"bar":2,"beat":1,"note":"${directive.chord_roots[1]}2","duration":"4n","velocity":90}
- Bar3 beat1 MUST be {"bar":3,"beat":1,"note":"${directive.chord_roots[2]}2","duration":"4n","velocity":90}
- Bar4 beat1 MUST be {"bar":4,"beat":1,"note":"${directive.chord_roots[3]}2","duration":"4n","velocity":90}

Output ONLY the JSON. No explanation.`.trim();

    const bassRaw = await callArrayAgent(client, BASS_SYSTEM, bassUserPrompt, model);
    sse(res, { type: 'log', line: `[Bass] Bass line locked — ${directive.feel} groove in ${key}.` });
    currentStep++;

    // ── STEP 3: Drums ─────────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: currentStep, label: 'Drummer building the beat...' });
    sse(res, { type: 'log',      line:  `[Producer → Drums] ${directive.drums_directive.slice(0, 100)}...` });

    const drumsUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${bpm} BPM | Feel: ${directive.feel}

DIRECTIVE: ${directive.drums_directive}

${guide}

REQUIREMENT: Generate exactly 32-48 hit objects in {"data":[...]} format.
Every single bar MUST contain:
  - {"instrument":"kick"} on beat 1
  - {"instrument":"snare"} on beat 2
  - {"instrument":"snare"} on beat 4
  - {"instrument":"hihat"} (or "ride") on beats 1, 2, 3, 4
Bars 2, 3, 4 must be IDENTICAL to bar 1.

Output ONLY the JSON. No explanation.`.trim();

    const drumsRaw = await callArrayAgent(client, DRUMS_SYSTEM, drumsUserPrompt, model);
    sse(res, { type: 'log', line: `[Drums] Beat locked — consistent backbeat with ${directive.feel} feel.` });
    currentStep++;

    // ── STEP: Melody (conditional) ──────────────────────────────────────────
    let melodyRaw: string | null = null;
    if (requestedTracks.includes('melody')) {
      sse(res, { type: 'progress', step: currentStep, label: 'Melodist composing lead...' });
      const melodyDirective = directive.melody_directive || `Play a lyrical melody in ${key} over ${directive.chord_roots.join('→')} in octave 4-5.`;
      sse(res, { type: 'log', line: `[Producer → Melody] ${melodyDirective.slice(0, 100)}...` });

      const melodyUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${key} | ${bpm} BPM | Feel: ${directive.feel}
CHORD ROOTS: Bar1=${directive.chord_roots[0]}, Bar2=${directive.chord_roots[1]}, Bar3=${directive.chord_roots[2]}, Bar4=${directive.chord_roots[3]}

DIRECTIVE: ${melodyDirective}

${guide}

REQUIREMENT: Generate 16-32 note objects in {"data":[...]} format. Notes in octave 4-5 only.
Output ONLY the JSON. No explanation.`.trim();

      melodyRaw = await callArrayAgent(client, MELODY_SYSTEM, melodyUserPrompt, model);
      sse(res, { type: 'log', line: `[Melody] Lead melody composed. Ready.` });
      currentStep++;
    }

    // ── STEP: Keys (conditional) ────────────────────────────────────────────
    let keysRaw: string | null = null;
    if (requestedTracks.includes('keys')) {
      sse(res, { type: 'progress', step: currentStep, label: 'Keys Player voicing chords...' });
      const keysDirective = directive.keys_directive || `Comp with chord voicings: ${directive.chord_roots.join(', ')} in octave 3-4. Half-note rhythm.`;
      sse(res, { type: 'log', line: `[Producer → Keys] ${keysDirective.slice(0, 100)}...` });

      const keysUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${key} | ${bpm} BPM | Feel: ${directive.feel}
CHORD ROOTS: Bar1=${directive.chord_roots[0]}, Bar2=${directive.chord_roots[1]}, Bar3=${directive.chord_roots[2]}, Bar4=${directive.chord_roots[3]}

DIRECTIVE: ${keysDirective}

${guide}

REQUIREMENT: Generate 8-16 chord objects in {"data":[...]} format. Each chord has a "notes" array of 3-4 notes.
Output ONLY the JSON. No explanation.`.trim();

      keysRaw = await callArrayAgent(client, KEYS_SYSTEM, keysUserPrompt, model);
      sse(res, { type: 'log', line: `[Keys] Chord voicings locked. Ready.` });
      currentStep++;
    }

    // ── STEP: Vocal (conditional, requires lyrics) ──────────────────────────
    let vocalRaw: string | null = null;
    if (requestedTracks.includes('vocal') && lyrics) {
      sse(res, { type: 'progress', step: currentStep, label: 'Vocalist mapping lyrics...' });
      const vocalDirective = directive.vocal_directive || `Sing the lyrics over ${directive.chord_roots.join('→')} in ${key}. Emphasize downbeats.`;
      sse(res, { type: 'log', line: `[Producer → Vocal] ${vocalDirective.slice(0, 100)}...` });

      const vocalUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${key} | ${bpm} BPM | Feel: ${directive.feel}
CHORD ROOTS: Bar1=${directive.chord_roots[0]}, Bar2=${directive.chord_roots[1]}, Bar3=${directive.chord_roots[2]}, Bar4=${directive.chord_roots[3]}

LYRICS:
${lyrics}

DIRECTIVE: ${vocalDirective}

REQUIREMENT: Generate 8-24 note objects in {"data":[...]} format. Include "syllable" for each note from the lyrics.
Output ONLY the JSON. No explanation.`.trim();

      vocalRaw = await callArrayAgent(client, VOCAL_SYSTEM, vocalUserPrompt, model);
      sse(res, { type: 'log', line: `[Vocal] Vocal melody mapped. Ready.` });
      currentStep++;
    }

    // ── FINAL STEP: Parse & validate ──────────────────────────────────────────
    sse(res, { type: 'progress', step: currentStep, label: 'Compiling & validating...' });

    let bassNotes, drumHits;
    let melodyNotes: unknown[] | undefined;
    let keysChords:  unknown[] | undefined;
    let vocalNotes:  unknown[] | undefined;
    try {
      bassNotes = JSON.parse(bassRaw);
      drumHits  = JSON.parse(drumsRaw);
      if (melodyRaw) melodyNotes = JSON.parse(melodyRaw);
      if (keysRaw)   keysChords  = JSON.parse(keysRaw);
      if (vocalRaw)  vocalNotes  = JSON.parse(vocalRaw);
    } catch {
      throw new Error('Failed to parse agent JSON output.');
    }

    if (!Array.isArray(bassNotes) || bassNotes.length === 0) {
      throw new Error(`Bass agent returned empty array. Raw: ${bassRaw.slice(0, 200)}`);
    }
    if (!Array.isArray(drumHits) || drumHits.length === 0) {
      throw new Error(`Drum agent returned empty array. Raw: ${drumsRaw.slice(0, 200)}`);
    }

    // Safety clamping
    bassNotes = (bassNotes as { bar: number; beat: number; note: string; duration: string; velocity: number }[]).map(n => ({
      ...n,
      bar:      Math.min(Math.max(Math.round(n.bar),  1), bars),
      beat:     Math.min(Math.max(n.beat,             1), 4),
      velocity: Math.min(Math.max(Math.round(n.velocity), 60), 110),
    }));

    drumHits = (drumHits as { bar: number; beat: number; instrument: string; velocity: number }[]).map(h => ({
      ...h,
      bar:      Math.min(Math.max(Math.round(h.bar),  1), bars),
      beat:     Math.min(Math.max(h.beat,             1), 4.99),
      velocity: Math.min(Math.max(Math.round(h.velocity), 65), 127),
    }));

    // Clamp melody notes
    if (melodyNotes && Array.isArray(melodyNotes)) {
      melodyNotes = (melodyNotes as Record<string, unknown>[]).map((n) => ({
        ...n,
        bar:      Math.min(Math.max(Math.round(Number(n.bar) || 1), 1), bars),
        beat:     Math.min(Math.max(Number(n.beat) || 1, 1), 4.5),
        velocity: Math.min(Math.max(Math.round(Number(n.velocity) || 80), 70), 100),
      }));
    }

    // Clamp keys chords
    if (keysChords && Array.isArray(keysChords)) {
      keysChords = (keysChords as Record<string, unknown>[]).map((c) => ({
        ...c,
        bar:      Math.min(Math.max(Math.round(Number(c.bar) || 1), 1), bars),
        beat:     Math.min(Math.max(Number(c.beat) || 1, 1), 4),
        velocity: Math.min(Math.max(Math.round(Number(c.velocity) || 70), 60), 85),
      }));
    }

    // Clamp vocal notes
    if (vocalNotes && Array.isArray(vocalNotes)) {
      vocalNotes = (vocalNotes as Record<string, unknown>[]).map((n) => ({
        ...n,
        bar:      Math.min(Math.max(Math.round(Number(n.bar) || 1), 1), bars),
        beat:     Math.min(Math.max(Number(n.beat) || 1, 1), 4.5),
        velocity: Math.min(Math.max(Math.round(Number(n.velocity) || 80), 70), 95),
      }));
    }

    const noteCount = bassNotes.length + drumHits.length +
      (melodyNotes?.length || 0) + (keysChords?.length || 0) + (vocalNotes?.length || 0);
    sse(res, { type: 'log', line: `[Producer] Total: ${noteCount} events · ${bars} bars @ ${bpm} BPM` });
    sse(res, { type: 'log', line: `[Producer] ✓ All tracks compiled — ${directive.chord_roots.join('→')} loop ready. Press PLAY!` });

    // Build midi_data object with optional tracks
    const midiPayload: Record<string, unknown> = {
      bpm,
      total_bars: bars,
      bass: bassNotes,
      drums: drumHits,
    };
    if (melodyNotes && Array.isArray(melodyNotes) && melodyNotes.length > 0) midiPayload.melody = melodyNotes;
    if (keysChords  && Array.isArray(keysChords)  && keysChords.length  > 0) midiPayload.keys   = keysChords;
    if (vocalNotes  && Array.isArray(vocalNotes)  && vocalNotes.length  > 0) midiPayload.vocal  = vocalNotes;

    // Validate through Zod schema to get proper typed MidiData
    const validation = MidiDataSchema.safeParse(midiPayload);
    if (!validation.success) {
      // Filter to only valid notes/hits and try again
      const validBass  = bassNotes.filter((n: { duration: string; note: string }) =>
        ['1n','2n','4n','4n.','8n','8n.','16n'].includes(n.duration) && /^[A-G]#?[0-9]$/.test(n.note)
      );
      const validDrums = drumHits.filter((h: { instrument: string }) =>
        ['kick','snare','hihat','ride','crash','tom'].includes(h.instrument)
      );
      const retryPayload: Record<string, unknown> = { bpm, total_bars: bars, bass: validBass, drums: validDrums };
      if (melodyNotes && Array.isArray(melodyNotes)) {
        retryPayload.melody = (melodyNotes as Record<string, unknown>[]).filter((n) =>
          typeof n.note === 'string' && /^[A-G]#?[0-9]$/.test(n.note as string)
        );
      }
      if (keysChords && Array.isArray(keysChords)) {
        retryPayload.keys = (keysChords as Record<string, unknown>[]).filter((c) =>
          Array.isArray(c.notes) && (c.notes as string[]).length >= 2
        );
      }
      if (vocalNotes && Array.isArray(vocalNotes)) {
        retryPayload.vocal = (vocalNotes as Record<string, unknown>[]).filter((n) =>
          typeof n.note === 'string' && /^[A-G]#?[0-9]$/.test(n.note as string)
        );
      }
      const retryValidation = MidiDataSchema.safeParse(retryPayload);
      if (!retryValidation.success) {
        throw new Error(`MIDI validation failed: ${retryValidation.error.message.slice(0, 200)}`);
      }
      const midiData: MidiData = retryValidation.data;
      sse(res, { type: 'result', midi_data: midiData });
      res.end();
      return;
    }

    const midiData: MidiData = validation.data;

    sse(res, { type: 'result', midi_data: midiData });
    res.end();

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[orchestrate-band] Fatal error:', message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    try {
      sse(res, { type: 'log',   line:  `[System] Fatal error: ${message}` });
      sse(res, { type: 'error', error: message });
    } catch { /* headers already sent or stream closed */ }
    res.end();
  }
}
