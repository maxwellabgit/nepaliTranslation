import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";

/**
 * Authenticated: mint a one-time rewarded session token for SSV custom_data.
 * No client secret — token is server-owned.
 */
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") {
    return errorResponse("invalid_payload", 405, requestId);
  }

  const token = bearerToken(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!url || !anon || !service) {
    return errorResponse("unavailable", 503, requestId);
  }

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  const rpc = await fetch(
    `${url}/rest/v1/rpc/service_create_rewarded_session`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${service}`,
        apikey: service,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({
        p_user_id: user.id,
        p_ttl_seconds: 600,
      }),
    },
  );
  if (!rpc.ok) return errorResponse("unavailable", 503, requestId);
  const body = await rpc.json();
  return json(
    {
      session_token: body.session_token,
      expires_at: body.expires_at,
    },
    200,
    requestId,
  );
});
