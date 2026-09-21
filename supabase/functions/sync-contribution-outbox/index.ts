import { translationReportBatchSchema } from "../_shared/schemas.ts";
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

  const parsed = translationReportBatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_payload", 400, requestId);

  // Fail the whole batch if consent is absent/outdated (server-authoritative).
  const consentRes = await fetch(`${url}/rest/v1/rpc/service_assert_contribution_consent`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${service}`,
      apikey: service,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_user_id: user.id }),
  });
  if (!consentRes.ok) {
    const errText = await consentRes.text();
    const code = mapRpcError(errText) ?? "unavailable";
    return errorResponse(code, statusForError(code), requestId);
  }

  const synced: string[] = [];
  const failed: Array<{ idempotency_key: string; reason: string }> = [];

  for (const body of parsed.data.items) {
    try {
      const insert = await fetch(`${url}/rest/v1/rpc/service_insert_translation_report`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${service}`,
          apikey: service,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_reporter_id: user.id,
          p_source_text: body.source_text,
          p_model_output: body.model_output,
          p_correction_text: body.correction_text ?? null,
          p_direction: body.direction,
          p_formality: body.formality,
          p_script: body.script,
          p_surface: body.surface,
          p_idempotency_key: body.idempotency_key,
          p_consent_version: body.consent_version,
          p_metadata: body.metadata ?? {},
        }),
      });
      if (!insert.ok) {
        const errText = await insert.text();
        const code = mapRpcError(errText) ?? "unavailable";
        failed.push({ idempotency_key: body.idempotency_key, reason: code });
        continue;
      }
      synced.push(body.idempotency_key);
    } catch {
      failed.push({ idempotency_key: body.idempotency_key, reason: "unavailable" });
    }
  }

  return json({ synced, failed }, 200, requestId);
});
