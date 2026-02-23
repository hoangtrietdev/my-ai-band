/**
 * Tone.js Engine — lazily initialized to avoid SSR issues.
 * All exports are async functions that dynamic-import Tone only in the browser.
 */

import type { MidiData } from './schemas';

type ToneModule = typeof import('tone');

let toneCache: ToneModule | null = null;

async function getTone(): Promise<ToneModule> {
  if (!toneCache) {
    toneCache = await import('tone');
  }
  return toneCache;
}

// ─── Synth instances (lazy singletons) ───────────────────────────────────────

let _bassSynth: InstanceType<ToneModule['Synth']> | null = null;
let _kickSynth: InstanceType<ToneModule['MembraneSynth']> | null = null;
let _snareSynth: InstanceType<ToneModule['NoiseSynth']> | null = null;
let _rideSynth: InstanceType<ToneModule['MetalSynth']> | null = null;
let _hihatSynth: InstanceType<ToneModule['MetalSynth']> | null = null;
let _guitarPlayer: InstanceType<ToneModule['Player']> | null = null;

let _bassVol: InstanceType<ToneModule['Volume']> | null = null;
let _drumsVol: InstanceType<ToneModule['Volume']> | null = null;
let _guitarVol: InstanceType<ToneModule['Volume']> | null = null;
let _masterComp: InstanceType<ToneModule['Compressor']> | null = null;
let _drumsReverb: InstanceType<ToneModule['Reverb']> | null = null;
let _bassFilter: InstanceType<ToneModule['Filter']> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _bassPart:  any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _drumsPart: any = null;

async function getSynths() {
  const Tone = await getTone();

  // ── Master compressor (glue the mix together) ─────────────────────────────
  if (!_masterComp) {
    _masterComp = new Tone.Compressor({
      threshold: -18,
      ratio:      4,
      attack:     0.003,
      release:    0.15,
      knee:       6,
    }).toDestination();
  }

  // ── Volume faders → compressor ─────────────────────────────────────────────
  if (!_bassVol)   _bassVol   = new Tone.Volume(-2).connect(_masterComp);
  if (!_drumsVol)  _drumsVol  = new Tone.Volume(-4).connect(_masterComp);
  if (!_guitarVol) _guitarVol = new Tone.Volume(-6).connect(_masterComp);

  // ── Drums reverb (short room reverb for realism) ──────────────────────────
  if (!_drumsReverb) {
    _drumsReverb = new Tone.Reverb({ decay: 0.6, wet: 0.18 });
    await _drumsReverb.ready;
    _drumsReverb.connect(_drumsVol);
  }

  // ── Bass lowpass filter (deep sub-bass sound) ─────────────────────────────
  if (!_bassFilter) {
    _bassFilter = new Tone.Filter(340, 'lowpass').connect(_bassVol);
  }

  // ── Bass synth (warm, punchy) ─────────────────────────────────────────────
  if (!_bassSynth) {
    _bassSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 },
    }).connect(_bassFilter);
  }

  // ── Kick drum (deep thump) ────────────────────────────────────────────────
  if (!_kickSynth) {
    _kickSynth = new Tone.MembraneSynth({
      pitchDecay:  0.08,
      octaves:     8,
      envelope:    { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    }).connect(_drumsReverb!);
    _kickSynth.volume.value = 4;
  }

  // ── Snare drum (crisp crack) ──────────────────────────────────────────────
  if (!_snareSynth) {
    _snareSynth = new Tone.NoiseSynth({
      noise:    { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0.01, release: 0.08 },
    }).connect(_drumsReverb!);
    _snareSynth.volume.value = -2;
  }

  // ── Ride cymbal ───────────────────────────────────────────────────────────
  if (!_rideSynth) {
    _rideSynth = new Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.5,  release: 0.2  },
      harmonicity:     5.1,
      modulationIndex: 16,
      resonance:       3200,
      octaves:         1.2,
    }).connect(_drumsReverb!);
    _rideSynth.frequency.value = 450;
    _rideSynth.volume.value    = -14;
  }

  // ── Hi-hat ────────────────────────────────────────────────────────────────
  if (!_hihatSynth) {
    _hihatSynth = new Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.07, release: 0.02 },
      harmonicity:     5.1,
      modulationIndex: 32,
      resonance:       4200,
      octaves:         1.5,
    }).connect(_drumsReverb!);
    _hihatSynth.frequency.value = 900;
    _hihatSynth.volume.value    = -20;
  }

  return { Tone, bassSynth: _bassSynth, kickSynth: _kickSynth, snareSynth: _snareSynth, rideSynth: _rideSynth, hihatSynth: _hihatSynth };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule all bass and drum events on Tone.Transport.
 * Must be called BEFORE Tone.Transport.start().
 */
