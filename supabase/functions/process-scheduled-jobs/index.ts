import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";
import { purgeUserStorageObjects } from "../_shared/storagePurge.ts";

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

  const dueRes = await fetch(`${url}/rest/v1/rpc/service_list_deletion_due_users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_limit: 50 }),
  });
  if (!dueRes.ok) return errorResponse("unavailable", 503, requestId);
  const dueUsers = await dueRes.json() as Array<{ user_id?: string }>;

  const authDeleted: string[] = [];
  for (const row of dueUsers) {
    const userId = row.user_id;
    if (!userId) continue;

    await purgeUserStorageObjects(userId, { url, service });

    const purgeRes = await fetch(`${url}/rest/v1/rpc/service_purge_scheduled_deletion`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!purgeRes.ok) continue;
    const purgeBody = await purgeRes.json() as { purged?: boolean };
    if (!purgeBody.purged) continue;

    const authRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${service}`,
        apikey: service,
      },
    });
    if (authRes.ok) authDeleted.push(userId);
  }

  return json(
    {
      ok: true,
      reward_close: closeBody,
      deletion_auth_removed: authDeleted.length,
    },
    200,
    requestId,
  );
});
