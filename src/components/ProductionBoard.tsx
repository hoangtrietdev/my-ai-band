import TrackStrip from './TrackStrip';
import { MidiData, TrackName } from '@/lib/schemas';
import { usePlayhead } from '@/hooks/usePlayhead';
import { durationToBeats } from '@/lib/musicTimeline';

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
  onVolume:    (track: TrackName, percent: number) => void;
  onSeek:      (seconds: number) => void;
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
  onSeek,
  onExportJson,
  armedTrack, onArmTrack,
}: ProductionBoardProps) {
  const totalDurationSeconds = midiData ? (midiData.total_bars * 4 * 60) / midiData.bpm : 0;
  const { pct: playheadPct, seconds: playheadSeconds } = usePlayhead(totalDurationSeconds);
  const totalBeats = (midiData?.total_bars ?? 4) * 4;

  function formatTime(seconds: number) {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60).toString().padStart(2, '0');
    const secs = (safe % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

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
      <div className="daw-panel-header flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs font-semibold tracking-wide text-foreground">Tracks</span>
          {midiData && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {midiData.total_bars} bars · {midiData.bpm} BPM
            </span>
          )}
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!isReady}
            className="daw-btn daw-btn-primary text-xs py-1.5 px-3 sm:px-4"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={onStop}
            disabled={!isReady}
            className="daw-btn daw-btn-ghost text-xs py-1.5 px-3 sm:px-4"
          >
            ■ Stop
          </button>
          <button
            onClick={onExportJson}
            disabled={!midiData}
            className="daw-btn daw-btn-ghost text-xs py-1.5 px-2 sm:px-3"
            title="Download MIDI JSON"
          >
            <span className="hidden sm:inline">⬇ Export</span>
            <span className="sm:hidden">⬇</span>
          </button>
        </div>

        {midiData && (
          <div className="daw-scrubber-wrap w-full">
            <div className="daw-scrubber-gutter" aria-hidden />
            <div className="daw-scrubber-rail">
              <div className="daw-scrubber-time-row">
                <span className="daw-scrubber-time">{formatTime(playheadSeconds)}</span>
                <span className="daw-scrubber-time">{formatTime(totalDurationSeconds)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(totalDurationSeconds, 1)}
                step={0.01}
                value={Math.min(playheadSeconds, totalDurationSeconds || 0)}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="daw-scrubber"
                aria-label="Seek playback"
              />
            </div>
          </div>
        )}
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
              onVolume={(percent) => onVolume(name, percent)}
              onSeekPct={(pct) => onSeek((pct / 100) * totalDurationSeconds)}
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
