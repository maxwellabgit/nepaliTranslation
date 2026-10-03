import { assertEquals } from 'jsr:@std/assert@1';
import { handleGuestDataDeletion } from '../_shared/guestDataDeletion.ts';

const deps = { url: 'https://local.example', anonKey: 'public-key' };
const request = (body = '{}', token = 'guest-jwt') => new Request('https://local.example/delete-data', {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body,
});

Deno.test('guest data deletion requires a real JWT and rejects a chosen subject', async () => {
  let calls = 0;
  const fetchImpl = (() => { calls++; return Promise.resolve(new Response('{}')); }) as typeof fetch;
  assertEquals((await handleGuestDataDeletion(new Request('https://local.example', { method: 'POST', body: '{}' }), { ...deps, fetchImpl })).status, 401);
  assertEquals((await handleGuestDataDeletion(request('{"user_id":"other"}'), { ...deps, fetchImpl })).status, 400);
  assertEquals(calls, 0);
});

Deno.test('guest data deletion validates token with Auth before issuing a subject-free RPC', async () => {
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  const fetchImpl = (async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers), body: init?.body });
    return new Response(JSON.stringify(calls.length === 1 ? { id: 'guest', is_anonymous: true } : {
      scheduled: true, deletion_due_at: '2026-11-01T00:00:00Z',
    }), { status: 200 });
  }) as typeof fetch;
  const response = await handleGuestDataDeletion(request(), { ...deps, fetchImpl });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { deleted: false, scheduled: true, deletion_due_at: '2026-11-01T00:00:00Z', scope: 'contributions' });
  assertEquals(calls.map(c => c.url), ['https://local.example/auth/v1/user', 'https://local.example/rest/v1/rpc/request_shared_data_deletion']);
  assertEquals(calls[1].headers.get('authorization'), 'Bearer guest-jwt');
  assertEquals(calls[1].headers.get('apikey'), 'public-key');
  assertEquals(calls[1].body, '{}');
});

Deno.test('rejected identity never schedules deletion', async () => {
  let calls = 0;
  const fetchImpl = (() => { calls++; return Promise.resolve(new Response('{}', { status: 401 })); }) as typeof fetch;
  assertEquals((await handleGuestDataDeletion(request(), { ...deps, fetchImpl })).status, 401);
  assertEquals(calls, 1);
});

Deno.test('network failure and malformed deadlines remain retryable without claiming completion', async () => {
  const failing = (() => Promise.reject(new Error('offline'))) as typeof fetch;
  assertEquals((await handleGuestDataDeletion(request(), { ...deps, fetchImpl: failing })).status, 503);
  let calls = 0;
  const malformed = (() => Promise.resolve(new Response(JSON.stringify(++calls === 1 ? { id: 'guest' } : { scheduled: true, deletion_due_at: 'invalid' })))) as typeof fetch;
  assertEquals((await handleGuestDataDeletion(request(), { ...deps, fetchImpl: malformed })).status, 503);
});
