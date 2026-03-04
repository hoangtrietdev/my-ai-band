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
const BLUES = [0, 3, 5, 6, 7, 10];            // blues scale intervals
const PENTATONIC_MAJ = [0, 2, 4, 7, 9];       // major pentatonic
const PENTATONIC_MIN = [0, 3, 5, 7, 10];      // minor pentatonic

type Genre = 'jazz' | 'pop' | 'blues' | 'funk' | 'bossa nova' | 'lo-fi' | 'rock';

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
  const nn = FLAT_TO_SHARP[name] ?? name;
  return NOTE_NAMES.indexOf(nn as (typeof NOTE_NAMES)[number]);
}

function getScale(root: string, quality: 'major' | 'minor'): string[] {
  const ri = noteIdx(root);
  return (quality === 'major' ? MAJOR : MINOR).map(i => NOTE_NAMES[(ri + i) % 12]);
}

/** Get a special genre-coloured scale for melody/solo lines. */
function getGenreScale(root: string, quality: 'major' | 'minor', genre: Genre): string[] {
  const ri = noteIdx(root);
  switch (genre) {
    case 'blues':
      return BLUES.map(i => NOTE_NAMES[(ri + i) % 12]);
    case 'rock':
      return (quality === 'minor' ? PENTATONIC_MIN : PENTATONIC_MAJ)
        .map(i => NOTE_NAMES[(ri + i) % 12]);
    case 'jazz':
      // Use full diatonic scale but add chromatic neighbor tones when picking
      return getScale(root, quality);
    default:
      return getScale(root, quality);
  }
}

function nt(name: string, oct: number): string {
  return `${name}${oct}`;
}

function parseKey(key: string): { root: string; quality: 'major' | 'minor' } {
  const [rawRoot, q] = key.split(' ');
  return { root: FLAT_TO_SHARP[rawRoot] ?? rawRoot, quality: q === 'minor' ? 'minor' : 'major' };
}

/** Return chromatic neighbor a half-step below a scale tone. */
function chromaticApproach(target: string): string {
  const idx = NOTE_NAMES.indexOf(target as (typeof NOTE_NAMES)[number]);
  return NOTE_NAMES[(idx - 1 + 12) % 12];
}

// ─── Bass Generator (genre-aware) ────────────────────────────────────────────

type BassDur = '4n' | '8n' | '2n' | '16n';

