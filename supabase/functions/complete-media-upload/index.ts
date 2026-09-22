import { z } from "npm:zod@3.24.2";
import {
  bearerToken,
  errorResponse,
  json,
  mapRpcError,
  requestIdFrom,
  statusForError,
} from "../_shared/http.ts";

const bodySchema = z.object({
  media_id: z.string().uuid(),
  sha256: z.string().min(8).max(128).optional().nullable(),
});

const SERVICE_HEADERS = (service: string) => ({
  authorization: `Bearer ${service}`,
  apikey: service,
  "content-type": "application/json",
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

  const complete = await fetch(`${url}/rest/v1/rpc/service_complete_media_upload`, {
    method: "POST",
    headers: SERVICE_HEADERS(service),
    body: JSON.stringify({
      p_user_id: user.id,
      p_media_id: parsed.data.media_id,
      p_sha256: parsed.data.sha256 ?? null,
    }),
  });
  if (!complete.ok) {
    const errText = await complete.text();
    const code = mapRpcError(errText) ?? "unavailable";
    return errorResponse(code, statusForError(code), requestId);
  }

  const rows = await complete.json() as Array<{
    media_id: string;
    status: string;
    object_path: string;
  }>;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.media_id) return errorResponse("unavailable", 503, requestId);

  return json(
    {
      media_id: row.media_id,
      status: row.status,
      object_path: row.object_path,
    },
    200,
    requestId,
  );
});
