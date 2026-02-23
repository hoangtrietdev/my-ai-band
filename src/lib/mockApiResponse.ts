import { BandOutput } from './schemas';

/**
 * Full mock response for a 4-bar ii-V-I-VI (Dm7-G7-Cmaj7-Am7) jazz progression
 * at 120 BPM in C major. Used during Phase 2 for UI testing without real API calls.
 */
export const MOCK_RESPONSE: BandOutput = {
  success: true,
  logs: [
    '[Producer] Initializing Virtual AI Band session...',
    '[Producer] Analyzing musical context: 120 BPM | Jazz | C Major | 4 bars',
    '[Producer] Detected ii-V-I-VI progression: Dm7 → G7 → Cmaj7 → Am7',
    '[Producer] Harmonic strategy: walking bass with chord tones, jazz ride groove.',
    '[Producer → Bass] DIRECTIVE: Compose a walking bass line over Dm7 (bar 1), G7 (bar 2), Cmaj7 (bar 3), Am7 (bar 4). Quarter-note feel, range C2-D3. Emphasize root on beat 1, chromatic approach on beat 4.',
    '[Bass] Understood. Initiating walking bass composition for 4 bars...',
    '[Bass] Bar 1 (Dm7): D2-F2-A2-C3 with chromatic approach.',
    '[Bass] Bar 2 (G7): G2-B2-D3-F2 with resolution pull.',
    '[Bass] Bar 3 (Cmaj7): C2-E2-G2-B2 with ascending line.',
    '[Bass] Bar 4 (Am7): A2-C3-E3-G2 with descending resolution.',
    '[Bass → Producer] Walking bass complete. 16 notes across 4 bars. Ready.',
    '[Producer → Drums] DIRECTIVE: Jazz ride pattern. Ride cymbal on all beats with swing 8ths. Snare on beats 2 and 4. Kick on beat 1 and beat 3. Hi-hat pedal on 2+4. 4 bars.',
    '[Drums] Understood. Composing jazz ride pattern...',
    '[Drums] Setting up ride cymbal ostinato with swing feel...',
    '[Drums] Placing snare backbeat on 2 and 4...',
    '[Drums] Adding kick drum on 1 and 3...',
    '[Drums → Producer] Jazz groove pattern complete. 40 events across 4 bars. Ready.',
    '[Producer] Verifying musical coherence... ✓',
    '[Producer] All parts aligned to tempo grid at 120 BPM.',
    '[Producer] Compilation complete. Dispatching to frontend synthesizer.',
  ],
  midi_data: {
    bpm: 120,
    total_bars: 4,
    bass: [
      // Bar 1 — Dm7: D2 F2 A2 C3
      { bar: 1, beat: 1, note: 'D2', duration: '4n', velocity: 95 },
      { bar: 1, beat: 2, note: 'F2', duration: '4n', velocity: 78 },
      { bar: 1, beat: 3, note: 'A2', duration: '4n', velocity: 85 },
      { bar: 1, beat: 4, note: 'C3', duration: '4n', velocity: 72 },
      // Bar 2 — G7: G2 B2 D3 F2
      { bar: 2, beat: 1, note: 'G2', duration: '4n', velocity: 95 },
      { bar: 2, beat: 2, note: 'B2', duration: '4n', velocity: 76 },
      { bar: 2, beat: 3, note: 'D3', duration: '4n', velocity: 83 },
      { bar: 2, beat: 4, note: 'F2', duration: '4n', velocity: 70 },
      // Bar 3 — Cmaj7: C2 E2 G2 B2
      { bar: 3, beat: 1, note: 'C2', duration: '4n', velocity: 98 },
      { bar: 3, beat: 2, note: 'E2', duration: '4n', velocity: 74 },
      { bar: 3, beat: 3, note: 'G2', duration: '4n', velocity: 82 },
      { bar: 3, beat: 4, note: 'B2', duration: '4n', velocity: 69 },
      // Bar 4 — Am7: A2 C3 E3 G2
      { bar: 4, beat: 1, note: 'A2', duration: '4n', velocity: 95 },
      { bar: 4, beat: 2, note: 'C3', duration: '4n', velocity: 77 },
      { bar: 4, beat: 3, note: 'E3', duration: '4n', velocity: 84 },
      { bar: 4, beat: 4, note: 'G2', duration: '4n', velocity: 71 },
    ],
    drums: [
      // Repeat pattern across 4 bars
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
  },
};
