import { useState, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MidiData, TrackName } from '@/lib/schemas';
import { AppStatus } from '@/components/StatusBadge';
import type { InputMode } from '@/components/InputForm';
import type { TrackState } from '@/components/ProductionBoard';

// Dynamically import heavy/browser-only components to avoid SSR issues
const InputForm         = dynamic(() => import('@/components/InputForm'),         { ssr: false });
const AgentTerminal     = dynamic(() => import('@/components/AgentTerminal'),     { ssr: false });
const ProductionBoard   = dynamic(() => import('@/components/ProductionBoard'),   { ssr: false });
const StatusBadge       = dynamic(() => import('@/components/StatusBadge'),       { ssr: false });

// ─── Generation Progress Bar ─────────────────────────────────────────────────

function GenerationProgress({ step, label, totalSteps }: { step: number; label: string; totalSteps: number }) {
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-primary font-bold tracking-widest animate-pulse">
          {label || 'INITIALIZING...'}
        </span>
        <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
      </div>
      <div className="retro-progress-track">
        <div className="retro-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Default track states ────────────────────────────────────────────────────

function defaultTrackStates(): Record<TrackName, TrackState> {
  return {
    guitar: { muted: false, solo: false, volume: 0 },
    bass:   { muted: false, solo: false, volume: 0 },
    drums:  { muted: false, solo: false, volume: 0 },
    melody: { muted: false, solo: false, volume: 0 },
    keys:   { muted: false, solo: false, volume: 0 },
    vocal:  { muted: false, solo: false, volume: 0 },
  };
}

export default function Home() {
  // ─── Session parameters ──────────────────────────────────────────────────
  const [bpm,        setBpm]        = useState(120);
  const [genre,      setGenre]      = useState('jazz');
  const [musicalKey, setMusicalKey] = useState('C major');
  const [bars,       setBars]       = useState(4);

  // ─── Input mode & content ────────────────────────────────────────────────
  const [inputMode,      setInputMode]      = useState<InputMode>('record');
  const [lyrics,         setLyrics]         = useState('');
  const [prompt,         setPrompt]         = useState('');
  const [uploadName,     setUploadName]     = useState<string | null>(null);
  const [uploadBlob,     setUploadBlob]     = useState<Blob | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<TrackName[]>(['bass', 'drums']);

  // ─── App state ───────────────────────────────────────────────────────────
  const [appStatus,   setAppStatus]   = useState<AppStatus>('idle');
  const [midiData,    setMidiData]    = useState<MidiData | null>(null);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [useMock,     setUseMock]     = useState(false);

  // ─── SSE streaming state ─────────────────────────────────────────────────
  const [streamLogs,  setStreamLogs]  = useState<string[]>([]);
  const [genStep,     setGenStep]     = useState(0);
  const [genLabel,    setGenLabel]    = useState('');
  const [genTotal,    setGenTotal]    = useState(4);

  // ─── Playback state ──────────────────────────────────────────────────────
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [trackStates, setTrackStates] = useState<Record<TrackName, TrackState>>(defaultTrackStates);

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

  // Effective audio — either recorded or uploaded
  const effectiveAudio = audioBlob || uploadBlob;

  // ─── Derived status ───────────────────────────────────────────────────────
  const derivedStatus: AppStatus =
    appStatus !== 'idle'           ? appStatus    :
    recordingState === 'recording' ? 'recording'  :
    'idle';

  // ─── Generate Band ────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!effectiveAudio && !lyrics && !prompt && !useMock) {
      setApiError('Please record audio, upload a file, enter lyrics, or type a prompt — or enable Mock Mode.');
      return;
    }

    setApiError(null);
    setMidiData(null);
    setStreamLogs([]);
    setGenStep(0);
    setGenLabel('');
    setAppStatus('processing');

    // Calculate total steps
    let steps = 3; // producer + bass&drums + compile
    if (selectedTracks.includes('melody')) steps++;
    if (selectedTracks.includes('keys'))   steps++;
    if (selectedTracks.includes('vocal'))  steps++;
    setGenTotal(steps);

    try {
      let finalMidiData: MidiData;

      if (useMock) {
        const { generateMockResponse } = await import('@/lib/mockApiResponse');
        const mockResult = generateMockResponse({ bpm, bars, musicalKey, genre, selectedTracks });
        setGenStep(1); setGenLabel('Producer analyzing session...');
        setStreamLogs(prev => [...prev, `[System] BPM: ${bpm}  |  Genre: ${genre.toUpperCase()}  |  Key: ${musicalKey}  |  Bars: ${bars}`]);
        await new Promise((r) => setTimeout(r, 400));
        setGenStep(2); setGenLabel('Bass Player composing groove...');
        await new Promise((r) => setTimeout(r, 400));
        setGenStep(3); setGenLabel('Drummer building the beat...');
        await new Promise((r) => setTimeout(r, 400));
        if (selectedTracks.includes('melody')) {
          setGenStep(4); setGenLabel('Melodist composing lead...');
          await new Promise((r) => setTimeout(r, 300));
        }
        if (selectedTracks.includes('keys')) {
          setGenStep(steps - 1); setGenLabel('Keys Player voicing chords...');
          await new Promise((r) => setTimeout(r, 300));
        }
        setGenStep(steps); setGenLabel('Compiling & validating...');
        await new Promise((r) => setTimeout(r, 200));
        finalMidiData = mockResult.midi_data;
        setStreamLogs(mockResult.logs);
      } else {
        const formData = new FormData();
        if (effectiveAudio) formData.append('audio', effectiveAudio, 'recording.webm');
        if (lyrics)         formData.append('lyrics', lyrics);
        if (prompt)         formData.append('prompt', prompt);
        formData.append('bpm',             String(bpm));
        formData.append('genre',           genre);
        formData.append('key',             musicalKey);
        formData.append('bars',            String(bars));
        formData.append('tracks',          selectedTracks.join(','));
        if (durationSeconds) formData.append('durationSeconds', String(durationSeconds));

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

          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            let evt: Record<string, unknown>;
            try {
              evt = JSON.parse(line.slice(6));
            } catch {
              continue; // skip malformed JSON
            }
            if (evt.type === 'log') {
              localLogs.push(evt.line as string);
              setStreamLogs([...localLogs]);
            } else if (evt.type === 'progress') {
              setGenStep(evt.step as number);
              setGenLabel(evt.label as string);
            } else if (evt.type === 'result') {
              resultMidi = evt.midi_data as MidiData;
            } else if (evt.type === 'error') {
              throw new Error(evt.error as string);
            }
          }
        }

        if (!resultMidi) {
          const debugLog = localLogs.length > 0 ? `\n\nRecent logs:\n${localLogs.slice(-8).join('\n')}` : '';
          throw new Error(
            'No MIDI data received from API.\n' +
            'This usually means the AI backend failed to generate valid output.\n' +
            'Check your API key, model name, and server logs for details.' +
            debugLog
          );
        }
        finalMidiData = resultMidi;
      }

      setMidiData(finalMidiData);
      setAppStatus('ready');
      setGenStep(0);

      const { scheduleBand, loadGuitarTrack } = await import('@/lib/toneEngine');
      await scheduleBand(finalMidiData);
      if (effectiveAudio) await loadGuitarTrack(effectiveAudio);

    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
      setAppStatus('error');
      setGenStep(0);
    }
  }, [effectiveAudio, bpm, genre, musicalKey, bars, durationSeconds, useMock, lyrics, prompt, selectedTracks]);

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

  // ─── Track control handlers ───────────────────────────────────────────────
  const handleVolume = useCallback(async (track: TrackName, db: number) => {
    const { setVolume } = await import('@/lib/toneEngine');
    await setVolume(track, db);
    setTrackStates(prev => ({ ...prev, [track]: { ...prev[track], volume: db } }));
  }, []);

  const handleMute = useCallback(async (track: TrackName) => {
    setTrackStates(prev => {
      const newMuted = !prev[track].muted;
      import('@/lib/toneEngine').then(({ setTrackMute }) => setTrackMute(track, newMuted));
      return { ...prev, [track]: { ...prev[track], muted: newMuted } };
    });
  }, []);

  const handleSolo = useCallback(async (track: TrackName) => {
    setTrackStates(prev => {
      const newSolo = !prev[track].solo;
      import('@/lib/toneEngine').then(({ setTrackSolo }) => setTrackSolo(track, newSolo));
      const next = { ...prev };
      if (newSolo) {
        for (const t of Object.keys(next) as TrackName[]) {
          next[t] = { ...next[t], solo: t === track, muted: t !== track };
        }
      } else {
        for (const t of Object.keys(next) as TrackName[]) {
          next[t] = { ...next[t], solo: false, muted: false };
        }
      }
      return next;
    });
  }, []);

  // ─── Upload handler ───────────────────────────────────────────────────────
  const handleUpload = useCallback((blob: Blob, name: string) => {
    setUploadBlob(blob);
    setUploadName(name);
  }, []);

  // ─── Export handler ───────────────────────────────────────────────────────
  const handleExportJson = useCallback(async () => {
    if (!midiData) return;
    const { downloadMidiJson } = await import('@/lib/exportHelpers');
    downloadMidiJson(midiData);
  }, [midiData]);

  const isReady      = appStatus === 'ready' || appStatus === 'playing';
  const isProcessing = appStatus === 'processing';
  const hasBand      = midiData !== null;

  return (
    <>
      <Head>
        <title>Virtual AI Band</title>
        <meta name="description" content="AI-powered virtual band — multi-modal music production with AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="scanlines min-h-screen md:h-screen bg-black text-white flex flex-col md:overflow-hidden">

        {/* ── Header ── */}
        <header className="border-b-2 border-border bg-black px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-head text-xl text-primary tracking-widest">
              ▶ VIRTUAL AI BAND
            </h1>
            <p className="text-xs text-blue-800 font-mono tracking-wider mt-0.5">
              {process.env.NEXT_PUBLIC_IS_GROQ === 'true'
                ? 'Powered by Groq · llama-3.3-70b-versatile'
                : 'Powered by DigitalOcean Gradient'} · Multi-Agent Production Board
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="retro-badge text-xs font-mono">
              {process.env.NEXT_PUBLIC_IS_GROQ === 'true' ? '⚡ GROQ' : '☁ GRADIENT'}
            </span>

            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none">
              <div
                onClick={() => setUseMock((p) => !p)}
                className={`relative w-9 h-5 cursor-pointer border-2 transition-colors ${
                  useMock
                    ? 'bg-yellow-900 border-primary'
                    : 'bg-gray-900 border-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3.5 h-3.5 transition-all ${
                    useMock ? 'left-4 bg-primary' : 'left-0.5 bg-gray-500'
                  }`}
                />
              </div>
              MOCK
            </label>

            <StatusBadge status={derivedStatus} />
          </div>
        </header>

        {/* ── Main layout ── */}
        <main className="flex-1 grid md:grid-cols-2 min-h-0 overflow-y-auto md:overflow-hidden">

          {/* Left — Input Form */}
          <section className="flex flex-col border-r-2 border-border overflow-y-auto p-4 gap-4">
            <span className="text-xs text-blue-700 tracking-widest font-mono">// STUDIO INPUT</span>

            <InputForm
              recordingState={recordingState}
              durationSeconds={durationSeconds}
              audioUrl={audioUrl}
              analyserNode={analyserNode}
              bpm={bpm}               setBpm={setBpm}
              genre={genre}           setGenre={setGenre}
              musicalKey={musicalKey} setMusicalKey={setMusicalKey}
              bars={bars}             setBars={setBars}
              lyrics={lyrics}         setLyrics={setLyrics}
              prompt={prompt}         setPrompt={setPrompt}
              inputMode={inputMode}   setInputMode={setInputMode}
              selectedTracks={selectedTracks} setSelectedTracks={setSelectedTracks}
              uploadName={uploadName}
              onUpload={handleUpload}
              onStartRec={startRecording}
              onStopRec={stopRecording}
              onClearRec={() => {
                clearRecording();
                setUploadBlob(null);
                setUploadName(null);
                setAppStatus('idle');
                setMidiData(null);
                setStreamLogs([]);
                setApiError(null);
              }}
              recError={recError}
              onGenerate={handleGenerate}
              isProcessing={isProcessing}
              disabled={isProcessing}
            />

            {/* Generation progress bar */}
            {isProcessing && genStep > 0 && (
              <GenerationProgress step={genStep} label={genLabel} totalSteps={genTotal} />
            )}

            {useMock && (
              <p className="text-xs font-mono text-center border-2 border-yellow-600 text-yellow-500 py-1.5">
                ⚠ MOCK MODE — no audio required, no API calls
              </p>
            )}
          </section>

          {/* Right — Agent Terminal */}
          <section className="flex flex-col p-4 gap-4 h-[500px] md:h-auto overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs text-blue-700 tracking-widest font-mono">// AGENT LOG</span>
              {midiData && (
                <span className="text-xs text-blue-700 font-mono">
                  {midiData.total_bars} bars · {midiData.bpm} BPM
                </span>
              )}
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <AgentTerminal
                logs={streamLogs}
                active={hasBand || isProcessing}
                isLoading={isProcessing && streamLogs.length === 0}
                error={apiError}
              />
            </div>
          </section>
        </main>

        {/* ── Production Board (mixer + transport) ── */}
        <footer className="shrink-0 border-t-2 border-border">
          <ProductionBoard
            midiData={midiData}
            hasAudio={!!effectiveAudio}
            trackStates={trackStates}
            isPlaying={isPlaying}
            isReady={isReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onMute={handleMute}
            onSolo={handleSolo}
            onVolume={handleVolume}
            onExportJson={handleExportJson}
          />
        </footer>
      </div>
    </>
  );
}
