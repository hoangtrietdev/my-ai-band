import { useState, useEffect } from 'react';

/**
 * Tracks Tone.Transport progress as a percentage (0–100).
 * Uses requestAnimationFrame for smooth updates.
 */
export function usePlayhead(): number {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf: number;
    let mounted = true;

    const tick = async () => {
      if (!mounted) return;
      try {
        const Tone = await import('tone');
        const transport = Tone.getTransport();
        const progress = transport.progress;
        setPct(typeof progress === 'number' && isFinite(progress) ? progress * 100 : 0);
      } catch {
        // Tone not loaded yet
      }
      if (mounted) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return pct;
}