function generateBass(bars: number, scale: string[], genre: Genre): BassNote[] {
  const out: BassNote[] = [];

  for (let bar = 1; bar <= bars; bar++) {
    switch (genre) {

      // ── Jazz: walking bass (quarter notes, chromatic approach) ──────────
      case 'jazz': {
        for (let b = 1; b <= 4; b++) {
          const target = pick(scale);
          // On beat 4, sometimes use chromatic approach to next bar's root
          const note = (b === 4 && Math.random() > 0.4)
            ? nt(chromaticApproach(scale[0]), 2)
            : nt(target, pick([2, 2, 2, 3]));
          out.push({ bar, beat: b, note, duration: '4n', velocity: vel(b === 1 ? 94 : 74) });
        }
        break;
      }

      // ── Rock: driving root-heavy eighth-note patterns ──────────────────
      case 'rock': {
        const root = scale[0];
        const fifth = scale[4] ?? scale[0];
        const pat = pick(['eighths', 'power', 'gallop'] as const);
        switch (pat) {
          case 'eighths':
            for (let b = 1; b <= 4; b++) {
              out.push({ bar, beat: b,       note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(96) });
              out.push({ bar, beat: b + 0.5, note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(70) });
            }
            break;
          case 'power':
            out.push({ bar, beat: 1, note: nt(root, 2),  duration: '4n', velocity: vel(100) });
            out.push({ bar, beat: 2, note: nt(root, 2),  duration: '4n', velocity: vel(88) });
            out.push({ bar, beat: 3, note: nt(fifth, 2), duration: '4n', velocity: vel(92) });
            out.push({ bar, beat: 4, note: nt(pick(scale.slice(0, 5)), 2), duration: '4n', velocity: vel(82) });
            break;
          case 'gallop':
            out.push({ bar, beat: 1,   note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(100) });
            out.push({ bar, beat: 1.5, note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(72) });
            out.push({ bar, beat: 2,   note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(72) });
            out.push({ bar, beat: 3,   note: nt(fifth, 2), duration: '4n', velocity: vel(92) });
            out.push({ bar, beat: 4,   note: nt(pick(scale), 2), duration: '4n', velocity: vel(80) });
            break;
        }
        break;
      }

      // ── Blues: shuffle feel, root-b7-root, walking chromatic ────────────
      case 'blues': {
        const root = scale[0];
        const b7   = scale[5] ?? scale[4]; // flat-7 in blues scale
        const pat  = pick(['shuffle', 'walkChrom'] as const);
        switch (pat) {
          case 'shuffle':
            out.push({ bar, beat: 1,   note: nt(root, 2), duration: '4n', velocity: vel(96) });
            out.push({ bar, beat: 2,   note: nt(b7, 2),   duration: '8n' as BassDur, velocity: vel(72) });
            out.push({ bar, beat: 2.5, note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(68) });
            out.push({ bar, beat: 3,   note: nt(root, 2), duration: '4n', velocity: vel(88) });
            out.push({ bar, beat: 4,   note: nt(b7, 2),   duration: '4n', velocity: vel(74) });
            break;
          case 'walkChrom':
            out.push({ bar, beat: 1, note: nt(root, 2), duration: '4n', velocity: vel(94) });
            out.push({ bar, beat: 2, note: nt(scale[2] ?? root, 2), duration: '4n', velocity: vel(78) });
            out.push({ bar, beat: 3, note: nt(scale[3] ?? root, 2), duration: '4n', velocity: vel(80) });
            out.push({ bar, beat: 4, note: nt(chromaticApproach(root), 2), duration: '4n', velocity: vel(72) });
            break;
        }
        break;
      }

      // ── Funk: syncopated, 16th-note feel, slap-like ────────────────────
      case 'funk': {
        const root = scale[0];
        const pat = pick(['slap', 'sync16', 'staccato'] as const);
        switch (pat) {
          case 'slap':
            out.push({ bar, beat: 1,    note: nt(root, 2), duration: '16n' as BassDur, velocity: vel(100) });
            out.push({ bar, beat: 1.75, note: nt(root, 2), duration: '16n' as BassDur, velocity: vel(60) });
            out.push({ bar, beat: 2.5,  note: nt(pick(scale), 2), duration: '8n' as BassDur, velocity: vel(82) });
            out.push({ bar, beat: 3,    note: nt(root, 2), duration: '16n' as BassDur, velocity: vel(90) });
            out.push({ bar, beat: 3.5,  note: nt(pick(scale), 2), duration: '16n' as BassDur, velocity: vel(64) });
            out.push({ bar, beat: 4,    note: nt(pick(scale), 2), duration: '8n' as BassDur, velocity: vel(78) });
            break;
          case 'sync16':
            out.push({ bar, beat: 1,    note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(96) });
            out.push({ bar, beat: 2,    note: nt(root, 2), duration: '16n' as BassDur, velocity: vel(68) });
            out.push({ bar, beat: 2.75, note: nt(pick(scale), 2), duration: '16n' as BassDur, velocity: vel(72) });
            out.push({ bar, beat: 3.5,  note: nt(pick(scale), 2), duration: '8n' as BassDur, velocity: vel(84) });
            out.push({ bar, beat: 4.25, note: nt(root, 2), duration: '16n' as BassDur, velocity: vel(70) });
            break;
          case 'staccato':
            for (let b = 1; b <= 4; b++) {
              out.push({ bar, beat: b, note: nt(b % 2 === 1 ? root : pick(scale), 2), duration: '16n' as BassDur, velocity: vel(b === 1 ? 94 : 70) });
              if (Math.random() > 0.4)
                out.push({ bar, beat: b + 0.5, note: nt(pick(scale), 2), duration: '16n' as BassDur, velocity: vel(58) });
            }
            break;
        }
        break;
      }

      // ── Bossa Nova: root-fifth alternation, gentle ─────────────────────
      case 'bossa nova': {
        const root  = scale[0];
        const fifth = scale[4] ?? scale[0];
        out.push({ bar, beat: 1,   note: nt(root, 2),  duration: '4n.', velocity: vel(82) });
        out.push({ bar, beat: 2.5, note: nt(fifth, 2), duration: '8n' as BassDur, velocity: vel(64) });
        out.push({ bar, beat: 3,   note: nt(root, 2),  duration: '4n', velocity: vel(76) });
        out.push({ bar, beat: 4,   note: nt(pick(scale.slice(0, 5)), 2), duration: '4n', velocity: vel(68) });
        break;
      }

      // ── Lo-fi: simple, warm, long tones ────────────────────────────────
      case 'lo-fi': {
        const root  = scale[0];
        const third = scale[2] ?? root;
        const fifth = scale[4] ?? root;
        const pat = pick(['whole', 'half', 'sparse'] as const);
        switch (pat) {
          case 'whole':
            out.push({ bar, beat: 1, note: nt(pick([root, fifth]), 2), duration: '2n', velocity: vel(68) });
            break;
          case 'half':
            out.push({ bar, beat: 1, note: nt(root, 2), duration: '2n', velocity: vel(72) });
            out.push({ bar, beat: 3, note: nt(pick([third, fifth]), 2), duration: '2n', velocity: vel(60) });
            break;
          case 'sparse':
            out.push({ bar, beat: 1, note: nt(root, 2), duration: '4n', velocity: vel(70) });
            if (Math.random() > 0.4)
              out.push({ bar, beat: 3, note: nt(fifth, 2), duration: '4n', velocity: vel(56) });
            break;
        }
        break;
      }

      // ── Pop: root-fifth, straight feel ─────────────────────────────────
      case 'pop':
      default: {
        const root  = scale[0];
        const fifth = scale[4] ?? scale[0];
        const pat = pick(['root5', 'octave', 'arpegg'] as const);
        switch (pat) {
          case 'root5':
            out.push({ bar, beat: 1, note: nt(root, 2),  duration: '4n', velocity: vel(90) });
            out.push({ bar, beat: 2, note: nt(root, 2),  duration: '4n', velocity: vel(72) });
            out.push({ bar, beat: 3, note: nt(fifth, 2), duration: '4n', velocity: vel(84) });
            out.push({ bar, beat: 4, note: nt(root, 2),  duration: '4n', velocity: vel(72) });
            break;
          case 'octave':
            out.push({ bar, beat: 1,   note: nt(root, 2), duration: '4n', velocity: vel(92) });
            out.push({ bar, beat: 2,   note: nt(root, 3), duration: '8n' as BassDur, velocity: vel(70) });
            out.push({ bar, beat: 2.5, note: nt(root, 2), duration: '8n' as BassDur, velocity: vel(68) });
            out.push({ bar, beat: 3,   note: nt(fifth, 2), duration: '2n', velocity: vel(80) });
            break;
          case 'arpegg':
            out.push({ bar, beat: 1, note: nt(root, 2),  duration: '4n', velocity: vel(90) });
            out.push({ bar, beat: 2, note: nt(scale[2], 2), duration: '4n', velocity: vel(72) });
            out.push({ bar, beat: 3, note: nt(fifth, 2), duration: '4n', velocity: vel(78) });
            out.push({ bar, beat: 4, note: nt(scale[2], 2), duration: '4n', velocity: vel(68) });
            break;
        }
        break;
      }
    }
  }
  return out;
}

