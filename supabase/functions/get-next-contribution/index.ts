import { toPublicContribution } from "../_shared/scoring.ts";
import {
  bearerToken,
  errorResponse,
  json,
  mapRpcError,
  requestIdFrom,
  statusForError,
} from "../_shared/http.ts";

Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);
  const token = bearerToken(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!url || !anon || !service) return errorResponse("unavailable", 503, requestId);

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
  const user = await userRes.json() as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  const leaseRes = await fetch(`${url}/rest/v1/rpc/service_lease_contribution_task`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${service}`,
      apikey: service,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_user_id: user.id }),
  });
  if (!leaseRes.ok) {
    const errText = await leaseRes.text();
    const code = mapRpcError(errText) ?? "unavailable";
    return errorResponse(code, statusForError(code), requestId);
  }
  const payload = await leaseRes.json() as Record<string, unknown> | null;
  if (!payload || payload.assignment === null) {
    return json({ assignment: null }, 200, requestId);
  }
  return json({ assignment: toPublicContribution(payload) }, 200, requestId);
});
