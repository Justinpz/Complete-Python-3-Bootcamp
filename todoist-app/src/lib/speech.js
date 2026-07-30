// Wrapper around the browser SpeechRecognition API.
//
// Two quirks drive this design:
//  - iOS Safari fires `onend` after a short pause even in continuous mode, so
//    an explicit restart loop is needed to keep a long ramble in one session.
//  - Restarting drops the interim buffer, so finalized text is accumulated
//    here rather than read off the event.

import { useCallback, useEffect, useRef, useState } from 'react';

export function getRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechSupported() {
  return Boolean(getRecognitionCtor());
}

/**
 * @returns {{
 *   supported: boolean, listening: boolean, finalText: string, interimText: string,
 *   error: string|null, start: function, stop: function, reset: function,
 *   setFinalText: function
 * }}
 */
export function useSpeechCapture() {
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  // Distinguishes a deliberate stop from the browser ending the session on
  // its own; only the latter should restart.
  const wantListeningRef = useRef(false);

  const supported = isSpeechSupported();

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    setListening(false);
    setInterimText('');
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('This browser cannot listen. Try Chrome or Safari, or type instead.');
      return;
    }

    setError(null);
    wantListeningRef.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (event) => {
      let interim = '';
      let finalized = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalized += chunk;
        else interim += chunk;
      }
      if (finalized) {
        setFinalText((prev) => (prev ? `${prev.replace(/\s+$/, '')} ${finalized.trim()}` : finalized.trim()));
      }
      setInterimText(interim);
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return; // benign
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListeningRef.current = false;
        setListening(false);
        setError('Microphone access was blocked. Allow it in your browser settings to dictate.');
        return;
      }
      setError(`Speech recognition stopped: ${event.error}`);
    };

    rec.onend = () => {
      setInterimText('');
      if (wantListeningRef.current) {
        // iOS ends the session on a pause — resume so one ramble stays one note
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Could not start listening. Is another tab already using the microphone?');
      setListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFinalText('');
    setInterimText('');
    setError(null);
  }, []);

  // Never leave the microphone open behind a closed panel.
  useEffect(
    () => () => {
      wantListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* nothing to stop */
      }
    },
    [],
  );

  return { supported, listening, finalText, interimText, error, start, stop, reset, setFinalText };
}