// ─── Drums Generator (genre-aware) ───────────────────────────────────────────

function generateDrums(bars: number, genre: Genre): DrumHit[] {
  const out: DrumHit[] = [];

  for (let bar = 1; bar <= bars; bar++) {
    switch (genre) {

      // ── Jazz: ride swing, light snare, sparse kick ─────────────────────
      case 'jazz': {
        // Swing ride pattern: 1, 2-and, 3, 4-and
        for (const b of [1, 2.5, 3, 4.5])
          out.push({ bar, beat: b, instrument: 'ride', velocity: vel(b % 1 === 0 ? 68 : 50) });
        // Hi-hat pedal on 2 & 4
        for (const b of [2, 4])
          out.push({ bar, beat: b, instrument: 'hihat', velocity: vel(44) });
        // Light kick
        out.push({ bar, beat: 1, instrument: 'kick', velocity: vel(68) });
        if (Math.random() > 0.5) out.push({ bar, beat: 3, instrument: 'kick', velocity: vel(56) });
        // Snare (brush) on 2 & 4
        out.push({ bar, beat: 2, instrument: 'snare', velocity: vel(54) });
        out.push({ bar, beat: 4, instrument: 'snare', velocity: vel(52) });
        // Occasional fill
        if (bar % 4 === 0 && Math.random() > 0.3) {
          out.push({ bar, beat: pick([4, 4.5]), instrument: 'tom', velocity: vel(58) });
        }
        break;
      }

      // ── Rock: heavy kick, loud snare, crash cymbals ────────────────────
      case 'rock': {
        // Kick: heavy on 1 and 3, sometimes extra
        for (const b of [1, 3]) out.push({ bar, beat: b, instrument: 'kick', velocity: vel(108, 8) });
        if (Math.random() > 0.5) out.push({ bar, beat: pick([2.5, 4.5]), instrument: 'kick', velocity: vel(80) });
        // Snare: hard on 2 and 4
        for (const b of [2, 4]) out.push({ bar, beat: b, instrument: 'snare', velocity: vel(100, 6) });
        // Hi-hat: straight eighths
        for (let b = 1; b <= 4; b++) {
          out.push({ bar, beat: b,       instrument: 'hihat', velocity: vel(64) });
          out.push({ bar, beat: b + 0.5, instrument: 'hihat', velocity: vel(48) });
        }
        // Crash every 2–4 bars
        if (bar === 1 || (bar % pick([2, 4]) === 1))
          out.push({ bar, beat: 1, instrument: 'crash', velocity: vel(95) });
        // Fill every 4 bars
        if (bar % 4 === 0) {
          out.push({ bar, beat: 4,   instrument: 'tom', velocity: vel(86) });
          out.push({ bar, beat: 4.5, instrument: 'tom', velocity: vel(78) });
        }
        break;
      }

      // ── Blues: shuffle ride, rim-like snare ─────────────────────────────
      case 'blues': {
        // Shuffle ride: 1, 1-trip, 2, 2-trip, etc.
        for (let b = 1; b <= 4; b++) {
          out.push({ bar, beat: b,          instrument: 'ride', velocity: vel(62) });
          out.push({ bar, beat: b + (2/3),  instrument: 'ride', velocity: vel(42) }); // triplet swing
        }
        // Kick on 1, sometimes 3
        out.push({ bar, beat: 1, instrument: 'kick', velocity: vel(84) });
        if (Math.random() > 0.3) out.push({ bar, beat: 3, instrument: 'kick', velocity: vel(72) });
        // Snare on 2 & 4
        out.push({ bar, beat: 2, instrument: 'snare', velocity: vel(76) });
        out.push({ bar, beat: 4, instrument: 'snare', velocity: vel(74) });
        break;
      }

      // ── Funk: 16th hi-hats, syncopated kick, ghost snares ─────────────
      case 'funk': {
        // 16th hi-hats
        for (let b = 1; b <= 4; b++) {
          for (const off of [0, 0.25, 0.5, 0.75])
            out.push({ bar, beat: b + off, instrument: 'hihat', velocity: vel(off === 0 ? 62 : 38) });
        }
        // Syncopated kick
        const kickPat = pick([[1, 2.75, 3.5], [1, 1.75, 3, 4.25], [1, 2.5, 3, 3.75]]);
        for (const b of kickPat) out.push({ bar, beat: b, instrument: 'kick', velocity: vel(92) });
        // Snare on 2 & 4 with ghost notes
        out.push({ bar, beat: 2, instrument: 'snare', velocity: vel(88) });
        out.push({ bar, beat: 4, instrument: 'snare', velocity: vel(86) });
        // Ghost notes
        for (const b of [1.75, 2.5, 3.75]) {
          if (Math.random() > 0.4) out.push({ bar, beat: b, instrument: 'snare', velocity: vel(38, 8) });
        }
        break;
      }

      // ── Bossa Nova: rim click, cross-stick pattern ─────────────────────
      case 'bossa nova': {
        // Bossa clave-ish pattern using rim (snare at low vel)
        for (const b of [1, 2.5, 3.5, 4]) {
          out.push({ bar, beat: b, instrument: 'snare', velocity: vel(44, 6) }); // rim click
        }
        // Light kick
        out.push({ bar, beat: 1, instrument: 'kick', velocity: vel(64) });
        out.push({ bar, beat: 3, instrument: 'kick', velocity: vel(58) });
        // Shaker-like hi-hat (very soft)
        for (let b = 1; b <= 4; b++) {
          out.push({ bar, beat: b,       instrument: 'hihat', velocity: vel(32, 6) });
          out.push({ bar, beat: b + 0.5, instrument: 'hihat', velocity: vel(26, 6) });
        }
        break;
      }

      // ── Lo-fi: sparse, mellow, tape-degraded feel ─────────────────────
      case 'lo-fi': {
        // Very sparse kick
        out.push({ bar, beat: 1, instrument: 'kick', velocity: vel(72) });
        if (Math.random() > 0.4) out.push({ bar, beat: 3, instrument: 'kick', velocity: vel(60) });
        // Soft snare
        out.push({ bar, beat: 2, instrument: 'snare', velocity: vel(58, 8) });
        out.push({ bar, beat: 4, instrument: 'snare', velocity: vel(54, 8) });
        // Minimal hi-hat — sometimes skip entirely
        if (Math.random() > 0.3) {
          for (const b of [1, 2, 3, 4])
            out.push({ bar, beat: b, instrument: 'hihat', velocity: vel(30, 6) });
        }
        break;
      }

      // ── Pop: standard 4-on-floor, clean ────────────────────────────────
      case 'pop':
      default: {
        // Kick on 1 & 3 (or all 4 for dance-pop)
        const kickPat = pick([[1, 3], [1, 2, 3, 4], [1, 3, 3.5]]);
        for (const b of kickPat) out.push({ bar, beat: b, instrument: 'kick', velocity: vel(90) });
        // Snare on 2 & 4
        out.push({ bar, beat: 2, instrument: 'snare', velocity: vel(86) });
        out.push({ bar, beat: 4, instrument: 'snare', velocity: vel(84) });
        // Hi-hat 8ths
        for (let b = 1; b <= 4; b++) {
          out.push({ bar, beat: b,       instrument: 'hihat', velocity: vel(56) });
          out.push({ bar, beat: b + 0.5, instrument: 'hihat', velocity: vel(40) });
        }
        if (bar === 1)
          out.push({ bar, beat: 1, instrument: 'crash', velocity: vel(80) });
        break;
      }
    }
  }
  return out;
}

