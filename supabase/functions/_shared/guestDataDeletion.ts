import { bearerToken, errorResponse, json, mapRpcError, requestIdFrom, statusForError } from './http.ts';

/** A validated guest JWT owns this request; clients cannot choose another subject. */
export async function handleGuestDataDeletion(req: Request, deps: {
  url?: string; anonKey?: string; fetchImpl?: typeof fetch;
}): Promise<Response> {
  const requestId = requestIdFrom(req);
  if (req.method !== 'POST') return errorResponse('invalid_payload', 405, requestId);
  const token = bearerToken(req);
  if (!token) return errorResponse('unauthorized', 401, requestId);
  if (!deps.url || !deps.anonKey) return errorResponse('unavailable', 503, requestId);
  const payload: unknown = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 0) {
    return errorResponse('invalid_payload', 400, requestId);
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${token}`, apikey: deps.anonKey, 'content-type': 'application/json' };
  try {
    const userRes = await fetchImpl(`${deps.url}/auth/v1/user`, { headers });
    if (!userRes.ok) return errorResponse('unauthorized', 401, requestId);
    const user = await userRes.json() as { id?: unknown };
    if (typeof user.id !== 'string' || !user.id) return errorResponse('unauthorized', 401, requestId);
    // RPC derives auth.uid() again. The public key alone is never authorization.
    const res = await fetchImpl(`${deps.url}/rest/v1/rpc/request_shared_data_deletion`, {
      method: 'POST', headers, body: '{}',
    });
    if (!res.ok) {
      const code = mapRpcError(await res.text()) ?? 'unavailable';
      return errorResponse(code, statusForError(code), requestId);
    }
    const result = await res.json() as { scheduled?: unknown; deletion_due_at?: unknown };
    if (result.scheduled !== true || typeof result.deletion_due_at !== 'string' || !Number.isFinite(Date.parse(result.deletion_due_at))) {
      return errorResponse('unavailable', 503, requestId);
    }
    return json({ deleted: false, scheduled: true, deletion_due_at: result.deletion_due_at, scope: 'contributions' }, 200, requestId);
  } catch { return errorResponse('unavailable', 503, requestId); }
}
