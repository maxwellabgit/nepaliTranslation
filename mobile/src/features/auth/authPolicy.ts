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
  /** Deadline for the purge. This is not proof that deletion finished. */
  deletionDueAt: string | null;
  /** Server completion timestamp. Absent until the deletion request finishes. */
  deletionCompletedAt: string | null;
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
  deletionCompletedAt: null,
};

export type AuthAction =
  | { type: 'ready_guest' }
  | { type: 'identity_unavailable' }
  | { type: 'permissions_revoked' }
  | { type: 'local_identity'; userId: string }
  | { type: 'local_deletion'; userId: string; dueAt: string | null; pending: boolean; completedAt: string | null }
  | { type: 'ready_session'; userId: string }
  | { type: 'signed_out' }
  | { type: 'session_revoked' }
  | { type: 'dismiss_alert' }
  | {
      type: 'account_summary';
      consentVersion: string | null;
      ageConfirmed: boolean;
      deletionDueAt?: string | null;
      deletionCompletedAt?: string | null;
    }
  | { type: 'start_deletion' }
  | { type: 'deletion_cancelled' }
  | { type: 'deletion_paused'; message: string }
  | { type: 'deletion_complete' }
  | { type: 'deletion_scheduled'; deletionDueAt: string; message: string };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'permissions_revoked':
      return { ...state, consentVersion: null, ageConfirmed: false };
    case 'local_identity':
      return { ...(state.userId === action.userId ? state : INITIAL_AUTH), status: 'guest', userId: action.userId, consentVersion: null, ageConfirmed: false };
    case 'local_deletion':
      return { ...state, userId: action.userId, consentVersion: null, ageConfirmed: false, deletionDueAt: action.dueAt, deletionRetryPending: action.pending, deletionCompletedAt: action.completedAt };
    case 'identity_unavailable':
      return { ...state, status: 'guest', consentVersion: null, ageConfirmed: false, error: null, alert: null };
    case 'ready_guest':
      return {
        ...INITIAL_AUTH,
        status: 'guest',
      };
    case 'ready_session':
      return {
        ...(state.userId === action.userId ? state : INITIAL_AUTH),
        status: 'signed-in',
        userId: action.userId,
        error: null,
        alert: null,
        deletionRetryPending: state.userId === action.userId && state.deletionRetryPending,
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
        deletionCompletedAt: action.deletionCompletedAt ?? null,
      };
    case 'start_deletion':
      return {
        ...state,
        status: 'deleting',
        consentVersion: null,
        ageConfirmed: false,
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
    case 'deletion_scheduled':
      return {
        ...state,
        status: 'signed-in',
        consentVersion: null,
        ageConfirmed: false,
        alert: action.message,
        deletionDueAt: action.deletionDueAt,
      };
    default:
      return state;
  }
}

/** Revoked or signed-out sessions must not wipe on-device translation history. */
export function keepsLocalHistory(
  _action: 'signed_out' | 'session_revoked' | 'credential_revoked',
): boolean {
  return true;
}
