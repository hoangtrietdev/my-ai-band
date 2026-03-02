import MiniTimeline from './MiniTimeline';

interface TrackStripProps {
  name:      string;
  icon:      string;
  color:     string;
  muted:     boolean;
  solo:      boolean;
  volume:    number;
  events:    { startBeat: number; durationBeats: number; label?: string }[];
  totalBeats: number;
  playheadPct: number;
  onMute:    () => void;
  onSolo:    () => void;
  onVolume:  (db: number) => void;
  hasData:   boolean;
}

export default function TrackStrip({
  name, icon, color, muted, solo, volume,
  events, totalBeats, playheadPct,
  onMute, onSolo, onVolume, hasData,
}: TrackStripProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b-2 border-border transition-opacity ${
        muted ? 'opacity-40' : 'opacity-100'
      }`}
    >
      {/* Track label */}
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-mono font-bold tracking-wider uppercase" style={{ color }}>
          {name}
        </span>
      </div>

      {/* Mute button */}
      <button
        onClick={onMute}
        className={`w-7 h-7 text-xs font-mono font-bold border-2 flex items-center justify-center shrink-0 transition-colors ${
          muted
            ? 'bg-red-900 border-red-500 text-red-300'
            : 'bg-secondary border-border text-muted-foreground hover:text-primary'
        }`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        M
      </button>

      {/* Solo button */}
      <button
        onClick={onSolo}
        className={`w-7 h-7 text-xs font-mono font-bold border-2 flex items-center justify-center shrink-0 transition-colors ${
          solo
            ? 'bg-yellow-900 border-yellow-500 text-yellow-300'
            : 'bg-secondary border-border text-muted-foreground hover:text-primary'
        }`}
        title={solo ? 'Unsolo' : 'Solo'}
      >
        S
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min={-24}
        max={6}
        step={1}
        value={volume}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="w-16 shrink-0"
        title={`${volume} dB`}
      />

      {/* Mini timeline */}
      <div className="flex-1 min-w-0">
        {hasData ? (
          <MiniTimeline
            events={events}
            color={color}
            totalBeats={totalBeats}
            playheadPct={playheadPct}
          />
        ) : (
          <div className="h-7 bg-black/50 border-2 border-border flex items-center justify-center">
            <span className="text-xs text-muted-foreground font-mono">—</span>
          </div>
        )}
      </div>
    </div>
  );
}
