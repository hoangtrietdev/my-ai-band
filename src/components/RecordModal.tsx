import { useRef, useEffect, useCallback } from 'react';

interface RecordModalProps {
  trackName:       string;
  trackColor:      string;
  /** from useAudioRecorder */
  recordingState:  'idle' | 'recording' | 'stopped';
  durationSeconds: number;
  audioUrl:        string | null;
  analyserNode:    AnalyserNode | null;
  onStartRec:      () => void;
  onStopRec:       () => void;
  onClearRec:      () => void;
  onAccept:        () => void;
  onCancel:        () => void;
  recError:        string | null;
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function RecordModal({
  trackName, trackColor,
  recordingState, durationSeconds, audioUrl, analyserNode,
  onStartRec, onStopRec, onClearRec, onAccept, onCancel,
  recError,
}: RecordModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);

  // ── Waveform visualizer ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !analyserNode) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const buf = analyserNode.frequencyBinCount;
    const data = new Uint8Array(buf);
    analyserNode.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = trackColor;
    ctx.shadowColor = trackColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const slice = c.width / buf;
    let x = 0;
    for (let i = 0; i < buf; i++) {
      const v = data[i] / 128.0;
      const y = (v * c.height) / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.lineTo(c.width, c.height / 2);
    ctx.stroke();
    rafRef.current = requestAnimationFrame(draw);
  }, [analyserNode, trackColor]);

  useEffect(() => {
    if (recordingState === 'recording' && analyserNode) {
      draw();
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.fillStyle = '#1c1c1e';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.strokeStyle = recordingState === 'stopped' ? trackColor : '#48484a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, c.height / 2);
          ctx.lineTo(c.width, c.height / 2);
          ctx.stroke();
        }
      }
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [recordingState, analyserNode, draw, trackColor]);

  return (
    <div className="record-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="record-modal">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full" style={{ background: trackColor }} />
          <h2 className="text-lg font-bold">Record — {trackName}</h2>
        </div>

        {/* Waveform visualizer */}
        <canvas
          ref={canvasRef}
          width={400}
          height={80}
          className="w-full h-20 rounded-lg mb-4"
        />

        {/* Duration */}
        <div className="text-center mb-5">
          {recordingState === 'recording' ? (
            <span className="text-2xl font-mono font-bold text-red-400 animate-pulse">
              ● {fmt(durationSeconds)}
            </span>
          ) : recordingState === 'stopped' ? (
            <span className="text-2xl font-mono font-bold" style={{ color: trackColor }}>
              ■ {fmt(durationSeconds)}
            </span>
          ) : (
            <span className="text-2xl font-mono text-muted-foreground">
              ○ Ready
            </span>
          )}
        </div>

        {/* Playback preview */}
        {audioUrl && recordingState === 'stopped' && (
          <audio src={audioUrl} controls className="w-full h-8 mb-4 opacity-80" />
        )}

        {/* Error */}
        {recError && (
          <div className="text-red-400 text-sm p-3 rounded-lg bg-red-950/30 border border-red-500/40 mb-4">
            {recError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          {recordingState === 'idle' && (
            <>
              <button onClick={onCancel} className="daw-btn daw-btn-ghost text-sm">Cancel</button>
              <button onClick={onStartRec} className="daw-btn daw-btn-danger text-sm">● Record</button>
            </>
          )}
          {recordingState === 'recording' && (
            <button onClick={onStopRec} className="daw-btn daw-btn-danger text-sm animate-pulse">
              ■ Stop
            </button>
          )}
          {recordingState === 'stopped' && (
            <>
              <button onClick={onClearRec} className="daw-btn daw-btn-ghost text-sm">Re-record</button>
              <button onClick={onCancel} className="daw-btn daw-btn-ghost text-sm">Cancel</button>
              <button onClick={onAccept} className="daw-btn daw-btn-primary text-sm">✓ Use Take</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
