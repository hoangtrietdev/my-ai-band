import { BandOutput } from './schemas';

/**
 * Full mock response for a 4-bar ii-V-I-VI (Dm7-G7-Cmaj7-Am7) jazz progression
 * at 120 BPM in C major. Used for UI testing without real API calls.
 * Includes melody, keys, and vocal tracks for Phase 5.
 */
export const MOCK_RESPONSE: BandOutput = {
  success: true,
  logs: [
    '[Producer] Initializing Virtual AI Band session...',
    '[Producer] Analyzing musical context: 120 BPM | Jazz | C Major | 4 bars',
    '[Producer] Detected ii-V-I-VI progression: Dm7 → G7 → Cmaj7 → Am7',
    '[Producer] Harmonic strategy: walking bass, jazz ride groove, melodic lead, chord voicings.',
    '[Producer → Bass] DIRECTIVE: Compose a walking bass line over Dm7 (bar 1), G7 (bar 2), Cmaj7 (bar 3), Am7 (bar 4).',
    '[Bass] Walking bass complete. 16 notes across 4 bars.',
    '[Producer → Drums] DIRECTIVE: Jazz ride pattern. Ride on all beats, snare 2&4, kick 1&3.',
    '[Drums] Jazz groove pattern complete. 40 events across 4 bars.',
    '[Producer → Melody] DIRECTIVE: Play a lyrical melody outlining Dm7→G7→Cmaj7→Am7 in octave 4-5.',
    '[Melody] Lead melody composed. 20 notes across 4 bars.',
    '[Producer → Keys] DIRECTIVE: Comp with 7th-chord voicings: Dm7, G7, Cmaj7, Am7.',
    '[Keys] Chord voicings locked. 8 chords across 4 bars.',
    '[Producer → Vocal] DIRECTIVE: Sing a gentle "la la" melody over the changes.',
    '[Vocal] Vocal melody mapped. 12 notes across 4 bars.',
    '[Producer] ✓ All 5 tracks compiled — press PLAY!',
  ],
  midi_data: {
    bpm: 120,
    total_bars: 4,
    bass: [
      { bar: 1, beat: 1, note: 'D2', duration: '4n', velocity: 95 },
      { bar: 1, beat: 2, note: 'F2', duration: '4n', velocity: 78 },
      { bar: 1, beat: 3, note: 'A2', duration: '4n', velocity: 85 },
      { bar: 1, beat: 4, note: 'C3', duration: '4n', velocity: 72 },
      { bar: 2, beat: 1, note: 'G2', duration: '4n', velocity: 95 },
      { bar: 2, beat: 2, note: 'B2', duration: '4n', velocity: 76 },
      { bar: 2, beat: 3, note: 'D3', duration: '4n', velocity: 83 },
      { bar: 2, beat: 4, note: 'F2', duration: '4n', velocity: 70 },
      { bar: 3, beat: 1, note: 'C2', duration: '4n', velocity: 98 },
      { bar: 3, beat: 2, note: 'E2', duration: '4n', velocity: 74 },
      { bar: 3, beat: 3, note: 'G2', duration: '4n', velocity: 82 },
      { bar: 3, beat: 4, note: 'B2', duration: '4n', velocity: 69 },
      { bar: 4, beat: 1, note: 'A2', duration: '4n', velocity: 95 },
      { bar: 4, beat: 2, note: 'C3', duration: '4n', velocity: 77 },
      { bar: 4, beat: 3, note: 'E3', duration: '4n', velocity: 84 },
      { bar: 4, beat: 4, note: 'G2', duration: '4n', velocity: 71 },
    ],
    drums: [
      ...([1, 2, 3, 4] as const).flatMap((bar) => [
        { bar, beat: 1,   instrument: 'kick'  as const, velocity: 100 },
        { bar, beat: 1,   instrument: 'ride'  as const, velocity: 65  },
        { bar, beat: 1.5, instrument: 'ride'  as const, velocity: 50  },
        { bar, beat: 2,   instrument: 'snare' as const, velocity: 92  },
        { bar, beat: 2,   instrument: 'ride'  as const, velocity: 65  },
        { bar, beat: 2,   instrument: 'hihat' as const, velocity: 55  },
        { bar, beat: 2.5, instrument: 'ride'  as const, velocity: 48  },
        { bar, beat: 3,   instrument: 'kick'  as const, velocity: 88  },
        { bar, beat: 3,   instrument: 'ride'  as const, velocity: 65  },
        { bar, beat: 3.5, instrument: 'ride'  as const, velocity: 50  },
        { bar, beat: 4,   instrument: 'snare' as const, velocity: 90  },
        { bar, beat: 4,   instrument: 'ride'  as const, velocity: 65  },
        { bar, beat: 4,   instrument: 'hihat' as const, velocity: 55  },
        { bar, beat: 4.5, instrument: 'ride'  as const, velocity: 48  },
      ]),
    ],
    melody: [
      // Bar 1 — Dm7 melody
      { bar: 1, beat: 1,   note: 'D4', duration: '4n', velocity: 85 },
      { bar: 1, beat: 2,   note: 'F4', duration: '8n', velocity: 78 },
      { bar: 1, beat: 2.5, note: 'E4', duration: '8n', velocity: 75 },
      { bar: 1, beat: 3,   note: 'A4', duration: '4n', velocity: 82 },
      { bar: 1, beat: 4,   note: 'G4', duration: '8n', velocity: 76 },
      // Bar 2 — G7 melody
      { bar: 2, beat: 1,   note: 'G4', duration: '4n', velocity: 88 },
      { bar: 2, beat: 2,   note: 'B4', duration: '8n', velocity: 80 },
      { bar: 2, beat: 2.5, note: 'A4', duration: '8n', velocity: 75 },
      { bar: 2, beat: 3,   note: 'D5', duration: '4n', velocity: 85 },
      { bar: 2, beat: 4,   note: 'C5', duration: '8n', velocity: 78 },
      // Bar 3 — Cmaj7 melody
      { bar: 3, beat: 1,   note: 'C5', duration: '4n', velocity: 90 },
      { bar: 3, beat: 2,   note: 'E5', duration: '8n', velocity: 82 },
      { bar: 3, beat: 2.5, note: 'D5', duration: '8n', velocity: 78 },
      { bar: 3, beat: 3,   note: 'G4', duration: '4n', velocity: 80 },
      { bar: 3, beat: 4,   note: 'B4', duration: '4n', velocity: 76 },
      // Bar 4 — Am7 melody
      { bar: 4, beat: 1,   note: 'A4', duration: '4n', velocity: 86 },
      { bar: 4, beat: 2,   note: 'C5', duration: '8n', velocity: 80 },
      { bar: 4, beat: 2.5, note: 'B4', duration: '8n', velocity: 75 },
      { bar: 4, beat: 3,   note: 'E4', duration: '4n', velocity: 82 },
      { bar: 4, beat: 4,   note: 'D4', duration: '4n', velocity: 78 },
    ],
    keys: [
      // Bar 1 — Dm7 voicing
      { bar: 1, beat: 1, notes: ['D3', 'F3', 'A3', 'C4'], duration: '2n', velocity: 70 },
      { bar: 1, beat: 3, notes: ['D3', 'F3', 'A3', 'C4'], duration: '2n', velocity: 65 },
      // Bar 2 — G7 voicing
      { bar: 2, beat: 1, notes: ['G3', 'B3', 'D4', 'F4'], duration: '2n', velocity: 72 },
      { bar: 2, beat: 3, notes: ['G3', 'B3', 'D4', 'F4'], duration: '2n', velocity: 68 },
      // Bar 3 — Cmaj7 voicing
      { bar: 3, beat: 1, notes: ['C3', 'E3', 'G3', 'B3'], duration: '2n', velocity: 75 },
      { bar: 3, beat: 3, notes: ['C3', 'E3', 'G3', 'B3'], duration: '2n', velocity: 70 },
      // Bar 4 — Am7 voicing
      { bar: 4, beat: 1, notes: ['A3', 'C4', 'E4', 'G4'], duration: '2n', velocity: 72 },
      { bar: 4, beat: 3, notes: ['A3', 'C4', 'E4', 'G4'], duration: '2n', velocity: 67 },
    ],
    vocal: [
      { bar: 1, beat: 1, note: 'D4', duration: '4n', velocity: 80, syllable: 'la' },
      { bar: 1, beat: 2, note: 'F4', duration: '4n', velocity: 75, syllable: 'la' },
      { bar: 1, beat: 3, note: 'A4', duration: '2n', velocity: 78, syllable: 'laa' },
      { bar: 2, beat: 1, note: 'G4', duration: '4n', velocity: 82, syllable: 'da' },
      { bar: 2, beat: 2, note: 'B4', duration: '4n', velocity: 78, syllable: 'da' },
      { bar: 2, beat: 3, note: 'D5', duration: '2n', velocity: 80, syllable: 'daa' },
      { bar: 3, beat: 1, note: 'C5', duration: '4n', velocity: 85, syllable: 'ooh' },
      { bar: 3, beat: 2, note: 'E5', duration: '4n', velocity: 80, syllable: 'aah' },
      { bar: 3, beat: 3, note: 'G4', duration: '2n', velocity: 78, syllable: 'mmm' },
      { bar: 4, beat: 1, note: 'A4', duration: '4n', velocity: 82, syllable: 'la' },
      { bar: 4, beat: 2, note: 'C5', duration: '4n', velocity: 78, syllable: 'la' },
      { bar: 4, beat: 3, note: 'E4', duration: '2n', velocity: 75, syllable: 'laa' },
    ],
  },
};
