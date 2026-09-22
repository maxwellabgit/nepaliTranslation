import * as AppleAuthentication from 'expo-apple-authentication';
import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';
import { clearCachedEntitlement } from '../entitlements/entitlementCache';
import { clearLocalConsent } from '../../storage/contributionConsent';
import { clearContributionCaches } from '../../storage/contributionOutbox';
import { clearMediaOutbox } from '../../storage/mediaOutbox';
import {
  clearAppleIdentity,
  loadAppleUserId,
  saveAppleUserId,
} from './appleIdentity';
import { createAuthNonce } from './authNonce';
import { isAppleCancel } from './authPolicy';

export type DeletionFailureCode =
  | 'cancelled'
  | 'unavailable'
  | 'unauthorized'
  | 'wrong_apple_account'
  | 'missing_authorization_code'
  | 'deletion_incomplete'
  | 'apple_unconfigured'
  | 'apple_revoke_failed';

export type DeletionClientResult =
  | { ok: true; scheduled?: boolean; deletionDueAt?: string | null }
  | {
      ok: false;
      code: DeletionFailureCode;
      /** Server-reported completed steps when deletion paused mid-flight. */
      completed?: string[];
      message: string;
    };

export type DeletionDeps = {
  refreshApple?: typeof AppleAuthentication.refreshAsync;
  signInApple?: typeof AppleAuthentication.signInAsync;
  fetchImpl?: typeof fetch;
};

type FreshCodeResult =
  | { ok: true; authorizationCode: string }
  | { ok: false; code: DeletionFailureCode; message: string };

type IdentityLike = {
  provider?: string;
  id?: string;
  identity_id?: string;
  identity_data?: { sub?: string } | null;
};

/**
 * Compare Apple credential.user to the signed-in Supabase user's Apple identity.
 * Does not call signInWithIdToken — avoids switching sessions on mismatch.
 */
export function appleCredentialMatchesUser(
  appleUserId: string,
  user: { id: string; identities?: IdentityLike[] | null } | null | undefined,
  expectedUserId: string,
): boolean {
  if (!user || user.id !== expectedUserId || !appleUserId) return false;
  const appleIds = (user.identities ?? []).filter((i) => i.provider === 'apple');
  if (appleIds.length === 0) return false;
  return appleIds.some((identity) => {
    const sub = identity.identity_data?.sub;
    return (
      identity.id === appleUserId ||
      identity.identity_id === appleUserId ||
      sub === appleUserId
    );
  });
}

async function obtainFreshAuthorizationCode(
  userId: string,
  deps: DeletionDeps,
): Promise<FreshCodeResult> {
  const refreshApple = deps.refreshApple ?? AppleAuthentication.refreshAsync;
  const signInApple = deps.signInApple ?? AppleAuthentication.signInAsync;
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'Sign-in is not configured. Account deletion cannot run.',
    };
  }

  const storedAppleUser = await loadAppleUserId(userId);

  try {
    if (storedAppleUser) {
      const credential = await refreshApple({
        user: storedAppleUser,
        requestedScopes: [],
      });
      if (!credential.authorizationCode) {
        return {
          ok: false,
          code: 'missing_authorization_code',
          message:
            'Apple did not return a fresh authorization code. Deletion paused before any server purge. Retry when ready.',
        };
      }
      return { ok: true, authorizationCode: credential.authorizationCode };
    }

    // Missing local Apple user id: interactive reauth; never purge solely for that.
    // Verify against the current session without signInWithIdToken (session must not switch).
    const nonce = await createAuthNonce();
    const credential = await signInApple({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonce.hashed,
    });
    if (!credential.user) {
      return {
        ok: false,
        code: 'missing_authorization_code',
        message:
          'Apple did not return a user identifier. Deletion paused. No local translation history was cleared.',
      };
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return {
        ok: false,
        code: 'unauthorized',
        message: 'Sign in again, then retry account deletion.',
      };
    }
    if (!appleCredentialMatchesUser(credential.user, userData.user, userId)) {
      return {
        ok: false,
        code: 'wrong_apple_account',
        message:
          'That Apple ID does not match the signed-in account. Deletion paused. No data was purged.',
      };
    }
    await saveAppleUserId(userId, credential.user);
    if (!credential.authorizationCode) {
      return {
        ok: false,
        code: 'missing_authorization_code',
        message:
          'Apple did not return a fresh authorization code. Deletion paused before any server purge. Retry when ready.',
      };
    }
    return { ok: true, authorizationCode: credential.authorizationCode };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (isAppleCancel(err)) {
      return {
        ok: false,
        code: 'cancelled',
        message: 'Deletion cancelled. Nothing changed.',
      };
    }
    return {
      ok: false,
      code: 'unavailable',
      message: 'Apple credential refresh failed. Deletion paused. Retry when ready.',
    };
  }
}

/**
 * Confirm → fresh Apple credential → delete-account immediately.
 * Server exchanges+revokes before purge. Client clears identity caches only after success.
 * Cancelled refresh changes nothing. Missing code / exchange / revoke pauses before purge.
 */
export async function performAccountDeletion(
  input: { userId: string },
  deps: DeletionDeps = {},
): Promise<DeletionClientResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'Account deletion is not configured in this build.',
    };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Sign in again, then retry account deletion.',
    };
  }

  const fresh = await obtainFreshAuthorizationCode(input.userId, deps);
  if (!fresh.ok) {
    return {
      ok: false,
      code: fresh.code,
      message: fresh.message,
    };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(`${env.supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: fresh.authorizationCode,
      }),
    });
  } catch {
    return {
      ok: false,
      code: 'deletion_incomplete',
      message:
        'Could not reach the deletion service. Deletion paused before purge. Retry when online.',
    };
  }

  if (res.ok) {
    let scheduled = false;
    let deletionDueAt: string | null = null;
    try {
      const body = (await res.json()) as {
        scheduled?: boolean;
        deletion_due_at?: string | null;
      };
      scheduled = Boolean(body.scheduled);
      deletionDueAt = body.deletion_due_at ?? null;
    } catch {
      // empty body on immediate-delete path
    }
    await clearAppleIdentity(input.userId);
    await clearLocalConsent();
    await clearCachedEntitlement();
    await clearContributionCaches();
    await clearMediaOutbox();
    return { ok: true, scheduled, deletionDueAt };
  }

  let completed: string[] | undefined;
  let serverCode: string | undefined;
  try {
    const body = (await res.json()) as {
      error?: { code?: string };
      completed?: string[];
    };
    serverCode = body.error?.code;
    completed = Array.isArray(body.completed) ? body.completed : undefined;
  } catch {
    // ignore parse errors
  }

  if (serverCode === 'apple_unconfigured') {
    return {
      ok: false,
      code: 'apple_unconfigured',
      completed,
      message:
        'Apple account revocation is not configured on the server. Deletion paused before purge. Retry after Apple secrets are set.',
    };
  }
  if (serverCode === 'apple_revoke_failed') {
    return {
      ok: false,
      code: 'apple_revoke_failed',
      completed,
      message:
        'Apple token revocation failed. Deletion paused before purge. Retry when ready.',
    };
  }
  return {
    ok: false,
    code: 'deletion_incomplete',
    completed,
    message:
      'Account deletion did not finish. Translation history on this device was not cleared. Retry when ready.',
  };
}
