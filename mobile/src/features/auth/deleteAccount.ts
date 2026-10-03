import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';
import { clearLocalConsent } from '../../storage/contributionConsent';
import { clearReviewResponseUploads } from '../contribution/reviewResponses';
import { discardOwnerContributionFiles } from '../../services/mediaEnqueue';
import { discardUtterancesForOwner } from '../contribution/utteranceCapture';
import { saveSharingToggles } from '../../storage/sharingToggles';
import { savePendingDeletionIntent, savePendingDeletionDue } from '../../storage/pendingDeletion';
import { listDrafts, deleteDraft } from '../../storage/contributionOutbox';

export type DeletionClientResult =
  | { ok: true; scheduled: boolean; deletionDueAt: string | null }
  | { ok: false; code: 'unavailable' | 'unauthorized' | 'deletion_incomplete'; message: string };
export type DeletionDeps = { fetchImpl?: typeof fetch };

/** Authenticated private subject requests deletion of shared data, not its identity.
 * No Apple/name/email/code exchange. Local sharing stops durably before networking; failures retain the pending intent. */
export async function performDataDeletion(input: { userId: string }, deps: DeletionDeps = {}): Promise<DeletionClientResult> {
  const env = readPublicEnv();
  const client = getSupabase();
  try {
    await savePendingDeletionIntent(input.userId);
    await stopOwnerSharing(input.userId);
    if (!env.authConfigured || !client) return { ok: false, code: 'unavailable', message: 'Shared data deletion is unavailable. Retry when connected.' };
    const { data, error } = await client.auth.getSession();
    const session = data.session;
    if (error || !session?.access_token || session.user?.id !== input.userId ||
      (session.expires_at && session.expires_at * 1000 <= Date.now())) {
      return { ok: false, code: 'unauthorized', message: 'The private data connection is unavailable. Retry when connected.' };
    }
    const response = await (deps.fetchImpl ?? fetch)(`${env.supabaseUrl}/functions/v1/delete-data`, {
      method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, apikey: env.supabaseAnonKey, 'content-type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) return { ok: false, code: 'deletion_incomplete', message: 'Shared data deletion was not accepted. Retry when connected.' };
    const body = await response.json() as { scheduled?: boolean; deletion_due_at?: string | null };
    const due = body.deletion_due_at;
    if (!body.scheduled || typeof due !== 'string' || !Number.isFinite(Date.parse(due))) {
      return { ok: false, code: 'deletion_incomplete', message: 'The deletion deadline could not be confirmed. Retry when connected.' };
    }
    await savePendingDeletionDue(input.userId, due);
    return { ok: true, scheduled: true, deletionDueAt: due };
  } catch {
    return { ok: false, code: 'deletion_incomplete', message: 'Shared data deletion could not finish. Retry when connected.' };
  }
}
/** Historical internal import compatibility; the app uses shared-data deletion. */
export const performAccountDeletion = performDataDeletion;

async function stopOwnerSharing(ownerId: string): Promise<void> {
  await clearLocalConsent();
  await saveSharingToggles(ownerId, { speech: false, photos: false });
  for (const row of await listDrafts()) if (row.owner_user_id === ownerId) await deleteDraft(row.id);
  await clearReviewResponseUploads(ownerId);
  await discardOwnerContributionFiles(ownerId);
  await discardUtterancesForOwner(ownerId);
}
