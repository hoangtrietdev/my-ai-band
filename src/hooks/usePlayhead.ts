import { useState, useEffect, useRef } from 'react';

/**
 * Tracks Tone.Transport progress as a percentage (0–100).
 * Uses requestAnimationFrame for smooth updates.
 * Caches the Tone module reference to avoid dynamic import on every frame.
 */
export function usePlayhead(totalDurationSeconds = 0): { pct: number; seconds: number } {
  const [pct, setPct] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const transportRef = useRef<{ progress: number; seconds: number } | null>(null);

  useEffect(() => {
    let raf: number;
    let mounted = true;

    // Load Tone once and cache the transport reference
    import('tone').then(Tone => {
      if (mounted) transportRef.current = Tone.getTransport();
    }).catch(() => { /* Tone not loaded yet */ });

    const tick = () => {
      if (!mounted) return;
      const transport = transportRef.current;
      if (transport) {
        const progress = transport.progress;
        const currentSeconds = typeof transport.seconds === 'number' && isFinite(transport.seconds)
          ? transport.seconds
          : 0;
        setSeconds(currentSeconds);
        if (totalDurationSeconds > 0) {
          setPct(Math.min(100, Math.max(0, (currentSeconds / totalDurationSeconds) * 100)));
        } else {
          setPct(typeof progress === 'number' && isFinite(progress) ? progress * 100 : 0);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [totalDurationSeconds]);

  return { pct, seconds };
}
