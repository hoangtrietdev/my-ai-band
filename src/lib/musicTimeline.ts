import type { MelodyNote, MidiData } from './schemas';

export const NOTE_DURATION_BEATS: Record<string, number> = {
  '1n': 4,
  '2n': 2,
  '4n': 1,
  '8n': 0.5,
  '16n': 0.25,
  '4n.': 1.5,
  '8n.': 0.75,
};

const SORTABLE_DURATIONS = [
  { label: '1n', beats: 4 },
  { label: '2n', beats: 2 },
  { label: '4n.', beats: 1.5 },
  { label: '4n', beats: 1 },
  { label: '8n.', beats: 0.75 },
  { label: '8n', beats: 0.5 },
  { label: '16n', beats: 0.25 },
] as const;

export function durationToBeats(duration: string): number {
  return NOTE_DURATION_BEATS[duration] ?? 1;
}

function floorDurationToSupportedValue(beats: number): MelodyNote['duration'] | null {
  for (const option of SORTABLE_DURATIONS) {
    if (beats >= option.beats - 1e-6) {
      return option.label;
    }
  }
  return null;
}

function noteStartBeat(note: { bar: number; beat: number }): number {
  return (note.bar - 1) * 4 + (note.beat - 1);
}

function absoluteBeatToBarBeat(absoluteBeat: number): { bar: number; beat: number } {
  const safeBeat = Math.max(0, absoluteBeat);
  const barIndex = Math.floor(safeBeat / 4);
  const beat = safeBeat - barIndex * 4 + 1;
  return {
    bar: barIndex + 1,
    beat: Number(beat.toFixed(2)),
  };
}

export function extendMelodyToSongLength(melody: MelodyNote[] | undefined, totalBars: number): MelodyNote[] | undefined {
  if (!melody?.length) return melody;

  const totalBeats = totalBars * 4;
  const sorted = [...melody].sort((a, b) => noteStartBeat(a) - noteStartBeat(b));
  const melodyEnd = sorted.reduce((max, note) => {
    const end = noteStartBeat(note) + durationToBeats(note.duration);
    return Math.max(max, end);
  }, 0);

  if (melodyEnd >= totalBeats - 0.25) {
    return sorted;
  }

  const phraseLength = Math.max(melodyEnd, 1);
  const extended = [...sorted];

  for (let offset = phraseLength; offset < totalBeats - 0.25; offset += phraseLength) {
    for (const note of sorted) {
      const start = noteStartBeat(note) + offset;
      if (start >= totalBeats) break;

      const remaining = totalBeats - start;
      const supportedDuration = floorDurationToSupportedValue(Math.min(durationToBeats(note.duration), remaining));
      if (!supportedDuration) continue;

      const { bar, beat } = absoluteBeatToBarBeat(start);
      extended.push({
        ...note,
        bar,
        beat,
        duration: supportedDuration,
      });
    }
  }

  return extended.sort((a, b) => noteStartBeat(a) - noteStartBeat(b));
}

export function normalizeMidiDataDurations(midiData: MidiData): MidiData {
  const melody = extendMelodyToSongLength(midiData.melody, midiData.total_bars);
  if (!melody || melody === midiData.melody) {
    return midiData;
  }
  return {
    ...midiData,
    melody,
  };
}
