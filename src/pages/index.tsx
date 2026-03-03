import { useState, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MidiData, TrackName } from '@/lib/schemas';
import { AppStatus } from '@/components/StatusBadge';
import type { TrackState, TrackSource } from '@/components/ProductionBoard';

// Dynamically import heavy/browser-only components to avoid SSR issues
const AgentTerminal     = dynamic(() => import('@/components/AgentTerminal'),     { ssr: false });
const ProductionBoard   = dynamic(() => import('@/components/ProductionBoard'),   { ssr: false });
const StatusBadge       = dynamic(() => import('@/components/StatusBadge'),       { ssr: false });
const RecordModal       = dynamic(() => import('@/components/RecordModal'),       { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = ['jazz', 'pop', 'blues', 'funk', 'bossa nova', 'lo-fi', 'rock'];
const KEYS = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'F major', 'Bb major',
  'A minor', 'E minor', 'D minor', 'G minor', 'C minor',
];

// ─── Generation Progress Bar ─────────────────────────────────────────────────

function GenerationProgress({ step, label, totalSteps }: { step: number; label: string; totalSteps: number }) {
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary animate-pulse">
          {label || 'Initializing...'}
        </span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="daw-progress-track">
        <div className="daw-progress-fill" style={{ width: `${pct}%` }} />
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

function defaultTrackSources(): Record<TrackName, TrackSource> {
  return {
    guitar: 'empty',
    bass:   'empty',
    drums:  'empty',
    melody: 'empty',
    keys:   'empty',
    vocal:  'empty',
  };
}

export default function Home() {
  // ─── Session parameters ──────────────────────────────────────────────────
  const [bpm,        setBpm]        = useState(120);
  const [genre,      setGenre]      = useState('jazz');
  const [musicalKey, setMusicalKey] = useState('C major');
  const [bars,       setBars]       = useState(4);

  // ─── Band Prompt (text description) ──────────────────────────────────────
  const [prompt,         setPrompt]         = useState('');
  const [uploadBlob,     setUploadBlob]     = useState<Blob | null>(null);

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

  // ─── Track sources (GarageBand: empty / ai / user) ────────────────────────
  const [trackSources, setTrackSources] = useState<Record<TrackName, TrackSource>>(defaultTrackSources);

  // ─── Recording (arm-to-record workflow) ───────────────────────────────────
  const [armedTrack,    setArmedTrack]    = useState<TrackName | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [logExpanded,   setLogExpanded]   = useState(false);

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
  const selectedTracks: TrackName[] = ['bass', 'drums', 'melody', 'keys', 'vocal'];

  // ─── Derived status ───────────────────────────────────────────────────────
  const derivedStatus: AppStatus =
    appStatus !== 'idle'           ? appStatus    :
    recordingState === 'recording' ? 'recording'  :
    'idle';

  // ─── Generate Band ────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!effectiveAudio && !prompt && !useMock) {
      setApiError('Please record audio, or type a prompt — or enable Mock Mode.');
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

      // Update track sources — mark AI-generated tracks
      setTrackSources(prev => {
        const next = { ...prev };
        if (finalMidiData.melody?.length)  next.melody = 'ai';
        if (finalMidiData.keys?.length)    next.keys   = 'ai';
        if (finalMidiData.bass?.length)    next.bass   = 'ai';
        if (finalMidiData.drums?.length)   next.drums  = 'ai';
        if (finalMidiData.vocal?.length)   next.vocal  = 'ai';
        if (effectiveAudio)                next.guitar = 'user';
        return next;
      });

      const { scheduleBand, loadGuitarTrack } = await import('@/lib/toneEngine');
      await scheduleBand(finalMidiData);
      if (effectiveAudio) await loadGuitarTrack(effectiveAudio);

    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
      setAppStatus('error');
      setGenStep(0);
    }
  }, [effectiveAudio, bpm, genre, musicalKey, bars, durationSeconds, useMock, prompt, selectedTracks]);

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
  const handleUpload = useCallback((blob: Blob) => {
    setUploadBlob(blob);
  }, []);

  // ─── Arm-to-record handler ────────────────────────────────────────────────
  const handleArmTrack = useCallback((track: TrackName) => {
    if (armedTrack === track) {
      // Disarm
      setArmedTrack(null);
    } else {
      setArmedTrack(track);
      setShowRecordModal(true);
    }
  }, [armedTrack]);

  // When recording is accepted via the modal
  const handleAcceptRecording = useCallback(() => {
    if (armedTrack && audioBlob) {
      setTrackSources(prev => ({ ...prev, [armedTrack]: 'user' as TrackSource }));
    }
    setShowRecordModal(false);
    setArmedTrack(null);
  }, [armedTrack, audioBlob]);

  // ─── Export handler ───────────────────────────────────────────────────────
  const handleExportJson = useCallback(async () => {
    if (!midiData) return;
    const { downloadMidiJson } = await import('@/lib/exportHelpers');
    downloadMidiJson(midiData);
  }, [midiData]);

  const isReady      = appStatus === 'ready' || appStatus === 'playing';
  const isProcessing = appStatus === 'processing';
  const hasBand      = midiData !== null;

  // Track label for record modal
  const armedTrackLabel = armedTrack
    ? armedTrack.charAt(0).toUpperCase() + armedTrack.slice(1)
    : '';

  const TRACK_COLORS: Record<TrackName, string> = {
    guitar: 'var(--track-audio)',
    melody: 'var(--track-midi)',
    keys:   'var(--track-midi)',
    bass:   'var(--track-midi)',
    drums:  'var(--track-drums)',
    vocal:  'var(--track-vocal)',
  };

  return (
    <>
      <Head>
        <title>Virtual AI Band</title>
        <meta name="description" content="AI-powered virtual band — multi-modal music production with AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen md:h-screen bg-background text-foreground flex flex-col md:overflow-hidden">

        {/* ── Header — Band Prompt + Session Toolbar ── */}
        <header className="border-b border-border bg-card px-5 py-3 shrink-0">
          {/* Top row: branding + status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="font-head text-lg font-extrabold tracking-tight">
                🎵 Virtual AI Band
              </h1>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {process.env.NEXT_PUBLIC_IS_GROQ === 'true'
                  ? 'Groq · llama-3.3-70b'
                  : 'DigitalOcean Gradient'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Mock toggle */}
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <div
                  onClick={() => setUseMock((p) => !p)}
                  className={`relative w-9 h-5 cursor-pointer rounded-full transition-colors ${
                    useMock
                      ? 'bg-amber-600'
                      : 'bg-secondary'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      useMock ? 'left-4.5 bg-white' : 'left-0.5 bg-muted-foreground'
                    }`}
                  />
                </div>
                <span className="text-muted-foreground">Mock</span>
              </label>

              <StatusBadge status={derivedStatus} />
            </div>
          </div>

          {/* Band Prompt bar + session params */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
            {/* Prompt input — the star */}
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Band Prompt</label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleGenerate()}
                placeholder="Describe the music you want — e.g. 'chill lo-fi beat with jazzy piano chords'..."
                className="daw-input w-full text-sm"
                disabled={isProcessing}
              />
            </div>

            {/* Session param controls */}
            <div className="flex gap-2 items-end flex-wrap">
              {/* BPM */}
              <div className="w-20">
                <label className="text-xs text-muted-foreground mb-1 block">BPM</label>
                <input
                  type="number" min={40} max={240} step={1}
                  value={bpm} onChange={(e) => setBpm(Number(e.target.value))}
                  className="daw-input text-center text-sm"
                />
              </div>

              {/* Genre */}
              <div className="w-32">
                <label className="text-xs text-muted-foreground mb-1 block">Genre</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className="daw-input text-sm">
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Key */}
              <div className="w-28">
                <label className="text-xs text-muted-foreground mb-1 block">Key</label>
                <select value={musicalKey} onChange={(e) => setMusicalKey(e.target.value)} className="daw-input text-sm">
                  {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              {/* Bars */}
              <div className="w-16">
                <label className="text-xs text-muted-foreground mb-1 block">Bars</label>
                <input
                  type="number" min={2} max={16} step={1}
                  value={bars} onChange={(e) => setBars(Number(e.target.value))}
                  className="daw-input text-center text-sm"
                />
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={isProcessing || recordingState === 'recording'}
                className="daw-btn daw-btn-primary h-9.5 px-6 text-sm whitespace-nowrap"
              >
                {isProcessing
                  ? <span className="animate-pulse">Generating...</span>
                  : <span>🎵 Generate Band</span>
                }
              </button>
            </div>
          </div>

          {/* Generation progress bar */}
          {isProcessing && genStep > 0 && (
            <div className="mt-3">
              <GenerationProgress step={genStep} label={genLabel} totalSteps={genTotal} />
            </div>
          )}

          {/* Error banner */}
          {apiError && (
            <div className="mt-3 text-sm text-red-400 p-3 rounded-lg bg-red-950/30 border border-red-500/40">
              {apiError}
            </div>
          )}

          {useMock && (
            <p className="mt-2 text-xs text-center rounded-lg bg-amber-900/30 border border-amber-600/40 text-amber-400 py-1.5">
              ⚠ Mock Mode — no audio required, no API calls
            </p>
          )}
        </header>

        {/* ── Main content — Production Board + Agent Log ── */}
        <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          {/* Production Board — the star of the show */}
          <section className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden">
            <ProductionBoard
              midiData={midiData}
              hasAudio={!!effectiveAudio}
              trackStates={trackStates}
              trackSources={trackSources}
              isPlaying={isPlaying}
              isReady={isReady}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onMute={handleMute}
              onSolo={handleSolo}
              onVolume={handleVolume}
              onExportJson={handleExportJson}
              armedTrack={armedTrack}
              onArmTrack={handleArmTrack}
            />
          </section>

          {/* Agent Log — collapsible side panel */}
          <section
            className={`border-t md:border-t-0 md:border-l border-border transition-all overflow-hidden flex flex-col ${
              logExpanded ? 'h-100 md:h-auto md:w-90' : 'h-10 md:h-auto md:w-10'
            }`}
          >
            {/* Toggle button */}
            <button
              onClick={() => setLogExpanded(p => !p)}
              className="shrink-0 flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors bg-secondary/50"
              title={logExpanded ? 'Collapse log' : 'Expand log'}
            >
              <span className={`transition-transform ${logExpanded ? 'rotate-90' : '-rotate-90 md:rotate-0'}`}>▶</span>
              {logExpanded && <span className="font-semibold">Agent Log</span>}
              {!logExpanded && <span className="md:hidden font-semibold">Log</span>}
            </button>

            {logExpanded && (
              <div className="flex-1 overflow-hidden min-h-0">
                <AgentTerminal
                  logs={streamLogs}
                  active={hasBand || isProcessing}
                  isLoading={isProcessing && streamLogs.length === 0}
                  error={apiError}
                />
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ── Record Modal (arm-to-record workflow) ── */}
      {showRecordModal && armedTrack && (
        <RecordModal
          trackName={armedTrackLabel}
          trackColor={TRACK_COLORS[armedTrack]}
          recordingState={recordingState}
          durationSeconds={durationSeconds}
          audioUrl={audioUrl}
          analyserNode={analyserNode}
          onStartRec={startRecording}
          onStopRec={stopRecording}
          onClearRec={clearRecording}
          onAccept={handleAcceptRecording}
          onCancel={() => { setShowRecordModal(false); setArmedTrack(null); }}
          recError={recError}
        />
      )}
    </>
  );
}
