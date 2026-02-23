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
You are "The Producer" — a professional music arranger AI. You analyze a session brief and output a precise arrangement plan for a 4-bar loop.

OUTPUT: ONLY valid JSON — no prose, no markdown fences, no extra keys:
{
  "producer_logs": [
    "[Producer] <your analysis comment>",
    "[Producer → Bass] <exact bass directive>",
    "[Producer → Drums] <exact drums directive>"
  ],
  "bass_directive": "Single paragraph: exact note choices, which chord roots to use, and rhythm pattern per bar.",
  "drums_directive": "Single paragraph: exact beat positions for kick, snare, and hihat/ride per bar.",
  "chord_roots": ["C", "F", "G", "Am"],
  "feel": "swing | straight | shuffle | bossa nova | 16th funk"
}

RULES:
1. chord_roots = EXACTLY 4 strings (one per bar). Use the actual note names from the key.
2. bass_directive and drums_directive MUST be concrete and specific — not vague. Include actual note names and beat numbers.
3. feel must be one of the five options above.
4. producer_logs: 3-5 entries total telling your decision process.
`.trim();

const BASS_SYSTEM = `
You are "The Bass Player" — a professional session bassist AI. You generate tight bass lines.

OUTPUT: ONLY this JSON structure (no other text):
{"data": [
  {"bar":1,"beat":1,"note":"C2","duration":"4n","velocity":90},
  ...
]}

NON-NEGOTIABLE RULES:
1. Generate EXACTLY 16 bass note objects. (4 bars × 4 beats = 16 notes). For bossa nova: 8 notes (2 per bar) using duration "2n".
2. bar: integer 1, 2, 3, or 4.
3. beat: 1, 2, 3, or 4 for walking bass. 1.0, 2.5, 3.0, 3.5 for funk.
4. note: EXACTLY "Letter+OptionalSharp+Octave". Examples: "C2","Eb2","F#2","G2","Bb2". OCTAVE MUST BE 1, 2, 3, or 4. Bass notes live in octave 2.
5. duration: "4n" (quarter), "2n" (half), "8n" (eighth), "4n." (dotted quarter).
6. velocity: integer between 70 and 105.
7. Bar 1, beat 1 MUST be the root note of chord_roots[0] in octave 2.
8. Every bar MUST start on beat 1.
`.trim();

const DRUMS_SYSTEM = `
You are "The Drummer" — a professional session drummer AI. You generate locked grooves.

OUTPUT: ONLY this JSON structure (no other text):
{"data": [
  {"bar":1,"beat":1,"instrument":"kick","velocity":110},
  ...
]}

NON-NEGOTIABLE RULES:
1. Generate between 32 and 56 drum hit objects total.
2. bar: integer 1, 2, 3, or 4.
3. beat: 1, 1.5, 2, 2.5, 3, 3.5, 4, or 4.5 (eighth-note grid). Never use 5 or higher.
4. instrument: ONLY "kick", "snare", "hihat", "ride", "crash", "tom".
5. velocity: integer between 65 and 127.
6. EVERY bar MUST contain:
   a. At least one "kick" hit
   b. "snare" on beat 2 AND beat 4 (the backbeat — non-negotiable)
   c. "hihat" or "ride" on beats 1, 2, 3, 4 (the clock — non-negotiable)
