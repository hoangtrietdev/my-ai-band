import {
  BandOutput, BassNote, DrumHit, MelodyNote, KeysChord, VocalNote,
  TrackName,
} from './schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function vel(base: number, spread = 12): number {
  return Math.max(40, Math.min(127, base + randInt(-spread, spread)));
}

function noteIdx(name: string): number {
  const n = FLAT_TO_SHARP[name] ?? name;
  return NOTE_NAMES.indexOf(n as (typeof NOTE_NAMES)[number]);
}

function getScale(root: string, quality: 'major' | 'minor'): string[] {
  const ri = noteIdx(root);
  return (quality === 'major' ? MAJOR : MINOR).map(i => NOTE_NAMES[(ri + i) % 12]);
}

function n(name: string, oct: number): string {
  return `${name}${oct}`;
}

function parseKey(key: string): { root: string; quality: 'major' | 'minor' } {
  const [rawRoot, q] = key.split(' ');
  return { root: FLAT_TO_SHARP[rawRoot] ?? rawRoot, quality: q === 'minor' ? 'minor' : 'major' };
}

// ─── Bass Generator ──────────────────────────────────────────────────────────

type BassDur = '4n' | '8n' | '2n';

function generateBass(bars: number, scale: string[]): BassNote[] {
  const out: BassNote[] = [];
  for (let bar = 1; bar <= bars; bar++) {
    const pat = pick(['walk4', 'walk3', 'half2', 'sync'] as const);
    switch (pat) {
      case 'walk4':
        for (let b = 1; b <= 4; b++)
          out.push({ bar, beat: b, note: n(pick(scale), pick([2, 2, 2, 3])), duration: '4n', velocity: vel(b === 1 ? 94 : 76) });
        break;
      case 'walk3':
        if (Math.random() > 0.5) {
          out.push({ bar, beat: 1, note: n(pick(scale), 2), duration: '2n', velocity: vel(92) });
          out.push({ bar, beat: 3, note: n(pick(scale), pick([2, 3])), duration: '4n', velocity: vel(78) });
          out.push({ bar, beat: 4, note: n(pick(scale), pick([2, 3])), duration: '4n', velocity: vel(72) });
        } else {
          out.push({ bar, beat: 1, note: n(pick(scale), 2), duration: '4n', velocity: vel(92) });
          out.push({ bar, beat: 2, note: n(pick(scale), pick([2, 3])), duration: '4n', velocity: vel(78) });
          out.push({ bar, beat: 3, note: n(pick(scale), 2), duration: '2n', velocity: vel(82) });
        }
        break;
      case 'half2':
        out.push({ bar, beat: 1, note: n(scale[0], 2), duration: '2n', velocity: vel(94) });
        out.push({ bar, beat: 3, note: n(pick(scale.slice(2, 6)), pick([2, 3])), duration: '2n', velocity: vel(80) });
        break;
      case 'sync':
        out.push({ bar, beat: 1, note: n(pick(scale), 2), duration: '8n' as BassDur, velocity: vel(92) });
        out.push({ bar, beat: 1.5, note: n(pick(scale), 2), duration: '8n' as BassDur, velocity: vel(68) });
        out.push({ bar, beat: 2, note: n(pick(scale), pick([2, 3])), duration: '4n', velocity: vel(78) });
        out.push({ bar, beat: 3, note: n(pick(scale), 2), duration: '4n', velocity: vel(86) });
        out.push({ bar, beat: 4, note: n(pick(scale), pick([2, 3])), duration: '8n' as BassDur, velocity: vel(72) });
        break;
    }
  }
  return out;
}

// ─── Drums Generator ─────────────────────────────────────────────────────────

const KICK_PATS  = [[1, 3], [1, 2.5, 4], [1, 3, 3.5], [1], [1, 2, 3, 4]];
const SNARE_PATS = [[2, 4], [2, 4, 4.5], [2, 3, 4], [2, 4]];
const HH_PATS    = [
  [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5],
  [1, 2, 3, 4],
  [1.5, 2.5, 3.5, 4.5],
  [1, 1.5, 2, 3, 3.5, 4],
];

