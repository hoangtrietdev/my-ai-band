import { z } from 'zod';

// ─── Track Names ──────────────────────────────────────────────────────────────

export const TRACK_NAMES = ['guitar', 'bass', 'drums', 'melody', 'keys', 'vocal'] as const;
export type TrackName = (typeof TRACK_NAMES)[number];

// ─── Note / Hit Schemas ───────────────────────────────────────────────────────

export const BassNoteSchema = z.object({
  bar:      z.number().int().positive(),
  beat:     z.number().positive(),
  note:     z.string().regex(/^[A-G]#?[0-9]$/, 'Invalid note format, e.g. "C2"'),
  duration: z.enum(['1n', '2n', '4n', '8n', '16n', '4n.', '8n.']),
  velocity: z.number().min(0).max(127),
});

export const DrumHitSchema = z.object({
  bar:        z.number().int().positive(),
  beat:       z.number().positive(),
  instrument: z.enum(['kick', 'snare', 'hihat', 'ride', 'crash', 'tom']),
  velocity:   z.number().min(0).max(127),
});

export const MelodyNoteSchema = z.object({
  bar:      z.number().int().positive(),
  beat:     z.number().positive(),
  note:     z.string().regex(/^[A-G]#?[0-9]$/, 'Invalid note format, e.g. "E4"'),
  duration: z.enum(['1n', '2n', '4n', '8n', '16n', '4n.', '8n.']),
  velocity: z.number().min(0).max(127),
});

export const KeysChordSchema = z.object({
  bar:      z.number().int().positive(),
  beat:     z.number().positive(),
  notes:    z.array(z.string().regex(/^[A-G]#?[0-9]$/)).min(2).max(5),
  duration: z.enum(['1n', '2n', '4n', '8n', '4n.']),
  velocity: z.number().min(0).max(127),
});

export const VocalNoteSchema = z.object({
  bar:      z.number().int().positive(),
  beat:     z.number().positive(),
  note:     z.string().regex(/^[A-G]#?[0-9]$/, 'Invalid note format, e.g. "G4"'),
  duration: z.enum(['1n', '2n', '4n', '8n', '16n', '4n.', '8n.']),
  velocity: z.number().min(0).max(127),
  syllable: z.string().max(20).optional(),
});

export const MidiDataSchema = z.object({
  bpm:        z.number().positive(),
  total_bars: z.number().int().positive(),
  bass:       z.array(BassNoteSchema),
  drums:      z.array(DrumHitSchema),
  melody:     z.array(MelodyNoteSchema).optional(),
  keys:       z.array(KeysChordSchema).optional(),
  vocal:      z.array(VocalNoteSchema).optional(),
});

// ─── API Response Schemas ─────────────────────────────────────────────────────

export const BandOutputSchema = z.object({
  success:   z.literal(true),
  logs:      z.array(z.string()),
  midi_data: MidiDataSchema,
});

export const BandErrorSchema = z.object({
  success: z.literal(false),
  error:   z.string(),
  logs:    z.array(z.string()),
});

// ─── Producer Directive (internal, from first LLM call) ──────────────────────

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

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type BassNote          = z.infer<typeof BassNoteSchema>;
export type DrumHit           = z.infer<typeof DrumHitSchema>;
export type MelodyNote        = z.infer<typeof MelodyNoteSchema>;
export type KeysChord         = z.infer<typeof KeysChordSchema>;
export type VocalNote         = z.infer<typeof VocalNoteSchema>;
export type MidiData          = z.infer<typeof MidiDataSchema>;
export type BandOutput        = z.infer<typeof BandOutputSchema>;
export type BandError         = z.infer<typeof BandErrorSchema>;
export type ProducerDirective = z.infer<typeof ProducerDirectiveSchema>;