7. The pattern MUST be IDENTICAL across all 4 bars (same instruments, same beats).
8. Copy bar 1's pattern exactly to bars 2, 3, and 4.
`.trim();

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
  const completion = await (client as OpenAI).chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.4,
    max_tokens:  2048,
    response_format: { type: 'json_object' },
  });
  return completion.choices[0]?.message?.content ?? '{}';
}

async function callArrayAgent(
  client: AIClient,
  systemPrompt: string,
  userMessage: string,
  model: string,
): Promise<string> {
  const wrapped = systemPrompt + '\n\nFINAL REMINDER: Wrap your array in {"data":[...]}. Output ONLY JSON.';
  const completion = await (client as OpenAI).chat.completions.create({
    model,
    messages: [
      { role: 'system', content: wrapped     },
      { role: 'user',   content: userMessage },
    ],
    temperature: 0.3,
    max_tokens:  3000,
    response_format: { type: 'json_object' },
  });
  const raw    = completion.choices[0]?.message?.content ?? '{"data":[]}';
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed))       return JSON.stringify(parsed);
  if (Array.isArray(parsed.data))  return JSON.stringify(parsed.data);
  return '[]';
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
    const [fields] = await form.parse(req);

    const bpm      = Number(fields.bpm?.[0]            ?? 120);
    const genre    =        fields.genre?.[0]           ?? 'jazz';
    const key      =        fields.key?.[0]             ?? 'C major';
    const duration = Number(fields.durationSeconds?.[0] ?? 30);
    const bars     = 4;

    // Log session header
    sse(res, { type: 'log', line: `[System] ──────── SESSION START ────────────────────` });
    sse(res, { type: 'log', line: `[System] BPM: ${bpm}  |  Genre: ${genre.toUpperCase()}  |  Key: ${key}` });
    sse(res, { type: 'log', line: `[System] Duration: ${duration}s  |  Bars: ${bars}  |  Loop: ON` });
    sse(res, { type: 'log', line: `[System] AI backend: ${IS_GROQ ? 'Groq (' + (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile') + ')' : 'OpenAI (' + (process.env.GRADIENT_MODEL ?? 'gpt-4o-mini') + ')'}` });
    sse(res, { type: 'log', line: `[System] ─────────────────────────────────────────────` });

    // 2. Build context
    const guide = genreGuide(genre, key);
    const musicalContext = `
TASK: Arrange a tight ${bars}-bar loop for a solo guitarist to improvise over.
This pattern will LOOP continuously, so it must be consistent and groovy.

SESSION:
- Tempo: ${bpm} BPM
- Genre: ${genre}
- Key: ${key}
- Duration: ~${duration}s per pass

${guide}

Produce an arrangement that sounds like real ${genre} music — locked rhythm section, clear harmony.
`.trim();

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

    // ── STEP 2: Bass ──────────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: 2, label: 'Bass Player composing groove...' });
    sse(res, { type: 'log',      line:  `[Producer → Bass] ${directive.bass_directive.slice(0, 100)}...` });

    const bassUserPrompt = `
DIRECTIVE: ${directive.bass_directive}

Key: ${key} | BPM: ${bpm} | Genre: ${genre} | Feel: ${directive.feel}
Chord roots for bars 1-4: ${directive.chord_roots.join(', ')}

${guide}

Generate EXACTLY 16 bass notes. Bar 1 beat 1 = "${directive.chord_roots[0]}2" (root, octave 2).
Each new bar must start on its chord root: Bar2 beat1="${directive.chord_roots[1]}2", Bar3="${directive.chord_roots[2]}2", Bar4="${directive.chord_roots[3]}2".
`.trim();

    const bassRaw = await callArrayAgent(client, BASS_SYSTEM, bassUserPrompt, model);
    sse(res, { type: 'log', line: `[Bass] Bass line locked — ${directive.feel} groove in ${key}.` });

    // ── STEP 3: Drums ─────────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: 3, label: 'Drummer building the beat...' });
    sse(res, { type: 'log',      line:  `[Producer → Drums] ${directive.drums_directive.slice(0, 100)}...` });

    const drumsUserPrompt = `
DIRECTIVE: ${directive.drums_directive}

BPM: ${bpm} | Genre: ${genre} | Feel: ${directive.feel}

${guide}

Generate 32-56 drum hits. IDENTICAL pattern across all 4 bars.
MANDATORY every bar: snare on beat 2 AND beat 4. Hihat/ride on beats 1,2,3,4. Kick on beat 1.
`.trim();

    const drumsRaw = await callArrayAgent(client, DRUMS_SYSTEM, drumsUserPrompt, model);
    sse(res, { type: 'log', line: `[Drums] Beat locked — consistent backbeat with ${directive.feel} feel.` });

    // ── STEP 4: Parse & validate ──────────────────────────────────────────────
    sse(res, { type: 'progress', step: 4, label: 'Compiling & validating beat...' });

    let bassNotes, drumHits;
    try {
      bassNotes = JSON.parse(bassRaw);
      drumHits  = JSON.parse(drumsRaw);
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

    sse(res, { type: 'log', line: `[Producer] Bass: ${bassNotes.length} notes  ·  Drums: ${drumHits.length} hits  ·  ${bars} bars @ ${bpm} BPM` });
    sse(res, { type: 'log', line: `[Producer] ✓ Beat ready — ${directive.chord_roots.join('→')} loop compiled. Press PLAY!` });

    // Validate through Zod schema to get proper typed MidiData
    const validation = MidiDataSchema.safeParse({ bpm, total_bars: bars, bass: bassNotes, drums: drumHits });
    if (!validation.success) {
      // Filter to only valid notes/hits and try again
      const validBass  = bassNotes.filter((n: { duration: string; note: string }) =>
        ['1n','2n','4n','4n.','8n','8n.','16n'].includes(n.duration) && /^[A-G]#?[0-9]$/.test(n.note)
      );
      const validDrums = drumHits.filter((h: { instrument: string }) =>
        ['kick','snare','hihat','ride','crash','tom'].includes(h.instrument)
      );
      const retryValidation = MidiDataSchema.safeParse({ bpm, total_bars: bars, bass: validBass, drums: validDrums });
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
    sse(res, { type: 'log',   line:  `[System] Fatal error: ${message}` });
    sse(res, { type: 'error', error: message });
    res.end();
  }
}
