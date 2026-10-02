import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getSttSupport, hardStopRecognition } from '../stt/sttSupport';
import {
  MAX_UTTERANCE_MS,
  newUtteranceId,
  saveUtterance,
  updateUtteranceFeedback,
  utteranceAllowed,
} from '../features/contribution/utteranceCapture';
import { useAuth } from '../features/auth/AuthProvider';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';
import { addHistory } from '../storage/phrasebook';
import { requestInterstitialOpportunity } from '../features/ads/InterstitialController';
import { MODEL_VERSION } from '../storage/contributionOutbox';
import { cleanTranslationText } from '../mt/cleanText';
import { loadPrefs, savePrefs } from '../storage/prefs';
import type { HistoryItem } from '../storage/phrasebook';
import { useRuntime } from '../runtime/RuntimeContext';
import {
  initialTranslatePhase,
  reduceTranslatePhase,
} from '../runtime/machines/translatePhase';
import {
  initialSession,
  isRetryableTurn,
  reduceSession,
  type SessionTurn,
  type Side,
} from './translationSessionReducer';

type Options = {
  active: boolean;
  seed?: HistoryItem | null;
};

function directionFor(side: Side): 'en-ne' | 'ne-en' {
  return side === 'en' ? 'en-ne' : 'ne-en';
}