// ─── Melody Generator (genre-aware) ──────────────────────────────────────────

type MelDur = '4n' | '8n' | '2n' | '4n.' | '16n';
const DUR_BEATS: Record<MelDur, number> = { '2n': 2, '4n.': 1.5, '4n': 1, '8n': 0.5, '16n': 0.25 };

function generateMelody(bars: number, scale: string[], genre: Genre): MelodyNote[] {
  const out: MelodyNote[] = [];
  const genreScale = getGenreScale(scale[0], scale.length === 7 && scale.includes(scale[2]) ? 'major' : 'minor', genre);

  for (let bar = 1; bar <= bars; bar++) {
    switch (genre) {

      // ── Jazz: syncopated, chromatic approaches, wide intervals ─────────
      case 'jazz': {
        const count = pick([3, 4, 5]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['4n', '8n', '8n', '4n.'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          // Occasionally use chromatic approach tone
          const target = pick(genreScale);
          const note = (Math.random() > 0.7) ? chromaticApproach(target) : target;
          out.push({ bar, beat, note: nt(note, pick([4, 4, 5])), duration: dur, velocity: vel(78) });
          beat += DUR_BEATS[dur];
          // Syncopation: shift beat by half
          if (Math.random() > 0.5 && beat < 4) beat += 0.5;
        }
        break;
      }

      // ── Rock: pentatonic riffs, bends-like, strong downbeats ───────────
      case 'rock': {
        const count = pick([2, 3, 4]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['4n', '4n', '8n', '2n'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), pick([4, 4, 5])), duration: dur, velocity: vel(beat === 1 ? 92 : 80) });
          beat += DUR_BEATS[dur];
        }
        break;
      }

      // ── Blues: blues scale, lazy phrasing, triplet feel ─────────────────
      case 'blues': {
        const count = pick([2, 3, 3]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['4n', '4n.', '2n'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), 4), duration: dur, velocity: vel(76) });
          beat += DUR_BEATS[dur];
          // Lazy triplet offsets
          if (Math.random() > 0.5) beat += 1/3;
        }
        break;
      }

      // ── Funk: rhythmic, short staccato, 16th feel ──────────────────────
      case 'funk': {
        const count = pick([4, 5, 6]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['16n', '8n', '8n', '16n'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), pick([4, 5])), duration: dur, velocity: vel(beat === 1 ? 86 : 72) });
          beat += DUR_BEATS[dur];
        }
        break;
      }

      // ── Bossa Nova: gentle stepwise, longer notes ──────────────────────
      case 'bossa nova': {
        const count = pick([2, 3]);
        let beat = 1;
        let prevIdx = randInt(0, genreScale.length - 1);
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['4n', '2n', '4n.'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          // Stepwise motion
          prevIdx = Math.max(0, Math.min(genreScale.length - 1, prevIdx + pick([-1, 0, 1])));
          out.push({ bar, beat, note: nt(genreScale[prevIdx], 4), duration: dur, velocity: vel(68) });
          beat += DUR_BEATS[dur];
        }
        break;
      }

      // ── Lo-fi: sparse, dreamy, pentatonic ──────────────────────────────
      case 'lo-fi': {
        const count = pick([1, 2, 2]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['2n', '4n.', '4n'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), pick([4, 5])), duration: dur, velocity: vel(60, 8) });
          beat += DUR_BEATS[dur];
          // Extra space between notes
          if (Math.random() > 0.3) beat += 1;
        }
        break;
      }

      // ── Pop: catchy, stepwise, simple rhythms ──────────────────────────
      case 'pop':
      default: {
        const count = pick([3, 4, 4]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur = pick(['4n', '4n', '8n', '4n.'] as MelDur[]);
          if (beat + DUR_BEATS[dur] > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), 4), duration: dur, velocity: vel(beat === 1 ? 84 : 74) });
          beat += DUR_BEATS[dur];
        }
        break;
      }
    }
  }
  return out;
}

