import {
  bearerToken,
  errorResponse,
  json,
  mapRpcError,
  requestIdFrom,
  statusForError,
} from "../_shared/http.ts";

/**
 * Authenticated sample-allotment receipt. This stores a count. It does not
 * grant credits, rotate a review window, or train a model.
 */
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);
  const token = bearerToken(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!url || !anon) return errorResponse("unavailable", 503, requestId);

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
  const user = await userRes.json() as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  const body = await req.json().catch(() => null) as {
    corpus_version?: string;
    allotted?: number;
    completed?: number;
    crossed_at?: string;
  } | null;
  if (!body?.corpus_version || !body.allotted || !body.completed || !body.crossed_at) {
    return errorResponse("invalid_payload", 400, requestId);
  }

  const saved = await fetch(`${url}/rest/v1/rpc/record_sample_progress`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      apikey: anon,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_corpus_version: body.corpus_version,
      p_allotted: body.allotted,
      p_completed: body.completed,
      p_crossed_at: body.crossed_at,
    }),
  });
  if (!saved.ok) {
    const errText = await saved.text();
    const code = mapRpcError(errText) ?? "unavailable";
    return errorResponse(code, statusForError(code), requestId);
  }
  return json({ ok: true, user_id: user.id, reward: null }, 200, requestId);
});
