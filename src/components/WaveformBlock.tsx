import { useMemo } from 'react';

interface WaveformBlockProps {
  /** MIDI events to render as colored blocks */
  events: { startBeat: number; durationBeats: number; label?: string }[];
  /** Color of the note blocks and background tint */
  color: string;
  /** Total beats across all bars */
  totalBeats: number;
  /** Playhead position 0–100% */
  playheadPct: number;
  /** Whether this block has data */
  hasData: boolean;
  /** Source — affects styling */
  source: 'user' | 'ai' | 'empty';
}

/**
 * GarageBand-style colored waveform block that visually fills a track lane.
 * - Blue for user recordings, green/yellow for AI-generated.
 * - Shows note blocks with a subtle beat grid.
 */
export default function WaveformBlock({
  events, color, totalBeats, playheadPct, hasData, source,
}: WaveformBlockProps) {
  const HEIGHT = 38;
  const NOTE_H = 18;
  const NOTE_Y = (HEIGHT - NOTE_H) / 2;

  // Generate a pseudo-waveform shape for user recordings (no note events)
  const fakeWaveform = useMemo(() => {
    if (source !== 'user' || !hasData) return null;
    const points: string[] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * totalBeats * 20;
      const amp = (Math.sin(i * 0.45) * 0.3 + Math.sin(i * 1.2) * 0.2 + Math.sin(i * 2.8) * 0.15 + 0.5);
      const y = HEIGHT / 2 - amp * (NOTE_H * 0.8);
      points.push(`${x},${y}`);
    }
    // Mirror for bottom half
    const bottomPoints: string[] = [];
    for (let i = steps; i >= 0; i--) {
      const x = (i / steps) * totalBeats * 20;
      const amp = (Math.sin(i * 0.45) * 0.3 + Math.sin(i * 1.2) * 0.2 + Math.sin(i * 2.8) * 0.15 + 0.5);
      const y = HEIGHT / 2 + amp * (NOTE_H * 0.8);
      bottomPoints.push(`${x},${y}`);
    }
    return [...points, ...bottomPoints].join(' ');
  }, [totalBeats, source, hasData]);

  if (!hasData) {
    return (
      <div className="waveform-block waveform-block-empty flex items-center justify-center">
        <span className="text-xs text-muted-foreground opacity-50">
          {source === 'user' ? 'Tap ● to record' : 'Waiting for AI'}
        </span>
      </div>
    );
  }

  const svgWidth = totalBeats * 20;

  return (
    <div className="waveform-block waveform-block-filled animate-cascade" style={{ background: `${color}22` }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${HEIGHT}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Subtle beat grid */}
        {Array.from({ length: totalBeats }, (_, i) => (
          <line
            key={`g-${i}`}
            x1={i * 20} y1={0} x2={i * 20} y2={HEIGHT}
            stroke={color}
            strokeWidth={i % 4 === 0 ? 0.8 : 0.3}
            opacity={0.15}
          />
        ))}

        {/* User waveform polygon */}
        {fakeWaveform && (
          <polygon points={fakeWaveform} fill={color} opacity={0.6} />
        )}

        {/* MIDI note blocks */}
        {source !== 'user' && events.map((ev, i) => {
          const x = ev.startBeat * 20;
          const w = Math.max(ev.durationBeats * 20 - 1.5, 3);
          return (
            <rect
              key={i}
              x={x} y={NOTE_Y}
              width={w} height={NOTE_H}
              fill={color}
              opacity={0.75}
              rx={3}
            />
          );
        })}

        {/* Playhead */}
        <line
          x1={(playheadPct / 100) * svgWidth}
          y1={0}
          x2={(playheadPct / 100) * svgWidth}
          y2={HEIGHT}
          stroke="#ffffff"
          strokeWidth={1.5}
          opacity={0.85}
        />
      </svg>
    </div>
  );
}
