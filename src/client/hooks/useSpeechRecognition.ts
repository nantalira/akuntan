import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API interface declarations
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

export function useSpeechRecognition({
  onTranscriptChange
}: {
  onTranscriptChange?: (text: string) => void;
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const onTranscriptChangeRef = useRef(onTranscriptChange);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    const hasSupport =
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(hasSupport);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Recognition stop failed:', err);
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    // 1. Check secure context (Mic API is blocked on HTTP unless localhost)
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setError('Mikrofon memerlukan koneksi HTTPS. Buka aplikasi via HTTPS atau localhost.');
      return;
    }

    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setError('Browser Anda belum mendukung Web Speech API.');
      return;
    }

    // Stop any existing session
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    setError(null);
    setTranscript('');

    try {
      // 2. Fresh instantiation per recording session to avoid deadlock
      // continuous = false ensures single-utterance recognition without accumulating duplicate buffer segments
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'id-ID';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      // 3. Live streaming interim results with deduplication
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalAccumulator = '';
        let interimText = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res?.[0]) continue;
          const chunk = res[0].transcript.trim();
          if (!chunk) continue;

          if (res.isFinal) {
            // If new chunk starts with or extends the accumulator (Chrome interim-as-final bug), replace it
            if (
              finalAccumulator &&
              chunk.toLowerCase().startsWith(finalAccumulator.toLowerCase())
            ) {
              finalAccumulator = chunk;
            } else if (finalAccumulator?.toLowerCase().startsWith(chunk.toLowerCase())) {
              // Accumulator already contains this chunk, keep it
            } else {
              finalAccumulator = finalAccumulator ? `${finalAccumulator} ${chunk}` : chunk;
            }
          } else {
            // Live interim phrase currently being spoken
            interimText = chunk;
          }
        }

        // Combine final and interim safely
        let fullTranscript = '';
        if (finalAccumulator && interimText) {
          if (interimText.toLowerCase().startsWith(finalAccumulator.toLowerCase())) {
            fullTranscript = interimText;
          } else {
            fullTranscript = `${finalAccumulator} ${interimText}`;
          }
        } else {
          fullTranscript = finalAccumulator || interimText;
        }

        if (fullTranscript) {
          setTranscript(fullTranscript);
          onTranscriptChangeRef.current?.(fullTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError(
            'Izin mikrofon ditolak. Mohon aktifkan izin mikrofon di pengaturan browser/HP Anda.'
          );
        } else if (event.error === 'network') {
          setError('Koneksi terputus saat menghubungi server suara.');
        } else if (event.error === 'audio-capture') {
          setError('Perangkat mikrofon tidak terdeteksi.');
        } else if (event.error !== 'no-speech') {
          setError(`Kendala suara: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError('Gagal memulai perekam suara. Coba lagi.');
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    setError,
    startListening,
    stopListening,
    toggleListening
  };
}