// ─── Keys Generator (genre-aware) ────────────────────────────────────────────

type KeysDur = '1n' | '2n' | '4n' | '4n.' | '8n' | '16n';  // matches KeysChordSchema

function generateKeys(bars: number, scale: string[], genre: Genre): KeysChord[] {
  const out: KeysChord[] = [];

  const triad = (): string[] => {
    const ri = randInt(0, 6);
    return [nt(scale[ri], 3), nt(scale[(ri + 2) % 7], 3), nt(scale[(ri + 4) % 7], 3)];
  };

  const seventh = (): string[] => {
    const ri = randInt(0, 6);
    return [nt(scale[ri], 3), nt(scale[(ri + 2) % 7], 3), nt(scale[(ri + 4) % 7], 3), nt(scale[(ri + 6) % 7], 4)];
  };

  const rootless = (): string[] => {
    // Jazz rootless voicing: 3rd, 5th, 7th, 9th (skip root)
    const ri = randInt(0, 6);
    return [nt(scale[(ri + 2) % 7], 3), nt(scale[(ri + 4) % 7], 3), nt(scale[(ri + 6) % 7], 4), nt(scale[(ri + 1) % 7], 4)];
  };

  const power = (): string[] => {
    // Rock power chord: root + fifth
    const ri = randInt(0, 6);
    return [nt(scale[ri], 3), nt(scale[(ri + 4) % 7], 3)];
  };

  const sus = (): string[] => {
    // Suspended voicing for lo-fi: root, 4th, 5th
    const ri = randInt(0, 6);
    return [nt(scale[ri], 3), nt(scale[(ri + 3) % 7], 3), nt(scale[(ri + 4) % 7], 4)];
  };

  for (let bar = 1; bar <= bars; bar++) {
    switch (genre) {

      // ── Jazz: rootless voicings, swing comp rhythm ─────────────────────
      case 'jazz': {
        const pat = pick(['comp1', 'comp2', 'charleston'] as const);
        const ch = Math.random() > 0.3 ? rootless : seventh;
        switch (pat) {
          case 'comp1':
            out.push({ bar, beat: 1,   notes: ch(), duration: '4n.' as KeysDur, velocity: vel(62) });
            out.push({ bar, beat: 2.5, notes: ch(), duration: '4n' as KeysDur, velocity: vel(56) });
            out.push({ bar, beat: 4,   notes: ch(), duration: '4n' as KeysDur, velocity: vel(58) });
            break;
          case 'comp2':
            out.push({ bar, beat: 1, notes: ch(), duration: '2n' as KeysDur, velocity: vel(64) });
            out.push({ bar, beat: 3, notes: ch(), duration: '2n' as KeysDur, velocity: vel(58) });
            break;
          case 'charleston':
            out.push({ bar, beat: 1,   notes: ch(), duration: '4n.' as KeysDur, velocity: vel(66) });
            out.push({ bar, beat: 2.5, notes: ch(), duration: '2n' as KeysDur, velocity: vel(54) });
            break;
        }
        break;
      }

      // ── Rock: power chords, driving rhythm ─────────────────────────────
      case 'rock': {
        const ch = power();
        const pat = pick(['heavy', 'palm', 'sustained'] as const);
        switch (pat) {
          case 'heavy':
            for (let b = 1; b <= 4; b++)
              out.push({ bar, beat: b, notes: ch, duration: '8n' as KeysDur, velocity: vel(92) });
            break;
          case 'palm':
            out.push({ bar, beat: 1, notes: ch, duration: '4n' as KeysDur, velocity: vel(96) });
            out.push({ bar, beat: 2.5, notes: power(), duration: '8n' as KeysDur, velocity: vel(78) });
            out.push({ bar, beat: 3, notes: power(), duration: '4n' as KeysDur, velocity: vel(88) });
            out.push({ bar, beat: 4, notes: ch, duration: '4n' as KeysDur, velocity: vel(82) });
            break;
          case 'sustained':
            out.push({ bar, beat: 1, notes: ch, duration: '1n' as KeysDur, velocity: vel(86) });
            break;
        }
        break;
      }

      // ── Blues: dominant 7ths, comping ───────────────────────────────────
      case 'blues': {
        const ch = seventh;
        out.push({ bar, beat: 1, notes: ch(), duration: '2n' as KeysDur, velocity: vel(72) });
        out.push({ bar, beat: 3, notes: ch(), duration: '4n' as KeysDur, velocity: vel(66) });
        if (Math.random() > 0.4)
          out.push({ bar, beat: 4, notes: ch(), duration: '4n' as KeysDur, velocity: vel(60) });
        break;
      }

      // ── Funk: choppy stabs, 16th feel chord hits ───────────────────────
      case 'funk': {
        const ch = () => { const c = triad(); if (Math.random() > 0.5) c.push(nt(scale[randInt(0,6)], 4)); return c; };
        const hits = pick([[1, 2.75, 3.5, 4.25], [1, 1.75, 2.5, 3, 4], [1, 2, 2.75, 4]]);
        for (const b of hits)
          out.push({ bar, beat: b, notes: ch(), duration: '16n' as KeysDur, velocity: vel(b === 1 ? 82 : 68) });
        break;
      }

      // ── Bossa Nova: gentle maj7/min7 comping ───────────────────────────
      case 'bossa nova': {
        const ch = seventh;
        out.push({ bar, beat: 1,   notes: ch(), duration: '4n.' as KeysDur, velocity: vel(58) });
        out.push({ bar, beat: 2.5, notes: ch(), duration: '8n' as KeysDur, velocity: vel(48) });
        out.push({ bar, beat: 3,   notes: ch(), duration: '2n' as KeysDur, velocity: vel(54) });
        break;
      }

      // ── Lo-fi: suspended, wide, dreamy ─────────────────────────────────
      case 'lo-fi': {
        const ch = Math.random() > 0.4 ? sus : () => { const c = triad(); return c; };
        const pat = pick(['whole', 'half'] as const);
        switch (pat) {
          case 'whole':
            out.push({ bar, beat: 1, notes: ch(), duration: '1n' as KeysDur, velocity: vel(52) });
            break;
          case 'half':
            out.push({ bar, beat: 1, notes: ch(), duration: '2n' as KeysDur, velocity: vel(56) });
            out.push({ bar, beat: 3, notes: ch(), duration: '2n' as KeysDur, velocity: vel(48) });
            break;
        }
        break;
      }

      // ── Pop: triads, sustained pads ────────────────────────────────────
      case 'pop':
      default: {
        const ch = () => { const c = triad(); if (Math.random() > 0.5) c.push(nt(scale[(randInt(0,6) + 6) % 7], 4)); return c; };
        const pat = pick(['whole', 'half', 'qqh'] as const);
        switch (pat) {
          case 'whole':
            out.push({ bar, beat: 1, notes: ch(), duration: '1n' as KeysDur, velocity: vel(70) });
            break;
          case 'half':
            out.push({ bar, beat: 1, notes: ch(), duration: '2n' as KeysDur, velocity: vel(72) });
            out.push({ bar, beat: 3, notes: ch(), duration: '2n' as KeysDur, velocity: vel(66) });
            break;
          case 'qqh':
            out.push({ bar, beat: 1, notes: ch(), duration: '4n' as KeysDur, velocity: vel(72) });
            out.push({ bar, beat: 2, notes: ch(), duration: '4n' as KeysDur, velocity: vel(66) });
            out.push({ bar, beat: 3, notes: ch(), duration: '2n' as KeysDur, velocity: vel(70) });
            break;
        }
        break;
      }
    }
  }
  return out;
}

