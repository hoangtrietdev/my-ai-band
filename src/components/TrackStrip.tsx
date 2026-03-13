import WaveformBlock from './WaveformBlock';

interface TrackStripProps {
  name:        string;
  icon:        string;
  color:       string;
  muted:       boolean;
  solo:        boolean;
  volume:      number;
  events:      { startBeat: number; durationBeats: number; label?: string }[];
  totalBeats:  number;
  playheadPct: number;
  onMute:      () => void;
  onSolo:      () => void;
  onVolume:    (percent: number) => void;
  onSeekPct?:  (pct: number) => void;
  hasData:     boolean;
  source:      'user' | 'ai' | 'empty';
  /** Whether this track is armed for recording */
  armed?:      boolean;
  onArm?:      () => void;
  /** Whether to show the arm-to-record button */
  canRecord?:  boolean;
}

export default function TrackStrip({
  name, icon, color, muted, solo, volume,
  events, totalBeats, playheadPct,
  onMute, onSolo, onVolume, hasData,
  onSeekPct,
  source, armed = false, onArm, canRecord = false,
}: TrackStripProps) {
  return (
    <div className={`track-lane ${!hasData ? 'track-lane-empty' : ''}`}>
      {/* Color stripe */}
      <div className="track-color-stripe" style={{ background: color }} />

      {/* Track label */}
      <div className="flex items-center gap-1 sm:gap-1.5 w-14 sm:w-20 shrink-0">
        <span className="text-sm sm:text-base">{icon}</span>
        <span className="text-[10px] sm:text-xs font-semibold tracking-wide truncate" style={{ color }}>
          {name}
        </span>
      </div>

      {/* Arm to Record button (only for recordable tracks) */}
      {canRecord ? (
        <button
          onClick={onArm}
          className={`arm-record-btn ${armed ? 'armed' : ''}`}
          title={armed ? 'Disarm' : 'Arm to record'}
        >
          <span className="arm-dot" />
        </button>
      ) : (
        <div className="w-7 shrink-0" /> /* spacer */
      )}

      {/* M / S buttons */}
      <button
        onClick={onMute}
        className={`w-6 h-6 text-[10px] font-bold rounded-md flex items-center justify-center shrink-0 transition-colors ${
          muted
            ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500'
            : 'bg-secondary text-muted-foreground hover:text-foreground ring-1 ring-border'
        }`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        M
      </button>

      <button
        onClick={onSolo}
        className={`w-6 h-6 text-[10px] font-bold rounded-md flex items-center justify-center shrink-0 transition-colors ${
          solo
            ? 'bg-yellow-500/30 text-yellow-300 ring-1 ring-yellow-500'
            : 'bg-secondary text-muted-foreground hover:text-foreground ring-1 ring-border'
        }`}
        title={solo ? 'Unsolo' : 'Solo'}
      >
        S
      </button>

      {/* Volume controls */}
      <div className="track-volume-control shrink-0">
        <button
          type="button"
          className="track-volume-btn"
          onClick={() => onVolume(Math.max(0, volume - 5))}
          aria-label={`Decrease ${name} volume`}
        >−</button>
        <div className="track-volume-readout">
          <span className="track-volume-label">VOL</span>
          <span className="track-volume-value">{volume}%</span>
        </div>
        <button
          type="button"
          className="track-volume-btn"
          onClick={() => onVolume(Math.min(100, volume + 5))}
          aria-label={`Increase ${name} volume`}
        >+</button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="track-volume-slider"
          title={`${volume}%`}
        />
      </div>

      {/* Waveform block */}
      <WaveformBlock
        events={events}
        color={color}
        totalBeats={totalBeats}
        playheadPct={playheadPct}
        hasData={hasData}
        source={source}
        canRecord={canRecord}
        onArm={onArm}
        onSeekPct={onSeekPct}
      />
    </div>
  );
}
