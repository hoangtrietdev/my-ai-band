import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  /** ms per character */
  charDelay?: number;
  /** ms between log lines */
  lineDelay?: number;
  onComplete?: () => void;
}

export interface UseTypewriterReturn {
  displayedLines: string[];
  isTyping:       boolean;
  reset:          () => void;
}

export function useTypewriter(
  lines: string[],
  active: boolean,
  options: UseTypewriterOptions = {}
): UseTypewriterReturn {
  const { charDelay = 18, lineDelay = 60, onComplete } = options;

  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [isTyping, setIsTyping]             = useState(false);

  const lineIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDisplayedLines([]);
    lineIndexRef.current = 0;
    charIndexRef.current = 0;
    setIsTyping(false);
  };

  useEffect(() => {
    if (!active || lines.length === 0) return;

    lineIndexRef.current = 0;
    charIndexRef.current = 0;
    setDisplayedLines([]);
    setIsTyping(true);

    function typeChar() {
      const li = lineIndexRef.current;
      const ci = charIndexRef.current;

      if (li >= lines.length) {
        setIsTyping(false);
        onComplete?.();
        return;
      }

      const line = lines[li];

      if (ci <= line.length) {
        setDisplayedLines((prev) => {
          const updated = [...prev];
          updated[li]   = line.slice(0, ci);
          return updated;
        });
        charIndexRef.current += 1;
        timerRef.current = setTimeout(typeChar, charDelay);
      } else {
        // Move to next line
        lineIndexRef.current += 1;
        charIndexRef.current  = 0;
        timerRef.current = setTimeout(typeChar, lineDelay);
      }
    }

    timerRef.current = setTimeout(typeChar, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // charDelay, lineDelay, and onComplete are config — intentionally excluded
    // to avoid restarting the typewriter mid-animation when parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lines]);

  return { displayedLines, isTyping, reset };
}