function generateDrums(bars: number): DrumHit[] {
  const out: DrumHit[] = [];
  for (let bar = 1; bar <= bars; bar++) {
    const kicks  = pick(KICK_PATS);
    const snares = pick(SNARE_PATS);
    const cymbal = pick(['ride', 'hihat', 'hihat'] as const);
    const hh     = pick(HH_PATS);

    for (const b of kicks)  out.push({ bar, beat: b, instrument: 'kick',  velocity: vel(96) });
    for (const b of snares) out.push({ bar, beat: b, instrument: 'snare', velocity: vel(b % 1 ? 55 : 90) });
    for (const b of hh)     out.push({ bar, beat: b, instrument: cymbal,  velocity: vel(b % 1 === 0 ? 64 : 48) });

    if (bar === 1 || (bar % 4 === 1 && Math.random() > 0.5))
      out.push({ bar, beat: 1, instrument: 'crash', velocity: vel(85) });
    if (Math.random() > 0.78)
      out.push({ bar, beat: pick([3.5, 4, 4.5]), instrument: 'tom', velocity: vel(72) });
  }
  return out;
}

// ─── Melody Generator ────────────────────────────────────────────────────────

type MelDur = '4n' | '8n' | '2n' | '4n.';
const MEL_DURS: MelDur[] = ['4n', '4n', '8n', '8n', '2n', '4n.'];
const DUR_BEATS: Record<MelDur, number> = { '2n': 2, '4n.': 1.5, '4n': 1, '8n': 0.5 };

function generateMelody(bars: number, scale: string[]): MelodyNote[] {
  const out: MelodyNote[] = [];
  for (let bar = 1; bar <= bars; bar++) {
    const max = pick([2, 3, 4, 5]);
    let beat = 1;
    let ct = 0;
    while (beat <= 4 && ct < max) {
      const dur = pick(MEL_DURS);
      if (beat + DUR_BEATS[dur] > 5) break;
      out.push({ bar, beat, note: n(pick(scale), pick([4, 4, 4, 5])), duration: dur, velocity: vel(beat === 1 ? 84 : 76) });
      beat += DUR_BEATS[dur];
      if (max <= 3 && Math.random() > 0.5) beat += pick([0.5, 1]);
      ct++;
    }
  }
  return out;
}

// ─── Keys Generator ──────────────────────────────────────────────────────────

type KeysDur = '1n' | '2n' | '4n' | '4n.';

function generateKeys(bars: number, scale: string[]): KeysChord[] {
  const out: KeysChord[] = [];
  const chord = (): string[] => {
    const ri = randInt(0, 6);
    const notes = [
      n(scale[ri], 3),
      n(scale[(ri + 2) % 7], 3),
      n(scale[(ri + 4) % 7], 3),
    ];
    if (Math.random() > 0.3) notes.push(n(scale[(ri + 6) % 7], 4));
    return notes;
  };
  for (let bar = 1; bar <= bars; bar++) {
    const pat = pick(['whole', 'half', 'qqh', 'sync'] as const);
    switch (pat) {
      case 'whole':
        out.push({ bar, beat: 1, notes: chord(), duration: '1n' as KeysDur, velocity: vel(70) });
        break;
      case 'half':
        out.push({ bar, beat: 1, notes: chord(), duration: '2n' as KeysDur, velocity: vel(72) });
        out.push({ bar, beat: 3, notes: chord(), duration: '2n' as KeysDur, velocity: vel(66) });
        break;
      case 'qqh':
        out.push({ bar, beat: 1, notes: chord(), duration: '4n' as KeysDur, velocity: vel(72) });
        out.push({ bar, beat: 2, notes: chord(), duration: '4n' as KeysDur, velocity: vel(66) });
        out.push({ bar, beat: 3, notes: chord(), duration: '2n' as KeysDur, velocity: vel(70) });
        break;
      case 'sync':
        out.push({ bar, beat: 1, notes: chord(), duration: '4n.' as KeysDur, velocity: vel(72) });
        out.push({ bar, beat: 2.5, notes: chord(), duration: '4n' as KeysDur, velocity: vel(64) });
        out.push({ bar, beat: 3.5, notes: chord(), duration: '4n' as KeysDur, velocity: vel(66) });
        break;
    }
  }
  return out;
}

// ─── Vocal Generator ─────────────────────────────────────────────────────────

const SYLLABLES = ['la', 'da', 'ooh', 'aah', 'mmm', 'doo', 'wah', 'hey', 'oh', 'na', 'ba', 'dee'];

