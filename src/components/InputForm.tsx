import { useRef, useEffect, useCallback, useState, ChangeEvent } from 'react';
import { RecordingState } from '@/hooks/useAudioRecorder';
import { TrackName, TRACK_NAMES } from '@/lib/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputMode = 'record' | 'upload' | 'lyrics' | 'prompt';

interface InputFormProps {
  // Recording
  recordingState:  RecordingState;
  durationSeconds: number;
  audioUrl:        string | null;
  analyserNode:    AnalyserNode | null;
  onStartRec:      () => void;
  onStopRec:       () => void;
  onClearRec:      () => void;
  recError:        string | null;
  // Upload
  onUpload:        (blob: Blob, name: string) => void;
  uploadName:      string | null;
  // Lyrics / Prompt
  lyrics:          string;
  setLyrics:       (v: string) => void;
  prompt:          string;
  setPrompt:       (v: string) => void;
  // Session params
  bpm:             number;
  setBpm:          (v: number) => void;
  genre:           string;
  setGenre:        (v: string) => void;
  musicalKey:      string;
  setMusicalKey:   (v: string) => void;
  bars:            number;
  setBars:         (v: number) => void;
  // Track selection
  selectedTracks:  TrackName[];
  setSelectedTracks: (t: TrackName[]) => void;
  // Input mode
  inputMode:       InputMode;
  setInputMode:    (m: InputMode) => void;
  // Generate
  onGenerate:      () => void;
  isProcessing:    boolean;
  disabled:        boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = ['jazz', 'pop', 'blues', 'funk', 'bossa nova', 'lo-fi', 'rock'];
const KEYS = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'F major', 'Bb major',
  'A minor', 'E minor', 'D minor', 'G minor', 'C minor',
];

const TABS: { mode: InputMode; icon: string; label: string }[] = [
  { mode: 'record', icon: '🎤', label: 'Record'  },
  { mode: 'upload', icon: '📁', label: 'Upload'  },
  { mode: 'lyrics', icon: '📝', label: 'Lyrics'  },
  { mode: 'prompt', icon: '💬', label: 'Prompt'  },
];

