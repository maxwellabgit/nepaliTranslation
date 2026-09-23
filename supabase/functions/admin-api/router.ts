/**
 * F7 admin-api router helpers (unit-testable without Deno.serve).
 * Service role is used only server-side after JWT admin assert.
 */

import {
  bearerToken,
  errorResponse,
  json,
  mapRpcError,
  requestIdFrom,
  statusForError,
  type ErrorCode,
} from "../_shared/http.ts";

export type AdminEnv = {
  url: string;
  anon: string;
  service: string;
  adminOrigin?: string;
};

export type RpcCaller = (
  name: string,
  body: Record<string, unknown>,
) => Promise<{ ok: boolean; status: number; json: unknown; text: string }>;

export type AuthUser = { id: string };

export type SignMediaFn = (
  bucket: string,
  path: string,
  expiresIn: number,
) => Promise<{ signedUrl: string | null; error?: string }>;

export function corsHeaders(origin: string | null, allowed?: string): HeadersInit {
  const headers: Record<string, string> = {
    "access-control-allow-headers":
      "authorization, content-type, x-request-id, apikey",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  };
  const allowList = parseAllowedOrigins(allowed);
  if (origin && allowList.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  return headers;
}

/** Soft local defaults when ADMIN_ORIGIN unset; otherwise comma-separated exact origins. */
export function parseAllowedOrigins(allowed?: string): string[] {
  if (allowed && allowed.trim().length > 0) {
    return allowed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

export function withCors(res: Response, origin: string | null, allowed?: string): Response {
  const extra = corsHeaders(origin, allowed);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

/** Path after /admin-api (supports /functions/v1/admin-api/...). */
export function routePath(pathname: string): string {
  const marker = "/admin-api";
  const idx = pathname.indexOf(marker);
  const rest = idx >= 0 ? pathname.slice(idx + marker.length) : pathname;
  const cleaned = rest.replace(/\/+$/, "") || "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

export async function resolveUser(
  token: string,
  env: AdminEnv,
): Promise<AuthUser | null> {
  const userRes = await fetch(`${env.url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: env.anon },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json() as { id?: string };
  if (!user.id) return null;
  return { id: user.id };
}

export function makeRpcCaller(env: AdminEnv): RpcCaller {
  return async (name, body) => {
    const res = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.service}`,
        apikey: env.service,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, json: parsed, text };
  };
}

export function makeSignMedia(env: AdminEnv): SignMediaFn {
  return async (bucket, path, expiresIn) => {
    const res = await fetch(
      `${env.url}/storage/v1/object/sign/${bucket}/${path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.service}`,
          apikey: env.service,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expiresIn }),
      },
    );
    if (!res.ok) {
      return { signedUrl: null, error: "sign_failed" };
    }
    const body = await res.json() as { signedURL?: string; signedUrl?: string };
    const relative = body.signedURL ?? body.signedUrl;
    if (!relative) return { signedUrl: null, error: "sign_failed" };
    const signedUrl = relative.startsWith("http")
      ? relative
      : `${env.url}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
    return { signedUrl };
  };
}

function rpcError(text: string, requestId: string): Response {
  const code: ErrorCode = mapRpcError(text) ?? "unavailable";
  return errorResponse(code, statusForError(code), requestId);
}

export type AdminDeps = {
  env: AdminEnv;
  rpc: RpcCaller;
  signMedia: SignMediaFn;
  resolveUser: (token: string) => Promise<AuthUser | null>;
};

export async function handleAdminRequest(
  req: Request,
  deps: AdminDeps,
): Promise<Response> {
  const requestId = requestIdFrom(req);
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), origin, deps.env.adminOrigin);
  }

  const token = bearerToken(req);
  if (!token) {
    return withCors(errorResponse("unauthorized", 401, requestId), origin, deps.env.adminOrigin);
  }

  const user = await deps.resolveUser(token);
  if (!user) {
    return withCors(errorResponse("unauthorized", 401, requestId), origin, deps.env.adminOrigin);
  }

  const asserted = await deps.rpc("service_assert_admin", { p_user_id: user.id });
  if (!asserted.ok) {
    const code = mapRpcError(asserted.text) ?? "forbidden";
    return withCors(
      errorResponse(code === "forbidden" ? "forbidden" : code, statusForError(code === "forbidden" ? "forbidden" : code), requestId),
      origin,
      deps.env.adminOrigin,
    );
  }

  const path = routePath(new URL(req.url).pathname);
  const method = req.method.toUpperCase();

  try {
    if (method === "GET" && path === "/dashboard") {
      const res = await deps.rpc("service_admin_dashboard_summary", {});
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "GET" && path === "/review") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const res = await deps.rpc("service_admin_list_review_queue", {
        p_limit: Number.isFinite(limit) ? limit : 50,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "POST" && (path === "/review/approve" || path === "/review/reject")) {
      const body = await req.json().catch(() => null) as {
        item_type?: string;
        item_id?: string;
        reason?: string;
      } | null;
      if (!body?.item_type || !body?.item_id) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const decision = path.endsWith("approve") ? "approve" : "reject";
      const res = await deps.rpc("service_admin_review_decide", {
        p_actor_id: user.id,
        p_item_type: body.item_type,
        p_item_id: body.item_id,
        p_decision: decision,
        p_reason: body.reason ?? null,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "GET" && path === "/alerts") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const res = await deps.rpc("service_admin_list_alerts", {
        p_limit: Number.isFinite(limit) ? limit : 50,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "GET" && path === "/deletions") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const res = await deps.rpc("service_admin_list_deletions", {
        p_limit: Number.isFinite(limit) ? limit : 50,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "GET" && path === "/flags") {
      const res = await deps.rpc("service_admin_get_flags", {});
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "PATCH" && path === "/flags") {
      const patch = await req.json().catch(() => null);
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_admin_patch_flags", {
        p_actor_id: user.id,
        p_patch: patch,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "POST" && path === "/dataset/export") {
      const body = await req.json().catch(() => null) as {
        version?: string;
        filter_manifest?: Record<string, unknown>;
        object_path?: string;
        row_count?: number;
        content_hash?: string;
      } | null;
      if (!body?.version || !body?.object_path) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_admin_stage_dataset_export", {
        p_actor_id: user.id,
        p_version: body.version,
        p_filter_manifest: body.filter_manifest ?? {},
        p_object_path: body.object_path,
        p_row_count: body.row_count ?? 0,
        p_content_hash: body.content_hash ?? "pending",
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "POST" && path === "/media/sign") {
      const body = await req.json().catch(() => null) as { media_id?: string } | null;
      if (!body?.media_id) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const preview = await deps.rpc("service_admin_media_preview", {
        p_actor_id: user.id,
        p_media_id: body.media_id,
      });
      if (!preview.ok) {
        return withCors(rpcError(preview.text, requestId), origin, deps.env.adminOrigin);
      }
      const meta = preview.json as {
        bucket_id?: string;
        object_path?: string;
        media_id?: string;
        content_type?: string;
        kind?: string;
      };
      if (!meta?.bucket_id || !meta?.object_path) {
        return withCors(errorResponse("unavailable", 503, requestId), origin, deps.env.adminOrigin);
      }
      const signed = await deps.signMedia(meta.bucket_id, meta.object_path, 120);
      if (!signed.signedUrl) {
        return withCors(errorResponse("unavailable", 503, requestId), origin, deps.env.adminOrigin);
      }
      return withCors(
        json(
          {
            media_id: meta.media_id,
            content_type: meta.content_type,
            kind: meta.kind,
            signed_url: signed.signedUrl,
            expires_in: 120,
          },
          200,
          requestId,
        ),
        origin,
        deps.env.adminOrigin,
      );
    }

    if (method === "POST" && path === "/public-review/unsatisfactory") {
      const body = await req.json().catch(() => null) as {
        submission_id?: string;
        reason?: string;
      } | null;
      if (!body?.submission_id || !body.reason) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_mark_review_unsatisfactory", {
        p_submission_id: body.submission_id,
        p_admin: user.id,
        p_reason: body.reason,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json ?? { ok: true }, 200, requestId), origin, deps.env.adminOrigin);
    }

    if (method === "POST" && path === "/public-review/quarantine") {
      const body = await req.json().catch(() => null) as {
        content_hash?: string;
        reason?: string;
      } | null;
      if (!body?.content_hash || !body.reason) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_add_review_exclusion", {
        p_content_hash: body.content_hash,
        p_reason: "admin_quarantine",
        p_source_lineage: "admin:public-review",
        p_actor_user_id: user.id,
        p_notes: body.reason,
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json({ ok: true }, 200, requestId), origin, deps.env.adminOrigin);
    }

    return withCors(errorResponse("not_found", 404, requestId), origin, deps.env.adminOrigin);
  } catch {
    return withCors(errorResponse("unavailable", 503, requestId), origin, deps.env.adminOrigin);
  }
}
