export type AuthStatus =
  | 'initializing'
  | 'guest'
  | 'signing-in'
  | 'signed-in'
  | 'error';

export type AuthState = {
  status: AuthStatus;
  userId: string | null;
  error: string | null;
  /** Set once for a real failure. Cancel never sets this. */
  alert: string | null;
};

export const INITIAL_AUTH: AuthState = {
  status: 'initializing',
  userId: null,
  error: null,
  alert: null,
};

export type AuthAction =
  | { type: 'ready_guest' }
  | { type: 'ready_session'; userId: string }
  | { type: 'start_sign_in' }
  | { type: 'apple_cancelled' }
  | { type: 'sign_in_failed'; message: string }
  | { type: 'signed_out' }
  | { type: 'session_revoked' }
  | { type: 'dismiss_alert' };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'ready_guest':
      return { status: 'guest', userId: null, error: null, alert: null };
    case 'ready_session':
      return {
        status: 'signed-in',
        userId: action.userId,
        error: null,
        alert: null,
      };
    case 'start_sign_in':
      return { ...state, status: 'signing-in', error: null, alert: null };
    case 'apple_cancelled':
      return { status: 'guest', userId: null, error: null, alert: null };
    case 'sign_in_failed':
      return {
        status: 'error',
        userId: null,
        error: action.message,
        alert: action.message,
      };
    case 'signed_out':
    case 'session_revoked':
      return { status: 'guest', userId: null, error: null, alert: null };
    case 'dismiss_alert':
      return {
        ...state,
        alert: null,
        status: state.status === 'error' ? 'guest' : state.status,
        error: null,
      };
    default:
      return state;
  }
}

export function isAppleCancel(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? '';
  return (
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'ERR_CANCELED' ||
    /cancel/i.test(error.message ?? '')
  );
}

/** Revoked or signed-out sessions must not wipe on-device translation history. */
export function keepsLocalHistory(
  _action: 'signed_out' | 'session_revoked',
): boolean {
  return true;
}

export function randomNonce(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