export async function scheduleBand(midiData: MidiData): Promise<void> {
  const { Tone, bassSynth, kickSynth, snareSynth, rideSynth, hihatSynth } = await getSynths();

  const transport = Tone.getTransport();
  transport.cancel();
  transport.bpm.value = midiData.bpm;

  // ── Dispose previous Parts before rescheduling ────────────────────────────
  if (_bassPart)  { _bassPart.dispose();  _bassPart  = null; }
  if (_drumsPart) { _drumsPart.dispose(); _drumsPart = null; }

  // ── Enable looping ─────────────────────────────────────────────────────────
  const loopEnd = `${midiData.total_bars}m`; // e.g. '4m'
  transport.loop    = true;
  transport.loopEnd = loopEnd;

  if (!bassSynth) return;

  // ── Bass Part (Tone.Part handles duplicate / unordered times safely) ───────
  let bassEvents = midiData.bass.map((note) => ({
    time: `${note.bar - 1}:${note.beat - 1}:0`,
    note: note.note,
    duration: note.duration,
    velocity: note.velocity / 127,
  }));

  // Sort by time (bar, beat)
  bassEvents.sort((a, b) => {
    const [abar, abeat, asix] = a.time.split(":").map(x => Number(x) || 0);
    const [bbar, bbeat, bsix] = b.time.split(":").map(x => Number(x) || 0);
    if (abar !== bbar) return abar - bbar;
    if (abeat !== bbeat) return abeat - bbeat;
    return asix - bsix;
  });

  // Remove duplicate times (keep first occurrence)
  const seenTimes = new Set();
  bassEvents = bassEvents.filter(ev => {
    if (seenTimes.has(ev.time)) return false;
    seenTimes.add(ev.time);
    return true;
  });

  _bassPart = new Tone.Part(
    (t: number, ev: { note: string; duration: string; velocity: number }) => {
      bassSynth.triggerAttackRelease(ev.note, ev.duration, t, ev.velocity);
    },
    bassEvents,
  );
  _bassPart.loop    = true;
  _bassPart.loopEnd = loopEnd;
  _bassPart.start(0);

  if (!kickSynth || !snareSynth || !hihatSynth || !rideSynth) return;

  // ── Drums Part ─────────────────────────────────────────────────────────────
  const drumsEvents = midiData.drums.map((hit) => {
    const bar       = hit.bar - 1;
    const beatInt   = Math.floor(hit.beat - 1);
    const frac      = (hit.beat - 1) - beatInt;
    const sixteenth = Math.round(frac * 4); // 0-3
    return {
      time:       `${bar}:${beatInt}:${sixteenth}`,
      instrument: hit.instrument,
      velocity:   hit.velocity / 127,
    };
  });

  _drumsPart = new Tone.Part(
    (t: number, ev: { instrument: string; velocity: number }) => {
      const vel = ev.velocity;
      switch (ev.instrument) {
        case 'kick':   kickSynth.triggerAttackRelease('C1',  '8n',  t, Math.min(vel * 1.1, 1));  break;
        case 'snare':  snareSynth.triggerAttackRelease('8n',        t, vel);                      break;
        case 'hihat':  hihatSynth.triggerAttackRelease('32n',       t, vel);                      break;
        case 'ride':   rideSynth.triggerAttackRelease('32n',        t, vel);                      break;
        case 'crash':  rideSynth.triggerAttackRelease('16n',        t, Math.min(vel * 1.2, 1));   break;
        case 'tom':    kickSynth.triggerAttackRelease('G1',  '8n',  t, vel);                      break;
      }
    },
    drumsEvents,
  );
  _drumsPart.loop    = true;
  _drumsPart.loopEnd = loopEnd;
  _drumsPart.start(0);
}

/**
 * Load the recorded guitar audioBlob into a Tone.Player and sync it
 * to Tone.Transport so it plays perfectly alongside bass and drums.
 */
export async function loadGuitarTrack(audioBlob: Blob): Promise<void> {
  // Ensure the full master chain (_guitarVol → _masterComp → Destination) is initialized
  // so guitar blends through the same compressor as bass and drums.
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

  // Connect into the existing _guitarVol (already wired to _masterComp)
  _guitarPlayer = new Tone.Player(audioBuffer).connect(_guitarVol!);
  // Sync to transport so it starts/loops alongside bass and drums
  _guitarPlayer.sync().start(0);
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
  transport.cancel();
  transport.loop = false;
  if (_guitarPlayer) _guitarPlayer.stop();
  // Dispose Parts so they don't accumulate on re-generate
  if (_bassPart)  { _bassPart.dispose();  _bassPart  = null; }
  if (_drumsPart) { _drumsPart.dispose(); _drumsPart = null; }
}

export async function setVolume(
  track: 'guitar' | 'bass' | 'drums',
  db: number
): Promise<void> {
  await getSynths(); // ensure volumes are initialized
  if (track === 'guitar' && _guitarVol) _guitarVol.volume.value = db;
  if (track === 'bass'   && _bassVol)   _bassVol.volume.value   = db - 2;   // bass pre-fader offset
  if (track === 'drums'  && _drumsVol)  _drumsVol.volume.value  = db - 4;   // drums pre-fader offset
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
