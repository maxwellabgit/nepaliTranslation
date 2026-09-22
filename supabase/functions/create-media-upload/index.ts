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
  kind: z.enum(["speech", "photo"]),
  idempotency_key: z.string().min(8).max(128),
  content_type: z.string().min(3).max(120),
  byte_size: z.number().int().positive().max(26_214_400),
  metadata: z.record(z.unknown()).optional(),
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
  const body = parsed.data;

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
  const user = await userRes.json() as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  const register = await fetch(`${url}/rest/v1/rpc/service_register_media_upload`, {
    method: "POST",
    headers: SERVICE_HEADERS(service),
    body: JSON.stringify({
      p_user_id: user.id,
      p_kind: body.kind,
      p_idempotency_key: body.idempotency_key,
      p_content_type: body.content_type,
      p_byte_size: body.byte_size,
      p_metadata: body.metadata ?? {},
    }),
  });
  if (!register.ok) {
    const errText = await register.text();
    const code = mapRpcError(errText) ?? "unavailable";
    return errorResponse(code, statusForError(code), requestId);
  }

  const rows = await register.json() as Array<{
    media_id: string;
    bucket_id: string;
    object_path: string;
    status: string;
    inserted: boolean;
  }>;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.media_id || !row.bucket_id || !row.object_path) {
    return errorResponse("unavailable", 503, requestId);
  }

  // Already uploaded — client should skip PUT and call complete (idempotent).
  if (row.status === "uploaded") {
    return json(
      {
        media_id: row.media_id,
        bucket_id: row.bucket_id,
        object_path: row.object_path,
        status: row.status,
        inserted: row.inserted,
        upload_url: null,
        token: null,
      },
      200,
      requestId,
    );
  }

  const signRes = await fetch(
    `${url}/storage/v1/object/upload/sign/${row.bucket_id}/${row.object_path}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${service}`,
        apikey: service,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  if (!signRes.ok) {
    return errorResponse("unavailable", 503, requestId);
  }
  const signed = await signRes.json() as {
    url?: string;
    token?: string;
    signedUrl?: string;
  };
  const relative = signed.url ?? signed.signedUrl;
  if (!relative || !signed.token) {
    return errorResponse("unavailable", 503, requestId);
  }
  const uploadUrl = relative.startsWith("http")
    ? relative
    : `${url}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;

  return json(
    {
      media_id: row.media_id,
      bucket_id: row.bucket_id,
      object_path: row.object_path,
      status: row.status,
      inserted: row.inserted,
      upload_url: uploadUrl,
      token: signed.token,
    },
    row.inserted ? 200 : 200,
    requestId,
  );
});
