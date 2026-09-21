/**
 * Explicit Camera capture/OCR/translate phases.
 */
export type CameraPhase =
  | 'permission'
  | 'live'
  | 'captured'
  | 'recognizing'
  | 'translating'
  | 'result'
  | 'empty'
  | 'lowConfidence'
  | 'unavailable';

export type CameraPhaseEvent =
  | { type: 'PERMISSION_NEEDED' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'CAPTURE' }
  | { type: 'CAPTURED' }
  | { type: 'RECOGNIZE_STARTED' }
  | { type: 'RECOGNIZE_EMPTY' }
  | { type: 'RECOGNIZE_LOW_CONFIDENCE' }
  | { type: 'TRANSLATE_STARTED' }
  | { type: 'RESULT' }
  | { type: 'FAIL'; reasonCode: string }
  | { type: 'RETAKE' }
  | { type: 'CANCEL' }
  | { type: 'MARK_UNAVAILABLE'; reasonCode: string };

export type CameraPhaseState = {
  phase: CameraPhase;
  reasonCode: string | null;
};

export function initialCameraPhase(granted: boolean): CameraPhaseState {
  return granted
    ? { phase: 'live', reasonCode: null }
    : { phase: 'permission', reasonCode: null };
}

export function reduceCameraPhase(
  state: CameraPhaseState,
  event: CameraPhaseEvent,
): CameraPhaseState {
  switch (event.type) {
    case 'MARK_UNAVAILABLE':
      return { phase: 'unavailable', reasonCode: event.reasonCode };
    case 'PERMISSION_NEEDED':
      return { phase: 'permission', reasonCode: null };
    case 'PERMISSION_GRANTED':
      if (state.phase === 'permission') {
        return { phase: 'live', reasonCode: null };
      }
      return state;
    case 'PERMISSION_DENIED':
      return { phase: 'permission', reasonCode: 'permission_denied' };
    case 'CAPTURE':
      if (state.phase === 'live') {
        return { phase: 'captured', reasonCode: null };
      }
      return state;
    case 'CAPTURED':
      if (state.phase === 'captured' || state.phase === 'live') {
        return { phase: 'captured', reasonCode: null };
      }
      return state;
    case 'RECOGNIZE_STARTED':
      if (state.phase === 'captured') {
        return { phase: 'recognizing', reasonCode: null };
      }
      return state;
    case 'RECOGNIZE_EMPTY':
      if (state.phase === 'recognizing' || state.phase === 'captured') {
        return { phase: 'empty', reasonCode: 'no_text' };
      }
      return state;
    case 'RECOGNIZE_LOW_CONFIDENCE':
      if (state.phase === 'recognizing') {
        return { phase: 'lowConfidence', reasonCode: 'low_confidence' };
      }
      return state;
    case 'TRANSLATE_STARTED':
      if (state.phase === 'recognizing') {
        return { phase: 'translating', reasonCode: null };
      }
      return state;
    case 'RESULT':
      if (state.phase === 'translating' || state.phase === 'recognizing') {
        return { phase: 'result', reasonCode: null };
      }
      return state;
    case 'FAIL':
      if (
        state.phase === 'captured' ||
        state.phase === 'recognizing' ||
        state.phase === 'translating'
      ) {
        return { phase: 'empty', reasonCode: event.reasonCode };
      }
      return state;
    case 'RETAKE':
    case 'CANCEL':
      if (state.phase !== 'permission' && state.phase !== 'unavailable') {
        return { phase: 'live', reasonCode: null };
      }
      return state;
    default:
      return state;
  }
}

export function isCameraBusy(phase: CameraPhase): boolean {
  return (
    phase === 'captured' ||
    phase === 'recognizing' ||
    phase === 'translating'
  );
}
