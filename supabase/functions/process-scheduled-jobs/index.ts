import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";
import {
  executeDeletionRequest,
  type DueDeletionRequest,
} from "../_shared/deletionExecutor.ts";

/**
 * Cron-invoked worker: NY reward close + overdue deletion purges + auth removal.
 * Requires CRON_SECRET bearer (service role also accepted for local ops).
 */
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);

  const cronSecret = Deno.env.get("CRON_SECRET");
  const token = bearerToken(req);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // Storage and Auth admin reject the newer non-JWT secret key. The legacy
  // service-role JWT still works for those APIs and for PostgREST.
  const deletionService = Deno.env.get("STORAGE_SERVICE_ROLE_KEY") ?? service;
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !service) return errorResponse("unavailable", 503, requestId);

  const authorized =
    (cronSecret && token === cronSecret) ||
    (service && token === service);
  if (!authorized) return errorResponse("unauthorized", 401, requestId);

  const headers = {
    authorization: `Bearer ${service}`,
    apikey: service,
    "content-type": "application/json",
  };

  const closeRes = await fetch(`${url}/rest/v1/rpc/service_close_ny_reward_window`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_as_of: new Date().toISOString() }),
  });
  if (!closeRes.ok) return errorResponse("unavailable", 503, requestId);
  const closeBody = await closeRes.json() as Record<string, unknown>;

  const dueRes = await fetch(`${url}/rest/v1/rpc/service_list_due_deletion_requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_limit: 50 }),
  });
  if (!dueRes.ok) return errorResponse("unavailable", 503, requestId);
  const dueRequests = await dueRes.json() as DueDeletionRequest[];

  const deletionResults = [];
  for (const row of dueRequests) {
    if (!row?.id || !row.user_id || !row.request_kind) continue;
    deletionResults.push(await executeDeletionRequest(row, { url, service: deletionService }));
  }

  return json(
    {
      ok: true,
      reward_close: closeBody,
      deletion_results: deletionResults,
    },
    200,
    requestId,
  );
});