export function useTranslationSession({ active, seed }: Options) {
  const runtime = useRuntime();
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const [state, dispatch] = useReducer(reduceSession, seed, (item) =>
    initialSession(
      item
        ? {
            source: item.source,
            translation: item.translation,
            sourceLang: item.sourceLang,
          }
        : null,
    ),
  );
  const [uiPhase, dispatchPhase] = useReducer(
    reduceTranslatePhase,
    undefined,
    initialTranslatePhase,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const uiRef = useRef(uiPhase);
  uiRef.current = uiPhase;
  const activeRef = useRef(active);
  activeRef.current = active;
  const requestRef = useRef(0);
  const sttSupportRef = useRef<{ en: boolean; ne: boolean } | null>(null);
  const captureRef = useRef<{
    utteranceId: string;
    startedAt: number;
    stoppedAt: number | null;
    transcript: string;
    audioUri: string | null;
    ended: boolean;
  } | null>(null);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [utteranceOffer, setUtteranceOffer] = useState<{
    id: string;
    transcript: string;
    audioUri: string;
    durationMs: number;
    language: 'en' | 'ne';
  } | null>(null);
  const [utteranceNotice, setUtteranceNotice] = useState<'not_saved' | 'invalid' | null>(null);

  const finishCapture = useCallback(() => {
    const cap = captureRef.current;
    if (!cap?.ended || !cap.audioUri) return;
    const durationMs = (cap.stoppedAt ?? Date.now()) - cap.startedAt;
    const transcript = cap.transcript.trim();
    const language = stateRef.current.activeSide;
    const utteranceId = cap.utteranceId;
    const audioUri = cap.audioUri;
    captureRef.current = null;
    if (listenTimer.current) {
      clearTimeout(listenTimer.current);
      listenTimer.current = null;
    }
    if (!transcript || !utteranceAllowed(durationMs)) {
      setUtteranceOffer(null);
      setUtteranceNotice(null);
      return;
    }
    const account = authRef.current;
    void saveUtterance({
      id: utteranceId,
      transcript,
      audioUri,
      feedback: 'unrated',
      durationMs,
      language,
      signedIn: account.status === 'signed-in',
      authConfigured: account.authConfigured,
      userId: account.status === 'signed-in' ? account.userId : null,
      eligible:
        account.status === 'signed-in' &&
        account.ageConfirmed &&
        account.consentVersion === CONTRIBUTION_CONSENT_VERSION,
    }).then((saved) => {
      if (!saved.ok) {
        setUtteranceOffer(null);
        setUtteranceNotice(saved.reason === 'not_saved' ? 'not_saved' : 'invalid');
        return;
      }
      setUtteranceNotice(null);
      setUtteranceOffer({
        id: saved.item.id,
        transcript: saved.item.transcript,
        audioUri: saved.item.audioUri,
        durationMs: saved.item.durationMs,
        language: saved.item.language,
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPrefs().then((prefs) => {
      if (cancelled) return;
      dispatch({ type: 'setFormality', formality: prefs.formalOn ? 'formal' : 'informal' });
      dispatch({ type: 'setScript', script: prefs.devaOn ? 'deva' : 'roman' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSttSupport().then((support) => {
      if (cancelled) return;
      sttSupportRef.current = support;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (active) return;
    requestRef.current += 1;
    hardStopRecognition();
    runtime.speechRecognition.abort();
    runtime.speechSynthesis.stop();
    runtime.translation.cancelAll();
    dispatch({ type: 'setTranslating', translating: false });
    dispatch({ type: 'setListening', listening: false });
    dispatch({ type: 'cancelPass' });
    dispatchPhase({ type: 'INTERRUPT' });
  }, [active, runtime]);

  const translateSide = useCallback(
    async (text: string, from: Side) => {
      const current = stateRef.current;
      return runtime.translation.translate({
        text,
        preferred: directionFor(from),
        formality: current.formality,
        script: current.script,
        forcePreferred: true,
      });
    },
    [runtime.translation],
  );

  const remember = useCallback(async (turn: SessionTurn) => {
    if (!turn.translation.trim()) return;
    const current = stateRef.current;
    const direction = turn.direction ?? directionFor(turn.from);
    await addHistory({
      id: turn.id,
      source: turn.source,
      translation: turn.translation,
      sourceLang: turn.from,
      targetLang: turn.from === 'en' ? 'ne' : 'en',
      direction,
      formality: current.formality,
      script: current.script,
      translationMethod:
        turn.method === 'phrase' || turn.method === 'lexicon' || turn.method === 'neural'
          ? turn.method
          : 'neural',
      modelVersion: MODEL_VERSION,
    });
    requestInterstitialOpportunity({
      transition: 'translate_send_committed',
      surface: 'translate_idle',
      resultUnderReview: true,
    });
  }, []);

  const submit = useCallback(async () => {
    if (!activeRef.current) return;
    if (stateRef.current.translating) return;
    const current = stateRef.current;
    const text = cleanTranslationText(current.draft);
    if (!text) return;
    const requestId = ++requestRef.current;
    dispatch({ type: 'setTranslating', translating: true });
    dispatchPhase({ type: 'TRANSLATE_STARTED' });
    try {
      const result = await translateSide(text, current.activeSide);
      if (requestId !== requestRef.current) return;
      if (!activeRef.current || result.cancelled) {
        dispatch({ type: 'setTranslating', translating: false });
        dispatchPhase({ type: 'CANCEL' });
        return;
      }
      if (!result.text.trim()) {
        dispatch({ type: 'setTranslating', translating: false });
        dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'empty_result' });
        return;
      }
      const turn: SessionTurn = {
        id: runtime.ids.nextId('t'),
        from: current.activeSide,
        source: text,
        translation: result.text,
        method: result.method,
        direction: result.direction,
      };
      dispatch({ type: 'commitTurn', turn, keepDraft: true });
      dispatchPhase({ type: 'TRANSLATE_SUCCEEDED' });
      runtime.speechSynthesis.stop();
      runtime.speechSynthesis.speak(turn.translation, {
        language: current.activeSide === 'en' ? 'ne-NP' : 'en-US',
      });
      await remember(turn);
    } catch {
      if (requestId !== requestRef.current) return;
      dispatch({ type: 'setTranslating', translating: false });
      dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'translate_error' });
    }
  }, [remember, translateSide, runtime.ids, runtime.speechSynthesis]);

  useEffect(() => {
    return runtime.speechRecognition.subscribe((event) => {
      if (!activeRef.current) return;
      if (event.kind === 'result') {
        if (!stateRef.current.listening) return;
        const text = event.transcript ?? '';
        if (text) {
          dispatch({ type: 'setDraft', text });
          if (captureRef.current) captureRef.current.transcript = text;
        }
        return;
      }
      if (event.kind === 'audio') {
        if (captureRef.current && event.audioUri) captureRef.current.audioUri = event.audioUri;
        finishCapture();
        return;
      }
      if (event.kind === 'end') {
        if (!stateRef.current.listening && !captureRef.current) return;
        dispatch({ type: 'setListening', listening: false });
        dispatchPhase({ type: 'TRANSCRIPT_FINAL' });
        if (captureRef.current) {
          if (captureRef.current.stoppedAt == null) captureRef.current.stoppedAt = Date.now();
          captureRef.current.ended = true;
        }
        finishCapture();
        void submit();
        return;
      }
      if (event.kind === 'error') {
        if (!stateRef.current.listening) return;
        dispatch({ type: 'setListening', listening: false });
        dispatchPhase({
          type: 'TRANSLATE_FAILED',
          reasonCode: event.reason ?? 'stt_error',
        });
      }
    });
  }, [runtime.speechRecognition, submit, finishCapture]);

  const pass = useCallback(() => {
    hardStopRecognition();
    runtime.speechRecognition.abort();
    runtime.speechSynthesis.stop();
    dispatch({ type: 'setListening', listening: false });
    dispatch({ type: 'pass' });
    dispatchPhase({ type: 'RESET' });
  }, [runtime]);

  const retry = useCallback(
    async (turn: SessionTurn) => {
      if (!isRetryableTurn(turn, stateRef.current.turns)) return;
      if (stateRef.current.translating) return;
      const requestId = ++requestRef.current;
      dispatch({ type: 'setTranslating', translating: true });
      dispatchPhase({ type: 'RETRY' });
      try {
        const source = cleanTranslationText(turn.source);
        const result = await translateSide(source, turn.from);
        if (!activeRef.current || result.cancelled || requestId !== requestRef.current) {
          dispatch({ type: 'setTranslating', translating: false });
          dispatchPhase({ type: 'CANCEL' });
          return;
        }
        if (!result.text.trim()) {
          dispatch({ type: 'setTranslating', translating: false });
          dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'empty_result' });
          return;
        }
        const next: SessionTurn = {
          ...turn,
          source,
          translation: result.text,
          method: result.method,
          direction: result.direction,
        };
        dispatch({ type: 'replaceTurn', id: turn.id, turn: next });
        dispatchPhase({ type: 'TRANSLATE_SUCCEEDED' });
        await remember(next);
      } catch {
        dispatch({ type: 'setTranslating', translating: false });
        dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'translate_error' });
      }
    },
    [remember, translateSide],
  );

  const cancelListen = useCallback(() => {
    hardStopRecognition();
    runtime.speechRecognition.abort();
    dispatch({ type: 'setListening', listening: false });
    dispatchPhase({ type: 'CANCEL' });
  }, [runtime]);

  const toggleListen = useCallback(async () => {
    if (!activeRef.current) return;
    if (stateRef.current.listening || uiRef.current.phase === 'listening') {
      cancelListen();
      return;
    }
    if (stateRef.current.translating) return;

    dispatchPhase({ type: 'SPEAK' });
    const support = sttSupportRef.current ?? (await getSttSupport());
    sttSupportRef.current = support;
    if (!activeRef.current) return;
    if (!support[stateRef.current.activeSide]) {
      dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'stt_unavailable' });
      return;
    }
    const perm = await runtime.speechRecognition.requestPermission();
    if (!activeRef.current) return;
    if (perm !== 'granted') {
      dispatchPhase({ type: 'PERMISSION_DENIED' });
      return;
    }
    dispatchPhase({ type: 'PERMISSION_GRANTED' });
    dispatch({ type: 'setListening', listening: true });
    dispatchPhase({ type: 'LISTENING_STARTED' });
    captureRef.current = {
      utteranceId: newUtteranceId(),
      startedAt: Date.now(),
      stoppedAt: null,
      transcript: '',
      audioUri: null,
      ended: false,
    };
    if (listenTimer.current) clearTimeout(listenTimer.current);
    listenTimer.current = setTimeout(() => {
      if (captureRef.current && captureRef.current.stoppedAt == null) {
        captureRef.current.stoppedAt = Date.now();
      }
      runtime.speechRecognition.stop();
    }, MAX_UTTERANCE_MS);
    try {
      runtime.speechRecognition.start({
        lang: stateRef.current.activeSide === 'en' ? 'en-US' : 'ne-NP',
        interimResults: true,
        requiresOnDeviceRecognition: true,
      });
    } catch {
      dispatch({ type: 'setListening', listening: false });
      dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'stt_unavailable' });
    }
  }, [cancelListen, runtime.speechRecognition]);

  const rateUtterance = useCallback(
    (feedback: 'up' | 'down') => {
      const offer = utteranceOffer;
      setUtteranceOffer(null);
      if (!offer) return;
      void updateUtteranceFeedback(offer.id, feedback);
    },
    [utteranceOffer],
  );

  const setFormality = useCallback((formalOn: boolean) => {
    dispatch({ type: 'setFormality', formality: formalOn ? 'formal' : 'informal' });
    void loadPrefs().then((prefs) =>
      savePrefs({
        ...prefs,
        formalOn,
        devaOn: stateRef.current.script === 'deva',
        conversationConsentSeen: true,
      }),
    );
  }, []);

  const setScript = useCallback((devaOn: boolean) => {
    dispatch({ type: 'setScript', script: devaOn ? 'deva' : 'roman' });
    void loadPrefs().then((prefs) =>
      savePrefs({
        ...prefs,
        formalOn: stateRef.current.formality === 'formal',
        devaOn,
        conversationConsentSeen: true,
      }),
    );
  }, []);

  const clearError = useCallback(() => {
    dispatchPhase({ type: 'RESET' });
  }, []);

  return {
    state,
    uiPhase,
    dispatch,
    submit,
    pass,
    retry,
    toggleListen,
    cancelListen,
    rateUtterance,
    utteranceOffer,
    utteranceNotice,
    clearError,
    setFormality,
    setScript,
  };
}

export type { SessionState } from './translationSessionReducer';
export type { TranslatePhaseState } from '../runtime/machines/translatePhase';