function generateVocal(bars: number, scale: string[]): VocalNote[] {
  const out: VocalNote[] = [];
  const durs: ('4n' | '8n' | '2n')[] = ['4n', '4n', '8n', '2n'];
  for (let bar = 1; bar <= bars; bar++) {
    const count = randInt(2, 4);
    let beat = 1;
    for (let i = 0; i < count && beat <= 4; i++) {
      const d = pick(durs);
      const db = d === '2n' ? 2 : d === '4n' ? 1 : 0.5;
      if (beat + db > 5) break;
      out.push({ bar, beat, note: n(pick(scale), 4), duration: d, velocity: vel(78), syllable: pick(SYLLABLES) });
      beat += db;
    }
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MockParams {
  bpm: number;
  bars: number;
  musicalKey: string;
  genre: string;
  selectedTracks: TrackName[];
}

/**
 * Generate a fully randomized mock BandOutput.
 * Each call produces different patterns, velocities, and note choices
 * while staying within the requested key and scale.
 */
export function generateMockResponse(params: MockParams): BandOutput {
  const { bpm, bars, musicalKey, genre, selectedTracks } = params;
  const { root, quality } = parseKey(musicalKey);
  const scale = getScale(root, quality);

  const hasMelody = selectedTracks.includes('melody');
  const hasKeys   = selectedTracks.includes('keys');
  const hasVocal  = selectedTracks.includes('vocal');

  const bass  = generateBass(bars, scale);
  const drums = generateDrums(bars);
  const melody = hasMelody ? generateMelody(bars, scale) : undefined;
  const keys   = hasKeys   ? generateKeys(bars, scale) : undefined;
  const vocal  = hasVocal  ? generateVocal(bars, scale) : undefined;

  const trackCount = 2 + (hasMelody ? 1 : 0) + (hasKeys ? 1 : 0) + (hasVocal ? 1 : 0);
  const keyLabel = `${musicalKey.charAt(0).toUpperCase()}${musicalKey.slice(1)}`;

  const logs: string[] = [
    '[Producer] Initializing Virtual AI Band session...',
    `[Producer] Analyzing musical context: ${bpm} BPM | ${genre.toUpperCase()} | ${keyLabel} | ${bars} bars`,
    `[Producer] Scale: ${scale.join(' ')} (${quality})`,
    `[Producer] Harmonic strategy: ${pick(['walking bass', 'root-fifth groove', 'chromatic approach'])} + ${pick(['swing feel', 'straight groove', 'syncopated pocket'])}.`,
    `[Producer → Bass] DIRECTIVE: Compose a ${pick(['walking', 'grooving', 'syncopated'])} bass line in ${keyLabel}.`,
    `[Bass] Bass complete. ${bass.length} notes across ${bars} bars.`,
    `[Producer → Drums] DIRECTIVE: Build a ${pick(['driving', 'laid-back', 'funky', 'jazzy'])} ${genre} beat.`,
    `[Drums] Groove complete. ${drums.length} events across ${bars} bars.`,
  ];

  if (hasMelody && melody) {
    logs.push(`[Producer → Melody] DIRECTIVE: Play a ${pick(['lyrical', 'angular', 'bluesy', 'flowing'])} melody in ${keyLabel}.`);
    logs.push(`[Melody] Lead melody composed. ${melody.length} notes across ${bars} bars.`);
  }
  if (hasKeys && keys) {
    logs.push(`[Producer → Keys] DIRECTIVE: Comp with ${pick(['7th-chord', 'triad', 'open', 'rootless'])} voicings.`);
    logs.push(`[Keys] Chord voicings locked. ${keys.length} chords across ${bars} bars.`);
  }
  if (hasVocal && vocal) {
    logs.push(`[Producer → Vocal] DIRECTIVE: Sing a ${pick(['gentle', 'soulful', 'breathy', 'bright'])} melody.`);
    logs.push(`[Vocal] Vocal melody mapped. ${vocal.length} notes across ${bars} bars.`);
  }

  logs.push(`[Producer] ✓ All ${trackCount} tracks compiled — press PLAY!`);

  return {
    success: true,
    logs,
    midi_data: { bpm, total_bars: bars, bass, drums, melody, keys, vocal },
  };
}
