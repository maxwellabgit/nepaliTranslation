import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalConsent } from '../../storage/contributionConsent';
import { saveSharingToggles } from '../../storage/sharingToggles';
import type { SupabaseClient } from '@supabase/supabase-js';

const KEY = 'neptranslate.private_identity.v1';
let pending: Promise<string | null> | null = null;

/** Only explicit SDK credential-loss errors allow a new identity. Transport/server
 * errors never rotate UUIDs. Old owned queues remain bound to their old subject. */
function terminalCredentialLoss(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: string };
  return value.name === 'AuthSessionMissingError' ||
    ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'user_not_found'].includes(value.code ?? '');
}

/** Preserve any installed authenticated subject, including historical registered users.
 * A transiently unavailable session never replaces its known subject: recovery is explicit
 * and cannot adopt its queued contributions or reset server credits. */
export function ensurePrivateIdentity(client: SupabaseClient): Promise<string | null> {
  if (pending) return pending;
  const run = async (): Promise<string | null> => {
    try {
      let known = await AsyncStorage.getItem(KEY);
      const { data, error } = await client.auth.getSession();
      if (error) {
        if (!known || !terminalCredentialLoss(error)) return null;
        await clearLocalConsent();
        await saveSharingToggles(known, { speech: false, photos: false });
        await AsyncStorage.removeItem(KEY);
        known = null;
      }
      let session = error ? null : data.session;
      if (!session && known) {
        const refreshed = await client.auth.refreshSession();
        if (refreshed.error) {
          if (!terminalCredentialLoss(refreshed.error)) return null;
          await clearLocalConsent();
          await saveSharingToggles(known, { speech: false, photos: false });
          await AsyncStorage.removeItem(KEY);
          known = null;
        } else session = refreshed.data.session;
      }
      if (!session && !known) {
        const created = await client.auth.signInAnonymously();
        if (created.error) return null;
        session = created.data.session;
      }
      if (!session?.user?.id || !session.access_token) return null;
      if (known && known !== session.user.id) return null;
      if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
        const refreshed = await client.auth.refreshSession();
        if (refreshed.error) {
          if (!terminalCredentialLoss(refreshed.error)) return null;
          await clearLocalConsent();
          await saveSharingToggles(session.user.id, { speech: false, photos: false });
          await AsyncStorage.removeItem(KEY);
          const created = await client.auth.signInAnonymously();
          if (created.error) return null;
          session = created.data.session;
        } else {
          if (refreshed.data.session?.user.id !== session.user.id) return null;
          session = refreshed.data.session;
        }
        if (!session?.access_token || (session.expires_at && session.expires_at * 1000 <= Date.now())) return null;
      }
      await AsyncStorage.setItem(KEY, session.user.id);
      return session.user.id;
    } catch { return null; }
  };
  pending = run().finally(() => { pending = null; });
  return pending;
}

export async function readKnownPrivateIdentity(): Promise<string | null> {
  try { return await AsyncStorage.getItem(KEY); } catch { return null; }
}
