import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getSttSupport, hardStopRecognition } from '../stt/sttSupport';
import { addHistory } from '../storage/phrasebook';
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
      const side = stateRef.current.activeSide;
      if (!support[side]) {
        dispatchPhase({ type: 'MARK_UNAVAILABLE', reasonCode: 'stt_unsupported' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const support = sttSupportRef.current;
    if (!support) return;
    if (!support[state.activeSide]) {
      dispatchPhase({ type: 'MARK_UNAVAILABLE', reasonCode: 'stt_unsupported' });
    } else if (uiRef.current.phase === 'unavailable') {
      dispatchPhase({ type: 'RESET' });
    }
  }, [state.activeSide]);

  useEffect(() => {
    if (active) return;
    requestRef.current += 1;
    hardStopRecognition();
    runtime.speechRecognition.abort();
    runtime.speechSynthesis.stop();
    runtime.translation.cancelAll();
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

  const remember = useCallback((turn: SessionTurn) => {
    if (!turn.translation.trim()) return;
    const current = stateRef.current;
    const direction = turn.direction ?? directionFor(turn.from);
    void addHistory({
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
      const turn: SessionTurn = {
        id: runtime.ids.nextId('t'),
        from: current.activeSide,
        source: text,
        translation: result.text,
        method: result.method,
        direction: result.direction,
      };
      dispatch({ type: 'commitTurn', turn, keepDraft: false });
      dispatchPhase({ type: 'TRANSLATE_SUCCEEDED' });
      remember(turn);
    } catch {
      dispatch({ type: 'setTranslating', translating: false });
      dispatchPhase({ type: 'TRANSLATE_FAILED', reasonCode: 'translate_error' });
    }
  }, [remember, translateSide, runtime.ids]);

  useEffect(() => {
    return runtime.speechRecognition.subscribe((event) => {
      if (!activeRef.current) return;
      if (event.kind === 'result') {
        if (!stateRef.current.listening) return;
        const text = event.transcript ?? '';
        if (text) dispatch({ type: 'setDraft', text });
        return;
      }
      if (event.kind === 'end') {
        if (!stateRef.current.listening) return;
        dispatch({ type: 'setListening', listening: false });
        dispatchPhase({ type: 'TRANSCRIPT_FINAL' });
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
  }, [runtime.speechRecognition, submit]);

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
        remember(next);
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

    const support = sttSupportRef.current ?? (await getSttSupport());
    sttSupportRef.current = support;
    const side = stateRef.current.activeSide;
    if (!support[side]) {
      dispatchPhase({ type: 'MARK_UNAVAILABLE', reasonCode: 'stt_unsupported' });
      return;
    }

    dispatchPhase({ type: 'SPEAK' });
    const perm = await runtime.speechRecognition.requestPermission();
    if (!activeRef.current) return;
    if (perm !== 'granted') {
      dispatchPhase({ type: 'PERMISSION_DENIED' });
      return;
    }
    dispatchPhase({ type: 'PERMISSION_GRANTED' });
    dispatch({ type: 'setListening', listening: true });
    dispatchPhase({ type: 'LISTENING_STARTED' });
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

  const setFormality = useCallback((formalOn: boolean) => {
    dispatch({ type: 'setFormality', formality: formalOn ? 'formal' : 'informal' });
    void savePrefs({
      formalOn,
      devaOn: stateRef.current.script === 'deva',
      conversationConsentSeen: true,
    });
  }, []);

  const setScript = useCallback((devaOn: boolean) => {
    dispatch({ type: 'setScript', script: devaOn ? 'deva' : 'roman' });
    void savePrefs({
      formalOn: stateRef.current.formality === 'formal',
      devaOn,
      conversationConsentSeen: true,
    });
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
    clearError,
    setFormality,
    setScript,
  };
}

export type { SessionState } from './translationSessionReducer';
export type { TranslatePhaseState } from '../runtime/machines/translatePhase';
