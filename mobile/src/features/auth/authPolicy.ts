export type AuthStatus =
  | 'initializing'
  | 'guest'
  | 'signing-in'
  | 'signed-in'
  | 'deleting'
  | 'error';

export type AuthState = {
  status: AuthStatus;
  userId: string | null;
  error: string | null;
  /** Set once for a real failure. Cancel never sets this. */
  alert: string | null;
  /** Consent version from account-summary when available. */
  consentVersion: string | null;
  ageConfirmed: boolean;
  /** True when deletion paused and the user can retry. */
  deletionRetryPending: boolean;
  /** ISO timestamp when scheduled deletion completes (30-day path). */
  deletionDueAt: string | null;
};

export const INITIAL_AUTH: AuthState = {
  status: 'initializing',
  userId: null,
  error: null,
  alert: null,
  consentVersion: null,
  ageConfirmed: false,
  deletionRetryPending: false,
  deletionDueAt: null,
};

export type AuthAction =
  | { type: 'ready_guest' }
  | { type: 'ready_session'; userId: string }
  | { type: 'start_sign_in' }
  | { type: 'apple_cancelled' }
  | { type: 'sign_in_failed'; message: string }
  | { type: 'signed_out' }
  | { type: 'session_revoked' }
  | { type: 'dismiss_alert' }
  | {
      type: 'account_summary';
      consentVersion: string | null;
      ageConfirmed: boolean;
      deletionDueAt?: string | null;
    }
  | { type: 'start_deletion' }
  | { type: 'deletion_cancelled' }
  | { type: 'deletion_paused'; message: string }
  | { type: 'deletion_complete' };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'ready_guest':
      return {
        ...INITIAL_AUTH,
        status: 'guest',
      };
    case 'ready_session':
      return {
        ...state,
        status: 'signed-in',
        userId: action.userId,
        error: null,
        alert: null,
        deletionRetryPending: false,
      };
    case 'start_sign_in':
      return { ...state, status: 'signing-in', error: null, alert: null };
    case 'apple_cancelled':
      return {
        ...state,
        status: state.userId ? 'signed-in' : 'guest',
        error: null,
        alert: null,
      };
    case 'sign_in_failed':
      return {
        ...state,
        status: 'error',
        userId: null,
        error: action.message,
        alert: action.message,
        consentVersion: null,
        ageConfirmed: false,
        deletionRetryPending: false,
      };
    case 'signed_out':
    case 'session_revoked':
      return {
        ...INITIAL_AUTH,
        status: 'guest',
      };
    case 'dismiss_alert':
      return {
        ...state,
        alert: null,
        status:
          state.status === 'error'
            ? state.userId
              ? 'signed-in'
              : 'guest'
            : state.status,
        error: null,
      };
    case 'account_summary':
      return {
        ...state,
        consentVersion: action.consentVersion,
        ageConfirmed: action.ageConfirmed,
        deletionDueAt: action.deletionDueAt ?? null,
      };
    case 'start_deletion':
      return {
        ...state,
        status: 'deleting',
        error: null,
        alert: null,
        deletionRetryPending: false,
      };
    case 'deletion_cancelled':
      return {
        ...state,
        status: 'signed-in',
        error: null,
        alert: null,
        deletionRetryPending: false,
      };
    case 'deletion_paused':
      return {
        ...state,
        status: 'signed-in',
        error: action.message,
        alert: action.message,
        deletionRetryPending: true,
      };
    case 'deletion_complete':
      return {
        ...INITIAL_AUTH,
        status: 'guest',
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
  _action: 'signed_out' | 'session_revoked' | 'credential_revoked',
): boolean {
  return true;
}

/** Capture full name only when Apple provides it (first authorization). */
export function mergeAppleFullName(
  existing: string | null | undefined,
  given: string | null | undefined,
  family: string | null | undefined,
): string | null {
  const next = [given, family].filter(Boolean).join(' ').trim();
  if (next) return next;
  return existing?.trim() || null;
}
