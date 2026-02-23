import { useRef, useState, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'recording' | 'stopped';

export interface UseAudioRecorderReturn {
  state:           RecordingState;
  audioBlob:       Blob | null;
  audioUrl:        string | null;
  durationSeconds: number;
  startRecording:  () => Promise<void>;
  stopRecording:   () => void;
  clearRecording:  () => void;
  error:           string | null;
  analyserNode:    AnalyserNode | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState]           = useState<RecordingState>('idle');
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl]     = useState<string | null>(null);
  const [duration, setDuration]     = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const streamRef         = useRef<MediaStream | null>(null);
  const audioContextRef   = useRef<AudioContext | null>(null);
  const startTimeRef      = useRef<number>(0);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Build analyser for waveform visualisation
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Pick the best supported MIME type
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

      const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setState('stopped');
        clearInterval(timerRef.current!);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
      };

      recorder.start(100); // collect chunks every 100ms
      startTimeRef.current = Date.now();
      setState('recording');

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow mic permission and try again.'
          : `Recording failed: ${err instanceof Error ? err.message : String(err)}`;
      setError(msg);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current!);
  }, []);

  const clearRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setState('idle');
    chunksRef.current = [];
  }, [audioUrl]);

  return {
    state,
    audioBlob,
    audioUrl,
    durationSeconds: duration,
    startRecording,
    stopRecording,
    clearRecording,
    error,
    analyserNode,
  };
}
