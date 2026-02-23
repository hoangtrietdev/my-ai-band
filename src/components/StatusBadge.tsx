export type AppStatus = 'idle' | 'recording' | 'processing' | 'ready' | 'playing' | 'error';

const STATUS_CONFIG: Record<AppStatus, { label: string; dotColor: string; pulse: boolean }> = {
  idle:       { label: 'IDLE',       dotColor: 'bg-gray-400',   pulse: false },
  recording:  { label: 'REC',        dotColor: 'bg-red-500',    pulse: true  },
  processing: { label: 'PROCESSING', dotColor: 'bg-yellow-400', pulse: true  },
  ready:      { label: 'READY',      dotColor: 'bg-green-400',  pulse: false },
  playing:    { label: 'PLAYING',    dotColor: 'bg-cyan-400',   pulse: true  },
  error:      { label: 'ERROR',      dotColor: 'bg-red-500',    pulse: false },
};

interface StatusBadgeProps {
  status: AppStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <span className="retro-badge inline-flex items-center gap-1.5">
      <span
        className={`w-2 h-2 ${cfg.dotColor} ${cfg.pulse ? 'animate-pulse' : ''}`}
        style={{ display: 'inline-block' }}
      />
      {cfg.label}
    </span>
  );
}
