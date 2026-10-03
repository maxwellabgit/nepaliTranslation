#!/usr/bin/env node
// Local ephemeral Supabase only. Real Auth, Edge, Storage and browser export.
// Never run against production; no real user content, screenshots or recordings.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('../testing-ground/node_modules/@playwright/test');
const settingsProcess = spawnSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8' });
assert.equal(settingsProcess.status, 0, 'local Supabase must be running');
const config = JSON.parse(settingsProcess.stdout);
const url = config.API_URL; const publicKey = config.ANON_KEY; const service = config.SERVICE_ROLE_KEY;
assert.equal(new URL(url).hostname, '127.0.0.1', 'proof is restricted to local Supabase');
assert.ok(publicKey && service);
function sql(input) {
  const r = spawnSync('docker', ['exec', '-i', 'supabase_db_neptranslate', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8' });
  assert.equal(r.status, 0, 'local fixture SQL failed'); return r.stdout.trim();
}
async function call(path, token, body) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: publicKey, authorization: `Bearer ${token ?? publicKey}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { response, data: await response.json().catch(() => null) };
}
function ok(result, label) { assert.equal(result.response.ok, true, `${label}: HTTP ${result.response.status}`); return result.data; }
async function ready(target, expectedStatus = 200) {
  for (let i=0; i<80; i++) {
    try { const r = await fetch(target); if (r.status === expectedStatus) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('local proof service did not start');
}
const edge = spawn('supabase', ['functions', 'serve', '--no-verify-jwt'], { stdio: 'ignore' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
  cwd: 'admin', stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: publicKey },
});
let browser;
try {
  // Kong can reject unauthenticated admin requests before the Edge worker starts.
  // A method rejection from each handler proves its actual worker is ready.
  for (const name of ['submit-translation-report', 'create-media-upload', 'complete-media-upload', 'delete-data', 'process-scheduled-jobs']) {
    await ready(url + `/functions/v1/${name}`, 405);
  }
  await ready('http://127.0.0.1:5174');
  const owner = ok(await call('/auth/v1/signup', null, { data: {} }), 'real guest signup');
  assert.equal(owner.user.is_anonymous, true);
  const uid = owner.user.id; const token = owner.access_token;
  assert.match(uid, /^[a-f0-9-]{36}$/);
  const versions = ok(await call('/rest/v1/app_config?select=startup_consent_version,contribution_consent_version', token), 'versions')[0];
  ok(await call('/rest/v1/rpc/service_record_startup_consent', token, { p_user_id: uid, p_version: versions.startup_consent_version,
    p_terms_accepted: true, p_privacy_accepted: true, p_age_confirmed: false }), 'general acceptance');
  ok(await call('/rest/v1/rpc/service_record_consent', token, { p_user_id: uid, p_version: versions.contribution_consent_version, p_age_confirmed: true }), 'separate synthetic consent');
  // These settings and seeded operator exist only in this disposable local DB.
  sql(`update public.app_config set contribution_text_enabled=true, contribution_speech_enabled=true where id=1;
    update public.profiles set speech_sharing=true where user_id='${uid}';
    insert into private.admin_users(user_id,role) values('11111111-1111-4111-8111-111111111111','ops') on conflict(user_id) do update set revoked_at=null;`);
  const report = { source_text: '[SYNTHETIC] original', model_output: '[SYNTHETIC] translation', correction_text: '[SYNTHETIC] typed correction',
    direction: 'en-ne', formality: 'formal', script: 'roman', surface: 'live_translate', consent_version: versions.contribution_consent_version,
    idempotency_key: randomUUID(), metadata: { method: 'typed-feedback', rating: 'down', engineeringProof: true } };
  ok(await call('/functions/v1/submit-translation-report', token, report), 'typed capture');
  for (const revision of [1,2]) ok(await call('/functions/v1/submit-translation-report', token, { ...report,
    correction_text: `synthetic answer revision ${revision}`, idempotency_key: randomUUID(),
    metadata: { method: 'todays_10', source_item_id: 'synthetic-meaning', revision, answer: `synthetic answer revision ${revision}`, engineeringProof: true } }), 'actual review answer revision');
  // Valid one-second, nonempty PCM WAV; generated tone/silence, no human recording.
  const wav = Buffer.alloc(44 + 16000); wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24);
  wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(16000,40);
  const media = ok(await call('/functions/v1/create-media-upload', token, { kind:'speech', idempotency_key:randomUUID(),
    content_type:'audio/wav',byte_size:wav.length,metadata:{utteranceId:'synthetic-utterance',transcript:'synthetic transcript',feedback:'down',feedbackRevision:1,durationMs:1000,engineeringProof:true} }), 'private signed upload');
  const signedUpload = new URL(media.upload_url);
  const upload = await fetch(new URL(signedUpload.pathname + signedUpload.search, url), { method:'PUT', headers:{'content-type':'audio/wav',authorization:`Bearer ${media.token}`,'x-upsert':'true'},body:wav });
  assert.equal(upload.ok,true,'nonempty binary storage upload');
  ok(await call('/functions/v1/complete-media-upload',token,{media_id:media.media_id}), 'media completion');
  assert.equal((await call('/functions/v1/admin-api/contributions', token)).response.status,403,'guest cannot retrieve admin data');
  assert.equal((await call('/functions/v1/admin-api/contributions/export', token, {})).response.status,403,'guest cannot export');

  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({acceptDownloads:true}); // no screenshot/video/trace
  const page = await context.newPage(); await page.goto('http://127.0.0.1:5174/contributions');
  await page.getByLabel('Email').fill('user-a@synthetic.test'); await page.getByLabel('Password').fill('synthetic-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Contributions',exact:true}).waitFor();
  await page.getByText('synthetic answer revision 1',{exact:false}).first().waitFor();
  await page.getByText('synthetic answer revision 2',{exact:false}).first().waitFor();
  await page.getByRole('button',{name:'Listen to speech'}).click();
  await page.locator('audio').waitFor();
  const preview = await fetch(await page.locator('audio').getAttribute('src'));
  assert.equal(preview.ok, true, 'signed private audio preview accessible from public origin');
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), wav, 'preview retains actual nonempty binary bytes');
  await page.getByRole('button',{name:'Download this page as JSON'}).waitFor({state:'visible'});
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button',{name:'Download this page as JSON'}).click();
  const download = await downloadPromise; const chunks=[];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());
  const owned=exported.records.filter(r=>r.owner_id===uid);
  assert.equal(owned.length,4); assert.equal(owned.filter(r=>r.metadata.method==='todays_10').length,2);
  assert.equal(owned.every(r=>r.training_eligible===false&&r.public_display_eligible===false),true);
  assert.ok(owned.some(r=>r.metadata.utteranceId==='synthetic-utterance'&&r.metadata.transcript==='synthetic transcript'));
  const request=ok(await call('/functions/v1/delete-data',token,{}),'owner shared deletion');
  assert.equal(request.scheduled,true); assert.equal(request.deleted,false);
  await page.reload(); await page.getByText('0 records on this page.',{exact:false}).waitFor();
  const worker=ok(await call('/functions/v1/process-scheduled-jobs',service,{}),'storage-first purge');
  assert.ok(worker.deletion_results.some(r=>r.ok&&r.stage==='complete'));
  const profile=ok(await call(`/rest/v1/profiles?user_id=eq.${uid}&select=deletion_purged_at`,token),'preserved guest')[0];
  assert.ok(profile.deletion_purged_at);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='contribution-speech' and name='${media.object_path}';`),'0','nonempty object actually removed');
  assert.equal(sql(`select count(*) from private.translation_reports where reporter_id='${uid}';`),'0','reports removed');
  assert.equal(sql(`select count(*) from private.audit_log where actor_id='11111111-1111-4111-8111-111111111111' and action='admin_contribution_export';`) !== '0',true,'browser export audited');
  console.log('PASS local real guest typed + original/revised review + nonempty speech upload; admin JWT browser retrieval/JSON export; non-admin denial; withdrawal filtering; storage-first actual binary/report purge, guest preserved. No hosted/native/legal proof inferred.');
} finally {
  await browser?.close(); edge.kill(); vite.kill();
}
