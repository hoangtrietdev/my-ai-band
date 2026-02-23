interface TransportControlsProps {
  onPlay:       () => void;
  onPause:      () => void;
  onStop:       () => void;
  isPlaying:    boolean;
  isReady:      boolean;
  guitarVolume: number;
  bassVolume:   number;
  drumsVolume:  number;
  onGuitarVol:  (v: number) => void;
  onBassVol:    (v: number) => void;
  onDrumsVol:   (v: number) => void;
}

export default function TransportControls({
  onPlay, onPause, onStop, isPlaying, isReady,
  guitarVolume, bassVolume, drumsVolume,
  onGuitarVol, onBassVol, onDrumsVol,
}: TransportControlsProps) {

  function dbToPercent(db: number) {
    // Map -40..0 dB to 0..100%
    return Math.round(((db + 40) / 40) * 100);
  }

  function percentToDb(pct: number) {
    return Math.round((pct / 100) * 40 - 40);
  }

  return (
    <div className="retro-panel overflow-hidden">
      <div className="retro-panel-header flex items-center justify-between">
        <span className="text-xs text-blue-500 font-mono tracking-widest">TRANSPORT</span>
        <span className="text-xs text-gray-600 font-mono">
          {isPlaying ? '▶ PLAYING' : isReady ? '■ READY' : '○ STANDBY'}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4 md:flex-row md:items-start md:gap-8">

        {/* Play / Pause / Stop buttons */}
        <div className="flex gap-3 items-center shrink-0">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!isReady}
            title={isPlaying ? 'Pause' : 'Play'}
            className="retro-btn retro-btn-primary w-12 h-12 flex items-center justify-center text-lg"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={onStop}
            disabled={!isReady}
            title="Stop"
            className="retro-btn retro-btn-ghost w-12 h-12 flex items-center justify-center text-lg"
          >
            ■
          </button>
        </div>

        {/* Mixer */}
        <div className="flex-1 grid grid-cols-3 gap-4">
          {[
            { label: 'GUITAR', value: guitarVolume, onChange: onGuitarVol, color: 'text-cyan-400',   trackBg: '#164e63' },
            { label: 'BASS',   value: bassVolume,   onChange: onBassVol,   color: 'text-blue-400',   trackBg: '#1e3a8a' },
            { label: 'DRUMS',  value: drumsVolume,  onChange: onDrumsVol,  color: 'text-fuchsia-400', trackBg: '#4a044e' },
          ].map(({ label, value, onChange, color }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className={`text-xs font-mono font-bold ${color} tracking-widest`}>{label}</span>
                <span className="text-xs font-mono text-gray-500">{dbToPercent(value)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={dbToPercent(value)}
                onChange={(e) => onChange(percentToDb(Number(e.target.value)))}
                className="w-full"
              />
              <div className="text-xs text-gray-700 font-mono text-right">{value} dB</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
