/**
 * Explicit Translate interaction phases. Session turns stay in translationSessionReducer;
 * this machine owns mic/permission/work/error presentation state.
 */
export type TranslatePhase =
  | 'idle'
  | 'requestingPermission'
  | 'listening'
  | 'finalizingTranscript'
  | 'translating'
  | 'success'
  | 'recoverableError'
  | 'unavailable';

export type TranslatePhaseEvent =
  | { type: 'SPEAK' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'LISTENING_STARTED' }
  | { type: 'TRANSCRIPT_FINAL' }
  | { type: 'TRANSLATE_STARTED' }
  | { type: 'TRANSLATE_SUCCEEDED' }
  | { type: 'TRANSLATE_FAILED'; reasonCode: string }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'INTERRUPT' }
  | { type: 'MARK_UNAVAILABLE'; reasonCode: string }
  | { type: 'RESET' };

export type TranslatePhaseState = {
  phase: TranslatePhase;
  reasonCode: string | null;
};

export function initialTranslatePhase(): TranslatePhaseState {
  return { phase: 'idle', reasonCode: null };
}

export function reduceTranslatePhase(
  state: TranslatePhaseState,
  event: TranslatePhaseEvent,
): TranslatePhaseState {
  switch (event.type) {
    case 'RESET':
      return initialTranslatePhase();
    case 'MARK_UNAVAILABLE':
      return { phase: 'unavailable', reasonCode: event.reasonCode };
    case 'CANCEL':
    case 'INTERRUPT':
      if (
        state.phase === 'listening' ||
        state.phase === 'finalizingTranscript' ||
        state.phase === 'translating' ||
        state.phase === 'requestingPermission'
      ) {
        return { phase: 'idle', reasonCode: null };
      }
      return state;
    case 'RETRY':
      if (state.phase === 'recoverableError' || state.phase === 'success') {
        return { phase: 'translating', reasonCode: null };
      }
      return state;
    case 'SPEAK':
      if (state.phase === 'idle' || state.phase === 'success' || state.phase === 'recoverableError') {
        return { phase: 'requestingPermission', reasonCode: null };
      }
      return state;
    case 'PERMISSION_GRANTED':
      if (state.phase === 'requestingPermission') {
        return { phase: 'listening', reasonCode: null };
      }
      return state;
    case 'PERMISSION_DENIED':
      if (state.phase === 'requestingPermission') {
        return { phase: 'recoverableError', reasonCode: 'permission_denied' };
      }
      return state;
    case 'LISTENING_STARTED':
      if (state.phase === 'requestingPermission' || state.phase === 'listening') {
        return { phase: 'listening', reasonCode: null };
      }
      return state;
    case 'TRANSCRIPT_FINAL':
      if (state.phase === 'listening') {
        return { phase: 'finalizingTranscript', reasonCode: null };
      }
      return state;
    case 'TRANSLATE_STARTED':
      if (
        state.phase === 'idle' ||
        state.phase === 'success' ||
        state.phase === 'finalizingTranscript' ||
        state.phase === 'recoverableError' ||
        state.phase === 'unavailable'
      ) {
        return { phase: 'translating', reasonCode: null };
      }
      return state;
    case 'TRANSLATE_SUCCEEDED':
      if (state.phase === 'translating') {
        return { phase: 'success', reasonCode: null };
      }
      return state;
    case 'TRANSLATE_FAILED':
      if (state.phase === 'translating' || state.phase === 'finalizingTranscript') {
        return { phase: 'recoverableError', reasonCode: event.reasonCode };
      }
      return state;
    default:
      return state;
  }
}

export function isTranslateBusy(phase: TranslatePhase): boolean {
  return (
    phase === 'requestingPermission' ||
    phase === 'listening' ||
    phase === 'finalizingTranscript' ||
    phase === 'translating'
  );
}
