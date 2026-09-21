import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { hardStopRecognition } from '../stt/sttSupport';
import { addHistory } from '../storage/phrasebook';
import { MODEL_VERSION } from '../storage/contributionOutbox';
import { cleanTranslationText } from '../mt/cleanText';
import { loadPrefs, savePrefs } from '../storage/prefs';
import type { HistoryItem } from '../storage/phrasebook';
import {
  initialSession,
  isRetryableTurn,
  reduceSession,
  type SessionState,
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeRef = useRef(active);
  activeRef.current = active;
  const requestRef = useRef(0);

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
    if (active) return;
    requestRef.current += 1;
    hardStopRecognition();
    dispatch({ type: 'setListening', listening: false });
    dispatch({ type: 'cancelPass' });
  }, [active]);

  const translateSide = useCallback(async (text: string, from: Side) => {
    const current = stateRef.current;
    return sharedTranslationEngine.translate({
      text,
      preferred: directionFor(from),
      formality: current.formality,
      script: current.script,
      forcePreferred: true,
    });
  }, []);

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
    const current = stateRef.current;
    const text = cleanTranslationText(current.draft);
    if (!text) return;
    const requestId = ++requestRef.current;
    dispatch({ type: 'setTranslating', translating: true });
    const result = await translateSide(text, current.activeSide);
    if (!activeRef.current || result.cancelled || requestId !== requestRef.current) {
      dispatch({ type: 'setTranslating', translating: false });
      return;
    }
    const turn: SessionTurn = {
      id: `t-${requestId}`,
      from: current.activeSide,
      source: text,
      translation: result.text,
      method: result.method,
      direction: result.direction,
    };
    dispatch({ type: 'commitTurn', turn, keepDraft: true });
    remember(turn);
  }, [remember, translateSide]);

  const pass = useCallback(() => {
    hardStopRecognition();
    dispatch({ type: 'setListening', listening: false });
    dispatch({ type: 'pass' });
  }, []);

  const retry = useCallback(
    async (turn: SessionTurn) => {
      if (!isRetryableTurn(turn, stateRef.current.turns)) return;
      const requestId = ++requestRef.current;
      dispatch({ type: 'setTranslating', translating: true });
      const source = cleanTranslationText(turn.source);
      const result = await translateSide(source, turn.from);
      if (!activeRef.current || result.cancelled || requestId !== requestRef.current) {
        dispatch({ type: 'setTranslating', translating: false });
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
      remember(next);
    },
    [remember, translateSide],
  );

  const toggleListen = useCallback(async () => {
    if (!activeRef.current) return;
    if (stateRef.current.listening) {
      hardStopRecognition();
      dispatch({ type: 'setListening', listening: false });
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted || !activeRef.current) return;
    dispatch({ type: 'setListening', listening: true });
    ExpoSpeechRecognitionModule.start({
      lang: stateRef.current.activeSide === 'en' ? 'en-US' : 'ne-NP',
      interimResults: true,
      continuous: false,
    });
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    if (!activeRef.current || !stateRef.current.listening) return;
    const text = event.results[0]?.transcript ?? '';
    if (text) dispatch({ type: 'setDraft', text });
  });

  useSpeechRecognitionEvent('end', () => {
    if (!stateRef.current.listening) return;
    dispatch({ type: 'setListening', listening: false });
    void submit();
  });

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

  return {
    state,
    dispatch,
    submit,
    pass,
    retry,
    toggleListen,
    setFormality,
    setScript,
  };
}

export type { SessionState };
