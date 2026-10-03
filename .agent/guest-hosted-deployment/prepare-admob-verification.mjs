// Owner-authorized Google console verification only; no synthetic signature/grant.
// Emits a short-lived synthetic user/session pair, never an Auth JWT/service key.
import assert from 'node:assert/strict';
const url = 'https://jcrpxoojxixoieqqfgzo.supabase.co';
const publicKey = process.env.BOLA_ADMOB_PROOF_PUBLIC_KEY;
assert.ok(publicKey, 'BOLA_ADMOB_PROOF_PUBLIC_KEY is required (public client key only)');
async function post(path, body, bearer) {
  const r = await fetch(url + path, { method: 'POST', headers: {
    apikey: publicKey, 'content-type': 'application/json',
    ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
  }, body: JSON.stringify(body) });
  assert.equal(r.ok, true, `${path}: HTTP ${r.status}`);
  return r.json();
}
const guest = await post('/auth/v1/signup', { data: {} });
assert.equal(guest.user?.is_anonymous, true);
assert.ok(guest.access_token);
const session = await post('/functions/v1/create-rewarded-session', {}, guest.access_token);
assert.match(session.session_token, /^[a-f0-9]{48}$/);
assert.ok(Date.parse(session.expires_at) > Date.now());
console.log(JSON.stringify({ user_id: guest.user.id, custom_data: session.session_token,
  expires_at: session.expires_at, purpose: 'AdMob signed console verification; synthetic guest only' }));
