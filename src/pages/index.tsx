import { useState, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MidiData } from '@/lib/schemas';
import { AppStatus } from '@/components/StatusBadge';

// Dynamically import heavy/browser-only components to avoid SSR issues
const StudioPanel       = dynamic(() => import('@/components/StudioPanel'),       { ssr: false });
const AgentTerminal     = dynamic(() => import('@/components/AgentTerminal'),     { ssr: false });
const TransportControls = dynamic(() => import('@/components/TransportControls'), { ssr: false });
const StatusBadge       = dynamic(() => import('@/components/StatusBadge'),       { ssr: false });

// ─── Generation Progress Bar ─────────────────────────────────────────────────
const GEN_STEPS = [
  { id: 1, label: 'Producer' },
  { id: 2, label: 'Bass Player' },
  { id: 3, label: 'Drummer' },
  { id: 4, label: 'Compile' },
];

function GenerationProgress({ step, label }: { step: number; label: string }) {
  const pct = Math.round((step / GEN_STEPS.length) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-[var(--primary)] font-bold tracking-widest animate-pulse">
          {label || 'INITIALIZING...'}
        </span>
        <span className="text-xs font-mono text-[var(--muted-foreground)]">{pct}%</span>
      </div>
      <div className="retro-progress-track">
        <div className="retro-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-3">
        {GEN_STEPS.map((s) => (
          <div key={s.id} className={`retro-step ${
            s.id < step  ? 'text-[var(--primary)]'  :
            s.id === step ? 'text-[var(--primary)] animate-pulse' :
            'text-[var(--muted-foreground)]'
          }`}>
            <div className={`retro-step-dot ${
              s.id < step   ? 'done'    :
              s.id === step ? 'active'  :
              'pending'
            }`} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  // ─── Session parameters ──────────────────────────────────────────────────
  const [bpm,        setBpm]        = useState(120);
  const [genre,      setGenre]      = useState('jazz');
  const [musicalKey, setMusicalKey] = useState('C major');

  // ─── App state ───────────────────────────────────────────────────────────
  const [appStatus,   setAppStatus]   = useState<AppStatus>('idle');
  const [midiData,    setMidiData]    = useState<MidiData | null>(null);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [useMock,     setUseMock]     = useState(false);

  // ─── SSE streaming state ─────────────────────────────────────────────────
  const [streamLogs,  setStreamLogs]  = useState<string[]>([]);
  const [genStep,     setGenStep]     = useState(0);
  const [genLabel,    setGenLabel]    = useState('');

  // ─── Playback state ──────────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [guitarVolume, setGuitarVolume] = useState(0);
  const [bassVolume,   setBassVolume]   = useState(0);
  const [drumsVolume,  setDrumsVolume]  = useState(0);

  // ─── Audio recording ──────────────────────────────────────────────────────
  const {
    state: recordingState,
    audioBlob,
    audioUrl,
    durationSeconds,
    startRecording,
    stopRecording,
    clearRecording,
    error:  recError,
    analyserNode,
  } = useAudioRecorder();

  // ─── Derived status ───────────────────────────────────────────────────────
  const derivedStatus: AppStatus =
    appStatus !== 'idle'           ? appStatus    :
    recordingState === 'recording' ? 'recording'  :
    'idle';

  // ─── Generate Band ────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!audioBlob && !useMock) {
      setApiError('Please record your guitar first, or enable Mock Mode.');
      return;
    }

    setApiError(null);
    setMidiData(null);
    setStreamLogs([]);
    setGenStep(0);
    setGenLabel('');
    setAppStatus('processing');

    try {
      let finalMidiData: MidiData;

      if (useMock) {
        const { MOCK_RESPONSE } = await import('@/lib/mockApiResponse');
        setGenStep(1); setGenLabel('Producer analyzing session...');
        setStreamLogs(prev => [...prev, `[System] BPM: ${bpm}  |  Genre: ${genre.toUpperCase()}  |  Key: ${musicalKey}`]);
        await new Promise((r) => setTimeout(r, 400));
        setGenStep(2); setGenLabel('Bass Player composing groove...');
        await new Promise((r) => setTimeout(r, 400));
        setGenStep(3); setGenLabel('Drummer building the beat...');
        await new Promise((r) => setTimeout(r, 400));
        setGenStep(4); setGenLabel('Compiling & validating...');
        await new Promise((r) => setTimeout(r, 200));
        finalMidiData = MOCK_RESPONSE.midi_data;
        setStreamLogs(MOCK_RESPONSE.logs);
      } else {
        const formData = new FormData();
        formData.append('audio',           audioBlob!,            'recording.webm');
        formData.append('bpm',             String(bpm));
        formData.append('genre',           genre);
        formData.append('key',             musicalKey);
        formData.append('durationSeconds', String(durationSeconds));

        const response = await fetch('/api/orchestrate-band', {
          method: 'POST',
          body:   formData,
        });

        if (!response.body) throw new Error('No response body from API');

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';
        let resultMidi: MidiData | null = null;
        const localLogs: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by \n\n
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'log') {
                localLogs.push(evt.line);
                setStreamLogs([...localLogs]);
              } else if (evt.type === 'progress') {
                setGenStep(evt.step);
                setGenLabel(evt.label);
              } else if (evt.type === 'result') {
                resultMidi = evt.midi_data;
              } else if (evt.type === 'error') {
                throw new Error(evt.error);
              }
            } catch (parseErr) {
              // skip malformed events
            }
          }
        }

        if (!resultMidi) throw new Error('No MIDI data received from API');
        finalMidiData = resultMidi;
      }

      setMidiData(finalMidiData);
      setAppStatus('ready');
      setGenStep(0); // hide progress bar

      const { scheduleBand, loadGuitarTrack } = await import('@/lib/toneEngine');
      await scheduleBand(finalMidiData);
      if (audioBlob) await loadGuitarTrack(audioBlob);

    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
      setAppStatus('error');
      setGenStep(0);
    }
  }, [audioBlob, bpm, genre, musicalKey, durationSeconds, useMock]);

  // ─── Transport handlers ───────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    const { startPlayback } = await import('@/lib/toneEngine');
    await startPlayback();
    setIsPlaying(true);
    setAppStatus('playing');
  }, []);

  const handlePause = useCallback(async () => {
    const { pausePlayback } = await import('@/lib/toneEngine');
    await pausePlayback();
    setIsPlaying(false);
    setAppStatus('ready');
  }, []);

  const handleStop = useCallback(async () => {
    const { stopPlayback } = await import('@/lib/toneEngine');
    await stopPlayback();
    setIsPlaying(false);
    setAppStatus(midiData ? 'ready' : 'idle');
  }, [midiData]);

  // ─── Volume ───────────────────────────────────────────────────────────────
  const handleVolume = useCallback(async (track: 'guitar' | 'bass' | 'drums', db: number) => {
    const { setVolume } = await import('@/lib/toneEngine');
    await setVolume(track, db);
    if (track === 'guitar') setGuitarVolume(db);
    if (track === 'bass')   setBassVolume(db);
    if (track === 'drums')  setDrumsVolume(db);
  }, []);

  const isReady      = appStatus === 'ready' || appStatus === 'playing';
  const isProcessing = appStatus === 'processing';
  const hasBand      = midiData !== null;

  return (
    <>
      <Head>
        <title>Virtual AI Band</title>
        <meta name="description" content="AI-powered virtual band — record guitar, get AI accompaniment" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="scanlines min-h-screen bg-black text-white flex flex-col">

        {/* ── Header ── */}
        <header className="border-b-2 border-[var(--border)] bg-black px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-head text-xl text-[var(--primary)] tracking-widest">
              ▶ VIRTUAL AI BAND
            </h1>
            <p className="text-xs text-blue-800 font-mono tracking-wider mt-0.5">
              {process.env.NEXT_PUBLIC_IS_GROQ === 'true'
                ? 'Powered by Groq · llama-3.3-70b-versatile'
                : 'Powered by DigitalOcean Gradient'} · Multi-Agent Jazz Ensemble
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* AI backend badge */}
            <span className="retro-badge text-xs font-mono">
              {process.env.NEXT_PUBLIC_IS_GROQ === 'true' ? '⚡ GROQ' : '☁ GRADIENT'}
            </span>

            {/* Mock toggle */}
            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none">
              <div
                onClick={() => setUseMock((p) => !p)}
                className={`relative w-9 h-5 cursor-pointer border-2 transition-colors ${
                  useMock
                    ? 'bg-yellow-900 border-[var(--primary)]'
                    : 'bg-gray-900 border-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3.5 h-3.5 transition-all ${
                    useMock ? 'left-4 bg-[var(--primary)]' : 'left-0.5 bg-gray-500'
                  }`}
                />
              </div>
              MOCK
            </label>

            <StatusBadge status={derivedStatus} />
          </div>
        </header>

        {/* ── Main layout ── */}
        <main className="flex-1 grid md:grid-cols-2 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Left — Studio Panel */}
          <section className="flex flex-col border-r-2 border-[var(--border)] overflow-y-auto p-4 gap-4">
            <span className="text-xs text-blue-700 tracking-widest font-mono">// STUDIO</span>

            <StudioPanel
              recordingState={recordingState}
              durationSeconds={durationSeconds}
              audioUrl={audioUrl}
              analyserNode={analyserNode}
              bpm={bpm}               setBpm={setBpm}
              genre={genre}           setGenre={setGenre}
              musicalKey={musicalKey} setMusicalKey={setMusicalKey}
              onStart={startRecording}
              onStop={stopRecording}
              onClear={() => {
                clearRecording();
                setAppStatus('idle');
                setMidiData(null);
                setStreamLogs([]);
                setApiError(null);
              }}
              disabled={isProcessing}
              error={recError}
            />

            {/* Generation progress bar */}
            {isProcessing && genStep > 0 && (
              <GenerationProgress step={genStep} label={genLabel} />
            )}

            {/* Generate Band button */}
            <button
              onClick={handleGenerate}
              disabled={isProcessing || recordingState === 'recording'}
              className="retro-btn retro-btn-primary w-full py-4 text-sm"
            >
              {isProcessing
                ? <span className="animate-pulse">⬡ GENERATING BAND...</span>
                : <span>⬡ GENERATE BAND</span>
              }
            </button>

            {useMock && (
              <p className="text-xs font-mono text-center border-2 border-yellow-600 text-yellow-500 py-1.5">
                ⚠ MOCK MODE — no audio required, no API calls
              </p>
            )}
          </section>

          {/* Right — Agent Terminal */}
          <section className="flex flex-col overflow-hidden p-4 gap-4" style={{ minHeight: '400px' }}>
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs text-blue-700 tracking-widest font-mono">// AGENT LOG</span>
              {hasBand && (
                <span className="text-xs text-blue-700 font-mono">
                  {midiData!.total_bars} bars · {midiData!.bpm} BPM
                </span>
              )}
            </div>

            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              <AgentTerminal
                logs={streamLogs}
                active={hasBand || isProcessing}
                isLoading={isProcessing && streamLogs.length === 0}
                error={apiError}
              />
            </div>
          </section>
        </main>

        {/* ── Transport Controls (footer) ── */}
        <footer className="shrink-0 border-t-2 border-[var(--border)] p-4">
          <TransportControls
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            isPlaying={isPlaying}
            isReady={isReady}
            guitarVolume={guitarVolume}
            bassVolume={bassVolume}
            drumsVolume={drumsVolume}
            onGuitarVol={(db) => handleVolume('guitar', db)}
            onBassVol={(db)   => handleVolume('bass',   db)}
            onDrumsVol={(db)  => handleVolume('drums',  db)}
          />
        </footer>
      </div>
    </>
  );
}
