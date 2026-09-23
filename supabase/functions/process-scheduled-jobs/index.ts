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

  // R1: rotate the global public-review window. Closes the prior window,
  // grants credits (through private.apply_reward) for confirm/edit
  // submissions that were not marked unsatisfactory, quarantines any
  // reported items, and opens a new 10-item window at random from the
  // eligible pool. `p_as_of` is omitted so production uses `now()`.
  //
  // Failure modes surfaced to the caller (cron alerting depends on this):
  //   * HTTP failure from PostgREST     -> 502 rotate_failed
  //   * status === 'not_due'            -> job continues; monitoring counts
  //                                       these to verify the scheduler
  //                                       is alive between 5 PM ticks.
  //   * status === 'busy'               -> concurrent invocation; also OK.
  //   * status === 'ok_pool_short'      -> job continues but the response
  //                                       includes a warning so ops can
  //                                       see the pool ran short.
  const rotateRes = await fetch(`${url}/rest/v1/rpc/service_rotate_review_window`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_size: 10 }),
  });
  if (!rotateRes.ok) {
    return errorResponse("rotate_failed", 502, requestId);
  }
  const rotateBody = await rotateRes.json() as Record<string, unknown>;

  const lookaheadRes = await fetch(`${url}/rest/v1/rpc/service_plan_review_lookahead`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_horizon: 28, p_min_enable: 14 }),
  });
  if (!lookaheadRes.ok) return errorResponse("lookahead_failed", 502, requestId);
  const lookaheadBody = await lookaheadRes.json() as Record<string, unknown>;

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
    deletionResults.push(await executeDeletionRequest(row, { url, service }));
  }

  return json(
    {
      ok: true,
      reward_close: closeBody,
      review_rotation: rotateBody,
      review_lookahead: lookaheadBody,
      deletion_results: deletionResults,
    },
    200,
    requestId,
  );
});
