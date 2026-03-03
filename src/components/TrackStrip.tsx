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
  onVolume:    (db: number) => void;
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
  source, armed = false, onArm, canRecord = false,
}: TrackStripProps) {
  return (
    <div className={`track-lane ${!hasData ? 'track-lane-empty' : ''}`}>
      {/* Color stripe */}
      <div className="track-color-stripe" style={{ background: color }} />

      {/* Track label */}
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold tracking-wide" style={{ color }}>
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

      {/* Volume slider */}
      <input
        type="range"
        min={-24} max={6} step={1}
        value={volume}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="w-14 shrink-0"
        title={`${volume} dB`}
      />

      {/* Waveform block */}
      <WaveformBlock
        events={events}
        color={color}
        totalBeats={totalBeats}
        playheadPct={playheadPct}
        hasData={hasData}
        source={source}
      />
    </div>
  );
}
