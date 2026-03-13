/**
 * Tone.js Engine — lazily initialized to avoid SSR issues.
 * All exports are async functions that dynamic-import Tone only in the browser.
 *
 * v2 — Improved sound quality:
 *   • Layered drum synths (kick body+click, snare body+noise+ring, tom)
 *   • Proper swing/groove quantization (not random jitter)
 *   • Richer bass with saturation, better melody & vocal FM patches
 *   • Velocity-sensitive ghost notes for drums
 */

import type { MidiData, TrackName } from './schemas';

type ToneModule = typeof import('tone');

let toneCache: ToneModule | null = null;

async function getTone(): Promise<ToneModule> {
  if (!toneCache) {
    toneCache = await import('tone');
  }
  return toneCache;
}

// ─── Synth instances (lazy singletons) ───────────────────────────────────────

// Bass
let _bassSynth:    InstanceType<ToneModule['FMSynth']> | null = null;
let _bassSubSynth: InstanceType<ToneModule['Synth']> | null = null;

// Drums — primary sampled kit, synth fallback
let _kickSampler:  InstanceType<ToneModule['Sampler']> | null = null;
let _snareSampler: InstanceType<ToneModule['Sampler']> | null = null;
let _hihatSampler: InstanceType<ToneModule['Sampler']> | null = null;
let _rideSampler:  InstanceType<ToneModule['Sampler']> | null = null;
let _crashSampler: InstanceType<ToneModule['Sampler']> | null = null;
let _tomSampler:   InstanceType<ToneModule['Sampler']> | null = null;
let _kickBody:    InstanceType<ToneModule['MembraneSynth']> | null = null;
let _kickClick:   InstanceType<ToneModule['Synth']> | null = null;
let _snareBody:   InstanceType<ToneModule['MembraneSynth']> | null = null;
let _snareNoise:  InstanceType<ToneModule['NoiseSynth']> | null = null;
let _rideSynth:   InstanceType<ToneModule['MetalSynth']> | null = null;
let _hihatClosed: InstanceType<ToneModule['MetalSynth']> | null = null;
let _crashSynth:  InstanceType<ToneModule['MetalSynth']> | null = null;
let _tomSynth:    InstanceType<ToneModule['MembraneSynth']> | null = null;

// Players
let _guitarPlayer: InstanceType<ToneModule['Player']> | null = null;
let _vocalPlayer:  InstanceType<ToneModule['Player']> | null = null;

// Melody / Keys / Vocal
let _melodySynth: InstanceType<ToneModule['FMSynth']> | null = null;
let _keysSynth:   InstanceType<ToneModule['PolySynth']> | null = null;
let _vocalSynth:  InstanceType<ToneModule['FMSynth']> | null = null;

// Volume faders
let _bassVol:    InstanceType<ToneModule['Volume']> | null = null;
let _drumsVol:   InstanceType<ToneModule['Volume']> | null = null;
let _guitarVol:  InstanceType<ToneModule['Volume']> | null = null;
let _melodyVol:  InstanceType<ToneModule['Volume']> | null = null;
let _keysVol:    InstanceType<ToneModule['Volume']> | null = null;
let _vocalVol:   InstanceType<ToneModule['Volume']> | null = null;

// Master bus
let _masterComp: InstanceType<ToneModule['Compressor']> | null = null;
let _masterEQ:   InstanceType<ToneModule['EQ3']> | null = null;
let _masterLimiter: InstanceType<ToneModule['Limiter']> | null = null;

// Effects
let _drumsReverb: InstanceType<ToneModule['Reverb']> | null = null;
let _bassFilter:  InstanceType<ToneModule['Filter']> | null = null;
let _bassDrive:   InstanceType<ToneModule['Distortion']> | null = null;

// Send/Return Effects Bus
let _sendReverb:         InstanceType<ToneModule['Reverb']> | null = null;
let _sendDelay:          InstanceType<ToneModule['PingPongDelay']> | null = null;
let _melodySendRevGain:  InstanceType<ToneModule['Gain']> | null = null;
let _melodySendDelGain:  InstanceType<ToneModule['Gain']> | null = null;
let _keysSendRevGain:    InstanceType<ToneModule['Gain']> | null = null;
let _keysSendDelGain:    InstanceType<ToneModule['Gain']> | null = null;
let _vocalSendRevGain:   InstanceType<ToneModule['Gain']> | null = null;

// Keys effects chain
let _keysChorus:  InstanceType<ToneModule['Chorus']> | null = null;
let _keysTremolo: InstanceType<ToneModule['Tremolo']> | null = null;

