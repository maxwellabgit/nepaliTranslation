import { contributionSubmitSchema } from "../_shared/schemas.ts";
import {
  bearerToken,
  errorResponse,
  json,
  mapRpcError,
  requestIdFrom,
  statusForError,
} from "../_shared/http.ts";

/**
 * Thin Edge wrapper around service_submit_contribution_atomic.
 * All consensus / reward mutations happen inside one DB transaction.
 * Never logs raw response text.
 */
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

  const parsed = contributionSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_payload", 400, requestId);
  const body = parsed.data;

  const res = await fetch(`${url}/rest/v1/rpc/service_submit_contribution_atomic`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${service}`,
      apikey: service,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: user.id,
      p_assignment_id: body.assignment_id,
      p_action: body.action,
      p_response_text: body.response_text ?? null,
      p_idempotency_key: body.idempotency_key,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const code = mapRpcError(errText) ?? "unavailable";
    return errorResponse(code, statusForError(code), requestId);
  }

  const payload = await res.json() as {
    receipt_id?: string;
    status?: string;
    reward_label?: string;
    reward?: null;
  };

  // Identical client envelope for every outcome — no known/unknown leak.
  return json({
    receipt_id: payload.receipt_id ?? null,
    status: payload.status ?? "received",
    reward_label: payload.reward_label ?? "Earn 1–6 credits after validation",
    reward: null,
  }, 200, requestId);
});