// ─── Vocal Generator (genre-aware) ───────────────────────────────────────────

const SYLLABLES_DEFAULT = ['la', 'da', 'ooh', 'aah', 'mmm', 'doo', 'wah', 'hey', 'oh', 'na', 'ba', 'dee'];
const SYLLABLES_JAZZ    = ['doo', 'bah', 'dwee', 'bop', 'sha', 'doo-wah', 'skee', 'bee'];
const SYLLABLES_BLUES   = ['oh', 'aah', 'yeah', 'mmm', 'babe', 'whoa', 'hey', 'ooh'];
const SYLLABLES_FUNK    = ['ow', 'huh', 'get', 'up', 'hey', 'uh', 'yeah', 'go'];
const SYLLABLES_BOSSA   = ['sha', 'la', 'ooh', 'mmm', 'da', 'ba', 'pa', 'na'];
const SYLLABLES_LOFI    = ['mmm', 'ooh', 'aah', 'hmm', 'la', 'oh'];
const SYLLABLES_ROCK    = ['yeah', 'oh', 'hey', 'whoa', 'ah', 'ow', 'go', 'na'];

function getSyllables(genre: Genre): string[] {
  switch (genre) {
    case 'jazz':       return SYLLABLES_JAZZ;
    case 'blues':      return SYLLABLES_BLUES;
    case 'funk':       return SYLLABLES_FUNK;
    case 'bossa nova': return SYLLABLES_BOSSA;
    case 'lo-fi':      return SYLLABLES_LOFI;
    case 'rock':       return SYLLABLES_ROCK;
    default:           return SYLLABLES_DEFAULT;
  }
}

