interface MiniTimelineProps {
  /** Events as {startBeat (0-based from bar start), durationBeats} */
  events: { startBeat: number; durationBeats: number; label?: string }[];
  /** Color for the note blocks */
  color: string;
  /** Total beats across all bars */
  totalBeats: number;
  /** Playhead position 0-100% */
  playheadPct: number;
}

export default function MiniTimeline({ events, color, totalBeats, playheadPct }: MiniTimelineProps) {
  const HEIGHT = 28;
  const NOTE_HEIGHT = 14;
  const NOTE_Y = (HEIGHT - NOTE_HEIGHT) / 2;

  return (
    <svg
      viewBox={`0 0 ${totalBeats * 20} ${HEIGHT}`}
      className="w-full h-7 bg-black/50 border-2 border-border"
      preserveAspectRatio="none"
    >
      {/* Beat grid lines */}
      {Array.from({ length: totalBeats }, (_, i) => (
        <line
          key={`grid-${i}`}
          x1={i * 20}
          y1={0}
          x2={i * 20}
          y2={HEIGHT}
          stroke={i % 4 === 0 ? '#334155' : '#1e293b'}
          strokeWidth={i % 4 === 0 ? 1.5 : 0.5}
        />
      ))}

      {/* Note blocks */}
      {events.map((ev, i) => {
        const x = ev.startBeat * 20;
        const w = Math.max(ev.durationBeats * 20 - 2, 4);
        return (
          <g key={i}>
            <rect
              x={x}
              y={NOTE_Y}
              width={w}
              height={NOTE_HEIGHT}
              fill={color}
              opacity={0.8}
              rx={1}
            />
            {ev.label && (
              <text
                x={x + 2}
                y={NOTE_Y - 2}
                fontSize="7"
                fill={color}
                opacity={0.7}
              >
                {ev.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Playhead */}
      <line
        x1={(playheadPct / 100) * totalBeats * 20}
        y1={0}
        x2={(playheadPct / 100) * totalBeats * 20}
        y2={HEIGHT}
        stroke="#ffffff"
        strokeWidth={2}
        opacity={0.9}
      />
    </svg>
  );
}
