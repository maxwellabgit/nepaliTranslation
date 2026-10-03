#!/usr/bin/env node
/** Real local Auth + RLS smoke: no simulated guest JWT and no service-key writes. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const status = spawnSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8' });
assert.equal(status.status, 0, 'local Supabase must be running');
const settings = JSON.parse(status.stdout);
const url = settings.API_URL ?? settings.api_url;
const anonKey = settings.ANON_KEY ?? settings.anon_key;
assert.ok(url && anonKey, 'local public configuration required');
// Credentials and payloads never enter console output.
async function call(path, token = anonKey, body) {
  return fetch(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: {
    apikey: anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json',
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const created = await call('/auth/v1/signup', anonKey, { data: {} });
assert.equal(created.status, 200, 'anonymous signup must be enabled');
const identity = await created.json();
assert.equal(identity.user?.is_anonymous, true, 'Auth must issue an authenticated guest');
assert.ok(identity.access_token && identity.user.id);
const claims = JSON.parse(Buffer.from(identity.access_token.split('.')[1], 'base64url').toString());
assert.equal(claims.role, 'authenticated');
assert.equal(claims.is_anonymous, true);
const token = identity.access_token;
const uid = identity.user.id;
const config = await (await call('/rest/v1/app_config?select=startup_consent_version,contribution_consent_version', token)).json();
assert.equal(config[0].contribution_consent_version, '2026-10-02.guest');
const startup = await call('/rest/v1/rpc/service_record_startup_consent', token, {
  p_user_id: uid, p_version: config[0].startup_consent_version,
  p_terms_accepted: true, p_privacy_accepted: true, p_age_confirmed: false,
});
assert.equal(startup.ok, true, 'guest records general terms without 18+');
const profilePath = `/rest/v1/profiles?user_id=eq.${uid}&select=consent_version,speech_sharing,age_confirmed_at`;
let profile = await (await call(profilePath, token)).json();
assert.equal(profile[0].consent_version, null, 'terms do not consent to sharing');
assert.equal(profile[0].speech_sharing, false);
const rejected = await call('/rest/v1/rpc/service_record_consent', token, {
  p_user_id: '11111111-1111-4111-8111-111111111111', p_version: config[0].contribution_consent_version, p_age_confirmed: true,
});
assert.equal(rejected.status, 403, 'guest cannot consent for a different identity');
const consent = await call('/rest/v1/rpc/service_record_consent', token, {
  p_user_id: uid, p_version: config[0].contribution_consent_version, p_age_confirmed: true,
});
assert.equal(consent.ok, true, 'explicit guest contribution consent works');
profile = await (await call(profilePath, token)).json();
assert.equal(profile[0].consent_version, config[0].contribution_consent_version);
assert.equal(profile[0].speech_sharing, false, 'raw audio needs another explicit toggle');
const unauthorized = await call('/rest/v1/rpc/request_shared_data_deletion', anonKey, {});
assert.equal(unauthorized.ok, false, 'public key alone cannot delete guest data');
const deletion = await call('/rest/v1/rpc/request_shared_data_deletion', token, {});
assert.equal(deletion.ok, true, 'guest can delete shared data without OAuth');
const receipt = await deletion.json();
assert.equal(receipt.scheduled, true);
assert.ok(Number.isFinite(Date.parse(receipt.deletion_due_at)));
const repeated = await (await call('/rest/v1/rpc/request_shared_data_deletion', token, {})).json();
assert.equal(repeated.deletion_due_at, receipt.deletion_due_at, 'retry preserves deadline');
profile = await (await call(profilePath, token)).json();
assert.equal(profile[0].consent_version, null);
assert.equal(profile[0].speech_sharing, false);
const current = await call('/auth/v1/user', token);
assert.equal(current.ok, true, 'deletion preserves private identity for status and credits');
console.log('PASS real anonymous Auth, subject RLS, separate consent, default-off speech and durable shared-data deletion');
