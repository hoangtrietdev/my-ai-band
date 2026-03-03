import TrackStrip from './TrackStrip';
import { MidiData, TrackName } from '@/lib/schemas';
import { usePlayhead } from '@/hooks/usePlayhead';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrackState = { muted: boolean; solo: boolean; volume: number };
export type TrackSource = 'user' | 'ai' | 'empty';

interface ProductionBoardProps {
  midiData:    MidiData | null;
  hasAudio:    boolean;
  trackStates: Record<TrackName, TrackState>;
  trackSources: Record<TrackName, TrackSource>;
  isPlaying:   boolean;
  isReady:     boolean;
  onPlay:      () => void;
  onPause:     () => void;
  onStop:      () => void;
  onMute:      (track: TrackName) => void;
  onSolo:      (track: TrackName) => void;
  onVolume:    (track: TrackName, db: number) => void;
  onExportJson: () => void;
  /** Track that is armed for recording */
  armedTrack?: TrackName | null;
  onArmTrack?: (track: TrackName) => void;
}

// ─── Track metadata — GarageBand color coding ────────────────────────────────

const TRACK_META: Record<TrackName, { icon: string; color: string; canRecord: boolean }> = {
  guitar: { icon: '🎸', color: 'var(--track-audio)',  canRecord: true  },
  melody: { icon: '🎵', color: 'var(--track-midi)',   canRecord: false },
  keys:   { icon: '🎹', color: 'var(--track-midi)',   canRecord: false },
  bass:   { icon: '🎸', color: 'var(--track-midi)',   canRecord: false },
  drums:  { icon: '🥁', color: 'var(--track-drums)',  canRecord: false },
  vocal:  { icon: '🎤', color: 'var(--track-vocal)',  canRecord: true  },
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
  midiData, hasAudio, trackStates, trackSources,
  isPlaying, isReady,
  onPlay, onPause, onStop,
  onMute, onSolo, onVolume,
  onExportJson,
  armedTrack, onArmTrack,
}: ProductionBoardProps) {
  const playheadPct = usePlayhead();
  const totalBeats = (midiData?.total_bars ?? 4) * 4;

  // Build track configs
  const tracks: {
    name: TrackName;
    label: string;
    events: { startBeat: number; durationBeats: number; label?: string }[];
    hasData: boolean;
    source: TrackSource;
  }[] = [
    {
      name: 'guitar', label: 'Guitar',
      events: [], hasData: hasAudio,
      source: trackSources.guitar,
    },
    {
      name: 'melody', label: 'Melody',
      events: midiData?.melody ? noteToEvents(midiData.melody) : [],
      hasData: !!midiData?.melody?.length,
      source: trackSources.melody,
    },
    {
      name: 'keys', label: 'Keys',
      events: midiData?.keys ? noteToEvents(midiData.keys.map(k => ({ ...k, duration: k.duration }))) : [],
      hasData: !!midiData?.keys?.length,
      source: trackSources.keys,
    },
    {
      name: 'bass', label: 'Bass',
      events: midiData?.bass ? noteToEvents(midiData.bass) : [],
      hasData: !!midiData?.bass?.length,
      source: trackSources.bass,
    },
    {
      name: 'drums', label: 'Drums',
      events: midiData?.drums ? drumToEvents(midiData.drums) : [],
      hasData: !!midiData?.drums?.length,
      source: trackSources.drums,
    },
    {
      name: 'vocal', label: 'Vocal',
      events: midiData?.vocal ? noteToEvents(midiData.vocal) : [],
      hasData: !!midiData?.vocal?.length,
      source: trackSources.vocal,
    },
  ];

  return (
    <div className="daw-panel overflow-hidden flex flex-col h-full">
      {/* Track header bar */}
      <div className="daw-panel-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wide text-foreground">Tracks</span>
          {midiData && (
            <span className="text-xs text-muted-foreground">
              {midiData.total_bars} bars · {midiData.bpm} BPM
            </span>
          )}
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!isReady}
            className="daw-btn daw-btn-primary text-xs py-1.5 px-4"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={onStop}
            disabled={!isReady}
            className="daw-btn daw-btn-ghost text-xs py-1.5 px-4"
          >
            ■ Stop
          </button>
          <button
            onClick={onExportJson}
            disabled={!midiData}
            className="daw-btn daw-btn-ghost text-xs py-1.5 px-3"
            title="Download MIDI JSON"
          >
            ⬇ Export
          </button>
        </div>
      </div>

      {/* Track lanes — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {tracks.map(({ name, label, events, hasData, source }) => {
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
              source={source}
              canRecord={meta.canRecord}
              armed={armedTrack === name}
              onArm={() => onArmTrack?.(name)}
            />
          );
        })}
      </div>
    </div>
  );
}