function generateVocal(bars: number, scale: string[], genre: Genre): VocalNote[] {
  const out: VocalNote[] = [];
  const syllables = getSyllables(genre);
  const genreScale = getGenreScale(scale[0], scale.length === 7 && scale.includes(scale[2]) ? 'major' : 'minor', genre);

  /** Duration-to-beats lookup that avoids TS narrowing issues. */
  const durBeats: Record<string, number> = { '2n': 2, '4n.': 1.5, '4n': 1, '8n': 0.5, '16n': 0.25 };
  const db = (d: string) => durBeats[d] ?? 1;

  for (let bar = 1; bar <= bars; bar++) {
    switch (genre) {

      // Jazz vocal: scat-like, bebop phrasing
      case 'jazz': {
        const count = pick([3, 4, 5]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur: '4n' | '8n' | '2n' = pick(['8n', '8n', '4n'] as const);
          if (beat + db(dur) > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), 4), duration: dur, velocity: vel(72), syllable: pick(syllables) });
          beat += db(dur);
          if (Math.random() > 0.5) beat += 0.5; // swing offset
        }
        break;
      }

      // Rock vocal: strong, power notes
      case 'rock': {
        const count = pick([2, 3]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur: '4n' | '8n' | '2n' = pick(['4n', '2n', '4n'] as const);
          if (beat + db(dur) > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), pick([4, 4, 5])), duration: dur, velocity: vel(90), syllable: pick(syllables) });
          beat += db(dur);
        }
        break;
      }

      // Lo-fi: sparse, breathy, long notes
      case 'lo-fi': {
        const count = pick([1, 1, 2]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur: '4n' | '8n' | '2n' = pick(['2n', '4n', '4n'] as const);
          if (beat + db(dur) > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), 4), duration: dur, velocity: vel(54, 6), syllable: pick(syllables) });
          beat += db(dur) + pick([0, 0.5, 1]);
        }
        break;
      }

      // Funk: rhythmic, percussive syllables
      case 'funk': {
        const count = pick([3, 4, 5]);
        let beat = 1;
        for (let i = 0; i < count && beat <= 4; i++) {
          const dur: '4n' | '8n' | '2n' = pick(['8n', '8n', '4n'] as const);
          if (beat + db(dur) > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), 4), duration: dur, velocity: vel(80), syllable: pick(syllables) });
          beat += db(dur);
        }
        break;
      }

      // Default: pop, blues, bossa nova — moderate phrasing
      default: {
        const count = randInt(2, 4);
        let beat = 1;
        const durs: ('4n' | '8n' | '2n')[] = genre === 'bossa nova' ? ['4n', '2n'] : ['4n', '4n', '8n', '2n'];
        for (let i = 0; i < count && beat <= 4; i++) {
          const d = pick(durs);
          if (beat + db(d) > 5) break;
          out.push({ bar, beat, note: nt(pick(genreScale), 4), duration: d, velocity: vel(genre === 'bossa nova' ? 62 : 78), syllable: pick(syllables) });
          beat += db(d);
        }
        break;
      }
    }
  }
  return out;
}

// ─── Genre descriptor helpers (for logs) ─────────────────────────────────────