const TRACK_META: Record<TrackName, { icon: string; label: string }> = {
  guitar: { icon: '🎸', label: 'Guitar' },
  bass:   { icon: '🎸', label: 'Bass'   },
  drums:  { icon: '🥁', label: 'Drums'  },
  melody: { icon: '🎹', label: 'Melody' },
  keys:   { icon: '🎹', label: 'Keys'   },
  vocal:  { icon: '🎤', label: 'Vocal'  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InputForm({
  recordingState, durationSeconds, audioUrl, analyserNode,
  onStartRec, onStopRec, onClearRec, recError,
  onUpload, uploadName,
  lyrics, setLyrics, prompt, setPrompt,
  bpm, setBpm, genre, setGenre, musicalKey, setMusicalKey,
  bars, setBars,
  selectedTracks, setSelectedTracks,
  inputMode, setInputMode,
  onGenerate, isProcessing, disabled,
}: InputFormProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);

  // ── Waveform drawing ──────────────────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#60a5fa';
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur  = 6;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    rafRef.current = requestAnimationFrame(drawWaveform);
  }, [analyserNode]);

  useEffect(() => {
    if (recordingState === 'recording' && analyserNode) {
      drawWaveform();
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10 MB)');
      return;
    }
    onUpload(file, file.name);
  };

  // ── Track toggle ──────────────────────────────────────────────────────────
  const toggleTrack = (t: TrackName) => {
    if (t === 'guitar') return; // guitar always depends on audio
    if (selectedTracks.includes(t)) {
      setSelectedTracks(selectedTracks.filter(x => x !== t));
    } else {
      setSelectedTracks([...selectedTracks, t]);
    }
  };

  // Selectable tracks (exclude guitar – guitar is auto-included when audio exists)
  const selectableTracks: TrackName[] = TRACK_NAMES.filter(t => t !== 'guitar');

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Tab bar ── */}
      <div className="flex gap-0 border-2 border-border">
        {TABS.map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            className={`flex-1 py-2 px-1 text-xs font-mono font-bold tracking-wider transition-colors
              ${inputMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-primary'
              }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="retro-panel overflow-hidden min-h-[160px]">
        <div className="retro-panel-header">
          <span className="text-xs text-blue-500 font-mono tracking-widest">
            {inputMode === 'record' ? 'MICROPHONE' :
             inputMode === 'upload' ? 'FILE UPLOAD' :
             inputMode === 'lyrics' ? 'LYRICS' : 'TEXT PROMPT'}
          </span>
        </div>

        <div className="p-3">
          {/* ── Record tab ── */}
          {inputMode === 'record' && (
            <div className="flex flex-col gap-3">
              <canvas ref={canvasRef} width={600} height={60} className="w-full h-16 bg-black" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  {recordingState === 'recording'
                    ? <span className="text-red-400 animate-pulse">● REC {formatDuration(durationSeconds)}</span>
                    : recordingState === 'stopped'
                    ? <span className="text-blue-400">■ {formatDuration(durationSeconds)}</span>
                    : <span>○ READY</span>}
                </span>
                <div className="flex gap-2">
                  {recordingState === 'idle' && (
                    <button onClick={onStartRec} disabled={disabled} className="retro-btn retro-btn-danger text-xs py-1 px-3">● REC</button>
                  )}
                  {recordingState === 'recording' && (
                    <button onClick={onStopRec} className="retro-btn retro-btn-danger text-xs py-1 px-3 animate-pulse">■ STOP</button>
                  )}
                  {recordingState === 'stopped' && (
                    <>
                      <button onClick={onClearRec} disabled={disabled} className="retro-btn retro-btn-ghost text-xs py-1 px-3">✕ CLEAR</button>
                      {audioUrl && (
                        <a href={audioUrl} download="recording.webm" className="retro-btn retro-btn-ghost text-xs py-1 px-3 text-center">↓ SAVE</a>
                      )}
                    </>
                  )}
                </div>
              </div>
              {audioUrl && (
                <audio src={audioUrl} controls className="w-full h-8 opacity-80" />
              )}
              {recError && (
                <div className="text-red-400 text-xs p-2 border-2 border-red-500 bg-red-950/20 font-mono">{recError}</div>
              )}
            </div>
          )}

          {/* ── Upload tab ── */}
          {inputMode === 'upload' && (
            <div className="flex flex-col gap-3">
              <label className="retro-btn retro-btn-ghost w-full py-4 text-center cursor-pointer text-xs">
                📁 CHOOSE AUDIO FILE
                <input type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
              </label>
              {uploadName && (
                <div className="text-xs font-mono text-primary p-2 border-2 border-border">
                  ✓ {uploadName}
                </div>
              )}
              <p className="text-xs text-muted-foreground font-mono">
                Accepts WAV, MP3, OGG, WebM. Max 10 MB.
              </p>
            </div>
          )}

          {/* ── Lyrics tab ── */}
          {inputMode === 'lyrics' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Paste your lyrics here...&#10;&#10;verse 1:&#10;walking down the street&#10;feeling the summer heat..."
                maxLength={2000}
                rows={6}
                className="retro-input resize-none text-xs leading-relaxed"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>Lyrics will shape melody and vocal tracks</span>
                <span>{lyrics.length}/2000</span>
              </div>
            </div>
          )}

          {/* ── Prompt tab ── */}
          {inputMode === 'prompt' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the music you want...&#10;&#10;e.g. 'chill lo-fi beat with jazzy piano chords and a walking bass line'"
                maxLength={1000}
                rows={4}
                className="retro-input resize-none text-xs leading-relaxed"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>AI will interpret your description</span>
                <span>{prompt.length}/1000</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Session Parameters ── */}
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
            <input type="range" min={40} max={240} step={1} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-gray-600 font-mono mt-0.5">
              <span>40</span><span>240</span>
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-xs text-blue-600 font-mono tracking-widest mb-1.5">GENRE</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button key={g} onClick={() => setGenre(g)}
                  className={`retro-btn text-xs py-1 px-2.5 ${genre === g ? 'retro-btn-primary' : 'retro-btn-ghost'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Key */}
          <div>
            <label className="block text-xs text-blue-600 font-mono tracking-widest mb-1.5">KEY</label>
            <select value={musicalKey} onChange={(e) => setMusicalKey(e.target.value)} className="retro-input w-full">
              {KEYS.map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>

          {/* Bars */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs text-blue-600 font-mono tracking-widest">BARS</label>
              <span className="text-xs text-blue-400 font-mono font-bold">{bars}</span>
            </div>
            <input type="range" min={2} max={16} step={1} value={bars} onChange={(e) => setBars(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-gray-600 font-mono mt-0.5">
              <span>2</span><span>16</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Track Selection ── */}
      <div className="retro-panel overflow-hidden">
        <div className="retro-panel-header">
          <span className="text-xs font-mono tracking-widest">TRACKS</span>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {selectableTracks.map((t) => {
            const meta = TRACK_META[t];
            const active = selectedTracks.includes(t);
            const isVocal = t === 'vocal';
            const vocalDisabled = isVocal && !lyrics;
            return (
              <button
                key={t}
                onClick={() => !vocalDisabled && toggleTrack(t)}
                disabled={vocalDisabled}
                className={`retro-btn text-xs py-1 px-2.5 ${
                  active ? 'retro-btn-primary' : 'retro-btn-ghost'
                } ${vocalDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={vocalDisabled ? 'Add lyrics to enable vocal track' : ''}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Generate Button ── */}
      <button
        onClick={onGenerate}
        disabled={isProcessing || recordingState === 'recording'}
        className="retro-btn retro-btn-primary w-full py-4 text-sm"
      >
        {isProcessing
          ? <span className="animate-pulse">⬡ GENERATING BAND...</span>
          : <span>⬡ GENERATE BAND</span>
        }
      </button>
    </div>
  );
}
