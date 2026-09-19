import { z } from "npm:zod@3.24.2";
import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";

const bodySchema = z.object({
  consent_version: z.string().min(4).max(80),
  age_confirmed: z.literal(true),
});

Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);
  const token = bearerToken(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!url || !anon || !service) return errorResponse("unavailable", 503, requestId);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_payload", 400, requestId);

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
  const user = await userRes.json() as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  const save = await fetch(`${url}/rest/v1/rpc/service_record_consent`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${service}`,
      apikey: service,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: user.id,
      p_version: parsed.data.consent_version,
      p_age_confirmed: true,
    }),
  });
  if (!save.ok) return errorResponse("unavailable", 503, requestId);
  return json({ saved: true, consent_version: parsed.data.consent_version }, 200, requestId);
});
