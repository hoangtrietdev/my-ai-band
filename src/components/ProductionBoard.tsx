import TrackStrip from './TrackStrip';
import { MidiData, TrackName } from '@/lib/schemas';
import { usePlayhead } from '@/hooks/usePlayhead';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrackState = { muted: boolean; solo: boolean; volume: number };

interface ProductionBoardProps {
  midiData:    MidiData | null;
  hasAudio:    boolean;
  trackStates: Record<TrackName, TrackState>;
  isPlaying:   boolean;
  isReady:     boolean;
  onPlay:      () => void;
  onPause:     () => void;
  onStop:      () => void;
  onMute:      (track: TrackName) => void;
  onSolo:      (track: TrackName) => void;
  onVolume:    (track: TrackName, db: number) => void;
  onExportJson: () => void;
}

// ─── Track metadata ───────────────────────────────────────────────────────────

const TRACK_META: Record<TrackName, { icon: string; color: string }> = {
  guitar: { icon: '🎸', color: '#f59e0b' },
  melody: { icon: '🎵', color: '#a78bfa' },
  keys:   { icon: '🎹', color: '#34d399' },
  bass:   { icon: '🎸', color: '#60a5fa' },
  drums:  { icon: '🥁', color: '#f87171' },
  vocal:  { icon: '🎤', color: '#fb923c' },
};

// ─── Helpers: convert MIDI data to timeline events ────────────────────────────

const DURATION_MAP: Record<string, number> = {
  '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25,
  '4n.': 1.5, '8n.': 0.75,
};

function durationToBeats(dur: string): number {
  return DURATION_MAP[dur] ?? 1;
}

function noteToEvents(notes: { bar: number; beat: number; duration: string; syllable?: string }[]) {
  return notes.map(n => ({
    startBeat: (n.bar - 1) * 4 + (n.beat - 1),
    durationBeats: durationToBeats(n.duration),
    label: n.syllable,
  }));
}

function drumToEvents(hits: { bar: number; beat: number }[]) {
  return hits.map(h => ({
    startBeat: (h.bar - 1) * 4 + (h.beat - 1),
    durationBeats: 0.25,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductionBoard({
  midiData, hasAudio, trackStates,
  isPlaying, isReady,
  onPlay, onPause, onStop,
  onMute, onSolo, onVolume,
  onExportJson,
}: ProductionBoardProps) {
  const playheadPct = usePlayhead();
  const totalBeats = (midiData?.total_bars ?? 4) * 4;

  // Build track configs
  const tracks: {
    name: TrackName;
    label: string;
    events: { startBeat: number; durationBeats: number; label?: string }[];
    hasData: boolean;
  }[] = [
    {
      name: 'guitar',
      label: 'Guitar',
      events: [],
      hasData: hasAudio,
    },
    {
      name: 'melody',
      label: 'Melody',
      events: midiData?.melody ? noteToEvents(midiData.melody) : [],
      hasData: !!midiData?.melody?.length,
    },
    {
      name: 'keys',
      label: 'Keys',
      events: midiData?.keys ? noteToEvents(midiData.keys.map(k => ({ ...k, duration: k.duration }))) : [],
      hasData: !!midiData?.keys?.length,
    },
    {
      name: 'bass',
      label: 'Bass',
      events: midiData?.bass ? noteToEvents(midiData.bass) : [],
      hasData: !!midiData?.bass?.length,
    },
    {
      name: 'drums',
      label: 'Drums',
      events: midiData?.drums ? drumToEvents(midiData.drums) : [],
      hasData: !!midiData?.drums?.length,
    },
    {
      name: 'vocal',
      label: 'Vocal',
      events: midiData?.vocal ? noteToEvents(midiData.vocal) : [],
      hasData: !!midiData?.vocal?.length,
    },
  ];

  return (
    <div className="retro-panel overflow-hidden">
      {/* Header */}
      <div className="retro-panel-header flex items-center justify-between">
        <span className="text-xs font-mono tracking-widest">PRODUCTION BOARD</span>
        {midiData && (
          <span className="text-xs font-mono text-muted-foreground">
            {midiData.total_bars} bars · {midiData.bpm} BPM
          </span>
        )}
      </div>

      {/* Track strips */}
      <div>
        {tracks.map(({ name, label, events, hasData }) => {
          const meta = TRACK_META[name];
          const state = trackStates[name];
          return (
            <TrackStrip
              key={name}
              name={label}
              icon={meta.icon}
              color={meta.color}
              muted={state.muted}
              solo={state.solo}
              volume={state.volume}
              events={events}
              totalBeats={totalBeats}
              playheadPct={playheadPct}
              onMute={() => onMute(name)}
              onSolo={() => onSolo(name)}
              onVolume={(db) => onVolume(name, db)}
              hasData={hasData}
            />
          );
        })}
      </div>

      {/* Transport + Export */}
      <div className="p-3 flex items-center gap-3 border-t-2 border-border">
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isReady}
          className="retro-btn retro-btn-primary text-xs py-1.5 px-4"
        >
          {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <button
          onClick={onStop}
          disabled={!isReady}
          className="retro-btn retro-btn-ghost text-xs py-1.5 px-4"
        >
          ■ STOP
        </button>

        <div className="flex-1" />

        <button
          onClick={onExportJson}
          disabled={!midiData}
          className="retro-btn retro-btn-ghost text-xs py-1.5 px-3"
          title="Download MIDI JSON"
        >
          ⬇ MIDI
        </button>
      </div>
    </div>
  );
}