const GENRE_BASS_DESC: Record<Genre, readonly string[]> = {
  'jazz':       ['walking', 'chromatic approach', 'bebop-walking'],
  'rock':       ['driving', 'power-root', 'galloping'],
  'blues':      ['shuffle-walking', 'chromatic 12-bar', 'root-b7 groove'],
  'funk':       ['slap', 'syncopated 16th', 'staccato pocket'],
  'bossa nova': ['root-fifth', 'gentle bossa', 'smooth alternating'],
  'lo-fi':      ['warm long-tone', 'sparse root', 'dreamy sub-bass'],
  'pop':        ['root-fifth', 'arpeggio', 'octave bounce'],
};
const GENRE_DRUM_DESC: Record<Genre, readonly string[]> = {
  'jazz':       ['swing ride', 'brush quartet', 'bebop swing'],
  'rock':       ['heavy driving', 'power rock', 'stadium crash-heavy'],
  'blues':      ['shuffle ride', 'triplet swing', '12/8 feel'],
  'funk':       ['16th hi-hat pocket', 'ghost-note groove', 'syncopated funk'],
  'bossa nova': ['rim-click bossa', 'cross-stick samba', 'brushed bossa'],
  'lo-fi':      ['sparse tape-hiss', 'mellow boom-bap', 'dusty lounge'],
  'pop':        ['four-on-floor', 'dance-pop beat', 'standard pop groove'],
};
const GENRE_MEL_DESC: Record<Genre, readonly string[]> = {
  'jazz':       ['bebop chromatic', 'angular modal', 'swing eighth'],
  'rock':       ['pentatonic riff', 'power melody', 'anthem hook'],
  'blues':      ['blues-scale bend', 'call-response', 'lazy triplet'],
  'funk':       ['rhythmic staccato', '16th-note hook', 'clavinet-style'],
  'bossa nova': ['gentle stepwise', 'chromatic bossa', 'smooth legato'],
  'lo-fi':      ['dreamy pentatonic', 'sparse ethereal', 'hazy ambient'],
  'pop':        ['catchy stepwise', 'hook-driven', 'singable phrase'],
};
const GENRE_KEYS_DESC: Record<Genre, readonly string[]> = {
  'jazz':       ['rootless voicing', 'swing comp', 'Charleston rhythm'],
  'rock':       ['power chord', 'palm-mute rhythm', 'stadium sustain'],
  'blues':      ['dominant 7th comp', '12-bar turnaround', 'gospel voicing'],
  'funk':       ['choppy stab', 'clavinet 16th', 'wah-wah scratch'],
  'bossa nova': ['maj7 comp', 'gentle bossa voicing', 'Antonio-Carlos style'],
  'lo-fi':      ['suspended wash', 'dreamy pad', 'wide reverb chord'],
  'pop':        ['triad pad', 'sustained synth', 'bright arpeggio'],
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MockParams {
  bpm: number;
  bars: number;
  musicalKey: string;
  genre: string;
  selectedTracks: TrackName[];
}

/**
 * Generate a genre-aware mock BandOutput.
 * Each genre produces unique bass lines, drum patterns, melodies, chord voicings,
 * and vocal styles — with different scales, rhythms, and articulations.
 */
export function generateMockResponse(params: MockParams): BandOutput {
  const { bpm, bars, musicalKey, genre: rawGenre, selectedTracks } = params;
  const genre = (rawGenre as Genre) || 'pop';
  const { root, quality } = parseKey(musicalKey);
  const scale = getScale(root, quality);

  const hasMelody = selectedTracks.includes('melody');
  const hasKeys   = selectedTracks.includes('keys');
  const hasVocal  = selectedTracks.includes('vocal');

  const bass   = generateBass(bars, scale, genre);
  const drums  = generateDrums(bars, genre);
  const melody = hasMelody ? generateMelody(bars, scale, genre) : undefined;
  const keys   = hasKeys   ? generateKeys(bars, scale, genre) : undefined;
  const vocal  = hasVocal  ? generateVocal(bars, scale, genre) : undefined;

  const trackCount = 2 + (hasMelody ? 1 : 0) + (hasKeys ? 1 : 0) + (hasVocal ? 1 : 0);
  const keyLabel = `${musicalKey.charAt(0).toUpperCase()}${musicalKey.slice(1)}`;
  const genreScaleLabel = genre === 'blues' ? 'blues' : genre === 'rock' ? 'pentatonic' : quality;

  const logs: string[] = [
    '[Producer] Initializing Virtual AI Band session...',
    `[Producer] Analyzing musical context: ${bpm} BPM | ${genre.toUpperCase()} | ${keyLabel} | ${bars} bars`,
    `[Producer] Scale: ${getGenreScale(root, quality, genre).join(' ')} (${genreScaleLabel})`,
    `[Producer] Harmonic strategy: ${pick(GENRE_BASS_DESC[genre] ?? GENRE_BASS_DESC.pop)} + ${pick(GENRE_DRUM_DESC[genre] ?? GENRE_DRUM_DESC.pop)}.`,
    `[Producer → Bass] DIRECTIVE: Compose a ${pick(GENRE_BASS_DESC[genre] ?? GENRE_BASS_DESC.pop)} bass line in ${keyLabel}.`,
    `[Bass] Bass complete. ${bass.length} notes across ${bars} bars.`,
    `[Producer → Drums] DIRECTIVE: Build a ${pick(GENRE_DRUM_DESC[genre] ?? GENRE_DRUM_DESC.pop)} ${genre} beat.`,
    `[Drums] Groove complete. ${drums.length} events across ${bars} bars.`,
  ];

  if (hasMelody && melody) {
    logs.push(`[Producer → Melody] DIRECTIVE: Play a ${pick(GENRE_MEL_DESC[genre] ?? GENRE_MEL_DESC.pop)} melody in ${keyLabel}.`);
    logs.push(`[Melody] Lead melody composed. ${melody.length} notes across ${bars} bars.`);
  }
  if (hasKeys && keys) {
    logs.push(`[Producer → Keys] DIRECTIVE: Comp with ${pick(GENRE_KEYS_DESC[genre] ?? GENRE_KEYS_DESC.pop)} voicings.`);
    logs.push(`[Keys] Chord voicings locked. ${keys.length} chords across ${bars} bars.`);
  }
  if (hasVocal && vocal) {
    logs.push(`[Producer → Vocal] DIRECTIVE: Sing a ${pick(['gentle', 'soulful', 'breathy', 'bright'])} ${genre} melody.`);
    logs.push(`[Vocal] Vocal melody mapped. ${vocal.length} notes across ${bars} bars.`);
  }

  logs.push(`[Producer] ✓ All ${trackCount} tracks compiled — press PLAY!`);

  return {
    success: true,
    logs,
    midi_data: { bpm, total_bars: bars, bass, drums, melody, keys, vocal },
  };
}
