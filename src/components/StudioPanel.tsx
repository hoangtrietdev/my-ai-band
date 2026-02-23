import { useRef, useEffect, useCallback } from 'react';
import { RecordingState } from '@/hooks/useAudioRecorder';

interface StudioPanelProps {
  recordingState:  RecordingState;
  durationSeconds: number;
  audioUrl:        string | null;
  analyserNode:    AnalyserNode | null;
  bpm:             number;
  setBpm:          (v: number) => void;
  genre:           string;
  setGenre:        (v: string) => void;
  musicalKey:      string;
  setMusicalKey:   (v: string) => void;
  onStart:         () => void;
  onStop:          () => void;
  onClear:         () => void;
  disabled:        boolean;
  error:           string | null;
}

const GENRES = ['jazz', 'pop', 'blues', 'funk', 'bossa nova'];
const KEYS   = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'F major', 'Bb major',
  'A minor', 'E minor', 'D minor', 'G minor', 'C minor',
];

function formatDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function StudioPanel({
  recordingState, durationSeconds, audioUrl, analyserNode,
  bpm, setBpm, genre, setGenre, musicalKey, setMusicalKey,
  onStart, onStop, onClear, disabled, error,
}: StudioPanelProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx    = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray    = new Uint8Array(bufferLength);
    analyserNode.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#60a5fa';
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur  = 6;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    rafRef.current = requestAnimationFrame(drawWaveform);
  }, [analyserNode]);

  // Start/stop waveform animation based on recording state
  useEffect(() => {
    if (recordingState === 'recording' && analyserNode) {
      drawWaveform();
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Draw flat line when idle
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = recordingState === 'stopped' ? '#1e40af' : '#1e293b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, canvas.height / 2);
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      }
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [recordingState, analyserNode, drawWaveform]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Waveform canvas */}
      <div className="retro-panel overflow-hidden">
        <div className="retro-panel-header flex items-center justify-between">
          <span className="text-xs text-blue-500 font-mono tracking-widest">WAVEFORM</span>
          <span className="text-xs font-mono text-blue-400">
            {recordingState === 'recording'
              ? <span className="text-red-400 animate-pulse">● {formatDuration(durationSeconds)}</span>
              : recordingState === 'stopped'
              ? <span className="text-blue-400">■ {formatDuration(durationSeconds)}</span>
              : <span className="text-gray-600">○ 00:00</span>}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-20 bg-black"
        />
      </div>

      {/* Record controls */}
      <div className="flex gap-3">
        {recordingState === 'idle' && (
          <button
            onClick={onStart}
            disabled={disabled}
            className="retro-btn retro-btn-danger flex-1"
          >
            ● REC
          </button>
        )}
        {recordingState === 'recording' && (
          <button
            onClick={onStop}
            className="retro-btn retro-btn-danger flex-1 animate-pulse"
          >
            ■ STOP
          </button>
        )}
        {recordingState === 'stopped' && (
          <>
            <button
              onClick={onClear}
              disabled={disabled}
              className="retro-btn retro-btn-ghost"
            >
              ✕ CLEAR
            </button>
            <a
              href={audioUrl ?? '#'}
              download="guitar-recording.webm"
              className="retro-btn retro-btn-ghost text-center"
            >
              ↓ SAVE
            </a>
          </>
        )}
      </div>

      {/* Playback of raw recording */}
      {audioUrl && (
        <div className="retro-panel overflow-hidden">
          <div className="retro-panel-header">
            <span className="text-xs font-mono tracking-widest">GUITAR MONITOR</span>
          </div>
          <div className="p-3">
            <audio
              src={audioUrl}
              controls
              className="w-full h-8 opacity-80"
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-red-400 text-xs p-3 border-2 border-red-500 bg-red-950/20 font-mono">
          {error}
        </div>
      )}

      {/* Session Parameters */}
      <div className="retro-panel overflow-hidden">
        <div className="retro-panel-header">
          <span className="text-xs font-mono tracking-widest">SESSION PARAMETERS</span>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {/* BPM */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs text-blue-600 font-mono tracking-widest">BPM</label>
              <span className="text-xs text-blue-400 font-mono font-bold">{bpm}</span>
            </div>
            <input
              type="range"
              min={60}
              max={200}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-600 font-mono mt-0.5">
              <span>60</span><span>200</span>
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-xs text-blue-600 font-mono tracking-widest mb-1.5">
              GENRE
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={`retro-btn text-xs py-1 px-2.5 ${
                    genre === g ? 'retro-btn-primary' : 'retro-btn-ghost'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Key */}
          <div>
            <label className="block text-xs text-blue-600 font-mono tracking-widest mb-1.5">
              KEY
            </label>
            <select
              value={musicalKey}
              onChange={(e) => setMusicalKey(e.target.value)}
              className="retro-input w-full"
            >
              {KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