// Vocal effects
let _vocalAutoFilter: InstanceType<ToneModule['AutoFilter']> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _bassPart:   any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _drumsPart:  any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _melodyPart: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _keysPart:   any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _vocalPart:  any = null;

// Swing amount (0 = straight, 0.5 = full triplet swing, typical jazz = 0.33)
let _swingAmount = 0;
let _drumSamplesFailed = false;

const DRUM_SAMPLE_ROOT = 'C1';
const DRUM_SAMPLE_URLS = {
  kick: '/samples/kick.wav',
  snare: '/samples/snare.wav',
  hihat: '/samples/hihat.wav',
  ride: '/samples/ride.wav',
  crash: '/samples/crash.wav',
  tom: '/samples/tom.wav',
} as const;

function disposeDrumSamplers() {
  [_kickSampler, _snareSampler, _hihatSampler, _rideSampler, _crashSampler, _tomSampler].forEach((sampler) => sampler?.dispose());
  _kickSampler = _snareSampler = _hihatSampler = _rideSampler = _crashSampler = _tomSampler = null;
}

function createDrumSampler(
  Tone: ToneModule,
  url: string,
  volume: number,
): InstanceType<ToneModule['Sampler']> {
  const sampler = new Tone.Sampler({
    attack: 0,
    release: 1,
    urls: { [DRUM_SAMPLE_ROOT]: url },
  }).connect(_drumsVol!);
  sampler.volume.value = volume;
  return sampler;
}

async function ensureDrumSamplers(Tone: ToneModule): Promise<boolean> {
  if (_drumSamplesFailed || !_drumsVol) {
    return false;
  }

  if (_kickSampler && _snareSampler && _hihatSampler && _rideSampler && _crashSampler && _tomSampler) {
    return true;
  }

  try {
    if (!_kickSampler)  _kickSampler  = createDrumSampler(Tone, DRUM_SAMPLE_URLS.kick, 2);
    if (!_snareSampler) _snareSampler = createDrumSampler(Tone, DRUM_SAMPLE_URLS.snare, -1);
    if (!_hihatSampler) _hihatSampler = createDrumSampler(Tone, DRUM_SAMPLE_URLS.hihat, -10);
    if (!_rideSampler)  _rideSampler  = createDrumSampler(Tone, DRUM_SAMPLE_URLS.ride, -8);
    if (!_crashSampler) _crashSampler = createDrumSampler(Tone, DRUM_SAMPLE_URLS.crash, -5);
    if (!_tomSampler)   _tomSampler   = createDrumSampler(Tone, DRUM_SAMPLE_URLS.tom, -3);

    await Tone.loaded();
    return true;
  } catch (error) {
    console.warn('Drum samples failed to load. Falling back to synth drums.', error);
    disposeDrumSamplers();
    _drumSamplesFailed = true;
    return false;
  }
}

