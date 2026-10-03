import { hasPendingDeletion } from '../../storage/pendingDeletion';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDraft, enqueueDraft, loadOutbox, newIdempotencyKey } from '../../storage/contributionOutbox';
import { loadLocalConsent } from '../../storage/contributionConsent';
import { canSubmitContribution } from '../auth/consent';
import { sessionInactiveNow } from '../auth/sessionExpiry';
import { getRuntimeFeatureFlags } from '../../app/featureFlags';
import { readPublicEnv } from '../../config/env';
import { flushPendingDrafts } from '../../services/contributionSync';
import { getSupabase } from '../../services/supabase';
import type { ReviewItem, ReviewSubmitAction } from './publicReviewApi';

const KEY = 'neptranslate.reviewResponses.v1';
export type ReviewResponse = {
  id: string; windowId: string; sourceItemId: string; revision: number;
  action: ReviewSubmitAction; answer: string; correction: string | null;
  source: string; proposed: string; direction: 'en-ne' | 'ne-en'; script: 'roman' | 'deva';
  userId: string | null; consentVersion: string | null; createdAt: string;
  status: 'local' | 'pending' | 'synced';
};
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task); chain = run.catch(() => undefined); return run;
}
export async function readReviewResponses(): Promise<ReviewResponse[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { const rows = JSON.parse(raw); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
export async function captureReviewResponse(input: {
  windowId: string; item: ReviewItem; action: ReviewSubmitAction; answer: string;
  correctedText?: string; userId: string | null;
  /** Account-summary consent from the current AuthProvider subject, never device-global alone. */
  consentVersion?: string | null; ageConfirmed?: boolean; deletionDueAt?: string | null;
  isCurrent?: () => boolean;
}): Promise<ReviewResponse> {
  return serial(async () => {
    const rows = await readReviewResponses();
    const consent = await loadLocalConsent(input.userId);
    const env = readPublicEnv();
    const client = input.userId ? getSupabase() : null;
    const session = client ? await client.auth.getSession().then(({ data }) => data.session).catch(() => null) : null;
    const validSession = session?.user?.id === input.userId && Boolean(session?.access_token) &&
      (session?.expires_at == null || session.expires_at * 1000 > Date.now());
    const eligible = input.action !== 'skip' && Boolean(input.userId) && getRuntimeFeatureFlags().contributionTextEnabled &&
      validSession && !input.deletionDueAt && !await hasPendingDeletion(input.userId!) &&
      canSubmitContribution({ authConfigured: env.authConfigured, signedIn: Boolean(input.userId), consentVersion: input.consentVersion ?? null, ageConfirmed: Boolean(input.ageConfirmed) }).ok &&
      canSubmitContribution({ authConfigured: env.authConfigured, signedIn: Boolean(input.userId), consentVersion: consent?.consent_version ?? null, ageConfirmed: Boolean(consent?.age_confirmed) }).ok &&
      !await sessionInactiveNow(input.userId!);
    const row: ReviewResponse = {
      id: newIdempotencyKey(), windowId: input.windowId, sourceItemId: input.item.source_item_id,
      revision: rows.filter((r) => r.sourceItemId === input.item.source_item_id && r.userId === (eligible ? input.userId : null)).length + 1,
      action: input.action, answer: input.answer, correction: input.correctedText ?? null,
      source: input.item.source_text, proposed: input.item.proposed_target ?? '',
      direction: input.item.direction, script: input.item.script === 'roman' ? 'roman' : 'deva',
      // Ineligible local answers can never be adopted by a later account/consent.
      userId: eligible ? input.userId : null, consentVersion: eligible ? consent!.consent_version : null,
      createdAt: new Date().toISOString(), status: eligible ? 'pending' : 'local',
    };
    if (input.isCurrent && !input.isCurrent()) throw new Error('review_owner_changed');
    await AsyncStorage.setItem(KEY, JSON.stringify([...rows, row]));
    if (eligible) await queueResponse(row);
    return row;
  });
}
async function queueResponse(row: ReviewResponse): Promise<void> {
  await enqueueDraft({ id: row.id, idempotency_key: row.id, local_fingerprint: `review:${row.id}`,
    owner_user_id: row.userId, source_text: row.source, model_output: row.proposed,
    correction_text: row.correction ?? row.answer, source_lang: row.direction === 'en-ne' ? 'en' : 'ne',
    formality: 'formal', script: row.script, surface: 'live_translate', translation_method: 'todays_10',
    consent_version: row.consentVersion, status: 'queued',
    review_metadata: { method: 'todays_10', source_item_id: row.sourceItemId, window_id: row.windowId,
      revision: row.revision, action: row.action, answer: row.answer, created_at: row.createdAt },
  });
}
/** Retry owned revisions through the existing contribution outbox and app lifecycle. */
export async function flushReviewResponses(userId: string | null): Promise<void> {
  if (!userId) return;
  await serial(async () => {
    const rows = await readReviewResponses();
    for (const row of rows.filter((r) => r.userId === userId && r.status === 'pending')) await queueResponse(row);
  });
  await flushPendingDrafts();
}
export async function clearReviewResponseUploads(userId: string): Promise<void> {
  return serial(async () => {
    const rows = await readReviewResponses();
    await AsyncStorage.setItem(KEY, JSON.stringify(rows.filter((r) => r.userId !== userId)));
    for (const draft of await loadOutbox()) if (draft.translation_method === 'todays_10' && draft.owner_user_id === userId) await deleteDraft(draft.id);
  });
}
