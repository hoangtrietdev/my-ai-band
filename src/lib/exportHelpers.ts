import type { MidiData } from './schemas';

/**
 * Download the full MIDI JSON as a .json file.
 */
export function downloadMidiJson(midiData: MidiData, filename = 'ai-band-midi.json') {
  const json = JSON.stringify(midiData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