async function getSynths() {
  const Tone = await getTone();

  // ── Master limiter (catch peaks) → destination ────────────────────────────
  if (!_masterLimiter) {
    _masterLimiter = new Tone.Limiter(-1).toDestination();
  }

  // ── Master EQ3 (smile curve — boost lows & highs, cut muddy mids) ────────
  if (!_masterEQ) {
    _masterEQ = new Tone.EQ3({
      low:           4,
      mid:          -3,
      high:          3,
      lowFrequency:  200,
      highFrequency: 3500,
    }).connect(_masterLimiter);
  }

  // ── Master compressor (glue bus) ──────────────────────────────────────────
  if (!_masterComp) {
    _masterComp = new Tone.Compressor({
      threshold: -20,
      ratio:      3,
      attack:     0.005,
      release:    0.12,
      knee:       8,
    }).connect(_masterEQ);
  }

  // ── Send/Return: Hall Reverb bus ──────────────────────────────────────────
  if (!_sendReverb) {
    _sendReverb = new Tone.Reverb({ decay: 2.2, wet: 1 });
    await _sendReverb.ready;
    _sendReverb.connect(_masterComp);
  }

  // ── Send/Return: PingPong Delay bus ───────────────────────────────────────
  if (!_sendDelay) {
    _sendDelay = new Tone.PingPongDelay({
      delayTime: '8n.',
      feedback:  0.25,
      wet:       1,
    }).connect(_masterComp);
  }

  // ── Volume faders → master compressor ─────────────────────────────────────
  if (!_bassVol)   _bassVol   = new Tone.Volume(0).connect(_masterComp);
  if (!_drumsVol)  _drumsVol  = new Tone.Volume(-2).connect(_masterComp);
  if (!_guitarVol) _guitarVol = new Tone.Volume(-4).connect(_masterComp);
  if (!_melodyVol) _melodyVol = new Tone.Volume(-4).connect(_masterComp);
  if (!_keysVol)   _keysVol   = new Tone.Volume(-6).connect(_masterComp);
  if (!_vocalVol)  _vocalVol  = new Tone.Volume(-3).connect(_masterComp);

  // ── Melody, Keys & Vocal send gains ───────────────────────────────────────
  if (!_melodySendRevGain) _melodySendRevGain = new Tone.Gain(0.25).connect(_sendReverb);
  if (!_melodySendDelGain) _melodySendDelGain = new Tone.Gain(0.15).connect(_sendDelay);
  if (!_keysSendRevGain)   _keysSendRevGain   = new Tone.Gain(0.20).connect(_sendReverb);
  if (!_keysSendDelGain)   _keysSendDelGain   = new Tone.Gain(0.10).connect(_sendDelay);
  if (!_vocalSendRevGain)  _vocalSendRevGain  = new Tone.Gain(0.30).connect(_sendReverb);

  // ── Drums reverb (plate for shimmer) ──────────────────────────────────────
  if (!_drumsReverb) {
    _drumsReverb = new Tone.Reverb({ decay: 0.8, wet: 0.15 });
    await _drumsReverb.ready;
    _drumsReverb.connect(_drumsVol);
  }

  // ── Bass effects chain: Distortion → Filter → Volume ─────────────────────
  if (!_bassFilter) {
    _bassFilter = new Tone.Filter({
      frequency: 400,
      type:      'lowpass',
      rolloff:   -24,
      Q:         1.5,
    }).connect(_bassVol!);
  }
  if (!_bassDrive) {
    _bassDrive = new Tone.Distortion({
      distortion: 0.15,
      wet:        0.3,
    }).connect(_bassFilter!);
  }

  // ── Bass synth (FM + sub-octave layer for fatness) ────────────────────────
  if (!_bassSynth) {
    _bassSynth = new Tone.FMSynth({
      harmonicity:     0.5,
      modulationIndex: 1.6,
      oscillator:      { type: 'triangle' },
      modulation:      { type: 'sine' },
      envelope:        { attack: 0.008, decay: 0.12, sustain: 0.65, release: 0.25 },
      modulationEnvelope: { attack: 0.004, decay: 0.08, sustain: 0.35, release: 0.15 },
    }).connect(_bassDrive!);
  }
  if (!_bassSubSynth) {
    _bassSubSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
      volume:     -10,
    }).connect(_bassVol!);
  }

  const drumSamplesReady = await ensureDrumSamplers(Tone);

  if (!drumSamplesReady) {
    // ── Kick: MembraneSynth (body) + Synth (click transient) ───────────────
    if (!_kickBody) {
      _kickBody = new Tone.MembraneSynth({
        pitchDecay:  0.05,
        octaves:     8,
        envelope:    { attack: 0.001, decay: 0.35, sustain: 0, release: 0.08 },
      }).connect(_drumsReverb!);
      _kickBody.volume.value = 2;
    }
    if (!_kickClick) {
      _kickClick = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope:   { attack: 0.001, decay: 0.015, sustain: 0, release: 0.01 },
        volume:     -6,
      }).connect(_drumsReverb!);
    }

    // ── Snare: MembraneSynth (body/ring) + NoiseSynth (wire rattle) ────────
    if (!_snareBody) {
      _snareBody = new Tone.MembraneSynth({
        pitchDecay:  0.008,
        octaves:     4,
        envelope:    { attack: 0.0005, decay: 0.12, sustain: 0, release: 0.06 },
      }).connect(_drumsReverb!);
      _snareBody.volume.value = -4;
    }
    if (!_snareNoise) {
      _snareNoise = new Tone.NoiseSynth({
        noise:    { type: 'white' },
        envelope: { attack: 0.0005, decay: 0.13, sustain: 0.01, release: 0.06 },
      }).connect(_drumsReverb!);
      _snareNoise.volume.value = -6;
    }

    // ── Hi-hat closed ───────────────────────────────────────────────────────
    if (!_hihatClosed) {
      _hihatClosed = new Tone.MetalSynth({
        envelope:        { attack: 0.0005, decay: 0.06, release: 0.015 },
        harmonicity:     5.1,
        modulationIndex: 40,
        resonance:       5000,
        octaves:         1.5,
      }).connect(_drumsReverb!);
      _hihatClosed.frequency.value = 1200;
      _hihatClosed.volume.value    = -18;
    }

    // ── Ride cymbal ─────────────────────────────────────────────────────────
    if (!_rideSynth) {
      _rideSynth = new Tone.MetalSynth({
        envelope:        { attack: 0.001, decay: 0.8, release: 0.3 },
        harmonicity:     5.1,
        modulationIndex: 18,
        resonance:       3000,
        octaves:         1.2,
      }).connect(_drumsReverb!);
      _rideSynth.frequency.value = 420;
      _rideSynth.volume.value    = -16;
    }

    // ── Crash cymbal ────────────────────────────────────────────────────────
    if (!_crashSynth) {
      _crashSynth = new Tone.MetalSynth({
        envelope:        { attack: 0.001, decay: 1.5, release: 0.5 },
        harmonicity:     5.1,
        modulationIndex: 24,
        resonance:       2800,
        octaves:         1.5,
      }).connect(_drumsReverb!);
      _crashSynth.frequency.value = 350;
      _crashSynth.volume.value    = -12;
    }

    // ── Tom ─────────────────────────────────────────────────────────────────
    if (!_tomSynth) {
      _tomSynth = new Tone.MembraneSynth({
        pitchDecay:  0.04,
        octaves:     6,
        envelope:    { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
      }).connect(_drumsReverb!);
      _tomSynth.volume.value = -2;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MELODY — warm FM lead with vibrato‑like modulation
  // ══════════════════════════════════════════════════════════════════════════
  if (!_melodySynth) {
    _melodySynth = new Tone.FMSynth({
      harmonicity:     2,
      modulationIndex: 3,
      oscillator:      { type: 'sine' },
      modulation:      { type: 'triangle' },
      envelope:        { attack: 0.04, decay: 0.25, sustain: 0.6, release: 0.6 },
      modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.4 },
    }).connect(_melodyVol!);
    _melodySynth.connect(_melodySendRevGain!);
    _melodySynth.connect(_melodySendDelGain!);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KEYS — warm Rhodes-style FM PolySynth → Chorus → Tremolo
  // ══════════════════════════════════════════════════════════════════════════
  if (!_keysChorus) {
    _keysChorus = new Tone.Chorus({
      frequency: 1.2,
      delayTime: 4,
      depth:     0.6,
      wet:       0.45,
    }).start();
  }
  if (!_keysTremolo) {
    _keysTremolo = new Tone.Tremolo({
      frequency: 3.2,
      depth:     0.2,
      wet:       0.3,
    }).start();
  }
  if (!_keysSynth) {
    _keysSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity:     1,
      modulationIndex: 2,
      oscillator:      { type: 'sine' },
      modulation:      { type: 'sine' },
      envelope:        { attack: 0.005, decay: 0.5, sustain: 0.4, release: 1.2 },
      modulationEnvelope: { attack: 0.015, decay: 0.35, sustain: 0.3, release: 0.9 },
    });
    _keysSynth.maxPolyphony = 8;
    _keysSynth.chain(_keysChorus!, _keysTremolo!, _keysVol!);
    _keysVol!.connect(_keysSendRevGain!);
    _keysVol!.connect(_keysSendDelGain!);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VOCAL — breathy FM synth with AutoFilter for formant-like motion
  // ══════════════════════════════════════════════════════════════════════════
  if (!_vocalAutoFilter) {
    _vocalAutoFilter = new Tone.AutoFilter({
      frequency: 2.5,
      baseFrequency: 400,
      octaves:  2.5,
      wet:      0.5,
    }).connect(_vocalVol!).start();
  }
  if (!_vocalSynth) {
    _vocalSynth = new Tone.FMSynth({
      harmonicity:     1.5,
      modulationIndex: 2,
      oscillator:      { type: 'sine' },
      modulation:      { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.25, sustain: 0.55, release: 0.5 },
      modulationEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.4, release: 0.4 },
    }).connect(_vocalAutoFilter!);
    _vocalSynth.connect(_vocalSendRevGain!);
  }

  return {
    Tone,
    bassSynth: _bassSynth, bassSubSynth: _bassSubSynth,
    kickSampler: _kickSampler, snareSampler: _snareSampler,
    hihatSampler: _hihatSampler, rideSampler: _rideSampler,
    crashSampler: _crashSampler, tomSampler: _tomSampler,
    kickBody: _kickBody, kickClick: _kickClick,
    snareBody: _snareBody, snareNoise: _snareNoise,
    rideSynth: _rideSynth, hihatClosed: _hihatClosed,
    crashSynth: _crashSynth, tomSynth: _tomSynth,
    melodySynth: _melodySynth, keysSynth: _keysSynth, vocalSynth: _vocalSynth,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// GROOVE / HUMANIZATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Apply swing to offbeat positions.
 * swingAmount 0 = straight, 0.33 = jazz swing, 0.5 = hard triplet shuffle.
 * Only offbeats (the "and" of each beat) get delayed.
 */
function applySwing(t: number, beat: number): number {
  if (_swingAmount <= 0) return humanizeTime(t);
  const isOffbeat = (beat % 1) !== 0 && Math.abs((beat % 1) - 0.5) < 0.01;
  if (isOffbeat) {
    const swingDelay = _swingAmount * 0.0833; // fraction of a beat in bars:beats
    return humanizeTime(t + swingDelay);
  }
  return humanizeTime(t);
}

/** Small random timing offset (±12 ms) — tighter than v1. */
function humanizeTime(t: number): number {
  const offset = (Math.random() * 0.024) - 0.012;
  return Math.max(0, t + offset);
}

/** Velocity humanization: subtle variation around the input value. */
function humanizeVelocity(v: number, spread = 0.08): number {
  const jittered = v + (Math.random() * spread * 2 - spread);
  return Math.min(1.0, Math.max(0.3, jittered));
}

/** Ghost note detection: low-velocity hits get extra-quiet treatment. */
function isGhostNote(velocity: number): boolean {
  return velocity < 0.55;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule all tracks on Tone.Transport.
 * Must be called BEFORE Tone.Transport.start().
 */
export async function scheduleBand(midiData: MidiData): Promise<void> {
  const {
    Tone, bassSynth, bassSubSynth,
    kickSampler, snareSampler, hihatSampler,
    rideSampler, crashSampler, tomSampler,
    kickBody, kickClick, snareBody, snareNoise,
    rideSynth, hihatClosed, crashSynth, tomSynth,
    melodySynth, keysSynth, vocalSynth,
  } = await getSynths();

  const transport = Tone.getTransport();
  transport.cancel();
  transport.bpm.value = midiData.bpm;

  // Set swing based on feel (passed as swing property or default 0)
  _swingAmount = (midiData as MidiData & { swing?: number }).swing ?? 0;

  // ── Dispose previous Parts before rescheduling ────────────────────────────
  if (_bassPart)   { _bassPart.dispose();   _bassPart   = null; }
  if (_drumsPart)  { _drumsPart.dispose();  _drumsPart  = null; }
  if (_melodyPart) { _melodyPart.dispose(); _melodyPart = null; }
  if (_keysPart)   { _keysPart.dispose();   _keysPart   = null; }
  if (_vocalPart)  { _vocalPart.dispose();  _vocalPart  = null; }

  // ── Enable looping ─────────────────────────────────────────────────────────
  const loopEnd = `${midiData.total_bars}m`;
  transport.loop    = true;
  transport.loopEnd = loopEnd;

  if (!bassSynth) return;

  // ══════════════════════════════════════════════════════════════════════════
  // BASS PART — FM synth + sub-octave sine layer
  // ══════════════════════════════════════════════════════════════════════════
  let bassEvents = midiData.bass.map((note) => ({
    time: `${note.bar - 1}:${note.beat - 1}:0`,
    beat: note.beat,
    note: note.note,
    duration: note.duration,
    velocity: note.velocity / 127,
  }));

  bassEvents.sort((a, b) => {
    const [abar, abeat, asix] = a.time.split(":").map(x => Number(x) || 0);
    const [bbar, bbeat, bsix] = b.time.split(":").map(x => Number(x) || 0);
    if (abar !== bbar) return abar - bbar;
    if (abeat !== bbeat) return abeat - bbeat;
    return asix - bsix;
  });

  const seenTimes = new Set();
  bassEvents = bassEvents.filter(ev => {
    if (seenTimes.has(ev.time)) return false;
    seenTimes.add(ev.time);
    return true;
  });

  _bassPart = new Tone.Part(
    (t: number, ev: { beat: number; note: string; duration: string; velocity: number }) => {
      const ht = applySwing(t, ev.beat);
      const hv = humanizeVelocity(ev.velocity);
      _bassFilter!.frequency.setValueAtTime(900, ht);
      _bassFilter!.frequency.exponentialRampToValueAtTime(400, ht + 0.06);
      bassSynth.triggerAttackRelease(ev.note, ev.duration, ht, hv);
      if (bassSubSynth) {
        bassSubSynth.triggerAttackRelease(ev.note, ev.duration, ht, hv * 0.6);
      }
    },
    bassEvents,
  );
  _bassPart.loop    = true;
  _bassPart.loopEnd = loopEnd;
  _bassPart.start(0);

  const usingDrumSamples = !!(kickSampler && snareSampler && hihatSampler && rideSampler && crashSampler && tomSampler);
  const usingDrumFallback = !!(kickBody && snareNoise && hihatClosed && rideSynth);
  if (!usingDrumSamples && !usingDrumFallback) return;

  // ══════════════════════════════════════════════════════════════════════════
  // DRUMS PART — layered per-instrument triggering
  // ══════════════════════════════════════════════════════════════════════════
  const drumsEvents = midiData.drums.map((hit) => {
    const bar       = hit.bar - 1;
    const beatInt   = Math.floor(hit.beat - 1);
    const frac      = (hit.beat - 1) - beatInt;
    const sixteenth = Math.round(frac * 4);
    return {
      time:       `${bar}:${beatInt}:${sixteenth}`,
      beat:       hit.beat,
      instrument: hit.instrument,
      velocity:   hit.velocity / 127,
    };
  });

  _drumsPart = new Tone.Part(
    (t: number, ev: { beat: number; instrument: string; velocity: number }) => {
      const ht = applySwing(t, ev.beat);
      const hv = humanizeVelocity(ev.velocity);
      const ghost = isGhostNote(hv);

      if (usingDrumSamples && kickSampler && snareSampler && hihatSampler && rideSampler && crashSampler && tomSampler) {
        switch (ev.instrument) {
          case 'kick':
            kickSampler.triggerAttack(DRUM_SAMPLE_ROOT, ht, ghost ? hv * 0.65 : Math.min(hv * 1.05, 1));
            break;
          case 'snare':
            snareSampler.triggerAttack(DRUM_SAMPLE_ROOT, ht, ghost ? hv * 0.45 : hv);
            break;
          case 'hihat':
            hihatSampler.triggerAttack(DRUM_SAMPLE_ROOT, ht, ghost ? hv * 0.55 : hv);
            break;
          case 'ride':
            rideSampler.triggerAttack(DRUM_SAMPLE_ROOT, ht, hv);
            break;
          case 'crash':
            crashSampler.triggerAttack(DRUM_SAMPLE_ROOT, ht, Math.min(hv * 1.15, 1));
            break;
          case 'tom':
            tomSampler.triggerAttack(DRUM_SAMPLE_ROOT, ht, hv);
            break;
        }
        return;
      }

      switch (ev.instrument) {
        case 'kick':
          kickBody!.triggerAttackRelease('C1', '8n', ht, ghost ? hv * 0.6 : Math.min(hv * 1.1, 1));
          if (kickClick && !ghost) kickClick.triggerAttackRelease('G5', '64n', ht, 0.4);
          break;
        case 'snare':
          if (snareBody) snareBody.triggerAttackRelease('E2', '16n', ht, ghost ? hv * 0.4 : hv * 0.8);
          snareNoise!.triggerAttackRelease(ghost ? '32n' : '8n', ht, ghost ? hv * 0.3 : hv);
          break;
        case 'hihat':
          hihatClosed!.triggerAttackRelease('32n', ht, ghost ? hv * 0.5 : hv);
          break;
        case 'ride':
          rideSynth!.triggerAttackRelease('16n', ht, hv);
          break;
        case 'crash':
          if (crashSynth) crashSynth.triggerAttackRelease('4n', ht, Math.min(hv * 1.2, 1));
          break;
        case 'tom':
          if (tomSynth) tomSynth.triggerAttackRelease('G1', '8n', ht, hv);
          break;
      }
    },
    drumsEvents,
  );
  _drumsPart.loop    = true;
  _drumsPart.loopEnd = loopEnd;
  _drumsPart.start(0);

  // ══════════════════════════════════════════════════════════════════════════
  // MELODY PART
  // ══════════════════════════════════════════════════════════════════════════
  if (midiData.melody?.length && melodySynth) {
    const melodyEvents = midiData.melody.map((note) => ({
      time:     `${note.bar - 1}:${Math.floor(note.beat - 1)}:${Math.round(((note.beat - 1) - Math.floor(note.beat - 1)) * 4)}`,
      beat:     note.beat,
      note:     note.note,
      duration: note.duration,
      velocity: note.velocity / 127,
    }));
    _melodyPart = new Tone.Part(
      (t: number, ev: { beat: number; note: string; duration: string; velocity: number }) => {
        melodySynth.triggerAttackRelease(ev.note, ev.duration, applySwing(t, ev.beat), humanizeVelocity(ev.velocity, 0.06));
      },
      melodyEvents,
    );
    _melodyPart.loop    = true;
    _melodyPart.loopEnd = loopEnd;
    _melodyPart.start(0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KEYS PART (PolySynth — chords)
  // ══════════════════════════════════════════════════════════════════════════
  if (midiData.keys?.length && keysSynth) {
    const keysEvents = midiData.keys.map((chord) => ({
      time:     `${chord.bar - 1}:${Math.floor(chord.beat - 1)}:${Math.round(((chord.beat - 1) - Math.floor(chord.beat - 1)) * 4)}`,
      beat:     chord.beat,
      notes:    chord.notes,
      duration: chord.duration,
      velocity: chord.velocity / 127,
    }));
    _keysPart = new Tone.Part(
      (t: number, ev: { beat: number; notes: string[]; duration: string; velocity: number }) => {
        keysSynth.triggerAttackRelease(ev.notes, ev.duration, applySwing(t, ev.beat), humanizeVelocity(ev.velocity, 0.05));
      },
      keysEvents,
    );
    _keysPart.loop    = true;
    _keysPart.loopEnd = loopEnd;
    _keysPart.start(0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VOCAL PART
  // ══════════════════════════════════════════════════════════════════════════
  if (midiData.vocal?.length && vocalSynth) {
    const vocalEvents = midiData.vocal.map((note) => ({
      time:     `${note.bar - 1}:${Math.floor(note.beat - 1)}:${Math.round(((note.beat - 1) - Math.floor(note.beat - 1)) * 4)}`,
      beat:     note.beat,
      note:     note.note,
      duration: note.duration,
      velocity: note.velocity / 127,
    }));
    _vocalPart = new Tone.Part(
      (t: number, ev: { beat: number; note: string; duration: string; velocity: number }) => {
        vocalSynth.triggerAttackRelease(ev.note, ev.duration, applySwing(t, ev.beat), humanizeVelocity(ev.velocity, 0.06));
      },
      vocalEvents,
    );
    _vocalPart.loop    = true;
    _vocalPart.loopEnd = loopEnd;
    _vocalPart.start(0);
  }
}

/**
 * Load the recorded guitar audioBlob into a Tone.Player and sync it
 * to Tone.Transport so it plays perfectly alongside bass and drums.
 */
export async function loadGuitarTrack(audioBlob: Blob): Promise<void> {
  await getSynths();
  const Tone = await getTone();

  // Tear down previous player
  if (_guitarPlayer) {
    _guitarPlayer.stop();
    _guitarPlayer.disconnect();
    _guitarPlayer = null;
  }

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await Tone.getContext().rawContext.decodeAudioData(arrayBuffer);

  _guitarPlayer = new Tone.Player(audioBuffer).connect(_guitarVol!);
  _guitarPlayer.sync().start(0);
}

/**
 * Load the recorded vocal audioBlob into a separate Tone.Player.
 * When a user records vocals, this replaces the synth-based vocal track.
 */
export async function loadVocalTrack(audioBlob: Blob): Promise<void> {
  await getSynths();
  const Tone = await getTone();

  // Tear down previous vocal player
  if (_vocalPlayer) {
    _vocalPlayer.stop();
    _vocalPlayer.disconnect();
    _vocalPlayer = null;
  }

  // Stop the synth-based vocal part so it doesn't overlap
  if (_vocalPart) {
    _vocalPart.dispose();
    _vocalPart = null;
  }

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await Tone.getContext().rawContext.decodeAudioData(arrayBuffer);

  _vocalPlayer = new Tone.Player(audioBuffer).connect(_vocalVol!);
  _vocalPlayer.sync().start(0);
}

/**
 * Start all tracks simultaneously via Tone.Transport.
 * Must be called after a user gesture (click/tap).
 */
export async function startPlayback(): Promise<void> {
  const Tone = await getTone();
  await Tone.start(); // Unlock AudioContext
  Tone.getTransport().start();
}

export async function pausePlayback(): Promise<void> {
  const Tone = await getTone();
  Tone.getTransport().pause();
}

export async function stopPlayback(): Promise<void> {
  const Tone = await getTone();
  const transport = Tone.getTransport();
  transport.stop();
  transport.position = 0;
  transport.cancel();
  transport.loop = false;
  if (_guitarPlayer) _guitarPlayer.stop();
  if (_vocalPlayer)  _vocalPlayer.stop();
  // Dispose Parts so they don't accumulate on re-generate
  if (_bassPart)   { _bassPart.dispose();   _bassPart   = null; }
  if (_drumsPart)  { _drumsPart.dispose();  _drumsPart  = null; }
  if (_melodyPart) { _melodyPart.dispose(); _melodyPart = null; }
  if (_keysPart)   { _keysPart.dispose();   _keysPart   = null; }
  if (_vocalPart)  { _vocalPart.dispose();  _vocalPart  = null; }
}

export async function setVolume(
  track: TrackName,
  db: number
): Promise<void> {
  await getSynths(); // ensure volumes are initialized
  if (track === 'guitar' && _guitarVol) _guitarVol.volume.value = db;
  if (track === 'bass'   && _bassVol)   _bassVol.volume.value   = db - 2;
  if (track === 'drums'  && _drumsVol)  _drumsVol.volume.value  = db - 4;
  if (track === 'melody' && _melodyVol) _melodyVol.volume.value = db - 6;
  if (track === 'keys'   && _keysVol)   _keysVol.volume.value   = db - 8;
  if (track === 'vocal'  && _vocalVol)  _vocalVol.volume.value  = db - 4;
}

/**
 * Mute or unmute a single track.
 */
export async function setTrackMute(track: TrackName, muted: boolean): Promise<void> {
  await getSynths();
  const vol = getVolumeNode(track);
  if (vol) vol.mute = muted;
}

/**
 * Solo a track (mutes all others). Passing solo=false unmutes all.
 */
export async function setTrackSolo(track: TrackName, solo: boolean): Promise<void> {
  await getSynths();
  const allTracks: TrackName[] = ['guitar', 'bass', 'drums', 'melody', 'keys', 'vocal'];
  if (solo) {
    for (const t of allTracks) {
      const vol = getVolumeNode(t);
      if (vol) vol.mute = t !== track;
    }
  } else {
    for (const t of allTracks) {
      const vol = getVolumeNode(t);
      if (vol) vol.mute = false;
    }
  }
}

function getVolumeNode(track: TrackName) {
  switch (track) {
    case 'guitar': return _guitarVol;
    case 'bass':   return _bassVol;
    case 'drums':  return _drumsVol;
    case 'melody': return _melodyVol;
    case 'keys':   return _keysVol;
    case 'vocal':  return _vocalVol;
    default:       return null;
  }
}

/**
 * Returns the total duration in seconds for a given midi_data config.
 */
export function getMidiDuration(bpm: number, totalBars: number): number {
  const beatsPerBar   = 4;
  const beatsTotal    = totalBars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  return beatsTotal * secondsPerBeat;
}

/**
 * Dispose ALL Tone.js resources to prevent memory leaks.
 * Call this when the React component unmounts.
 */
export async function disposeAll(): Promise<void> {
  const Tone = await getTone();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();

  // Dispose Parts
  [_bassPart, _drumsPart, _melodyPart, _keysPart, _vocalPart].forEach(p => p?.dispose());
  _bassPart = _drumsPart = _melodyPart = _keysPart = _vocalPart = null;

  // Dispose Players
  [_guitarPlayer, _vocalPlayer].forEach(p => { p?.stop(); p?.dispose(); });
  _guitarPlayer = _vocalPlayer = null;

  // Dispose drum samplers
  disposeDrumSamplers();
  _drumSamplesFailed = false;

  // Dispose Synths
  [_bassSynth, _bassSubSynth, _kickBody, _kickClick, _snareBody, _snareNoise,
   _rideSynth, _hihatClosed, _crashSynth, _tomSynth,
   _melodySynth, _vocalSynth].forEach(s => s?.dispose());
  _bassSynth = _bassSubSynth = null;
  _kickBody = _kickClick = _snareBody = _snareNoise = null;
  _rideSynth = _hihatClosed = _crashSynth = _tomSynth = null;
  _melodySynth = _vocalSynth = null;
  _keysSynth?.dispose(); _keysSynth = null;

  // Dispose effects
  _keysChorus?.dispose();  _keysChorus  = null;
  _keysTremolo?.dispose(); _keysTremolo = null;
  _vocalAutoFilter?.dispose(); _vocalAutoFilter = null;
  _bassDrive?.dispose(); _bassDrive = null;

  // Dispose Send/Return effects
  _sendReverb?.dispose(); _sendReverb = null;
  _sendDelay?.dispose();  _sendDelay  = null;

  // Dispose Send gains
  [_melodySendRevGain, _melodySendDelGain, _keysSendRevGain, _keysSendDelGain, _vocalSendRevGain].forEach(g => g?.dispose());
  _melodySendRevGain = _melodySendDelGain = _keysSendRevGain = _keysSendDelGain = _vocalSendRevGain = null;

  // Dispose Drums reverb & Bass filter
  _drumsReverb?.dispose(); _drumsReverb = null;
  _bassFilter?.dispose();  _bassFilter  = null;

  // Dispose Volume faders
  [_bassVol, _drumsVol, _guitarVol, _melodyVol, _keysVol, _vocalVol].forEach(v => v?.dispose());
  _bassVol = _drumsVol = _guitarVol = _melodyVol = _keysVol = _vocalVol = null;

  // Dispose Master bus
  _masterComp?.dispose(); _masterComp = null;
  _masterEQ?.dispose();   _masterEQ   = null;
  _masterLimiter?.dispose(); _masterLimiter = null;
}
