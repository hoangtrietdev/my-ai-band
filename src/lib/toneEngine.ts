/**
 * Tone.js Engine — lazily initialized to avoid SSR issues.
 * All exports are async functions that dynamic-import Tone only in the browser.
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

let _bassSynth:   InstanceType<ToneModule['Synth']> | null = null;
let _kickSynth:   InstanceType<ToneModule['MembraneSynth']> | null = null;
let _snareSynth:  InstanceType<ToneModule['NoiseSynth']> | null = null;
let _rideSynth:   InstanceType<ToneModule['MetalSynth']> | null = null;
let _hihatSynth:  InstanceType<ToneModule['MetalSynth']> | null = null;
let _guitarPlayer: InstanceType<ToneModule['Player']> | null = null;
let _vocalPlayer:  InstanceType<ToneModule['Player']> | null = null;
let _melodySynth: InstanceType<ToneModule['FMSynth']> | null = null;
let _keysSynth:   InstanceType<ToneModule['PolySynth']> | null = null;
let _vocalSynth:  InstanceType<ToneModule['AMSynth']> | null = null;

let _bassVol:    InstanceType<ToneModule['Volume']> | null = null;
let _drumsVol:   InstanceType<ToneModule['Volume']> | null = null;
let _guitarVol:  InstanceType<ToneModule['Volume']> | null = null;
let _melodyVol:  InstanceType<ToneModule['Volume']> | null = null;
let _keysVol:    InstanceType<ToneModule['Volume']> | null = null;
let _vocalVol:   InstanceType<ToneModule['Volume']> | null = null;
let _masterComp: InstanceType<ToneModule['Compressor']> | null = null;
let _drumsReverb: InstanceType<ToneModule['Reverb']> | null = null;
let _bassFilter: InstanceType<ToneModule['Filter']> | null = null;

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
  if (!_melodyVol) _melodyVol = new Tone.Volume(-6).connect(_masterComp);
  if (!_keysVol)   _keysVol   = new Tone.Volume(-8).connect(_masterComp);
  if (!_vocalVol)  _vocalVol  = new Tone.Volume(-4).connect(_masterComp);

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

  // ── Melody synth (bright FM lead) ─────────────────────────────────────────
  if (!_melodySynth) {
    _melodySynth = new Tone.FMSynth({
      harmonicity:     3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3 },
    }).connect(_melodyVol!);
  }

  // ── Keys synth (warm polyphonic pad) ──────────────────────────────────────
  if (!_keysSynth) {
    _keysSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope:   { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 },
    }).connect(_keysVol!);
    _keysSynth.maxPolyphony = 6;
  }

  // ── Vocal synth (AM synth with vocal-ish timbre) ──────────────────────────
  if (!_vocalSynth) {
    _vocalSynth = new Tone.AMSynth({
      harmonicity:     2.5,
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.4 },
    }).connect(_vocalVol!);
  }

  return {
    Tone,
    bassSynth: _bassSynth, kickSynth: _kickSynth, snareSynth: _snareSynth,
    rideSynth: _rideSynth, hihatSynth: _hihatSynth,
    melodySynth: _melodySynth, keysSynth: _keysSynth, vocalSynth: _vocalSynth,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule all bass and drum events on Tone.Transport.
 * Must be called BEFORE Tone.Transport.start().
 */
export async function scheduleBand(midiData: MidiData): Promise<void> {
  const { Tone, bassSynth, kickSynth, snareSynth, rideSynth, hihatSynth, melodySynth, keysSynth, vocalSynth } = await getSynths();

  const transport = Tone.getTransport();
  transport.cancel();
  transport.bpm.value = midiData.bpm;

  // ── Dispose previous Parts before rescheduling ────────────────────────────
  if (_bassPart)   { _bassPart.dispose();   _bassPart   = null; }
  if (_drumsPart)  { _drumsPart.dispose();  _drumsPart  = null; }
  if (_melodyPart) { _melodyPart.dispose(); _melodyPart = null; }
  if (_keysPart)   { _keysPart.dispose();   _keysPart   = null; }
  if (_vocalPart)  { _vocalPart.dispose();  _vocalPart  = null; }

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

  // ── Melody Part ────────────────────────────────────────────────────────────
  if (midiData.melody?.length && melodySynth) {
    const melodyEvents = midiData.melody.map((note) => ({
      time:     `${note.bar - 1}:${Math.floor(note.beat - 1)}:${Math.round(((note.beat - 1) - Math.floor(note.beat - 1)) * 4)}`,
      note:     note.note,
      duration: note.duration,
      velocity: note.velocity / 127,
    }));
    _melodyPart = new Tone.Part(
      (t: number, ev: { note: string; duration: string; velocity: number }) => {
        melodySynth.triggerAttackRelease(ev.note, ev.duration, t, ev.velocity);
      },
      melodyEvents,
    );
    _melodyPart.loop    = true;
    _melodyPart.loopEnd = loopEnd;
    _melodyPart.start(0);
  }

  // ── Keys Part (PolySynth — chords) ─────────────────────────────────────────
  if (midiData.keys?.length && keysSynth) {
    const keysEvents = midiData.keys.map((chord) => ({
      time:     `${chord.bar - 1}:${Math.floor(chord.beat - 1)}:${Math.round(((chord.beat - 1) - Math.floor(chord.beat - 1)) * 4)}`,
      notes:    chord.notes,
      duration: chord.duration,
      velocity: chord.velocity / 127,
    }));
    _keysPart = new Tone.Part(
      (t: number, ev: { notes: string[]; duration: string; velocity: number }) => {
        keysSynth.triggerAttackRelease(ev.notes, ev.duration, t, ev.velocity);
      },
      keysEvents,
    );
    _keysPart.loop    = true;
    _keysPart.loopEnd = loopEnd;
    _keysPart.start(0);
  }

  // ── Vocal Part ─────────────────────────────────────────────────────────────
  if (midiData.vocal?.length && vocalSynth) {
    const vocalEvents = midiData.vocal.map((note) => ({
      time:     `${note.bar - 1}:${Math.floor(note.beat - 1)}:${Math.round(((note.beat - 1) - Math.floor(note.beat - 1)) * 4)}`,
      note:     note.note,
      duration: note.duration,
      velocity: note.velocity / 127,
    }));
    _vocalPart = new Tone.Part(
      (t: number, ev: { note: string; duration: string; velocity: number }) => {
        vocalSynth.triggerAttackRelease(ev.note, ev.duration, t, ev.velocity);
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
