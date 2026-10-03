import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Only public client configuration. Never print or commit guest session credentials.
const url = 'https://jcrpxoojxixoieqqfgzo.supabase.co';
const key = process.env.BOLA_PROOF_PUBLIC_KEY;
assert.ok(key?.startsWith('sb_publishable_'), 'publishable client key required');
const sessionPath = join(tmpdir(), 'bola-guest-hosted-proof-20261003.private.json');
async function call(path, token, body) {
  const response = await fetch(url + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: key, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, data };
}
function success(result, label) {
  assert.equal(result.ok, true, `${label} failed: status=${result.status}, code=${result.data?.error?.code ?? result.data?.code ?? 'unknown'}`);
  return result.data;
}
if (process.argv[2] === 'create') {
  const identities = [];
  for (let i = 0; i < 2; i++) {
    const data = success(await call('/auth/v1/signup', null, { data: { engineering_proof: 'synthetic-guest-20261003' } }), 'anonymous Auth');
    assert.equal(data.user?.is_anonymous, true);
    assert.ok(data.access_token && data.user?.id);
    identities.push({ uid: data.user.id, token: data.access_token, refresh: data.refresh_token });
  }
  writeFileSync(sessionPath, JSON.stringify({ identities, idempotencyKey: `synthetic-guest-proof-${randomUUID()}` }), { mode: 0o600 });
  console.log(JSON.stringify({ proof: 'real anonymous Auth', syntheticSubjects: identities.map(i => i.uid), credentials: 'temporary private file only' }));
} else {
  const state = JSON.parse(readFileSync(sessionPath, 'utf8'));
  const [owner, other] = state.identities;
  if (process.argv[2] === 'capture') {
    const config = success(await call('/rest/v1/app_config?select=startup_consent_version,contribution_consent_version,contribution_text_enabled,contribution_speech_enabled,contribution_photos_enabled,public_review_enabled', owner.token), 'config')[0];
    assert.equal(config.contribution_consent_version, '2026-10-02.guest');
    assert.equal(config.public_review_enabled, false);
    // Synthetic engineering subjects; these are not an owner's legal/content approval.
    success(await call('/rest/v1/rpc/service_record_startup_consent', owner.token, { p_user_id: owner.uid, p_version: config.startup_consent_version, p_terms_accepted: true, p_privacy_accepted: true, p_age_confirmed: false }), 'synthetic startup');
    const profilePath = `/rest/v1/profiles?user_id=eq.${owner.uid}&select=consent_version,speech_sharing,age_confirmed_at,deletion_due_at,deletion_purged_at`;
    let profile = success(await call(profilePath, owner.token), 'own profile')[0];
    assert.equal(profile.consent_version, null);
    assert.equal(profile.speech_sharing, false);
    const isolated = success(await call(profilePath, other.token), 'cross-owner RLS');
    assert.equal(isolated.length, 0);
    const report = { source_text: '[SYNTHETIC ENGINEERING PROOF] hello', model_output: '[SYNTHETIC] namaste', correction_text: '[SYNTHETIC] revised namaste', direction: 'en-ne', formality: 'formal', script: 'roman', surface: 'live_translate', idempotency_key: state.idempotencyKey, consent_version: config.contribution_consent_version, metadata: { engineeringProof: true, method: 'typed-feedback', feedback: 'down', feedbackRevision: 1 } };
    const denied = await call('/functions/v1/submit-translation-report', owner.token, report);
    assert.equal(denied.status, 403, 'general terms must not authorize contributions');
    success(await call('/functions/v1/record-consent', owner.token, { consent_version: config.contribution_consent_version, age_confirmed: true }), 'specific synthetic opt-in');
    profile = success(await call(profilePath, owner.token), 'consented profile')[0];
    assert.equal(profile.consent_version, config.contribution_consent_version);
    assert.equal(profile.speech_sharing, false);
    const inserted = success(await call('/functions/v1/submit-translation-report', owner.token, report), 'typed-feedback upload');
    const retry = await call('/functions/v1/submit-translation-report', owner.token, report);
    assert.equal(retry.status, 409);
    assert.equal(retry.data.report_id, inserted.report_id);
    success(await call('/functions/v1/record-sample-progress', owner.token, { corpus_version: 'review-roster-370', allotted: 370, completed: 334, crossed_at: new Date().toISOString() }), 'sample progress');
    const publicDelete = await call('/functions/v1/delete-data', null, {});
    assert.equal(publicDelete.status, 401);
    const forged = await call('/functions/v1/delete-data', other.token, { user_id: owner.uid });
    assert.equal(forged.status, 400);
    state.reportId = inserted.report_id;
    state.report = report;
    writeFileSync(sessionPath, JSON.stringify(state), { mode: 0o600 });
    console.log(JSON.stringify({ proof: 'separate consent, default-off speech, owner RLS, idempotent typed upload, sample progress, deletion authorization', owner: owner.uid, reportId: inserted.report_id, flags: config }));
  } else if (process.argv[2] === 'delete') {
    const result = success(await call('/functions/v1/delete-data', owner.token, {}), 'guest shared deletion');
    const repeat = success(await call('/functions/v1/delete-data', owner.token, {}), 'deletion retry');
    assert.equal(result.deleted, false);
    assert.equal(result.scheduled, true);
    assert.equal(result.deletion_due_at, repeat.deletion_due_at);
    assert.ok(Number.isFinite(Date.parse(result.deletion_due_at)));
    state.deletion = result;
    writeFileSync(sessionPath, JSON.stringify(state), { mode: 0o600 });
    const after = await call('/functions/v1/submit-translation-report', owner.token, { ...state.report, idempotency_key: `${state.idempotencyKey}-after-withdrawal` });
    assert.equal(after.status, 403);
    success(await call('/auth/v1/user', owner.token), 'private identity retained');
    console.log(JSON.stringify({ proof: 'withdrawal denies uploads, private identity survives, original deadline preserved', owner: owner.uid, ...result }));
  } else if (process.argv[2] === 'retired') {
    const retired = await call('/functions/v1/public-review', owner.token, {});
    assert.equal(retired.status, 410);
    assert.equal(retired.data?.error?.code, 'review_retired');
    console.log('PASS hosted public review returns410/review_retired');
  } else if (process.argv[2] === 'status') {
    const profile = success(await call(`/rest/v1/profiles?user_id=eq.${owner.uid}&select=consent_version,speech_sharing,deletion_due_at,deletion_purged_at`, owner.token), 'post-purge profile')[0];
    success(await call('/auth/v1/user', owner.token), 'post-purge private identity');
    assert.ok(profile.deletion_purged_at);
    assert.equal(profile.consent_version, null);
    assert.equal(profile.speech_sharing, false);
    const credits = success(await call(`/rest/v1/earned_entitlements?user_id=eq.${owner.uid}&select=lifetime_credits`, owner.token), 'post-purge credits')[0];
    assert.equal(credits.lifetime_credits, 17);
    console.log(JSON.stringify({ owner: owner.uid, profile, credits }));
  } else throw new Error('Expected create/capture/delete/status');
}
