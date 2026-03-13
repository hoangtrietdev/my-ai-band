import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { ProducerDirectiveSchema, MidiDataSchema, MidiData, type ProducerDirective } from '@/lib/schemas';

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

// ─── Flat → Sharp normalizer ──────────────────────────────────────────────────

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
  Cb: 'B',  Fb: 'E',
};

const CHROMATIC_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function normalizeNote(note: string): string {
  const m = note.match(/^([A-G]b)(\d)$/);
  if (m && FLAT_TO_SHARP[m[1]]) return FLAT_TO_SHARP[m[1]] + m[2];
  return note;
}

function normalizeNotes(notes: string[]): string[] {
  return notes.map(normalizeNote);
}

function normalizeRoot(root: string): string {
  const canonical = root.charAt(0).toUpperCase() + root.slice(1);
  return FLAT_TO_SHARP[canonical] ?? canonical;
}

function parseKeySignature(key: string): { tonic: string; isMinor: boolean } {
  const match = key.trim().match(/^([A-G](?:#|b)?)(?:\s+(major|minor))?/i);
  const tonic = normalizeRoot(match?.[1] ?? 'C');
  const lower = key.toLowerCase();
  const isMinor = (match?.[2]?.toLowerCase() === 'minor') || lower.includes(' minor');
  return { tonic, isMinor };
}

function transposeRoot(root: string, semitones: number): string {
  const index = CHROMATIC_SHARPS.indexOf(normalizeRoot(root));
  if (index === -1) return normalizeRoot(root);
  return CHROMATIC_SHARPS[(index + semitones + 120) % 12];
}

function buildChordRootsForGenre(genre: string, key: string, bars: number): string[] {
  const { tonic, isMinor } = parseKeySignature(key);
  const g = genre.toLowerCase();

  let pattern: number[];
  if (g === 'jazz') {
    pattern = isMinor ? [2, 7, 0, 8] : [2, 7, 0, 9];
  } else if (g === 'blues') {
    pattern = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];
  } else if (g === 'funk') {
    pattern = [0, 5, 0, 7];
  } else if (g === 'bossa nova') {
    pattern = isMinor ? [0, 8, 2, 7] : [0, 9, 2, 7];
  } else if (g === 'rock' || g === 'metal') {
    pattern = [0, 10, 5, 0];
  } else if (g === 'hip hop' || g === 'hip-hop' || g === 'trap') {
    pattern = [0, 8, 10, 0];
  } else {
    pattern = isMinor ? [0, 8, 3, 10] : [0, 7, 9, 5];
  }

  return Array.from({ length: bars }, (_, index) => transposeRoot(tonic, pattern[index % pattern.length]));
}

function deriveFeelSettings(genre: string): { feel: ProducerDirective['feel']; swing: number } {
  const g = genre.toLowerCase();
  if (g === 'jazz') return { feel: 'swing', swing: 0.3 };
  if (g === 'blues') return { feel: 'shuffle', swing: 0.25 };
  if (g === 'bossa nova') return { feel: 'bossa nova', swing: 0 };
  if (g === 'funk') return { feel: '16th funk', swing: 0 };
  return { feel: 'straight', swing: 0 };
}

function buildFallbackProducerDirective(params: {
  bpm: number;
  genre: string;
  key: string;
  bars: number;
  requestedTracks: string[];
  lyrics: string;
}): ProducerDirective {
  const { bpm, genre, key, bars, requestedTracks, lyrics } = params;
  const roots = buildChordRootsForGenre(genre, key, bars);
  const { feel, swing } = deriveFeelSettings(genre);
  const g = genre.toLowerCase();
  const requested = new Set(requestedTracks);
  const rootPath = roots.join('→');

  let bassDirective = `Outline ${rootPath} with root on beat 1 each bar, octave 2, and a turnaround in bar ${bars}.`;
  if (g === 'jazz') bassDirective = `Walking quarter-note bass over ${rootPath}; beat 1 root every bar, beat 4 chromatic approach to next root, octaves 2-3.`;
  if (g === 'blues') bassDirective = `Shuffle bass over ${rootPath}; root on 1, fifth on 3, passing tone on 2 or 4, turnaround in bar ${bars}.`;
  if (g === 'funk') bassDirective = `Syncopated 16th-funk bass over ${rootPath}; root on 1, short ghosted offbeats, octave pop near beat 4.`;
  if (g === 'bossa nova') bassDirective = `Sparse bossa bass over ${rootPath}; root on beat 1, fifth on beat 3, light chromatic lead-in to next bar.`;
  if (g === 'rock' || g === 'metal') bassDirective = `Driving straight 8ths over ${rootPath}; root/fifth motion, strong accents on 1 and 3, chromatic walk-up in bar ${bars}.`;
  if (g === 'hip hop' || g === 'hip-hop' || g === 'trap') bassDirective = `808-style bass over ${rootPath}; long roots, occasional fifth slide, leave space between phrases, hit bar entries hard.`;

  let drumsDirective = `Kick on 1 and 3, snare on 2 and 4, steady hats, crash on bar 1, fill on bar ${bars}.`;
  if (g === 'jazz') drumsDirective = `Ride on 1-4, hi-hat chick on 2 and 4, snare backbeat with soft ghosts on 2.5 and 4.5, kick on 1, fill on bar ${bars}.`;
  if (g === 'blues') drumsDirective = `Shuffle hats on the beat, kick on 1 and 3, snare on 2 and 4, ghost snare on 2.5 and 4.5, fill on bar ${bars}.`;
  if (g === 'funk') drumsDirective = `Hihat 8ths, kick on 1, 2.5, and 3.5, snare on 2 and 4, ghost snares on offbeats, open hat on 4.5, fill on bar ${bars}.`;
  if (g === 'bossa nova') drumsDirective = `Ride on 1 and 3, cross-stick on 2 and 3.5, soft kick on 1, keep it sparse, tiny fill on bar ${bars}.`;
  if (g === 'rock' || g === 'metal') drumsDirective = `Kick on 1 and 3, hard snare on 2 and 4, straight 8th hihat, crash on bar 1, tom fill on bar ${bars}.`;
  if (g === 'hip hop' || g === 'hip-hop' || g === 'trap') drumsDirective = `Hihat 8ths with occasional rolls, kick on 1 and 2.5, snare/clap on 3, leave space, fill on bar ${bars}.`;

  const melodyDirective = requested.has('melody')
    ? `Octave 4-5 melody over ${rootPath}; 2-bar motifs, leave rests, resolve on chord tones.`
    : '';
  const keysDirective = requested.has('keys')
    ? `Comp over ${rootPath} in octave 3-4 with smooth voice leading; sustained chords for pop/rock, shorter stabs for jazz/funk.`
    : '';
  const vocalDirective = requested.has('vocal') && lyrics
    ? `Set lyric syllables across 2-4 bar phrases, leave breathing gaps, and resolve near ${roots[0]}.`
    : '';

  return {
    producer_logs: [
      `[Producer] AI producer failed; using built-in arranger at ${bpm} BPM.`,
      `[Producer] ${genre} groove in ${key} across ${bars} bars.`,
      `[Producer] Chord roots: ${rootPath}.`,
      `[Producer] Feel: ${feel}.`,
    ],
    bass_directive: bassDirective,
    drums_directive: drumsDirective,
    melody_directive: melodyDirective,
    keys_directive: keysDirective,
    vocal_directive: vocalDirective,
    chord_roots: roots,
    swing,
    feel,
  };
}

// ─── Genre music theory guide ──────────────────────────────────────────────────

function genreGuide(genre: string, key: string, bars: number): string {
  const g = genre.toLowerCase();
  const variationNote = bars > 4
    ? `\n• VARIATION: Do NOT copy-paste identical patterns for all ${bars} bars. Add fills on bar ${bars} (drum fill, bass walk-up). Bars 1-${Math.floor(bars/2)} = A section, bars ${Math.floor(bars/2)+1}-${bars} = B section with slight melodic/rhythmic variation.`
    : '';

  if (g === 'jazz') return `
JAZZ GUIDE for ${key} (${bars} bars):
• Chord progression: ii-V-I-vi in ${key}, cycle across ${bars} bars. Example C major: Dm7→G7→Cmaj7→Am7 repeated.
• Bass (WALKING): ONE note per beat (4 per bar), stepwise through chord tones + chromatic approach notes.
  Example bar1=Dm7: D2→F2→A2→C3. Beat 4 should be a chromatic approach to the NEXT bar's root.
  Use passing tones (b5, #4) to create smooth voice leading. Vary rhythm with occasional 8th-note pairs.
• Drums (SWING): ride on 1,2,3,4 EVERY bar. Snare GHOST notes on beat 2.5 and 4.5 (velocity 50-65).
  Loud snare on 2 & 4 (velocity 95-110). Kick on 1 (strong) and occasional beat 3 (softer).
  Add hi-hat "chick" on 2 & 4 for authenticity. Use crash on beat 1 of bar 1 only.
  Per-bar: 4 ride + 2 snare + 2 ghost + 2 kick = ~10 events minimum.
• Swing feel: 0.30 (delays offbeats for triplet feel)${variationNote}`;

  if (g === 'blues') return `
BLUES GUIDE for ${key} (${bars} bars):
• Chord progression: 12-bar blues over ${bars} bars. I7-I7-I7-I7-IV7-IV7-I7-I7-V7-IV7-I7-V7.
  Adapt to ${bars} bars by truncating or repeating sections as needed.
• Bass (SHUFFLE): Alternating root-fifth with blue note. Example C: C2→E2→G2→A#2.
  Beat 1 = root (strong), beat 3 = fifth. Beats 2 & 4 = passing tones. Shuffle feel!
• Drums (SHUFFLE): hihat on 1,2,3,4. Kick on 1 & 3. Snare on 2 & 4.
  Ghost snare on 2.5 & 4.5. Shuffle feel with swing.
  Per-bar: 4 hihat + 2 snare + 2 ghost + 2 kick = ~10 events.
• Swing feel: 0.25 (medium shuffle)${variationNote}`;

  if (g === 'funk') return `
FUNK GUIDE for ${key} (${bars} bars):
• Chord progression: I7-IV7-I7-V7 in ${key}. Tight dominant 7ths. Keep it nasty and minimal.
• Bass (16TH FUNK): Syncopated, staccato. Mix 8th and 16th notes.
  Beat 1=root (accent!), beats 2.5 & 3.5=ghost notes (low velocity), beat 3=root.
  Occasional octave jump on beat 4. Use dead notes (same pitch, very short "16n").
• Drums (16TH FUNK): hihat on EVERY 8th note (1,1.5,2,2.5,3,3.5,4,4.5). Kick syncopated: 1, 2.5, 3.5.
  Snare cracks on 2 & 4. Ghost snares on 1.5, 3.5 (velocity 50-60). Open hihat on 4.5.
  Per-bar: 8 hihat + 2 snare + 2 ghost + 3 kick = ~15 events.
• Swing feel: 0 (dead straight 16ths)${variationNote}`;

  if (g === 'bossa nova') return `
BOSSA NOVA GUIDE for ${key} (${bars} bars):
• Chord progression: Imaj7-vi7-ii7-V7 in ${key}. Smooth jazz harmony with extensions (9ths, 13ths).
• Bass (MINIMAL): Only 2 notes per bar. Beat 1=root (half note), beat 3=fifth (half note).
  Occasional chromatic approach note on beat 4 → next root. Keep it sparse and elegant.
• Drums (BOSSA CLAVE): Cross-stick (snare) on beats 2 and 3.5 (the clave pattern).
  Kick very softly on 1. NO hihat — use ride instead, on beats 1 and 3.
  Per-bar: 1 kick + 2 snare + 2 ride = 5 events (deliberately sparse!).
• Swing feel: 0 (straight 8ths, bossa is NOT swung)${variationNote}`;

  if (g === 'rock' || g === 'metal') return `
ROCK/METAL GUIDE for ${key} (${bars} bars):
• Chord progression: I-bVII-IV-I power chords in ${key}. Driving and aggressive.
• Bass (DRIVING 8THS): Root notes in octave 2, straight 8th notes. Follow the guitar riff.
  Beat 1=root (accent), beats 1.5-4.5 = steady 8ths alternating root and fifth.
  Use "8n" duration for all notes. 8 notes per bar.
• Drums (ROCK): Kick on 1 & 3. Snare HARD on 2 & 4 (velocity 105-120). Crash on bar 1 beat 1.
  Hihat straight 8ths (1,1.5,2,2.5,3,3.5,4,4.5) or ride for chorus sections.
  Double kick on bar ${bars} for fill. Per-bar: 8 hihat + 2 snare + 2 kick = 12 events.
• Swing feel: 0 (dead straight)${variationNote}`;

  if (g === 'hip hop' || g === 'hip-hop' || g === 'trap') return `
HIP HOP / TRAP GUIDE for ${key} (${bars} bars):
• Chord progression: i-bVI-bVII-i in ${key} minor. Dark, moody.
• Bass (808 SUB): Root notes in octave 1-2 with long sustain ("2n" or "1n" duration).
  Slides: occasional glide from root to fifth. Only 2-4 notes per bar — let it breathe.
• Drums (TRAP): Hi-hat rolls with varying density (triplets on some beats).
  Kick on 1 and 2.5 (boom-bap pattern). Snare/clap on 3 only (half-time feel).
  Hihat: 1,1.5,2,2.5,3,3.5,4,4.5 with velocity variation (accents on downbeats).
  Per-bar: 8 hihat + 1 snare + 2 kick = ~11 events.
• Swing feel: 0 (straight)${variationNote}`;

  return `
POP GUIDE for ${key} (${bars} bars):
• Chord progression: I-V-vi-IV in ${key}. Example C: C→G→Am→F
• Bass (ROOT-MOTION): Root on beat 1 (quarter note), fifth on beat 3 (quarter note).
  Add passing tone on beat 2 or 4 for movement. Keep it simple but NOT static.
• Drums (4-ON-FLOOR): hihat on beats 1,2,3,4. Kick on 1 & 3. Snare on 2 & 4.
  Add open hihat on beat 4.5 for lift. Crash on bar 1 beat 1.
  Per-bar: 4 hihat + 2 kick + 2 snare = 8 events minimum.
• Swing feel: 0 (straight)${variationNote}`;
}

// ─── Improved system prompts ──────────────────────────────────────────────────

const PRODUCER_SYSTEM = `
You are "The Producer" — a professional music arranger AI with deep knowledge of music theory, arrangement, and groove.

Your ONLY output is a single JSON object — no markdown, no code fences, no prose before or after:
{
  "producer_logs": [
    "[Producer] Analyzing 120 BPM jazz in C major...",
    "[Producer] Choosing ii-V-I-vi: Dm7→G7→Cmaj7→Am7",
    "[Producer → Bass] Walk chord tones, root on beat 1 each bar.",
    "[Producer → Drums] Jazz ride groove, snare 2&4, ghost notes for texture."
  ],
  "bass_directive": "Play walking quarter notes with chromatic approach. Bar1=Dm7: D2 F2 A2 C#3. Bar2=G7: G2 B2 D3 F#2. ...",
  "drums_directive": "Ride on beats 1,2,3,4. Snare backbeat 2&4 (forte). Ghost snare on 2.5&4.5 (piano). Kick softly on 1&3. Crash on bar 1 beat 1.",
  "melody_directive": "Play a lyrical melody outlining Dm7→G7→Cmaj7→Am7. Start on chord tone, use approach notes. Mix 8ths and quarters. Range: C4-G5.",
  "keys_directive": "Comp: Dm9→G13→Cmaj9→Am7. Rootless voicings in octave 3. Half-note rhythm. Voice lead: keep common tones, move others by step.",
  "vocal_directive": "Sing the lyrics over the changes using the melody contour. Emphasize downbeats. Breathe between phrases.",
  "chord_roots": ["D", "G", "C", "A", "D", "G", "C", "A"],
  "swing": 0.30,
  "feel": "swing"
}

RULES:
1. chord_roots = EXACTLY one root per bar — only the ROOT LETTER (no "m", no "maj7"). Length MUST equal the number of bars requested.
2. feel must be exactly one of: swing, straight, shuffle, bossa nova, 16th funk
3. swing: float 0-0.5. Jazz=0.3, blues/shuffle=0.25, funk/pop/rock=0, bossa nova=0.
4. bass_directive: short groove instruction with register, beat-1 root rule, and turnaround guidance.
5. drums_directive: short beat pattern with beat numbers, timekeeping instrument, backbeat, and fill placement.
6. melody_directive: short range and phrase-shape instruction, or "" if melody not requested.
7. keys_directive: short comping/voicing instruction, or "" if keys not requested.
8. vocal_directive: short phrasing/breathing instruction, or "" if vocals not requested.
9. producer_logs: 4 short entries exactly.
10. Keep every string compact. Total JSON should stay under 1200 characters when possible.
11. DO NOT output anything except the JSON object.
`.trim();

const BASS_SYSTEM = `
You are "The Bass Player" — a professional session bassist AI with impeccable time and tone.

Your ONLY output is this exact JSON structure. No markdown, no explanation, no text outside the JSON:
{"data":[
  {"bar":1,"beat":1,"note":"D2","duration":"4n","velocity":95},
  {"bar":1,"beat":2,"note":"F2","duration":"4n","velocity":78},
  {"bar":1,"beat":3,"note":"A2","duration":"4n","velocity":82},
  {"bar":1,"beat":4,"note":"C#3","duration":"8n","velocity":72},
  ...
]}

STRICT RULES (follow exactly):
1. Output 4 notes per bar × total bars = total notes (e.g. 8 bars = 32 notes). For bossa nova: 2 per bar.
2. bar: integer from 1 to the total number of bars requested.
3. beat: 1, 2, 3, or 4 for walking/pop/blues/jazz. For funk: use 1, 2.5, 3, 3.5. For bossa nova: 1 and 3 only.
4. note: letter + optional # + octave digit. Valid: "C2" "C#2" "D#2" "F#2" "G#2" "A#2" "G3". Bass lives in octave 2 (occasional 3).
5. duration: "4n" "2n" "8n" "4n." "8n." only.
6. velocity: integer 60-105. Use dynamics! Beat 1 = strongest (90-105), offbeats = softer (65-80).
7. Every bar's beat 1 MUST start on the chord root.
8. Beat 4 should be a CHROMATIC APPROACH NOTE to the next bar's root (half step above or below).
9. Use passing tones and neighbor tones, not just arpeggios. Real bass lines have CONTOUR.
10. The LAST bar should build tension (walk up) to resolve back to bar 1 for looping.
11. DO NOT write anything outside the JSON.
`.trim();

const DRUMS_SYSTEM = `
You are "The Drummer" — a professional session drummer AI with deep groove knowledge.

Your ONLY output is this exact JSON structure. No markdown, no explanation, no text outside the JSON:
{"data":[
  {"bar":1,"beat":1,"instrument":"kick","velocity":110},
  {"bar":1,"beat":1,"instrument":"hihat","velocity":80},
  {"bar":1,"beat":2,"instrument":"snare","velocity":100},
  {"bar":1,"beat":2,"instrument":"hihat","velocity":75},
  {"bar":1,"beat":3,"instrument":"kick","velocity":105},
  {"bar":1,"beat":3,"instrument":"hihat","velocity":75},
  {"bar":1,"beat":4,"instrument":"snare","velocity":98},
  {"bar":1,"beat":4,"instrument":"hihat","velocity":72},
  ...
]}

STRICT RULES (follow exactly):
1. Generate 8-12 drum hit objects per bar × total bars. Total depends on bar count.
2. bar: integer from 1 to the total number of bars requested.
3. beat: 1, 1.5, 2, 2.5, 3, 3.5, 4, or 4.5 only. NEVER 5 or higher.
4. instrument: ONLY one of: "kick" "snare" "hihat" "ride" "crash" "tom".
5. velocity: integer 65-127.
6. EVERY bar MUST have ALL of the following:
   - kick on beat 1 (mandatory)
   - snare on beat 2 (mandatory backbeat)
   - snare on beat 4 (mandatory backbeat)
   - hihat or ride on beats 1, 2, 3, 4 (mandatory clock)
7. GHOST NOTES: On some offbeats (2.5, 4.5), add soft snare hits with velocity 35-55. These are ghost notes and essential for groove.
8. VARIATION: Every 4 bars, the LAST bar should be a FILL: add extra kick, tom, or crash hits. The other bars can vary slightly (e.g., extra kick on beat 3.5 in some bars).
9. CRASH: Use crash on beat 1 of bar 1, and beat 1 after any fill bar.
10. For jazz: replace hihat with ride on all beats, add hihat on 2 and 4 only ("foot splash").
11. DO NOT write anything outside the JSON.
`.trim();

// ─── NEW AGENT PROMPTS ──────────────────────────────────────────────────────

const MELODY_SYSTEM = `
You are "The Melodist" — a professional lead instrumentalist AI with a gift for memorable phrases.

Your ONLY output is this exact JSON structure. No markdown, no explanation:
{"data":[
  {"bar":1,"beat":1,"note":"E4","duration":"8n","velocity":85},
  {"bar":1,"beat":1.5,"note":"G4","duration":"8n","velocity":78},
  ...
]}

STRICT RULES:
1. Output 4-8 note objects per bar × total bars requested.
2. bar: integer from 1 to total bars.
3. beat: 1, 1.5, 2, 2.5, 3, 3.5, 4, or 4.5.
4. note: octave 4 or 5 ONLY (e.g. "E4", "G5"). Stay in the given key.
5. duration: "4n" "8n" "16n" "4n." "8n." only.
6. velocity: integer 70-100. Phrase peaks should be louder, phrase endings softer.
7. Mix stepwise motion (C4→D4→E4) with small leaps (C4→E4). No leaps > octave.
8. First note of bar 1 should be a chord tone (root, 3rd, or 5th).
9. PHRASING: Think in 2-bar phrases. Each phrase should have a clear contour (arch shape). Leave rests between phrases.
10. MOTIF: Establish a short motif (3-4 notes) in bars 1-2, then develop it (sequence, invert, augment) in later bars.
11. RESTS: Not every beat needs a note. Silence is musical. Leave at least 2 beats of rest per 4-bar section.
12. DO NOT write anything outside the JSON.
`.trim();

const KEYS_SYSTEM = `
You are "The Keys Player" — a professional keyboard/piano AI with sophisticated harmonic knowledge.

Your ONLY output is this exact JSON structure. No markdown, no explanation:
{"data":[
  {"bar":1,"beat":1,"notes":["C3","E3","G3"],"duration":"2n","velocity":75},
  {"bar":1,"beat":3,"notes":["C3","E3","G3"],"duration":"2n","velocity":70},
  ...
]}

STRICT RULES:
1. Output 2-4 chord objects per bar × total bars requested.
2. bar: integer from 1 to total bars.
3. beat: 1, 2, 3, or 4.
4. notes: array of 3-4 note names in octave 3-4 (e.g. ["C3","E3","G3","B3"]).
5. duration: "1n" "2n" "4n" only. Prefer half notes ("2n") for sustained chords.
6. velocity: integer 60-85.
7. VOICE LEADING: Minimize hand movement between chords. Move individual voices by step when possible. Use inversions.
8. EXTENSIONS: For jazz/bossa, add 7ths and 9ths. For pop, use simple triads.
9. RHYTHM: Don't just hit on beats 1 and 3. Vary — sometimes anticipate (beat 4.5 of previous bar), sometimes syncopate (beat 2.5).
10. COMPING: In jazz/funk, use shorter rhythmic bursts ("4n") with rests. In ballads/pop, use sustained chords ("2n", "1n").
11. DO NOT write anything outside the JSON.
`.trim();

const VOCAL_SYSTEM = `
You are "The Vocalist" — a professional singer AI with natural phrasing and breath control.

If lyrics are provided, map each syllable to a pitch and rhythm.
If no lyrics, generate a "la la la" vocal melody.

Your ONLY output is this exact JSON structure:
{"data":[
  {"bar":1,"beat":1,"note":"G4","duration":"4n","velocity":80,"syllable":"hel"},
  {"bar":1,"beat":2,"note":"A4","duration":"4n","velocity":78,"syllable":"lo"},
  ...
]}

STRICT RULES:
1. Output 2-6 note objects per bar × total bars requested.
2. bar: integer from 1 to total bars.
3. note: octave 3-5 only. Stay in the given key.
4. duration: "4n" "8n" "2n" "4n." only.
5. velocity: integer 70-95. Crescendo through phrases, soften at phrase endings.
6. syllable: one syllable per note. If lyrics given, use syllables in order. If not, use "la", "da", "ooh", "aah", "mmm".
7. BREATHING: Leave at least 1-2 beats of rest between phrases. No human can sing without breathing.
8. PHRASE SHAPE: Sing in 2-4 bar phrases. Start mid-range, arc up for emotional peaks, descend to resolve.
9. REPETITION: Repeat melodic motifs with slight variation. Hooks are born from repetition.
10. DO NOT write anything outside the JSON.
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

function extractJSONObject(raw: string): string {
  const s = raw.trim();
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return s;
  } catch {}

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return fenced[1].trim();
    } catch {}
  }

  const objStart = s.indexOf('{');
  const objEnd   = s.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const slice = s.slice(objStart, objEnd + 1);
    try {
      const parsed = JSON.parse(slice);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return slice;
    } catch {}
  }

  return s;
}

function parseProducerDirective(raw: string): ProducerDirective | null {
  try {
    const parsed = JSON.parse(extractJSONObject(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const result = ProducerDirectiveSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function parseAgentDataArray(raw: string): unknown[] | null {
  try {
    const parsed = JSON.parse(extractJSON(raw));
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { data?: unknown }).data)) {
      return (parsed as { data: unknown[] }).data;
    }
  } catch {
    // Attempt to salvage truncated arrays by finding full flat objects
    const objects: unknown[] = [];
    const regex = /\{[^{}]+\}/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      try {
        const parsedObj = JSON.parse(match[0]);
        // Simple heuristic: music events have a 'bar', 'beat', or 'note'
        if (parsedObj && typeof parsedObj === 'object' && Object.keys(parsedObj).length > 0) {
          objects.push(parsedObj);
        }
      } catch {
        // ignore invalid objects
      }
    }
    if (objects.length > 0) {
      return objects;
    }
  }
  return null;
}

type DrumInstrument = 'kick' | 'snare' | 'hihat' | 'ride' | 'crash' | 'tom';

interface DrumHitSeed {
  bar: number;
  beat: number;
  instrument: DrumInstrument;
  velocity: number;
}

function buildFallbackDrumPattern(bars: number, genre: string, feel: string): DrumHitSeed[] {
  const hits: DrumHitSeed[] = [];
  const style = `${genre} ${feel}`.toLowerCase();
  const isJazz = style.includes('jazz') || style.includes('swing');
  const isBossa = style.includes('bossa');
  const isTrap = style.includes('hip hop') || style.includes('hip-hop') || style.includes('trap');
  const isFunk = style.includes('funk');
  const isRock = style.includes('rock') || style.includes('metal');

  const push = (...events: DrumHitSeed[]) => hits.push(...events);

  for (let bar = 1; bar <= bars; bar++) {
    const turnaround = bar === bars || bar % 4 === 0;

    if (isBossa) {
      push(
        { bar, beat: 1,   instrument: 'kick',  velocity: 92 },
        { bar, beat: 1,   instrument: 'ride',  velocity: 74 },
        { bar, beat: 2,   instrument: 'snare', velocity: 84 },
        { bar, beat: 3,   instrument: 'ride',  velocity: 72 },
        { bar, beat: 3.5, instrument: 'snare', velocity: 78 },
      );
      if (turnaround) {
        push(
          { bar, beat: 4,   instrument: 'kick', velocity: 86 },
          { bar, beat: 4.5, instrument: 'tom',  velocity: 82 },
        );
      }
      continue;
    }

    if (isJazz) {
      if (bar === 1) {
        push({ bar, beat: 1, instrument: 'crash', velocity: 106 });
      }
      push(
        { bar, beat: 1,   instrument: 'ride',  velocity: 82 },
        { bar, beat: 2,   instrument: 'ride',  velocity: 76 },
        { bar, beat: 2,   instrument: 'hihat', velocity: 70 },
        { bar, beat: 2,   instrument: 'snare', velocity: 94 },
        { bar, beat: 2.5, instrument: 'snare', velocity: 48 },
        { bar, beat: 3,   instrument: 'ride',  velocity: 78 },
        { bar, beat: 4,   instrument: 'ride',  velocity: 74 },
        { bar, beat: 4,   instrument: 'hihat', velocity: 68 },
        { bar, beat: 4,   instrument: 'snare', velocity: 92 },
        { bar, beat: 4.5, instrument: 'snare', velocity: 46 },
        { bar, beat: 1,   instrument: 'kick',  velocity: 88 },
      );
      if (bar % 2 === 1 || turnaround) {
        push({ bar, beat: 3, instrument: 'kick', velocity: 74 });
      }
      if (turnaround) {
        push({ bar, beat: 4.5, instrument: 'tom', velocity: 80 });
      }
      continue;
    }

    if (isTrap) {
      if (bar === 1) {
        push({ bar, beat: 1, instrument: 'crash', velocity: 98 });
      }
      [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].forEach((beat) => {
        push({
          bar,
          beat,
          instrument: 'hihat',
          velocity: Number.isInteger(beat) ? 82 : 70,
        });
      });
      push(
        { bar, beat: 1,   instrument: 'kick',  velocity: 104 },
        { bar, beat: 2.5, instrument: 'kick',  velocity: 92 },
        { bar, beat: 3,   instrument: 'snare', velocity: 96 },
      );
      if (turnaround) {
        push(
          { bar, beat: 4,   instrument: 'kick', velocity: 96 },
          { bar, beat: 4.5, instrument: 'tom',  velocity: 84 },
        );
      }
      continue;
    }

    [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].forEach((beat) => {
      push({
        bar,
        beat,
        instrument: isJazz ? 'ride' : 'hihat',
        velocity: Number.isInteger(beat) ? 80 : 70,
      });
    });

    push(
      { bar, beat: 1, instrument: 'kick',  velocity: 108 },
      { bar, beat: 2, instrument: 'snare', velocity: isRock ? 108 : 98 },
      { bar, beat: 3, instrument: 'kick',  velocity: 100 },
      { bar, beat: 4, instrument: 'snare', velocity: isRock ? 106 : 96 },
    );

    if (isFunk) {
      push(
        { bar, beat: 2.5, instrument: 'kick',  velocity: 88 },
        { bar, beat: 3.5, instrument: 'kick',  velocity: 84 },
        { bar, beat: 1.5, instrument: 'snare', velocity: 48 },
        { bar, beat: 4.5, instrument: 'snare', velocity: 44 },
      );
    }

    if (bar === 1) {
      push({ bar, beat: 1, instrument: 'crash', velocity: 108 });
    }

    if (turnaround) {
      push(
        { bar, beat: 3.5, instrument: 'kick', velocity: 92 },
        { bar, beat: 4,   instrument: 'tom',  velocity: 86 },
        { bar, beat: 4.5, instrument: 'tom',  velocity: 80 },
      );
    }
  }

  return hits;
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

async function callProducerAgent(
  client: AIClient,
  userMessage: string,
  model: string,
): Promise<ProducerDirective> {
  const wrappedSystem = `${PRODUCER_SYSTEM}\n\nFINAL REMINDER: Output ONLY a single JSON object. Never output a bare array. Required keys: producer_logs, bass_directive, drums_directive, melody_directive, keys_directive, vocal_directive, chord_roots, swing, feel.`;
  let repairPrompt = userMessage;
  let lastRaw = '{}';

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await (client as OpenAI).chat.completions.create({
      model,
      messages: [
        { role: 'system', content: wrappedSystem },
        { role: 'user',   content: repairPrompt },
      ],
      temperature: attempt === 0 ? 0.3 : 0,
      max_tokens:  2048,
    });

    lastRaw = completion.choices[0]?.message?.content ?? '{}';
    const directive = parseProducerDirective(lastRaw);
    if (directive) return directive;

    repairPrompt = [
      userMessage,
      '',
      'Your previous response was invalid.',
      'Return ONLY one valid JSON object matching the required schema.',
      'Do NOT return a bare array or prose.',
      `Previous invalid response:\n${lastRaw.slice(0, 1200)}`,
    ].join('\n');
  }

  throw new Error(`Producer returned invalid JSON after retry: ${extractJSONObject(lastRaw).slice(0, 300)}`);
}

async function callArrayAgent(
  client: AIClient,
  systemPrompt: string,
  userMessage: string,
  model: string,
  options: { minItems?: number; repairHint?: string } = {},
): Promise<string> {
  const wrapped = systemPrompt + '\n\nFINAL REMINDER: Output ONLY the JSON object {"data":[...]}. No text before or after.';
  const minItems = options.minItems ?? 1;
  let repairPrompt = userMessage;
  let lastRaw = '{"data":[]}';

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await (client as OpenAI).chat.completions.create({
      model,
      messages: [
        { role: 'system', content: wrapped },
        { role: 'user',   content: repairPrompt },
      ],
      temperature: attempt === 0 ? 0.2 : 0,
      max_tokens:  3500,
    });

    lastRaw = completion.choices[0]?.message?.content ?? '{"data":[]}';
    const parsed = parseAgentDataArray(lastRaw);
    if (parsed && parsed.length >= minItems) {
      return JSON.stringify(parsed);
    }

    const reason = !parsed
      ? 'It did not contain a valid JSON object with a data array.'
      : `It returned ${parsed.length} items, but at least ${minItems} are required.`;

    repairPrompt = [
      userMessage,
      '',
      'Your previous response was invalid.',
      reason,
      options.repairHint ? `Repair hint: ${options.repairHint}` : '',
      'Return ONLY the JSON object {"data":[...]} with no prose, markdown, or comments.',
      `Previous invalid response:\n${lastRaw.slice(0, 1200)}`,
    ].filter(Boolean).join('\n');
  }

  throw new Error(`Agent returned invalid or empty data array: ${extractJSON(lastRaw).slice(0, 300)}`);
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
    const guide = genreGuide(genre, key, bars);
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

    let directive: ProducerDirective;
    try {
      directive = await callProducerAgent(client, musicalContext, model);
    } catch (error) {
      console.warn('[orchestrate-band] Producer agent failed, using fallback arranger.', error);
      sse(res, { type: 'log', line: '[Producer] AI producer returned invalid JSON. Using built-in arranger.' });
      directive = buildFallbackProducerDirective({
        bpm,
        genre,
        key,
        bars,
        requestedTracks,
        lyrics,
      });
    }

    directive.producer_logs.forEach((l: string) => sse(res, { type: 'log', line: l }));
    sse(res, { type: 'log', line: `[Producer] Chords: ${directive.chord_roots.join(' → ')} | Feel: ${directive.feel}` });

    let currentStep = 2;

    // ── STEP 2: Bass ──────────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: currentStep, label: 'Bass Player composing groove...' });
    sse(res, { type: 'log',      line:  `[Producer → Bass] ${directive.bass_directive.slice(0, 100)}...` });

    const bassUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${key} | ${bpm} BPM | Feel: ${directive.feel}
CHORD ROOTS (${bars} bars): ${directive.chord_roots.map((r, i) => `Bar${i + 1}=${r}`).join(', ')}

DIRECTIVE: ${directive.bass_directive}

${guide}

REQUIREMENT: Generate EXACTLY ${bars * 4} note objects in {"data":[...]} format (4 notes per bar × ${bars} bars).
${directive.chord_roots.map((r, i) => `- Bar${i + 1} beat1 MUST start on {"bar":${i + 1},"beat":1,"note":"${r}2","duration":"4n","velocity":90}`).join('\n')}
- Beat 4 of each bar should be a chromatic approach note (half step above/below) to the NEXT bar's root.

Output ONLY the JSON. No explanation.`.trim();

    let bassRaw = '[]';
    try {
      bassRaw = await callArrayAgent(client, BASS_SYSTEM, bassUserPrompt, model);
      sse(res, { type: 'log', line: `[Bass] Bass line locked — ${directive.feel} groove in ${key}.` });
    } catch (e) {
      console.warn('[orchestrate-band] Bass agent failed:', e);
      sse(res, { type: 'log', line: `[Bass] Agent failed or truncated completely, yielding empty track.` });
    }
    currentStep++;

    // ── STEP 3: Drums ─────────────────────────────────────────────────────────
    sse(res, { type: 'progress', step: currentStep, label: 'Drummer building the beat...' });
    sse(res, { type: 'log',      line:  `[Producer → Drums] ${directive.drums_directive.slice(0, 100)}...` });

    const drumsUserPrompt = `
SESSION: ${genre.toUpperCase()} | ${bpm} BPM | Feel: ${directive.feel} | ${bars} bars

DIRECTIVE: ${directive.drums_directive}

${guide}

REQUIREMENT: Generate ${bars * 8}-${bars * 12} hit objects in {"data":[...]} format (8-12 per bar × ${bars} bars).
Every single bar MUST contain:
  - {"instrument":"kick"} on beat 1
  - {"instrument":"snare"} on beat 2
  - {"instrument":"snare"} on beat 4
  - {"instrument":"hihat"} (or "ride") on beats 1, 2, 3, 4
Add ghost notes (soft snare on offbeats, velocity 35-55) for groove.
${bars > 4 ? `Bars ${bars - 1} and ${bars} should include a FILL (extra kick/tom/crash).` : ''}
crash on beat 1 of bar 1.

Output ONLY the JSON. No explanation.`.trim();

    let drumsRaw: string;
    try {
      drumsRaw = await callArrayAgent(client, DRUMS_SYSTEM, drumsUserPrompt, model, {
        minItems: bars * 4,
        repairHint: 'Each bar needs kick on 1, snare on 2 and 4, and hihat or ride timekeeping. Do not return an empty array.',
      });
    } catch (error) {
      console.warn('[orchestrate-band] Drum agent failed, using fallback groove.', error);
      sse(res, { type: 'log', line: `[Drums] AI output was empty/invalid. Using built-in ${directive.feel} fallback groove.` });
      drumsRaw = JSON.stringify(buildFallbackDrumPattern(bars, genre, directive.feel));
    }
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
CHORD ROOTS (${bars} bars): ${directive.chord_roots.map((r: string, i: number) => `Bar${i + 1}=${r}`).join(', ')}

DIRECTIVE: ${melodyDirective}

${guide}

REQUIREMENT: Generate ${bars * 4}-${bars * 8} note objects in {"data":[...]} format. Notes in octave 4-5 only.
Think in 2-bar phrases with rests between them. Develop a motif across the ${bars} bars.
Output ONLY the JSON. No explanation.`.trim();

      try {
        melodyRaw = await callArrayAgent(client, MELODY_SYSTEM, melodyUserPrompt, model);
        sse(res, { type: 'log', line: `[Melody] Lead melody composed. Ready.` });
      } catch (e) {
        console.warn('[orchestrate-band] Melody agent failed:', e);
        melodyRaw = '[]';
        sse(res, { type: 'log', line: `[Melody] Agent failed, yielding empty track.` });
      }
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
CHORD ROOTS (${bars} bars): ${directive.chord_roots.map((r: string, i: number) => `Bar${i + 1}=${r}`).join(', ')}

DIRECTIVE: ${keysDirective}

${guide}

REQUIREMENT: Generate ${bars * 2}-${bars * 4} chord objects in {"data":[...]} format. Each chord has a "notes" array of 3-4 notes.
Use smooth voice leading between chords. Vary the rhythm — don't always hit on beats 1 and 3.
Output ONLY the JSON. No explanation.`.trim();

      try {
        keysRaw = await callArrayAgent(client, KEYS_SYSTEM, keysUserPrompt, model);
        sse(res, { type: 'log', line: `[Keys] Chord voicings locked. Ready.` });
      } catch (e) {
        console.warn('[orchestrate-band] Keys agent failed:', e);
        keysRaw = '[]';
        sse(res, { type: 'log', line: `[Keys] Agent failed, yielding empty track.` });
      }
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
CHORD ROOTS (${bars} bars): ${directive.chord_roots.map((r: string, i: number) => `Bar${i + 1}=${r}`).join(', ')}

LYRICS:
${lyrics}

DIRECTIVE: ${vocalDirective}

REQUIREMENT: Generate ${bars * 2}-${bars * 6} note objects in {"data":[...]} format. Include "syllable" for each note from the lyrics.
Sing in 2-4 bar phrases with breathing gaps. Shape phrases with an arc contour.
Output ONLY the JSON. No explanation.`.trim();

      try {
        vocalRaw = await callArrayAgent(client, VOCAL_SYSTEM, vocalUserPrompt, model);
        sse(res, { type: 'log', line: `[Vocal] Vocal melody mapped. Ready.` });
      } catch (e) {
        console.warn('[orchestrate-band] Vocal agent failed:', e);
        vocalRaw = '[]';
        sse(res, { type: 'log', line: `[Vocal] Agent failed, yielding empty track.` });
      }
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

    if (!Array.isArray(bassNotes)) {
      bassNotes = [];
    }
    if (!Array.isArray(drumHits) || drumHits.length === 0) {
      sse(res, { type: 'log', line: `[Drums] Parsed drum data was empty. Rebuilding with built-in ${directive.feel} fallback groove.` });
      drumHits = buildFallbackDrumPattern(bars, genre, directive.feel);
    }

    // Safety clamping + flat→sharp normalization
    bassNotes = (bassNotes as { bar: number; beat: number; note: string; duration: string; velocity: number }[]).map(n => ({
      ...n,
      bar:      Math.min(Math.max(Math.round(n.bar),  1), bars),
      beat:     Math.min(Math.max(n.beat,             1), 4),
      note:     normalizeNote(n.note),
      velocity: Math.min(Math.max(Math.round(n.velocity), 60), 110),
    }));

    drumHits = (drumHits as { bar: number; beat: number; instrument: string; velocity: number }[]).map(h => ({
      ...h,
      bar:      Math.min(Math.max(Math.round(h.bar),  1), bars),
      beat:     Math.min(Math.max(h.beat,             1), 4.99),
      velocity: Math.min(Math.max(Math.round(h.velocity), 35), 127),
    }));

    // Clamp melody notes
    if (melodyNotes && Array.isArray(melodyNotes)) {
      melodyNotes = (melodyNotes as Record<string, unknown>[]).map((n) => ({
        ...n,
        bar:      Math.min(Math.max(Math.round(Number(n.bar) || 1), 1), bars),
        beat:     Math.min(Math.max(Number(n.beat) || 1, 1), 4.5),
        note:     typeof n.note === 'string' ? normalizeNote(n.note) : n.note,
        velocity: Math.min(Math.max(Math.round(Number(n.velocity) || 80), 70), 100),
      }));
    }

    // Clamp keys chords
    if (keysChords && Array.isArray(keysChords)) {
      keysChords = (keysChords as Record<string, unknown>[]).map((c) => ({
        ...c,
        bar:      Math.min(Math.max(Math.round(Number(c.bar) || 1), 1), bars),
        beat:     Math.min(Math.max(Number(c.beat) || 1, 1), 4),
        notes:    Array.isArray(c.notes) ? normalizeNotes(c.notes as string[]) : c.notes,
        velocity: Math.min(Math.max(Math.round(Number(c.velocity) || 70), 60), 85),
      }));
    }

    // Clamp vocal notes
    if (vocalNotes && Array.isArray(vocalNotes)) {
      vocalNotes = (vocalNotes as Record<string, unknown>[]).map((n) => ({
        ...n,
        bar:      Math.min(Math.max(Math.round(Number(n.bar) || 1), 1), bars),
        beat:     Math.min(Math.max(Number(n.beat) || 1, 1), 4.5),
        note:     typeof n.note === 'string' ? normalizeNote(n.note) : n.note,
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
    if (directive.swing != null) midiPayload.swing = directive.swing;
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
