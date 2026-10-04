// Production project, synthetic engineering data only. Uses public client config;
// never extracts operator/service credentials. Run each stage deliberately.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const url = 'https://jcrpxoojxixoieqqfgzo.supabase.co';
const key = process.env.BOLA_PROOF_PUBLIC_KEY;
assert.ok(key?.startsWith('sb_publishable_'), 'public client key required');
const statePath = join(tmpdir(), 'bola-hosted-media-proof.private.json');
const stage = process.argv[2];
async function call(path, token, body) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: key, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, ok: response.ok, data: await response.json().catch(() => null) };
}
function ok(result, label) {
  assert.equal(result.ok, true, `${label}: HTTP ${result.status}, ${result.data?.error?.code ?? 'unknown'}`);
  return result.data;
}
function save(state) { writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 }); }
async function storageNotFound(response, label) {
  const data = await response.json().catch(() => null);
  assert.ok([400, 404].includes(response.status), `${label}: unexpected HTTP ${response.status}`);
  assert.equal(String(data?.statusCode), '404', `${label}: must be an object-not-found response, not a service/auth failure`);
  return { httpStatus: response.status, storageCode: data.statusCode };
}
if (stage === 'create') {
  const identities = [];
  for (let i = 0; i < 2; i++) {
    const data = ok(await call('/auth/v1/signup', null, { data: { engineering_proof: 'synthetic-media' } }), 'guest Auth');
    assert.equal(data.user.is_anonymous, true);
    identities.push({ uid: data.user.id, token: data.access_token });
  }
  const state = { identities, nonce: randomUUID() };
  save(state);
  console.log(JSON.stringify({ proof: 'synthetic guest identities created', owner: identities[0].uid }));
} else {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const [owner, other] = state.identities;
  if (stage === 'capture') {
    const cfg = ok(await call('/rest/v1/app_config?select=startup_consent_version,contribution_consent_version,contribution_text_enabled,contribution_speech_enabled,contribution_photos_enabled,public_review_enabled', owner.token), 'config')[0];
    assert.equal(cfg.contribution_text_enabled, true);
    assert.equal(cfg.contribution_speech_enabled, true);
    assert.equal(cfg.contribution_photos_enabled, false);
    assert.equal(cfg.public_review_enabled, false);
    ok(await call('/rest/v1/rpc/service_record_startup_consent', owner.token, { p_user_id: owner.uid, p_version: cfg.startup_consent_version, p_terms_accepted: true, p_privacy_accepted: true, p_age_confirmed: false }), 'synthetic terms');
    const report = { source_text: '[SYNTHETIC ENGINEERING TEST] hello', model_output: '[SYNTHETIC] namaste', correction_text: '[SYNTHETIC] corrected namaste', direction: 'en-ne', formality: 'formal', script: 'roman', surface: 'live_translate', consent_version: cfg.contribution_consent_version, idempotency_key: `${state.nonce}-typed`, metadata: { method: 'typed-feedback', feedback: 'down', feedbackRevision: 1, engineeringProof: true } };
    assert.equal((await call('/functions/v1/submit-translation-report', owner.token, report)).status, 403, 'terms alone deny collection');
    ok(await call('/functions/v1/record-consent', owner.token, { consent_version: cfg.contribution_consent_version, age_confirmed: true }), 'specific synthetic opt-in');
    const profilePath = `/rest/v1/profiles?user_id=eq.${owner.uid}&select=speech_sharing,consent_version,deletion_due_at,deletion_purged_at`;
    assert.equal(ok(await call(profilePath, owner.token), 'default speech')[0].speech_sharing, false);
    assert.equal(ok(await call(profilePath, other.token), 'cross-owner isolation').length, 0);
    const inserted = ok(await call('/functions/v1/submit-translation-report', owner.token, report), 'typed capture');
    const retry = await call('/functions/v1/submit-translation-report', owner.token, report);
    assert.equal(retry.status, 409); assert.equal(retry.data.report_id, inserted.report_id);
    state.reportIds = [inserted.report_id];
    state.report = report; save(state);
    for (const revision of [1, 2]) {
      const result = ok(await call('/functions/v1/submit-translation-report', owner.token, { ...report, correction_text: `[SYNTHETIC] review answer revision ${revision}`, idempotency_key: `${state.nonce}-review-${revision}`, metadata: { method: 'todays_10', source_item_id: 'synthetic-meaning', revision, answer: `[SYNTHETIC] review answer revision ${revision}`, engineeringProof: true } }), 'review answer');
      state.reportIds.push(result.report_id);
      save(state);
    }
    const wav = Buffer.alloc(16044);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
    const mediaBody = { kind: 'speech', idempotency_key: `${state.nonce}-speech`, content_type: 'audio/wav', byte_size: wav.length, metadata: { utteranceId: `synthetic-${state.nonce}`, transcript: '[SYNTHETIC] transcript', feedback: 'down', feedbackRevision: 1, durationMs: 1000, engineeringProof: true } };
    assert.equal((await call('/functions/v1/create-media-upload', owner.token, mediaBody)).status, 403, 'default-off speech denies upload');
    ok(await call('/rest/v1/rpc/service_set_sharing_toggles', owner.token, { p_user_id: owner.uid, p_speech: true, p_photos: false }), 'explicit synthetic speech choice');
    const media = ok(await call('/functions/v1/create-media-upload', owner.token, mediaBody), 'private upload URL');
    state.media = { id: media.media_id, path: media.object_path, bytes: wav.length, sha256: createHash('sha256').update(wav).digest('hex') }; save(state);
    const signed = new URL(media.upload_url);
    assert.equal(signed.hostname, new URL(url).hostname, 'upload stays on named project');
    const uploaded = await fetch(signed, { method: 'PUT', headers: { 'content-type': 'audio/wav', authorization: `Bearer ${media.token}`, 'x-upsert': 'true' }, body: wav });
    assert.equal(uploaded.ok, true, 'nonempty private object upload');
    ok(await call('/functions/v1/complete-media-upload', owner.token, { media_id: media.media_id }), 'completed media record');
    const ownObject = await fetch(`${url}/storage/v1/object/authenticated/contribution-speech/${media.object_path}`, { headers: { apikey: key, authorization: `Bearer ${owner.token}` } });
    assert.equal(ownObject.ok, true, 'owner can retrieve private binary');
    assert.deepEqual(Buffer.from(await ownObject.arrayBuffer()), wav, 'byte-exact private binary');
    const crossObject = await fetch(`${url}/storage/v1/object/authenticated/contribution-speech/${media.object_path}`, { headers: { apikey: key, authorization: `Bearer ${other.token}` } });
    const crossOwnerStorage = await storageNotFound(crossObject, 'other guest cannot discover/read binary');
    const deniedAdmin = await call('/functions/v1/admin-api/contributions', owner.token);
    assert.ok([401, 403].includes(deniedAdmin.status), 'guest cannot read operator data');
    state.report = report; state.media = { id: media.media_id, path: media.object_path, bytes: wav.length, sha256: createHash('sha256').update(wav).digest('hex') };
    save(state);
    console.log(JSON.stringify({ proof: 'terms-only denial, current consent, speech default-off denial, typed idempotency, two immutable review revisions, byte-exact private speech and cross-owner denial', owner: owner.uid, reportIds: state.reportIds, media: state.media, crossOwnerStorage, guestAdminStatus: deniedAdmin.status }));
  } else if (stage === 'delete') {
    const before = ok(await call(`/rest/v1/earned_entitlements?user_id=eq.${owner.uid}&select=lifetime_credits`, owner.token), 'pre-delete credits');
    const requested = ok(await call('/functions/v1/delete-data', owner.token, {}), 'shared deletion');
    const repeat = ok(await call('/functions/v1/delete-data', owner.token, {}), 'deletion retry');
    assert.equal(requested.deletion_due_at, repeat.deletion_due_at);
    assert.equal(requested.deleted, false); assert.equal(requested.scheduled, true);
    assert.equal((await call('/functions/v1/submit-translation-report', owner.token, { ...state.report, idempotency_key: `${state.nonce}-after-delete` })).status, 403);
    state.deletion = requested; state.credits = before; save(state);
    console.log(JSON.stringify({ proof: 'withdrawal denies upload and preserves original deletion deadline', owner: owner.uid, deletion: requested }));
  } else if (stage === 'status') {
    const profile = ok(await call(`/rest/v1/profiles?user_id=eq.${owner.uid}&select=consent_version,speech_sharing,deletion_due_at,deletion_purged_at`, owner.token), 'purge status')[0];
    assert.ok(profile.deletion_purged_at, 'worker purge not yet complete');
    assert.equal(profile.consent_version, null); assert.equal(profile.speech_sharing, false);
    const privateIdentity = ok(await call('/auth/v1/user', owner.token), 'identity preserved'); assert.equal(privateIdentity.id, owner.uid);
    assert.deepEqual(ok(await call(`/rest/v1/earned_entitlements?user_id=eq.${owner.uid}&select=lifetime_credits`, owner.token), 'credits preserved'), state.credits);
    // A fresh URL avoids confusing a cached successful owner read with the
    // authoritative post-deletion object lookup.
    const object = await fetch(`${url}/storage/v1/object/authenticated/contribution-speech/${state.media.path}?proof=${randomUUID()}`, { cache: 'no-store', headers: { apikey: key, authorization: `Bearer ${owner.token}`, 'cache-control': 'no-cache' } });
    const removedStorage = await storageNotFound(object, 'deleted binary');
    console.log(JSON.stringify({ proof: 'purge complete, binary not found, guest and credits preserved', owner: owner.uid, profile, mediaId: state.media.id, removedStorage }));
  } else if (stage === 'cleanup') { unlinkSync(statePath); console.log('Temporary synthetic guest credentials removed.'); }
  else throw Error('create/capture/delete/status/cleanup required');
}
