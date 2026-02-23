import { useEffect, useRef } from 'react';
import { useTypewriter } from '@/hooks/useTypewriter';

interface AgentTerminalProps {
  logs:      string[];
  active:    boolean;
  isLoading: boolean;
  error?:    string | null;
}

/** Color-code log lines by agent prefix */
function colorize(line: string): React.ReactNode {
  if (line.startsWith('[Producer →') || line.startsWith('[Bass →') || line.startsWith('[Drums →')) {
    // Inter-agent messages — dim
    const match = line.match(/^(\[[^\]]+\])(.*)/);
    if (match) {
      return (
        <>
          <span className="text-gray-400">{match[1]}</span>
          <span className="text-gray-300">{match[2]}</span>
        </>
      );
    }
  }
  if (line.startsWith('[Producer]')) {
    const rest = line.slice(10);
    return <><span className="text-amber-400 font-bold">[Producer]</span><span className="text-amber-200">{rest}</span></>;
  }
  if (line.startsWith('[Bass]')) {
    const rest = line.slice(6);
    return <><span className="text-blue-400 font-bold">[Bass]</span><span className="text-blue-200">{rest}</span></>;
  }
  if (line.startsWith('[Drums]')) {
    const rest = line.slice(7);
    return <><span className="text-fuchsia-400 font-bold">[Drums]</span><span className="text-fuchsia-200">{rest}</span></>;
  }
  if (line.startsWith('[System]')) {
    const rest = line.slice(8);
    return <><span className="text-blue-500 font-bold">[System]</span><span className="text-blue-300">{rest}</span></>;
  }
  if (line.startsWith('[Producer →')) {
    return <span className="text-yellow-300">{line}</span>;
  }
  return <span className="text-blue-300">{line}</span>;
}

export default function AgentTerminal({ logs, active, isLoading, error }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { displayedLines, isTyping } = useTypewriter(logs, active, {
    charDelay: 16,
    lineDelay: 50,
  });

  // Auto-scroll to bottom whenever new content appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLines]);

  return (
    <div className="retro-panel flex flex-col h-full overflow-hidden">
      {/* Terminal header bar */}
      <div className="retro-panel-header flex items-center gap-2 shrink-0">
        <span className="w-3 h-3 bg-red-500 opacity-80" />
        <span className="w-3 h-3 bg-yellow-400 opacity-80" />
        <span className="w-3 h-3 bg-green-500 opacity-80" />
        <span className="ml-3 text-xs text-blue-600 font-mono tracking-widest uppercase">
          agent.log — virtual-ai-band
        </span>
      </div>

      {/* Log output area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
        {/* Prompt line at top */}
        <p className="text-blue-600 mb-3 text-xs select-none">
          $ ./orchestrate-band start-session --input guitar.wav
        </p>

        {/* Loading / thinking animation */}
        {isLoading && displayedLines.length === 0 && (
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="animate-pulse">Connecting to agent network...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-red-400 text-xs mb-2 p-2 border-2 border-red-500 bg-red-950/30">
            <span className="font-bold">[ERROR]</span> {error}
          </div>
        )}

        {/* Rendered log lines */}
        {displayedLines.map((line, i) => (
          <div key={i} className="mb-0.5 text-xs">
            <span className="text-blue-700 mr-2 select-none">{'>'}</span>
            {colorize(line)}
            {/* Show cursor only on the last actively-typing line */}
            {isTyping && i === displayedLines.length - 1 && (
              <span className="cursor-blink text-blue-400 ml-0.5">█</span>
            )}
          </div>
        ))}

        {/* Final cursor when done */}
        {!isTyping && displayedLines.length > 0 && !error && (
          <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
            <span>$</span>
            <span className="cursor-blink">█</span>
          </div>
        )}

        {/* Idle placeholder */}
        {!isLoading && displayedLines.length === 0 && !error && (
          <div className="text-blue-900 text-xs">
            <p>Waiting for session to start...</p>
            <p className="mt-1 opacity-60">Record your guitar, then hit &quot;Generate Band&quot;.</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
