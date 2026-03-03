import { useState, useEffect, useRef } from 'react';

/**
 * Tracks Tone.Transport progress as a percentage (0–100).
 * Uses requestAnimationFrame for smooth updates.
 * Caches the Tone module reference to avoid dynamic import on every frame.
 */
export function usePlayhead(): number {
  const [pct, setPct] = useState(0);
  const transportRef = useRef<{ progress: number } | null>(null);

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
        setPct(typeof progress === 'number' && isFinite(progress) ? progress * 100 : 0);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return pct;
}
