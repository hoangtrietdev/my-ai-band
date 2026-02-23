import { z } from 'zod';

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

export const MidiDataSchema = z.object({
  bpm:        z.number().positive(),
  total_bars: z.number().int().positive(),
  bass:       z.array(BassNoteSchema),
  drums:      z.array(DrumHitSchema),
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
  producer_logs:   z.array(z.string()),
  bass_directive:  z.string(),
  drums_directive: z.string(),
  chord_roots:     z.array(z.string()),
  feel:            z.string(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type BassNote       = z.infer<typeof BassNoteSchema>;
export type DrumHit        = z.infer<typeof DrumHitSchema>;
export type MidiData       = z.infer<typeof MidiDataSchema>;
export type BandOutput     = z.infer<typeof BandOutputSchema>;
export type BandError      = z.infer<typeof BandErrorSchema>;
export type ProducerDirective = z.infer<typeof ProducerDirectiveSchema>;
