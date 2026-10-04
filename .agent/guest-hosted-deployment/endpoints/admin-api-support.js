// supabase/functions/_shared/http.ts
function json(body, status = 200, requestId) {
  const headers = {
    "content-type": "application/json; charset=utf-8"
  };
  if (requestId) headers["x-request-id"] = requestId;
  return new Response(JSON.stringify(body), { status, headers });
}
function errorBody(code, requestId) {
  return { error: { code, request_id: requestId } };
}
function errorResponse(code, status, requestId) {
  return json(errorBody(code, requestId), status, requestId);
}
function requestIdFrom(req) {
  const header = req.headers.get("x-request-id")?.trim();
  if (header && header.length <= 80) return header;
  return crypto.randomUUID();
}
function bearerToken(req) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}
function mapRpcError(errText) {
  const lower = errText.toLowerCase();
  if (lower.includes("consent_required")) return "consent_required";
  if (lower.includes("consent_outdated")) return "consent_outdated";
  if (lower.includes("age_required")) return "age_required";
  if (lower.includes("sharing_disabled")) return "sharing_disabled";
  if (lower.includes("flag_disabled")) return "flag_disabled";
  if (lower.includes("deletion_pending")) return "deletion_pending";
  if (lower.includes("rate_limited")) return "rate_limited";
  if (lower.includes("lease_expired")) return "lease_expired";
  if (lower.includes("sign_in_required")) return "sign_in_required";
  if (lower.includes("window_closed") || lower.includes("window_not_open")) return "window_closed";
  if (lower.includes("already_submitted") || lower.includes("23505")) return "already_submitted";
  if (lower.includes("not_found") || lower.includes("p0002")) return "not_found";
  if (lower.includes("invalid_payload") || lower.includes("edit_requires_text") || lower.includes("invalid_action") || lower.includes("22023")) return "invalid_payload";
  if (lower.includes("unauthorized") || lower.includes("28000")) return "unauthorized";
  if (lower.includes("forbidden") || lower.includes("42501")) return "forbidden";
  return null;
}
function statusForError(code) {
  switch (code) {
    case "unauthorized":
    case "sign_in_required":
      return 401;
    case "forbidden":
    case "consent_required":
    case "consent_outdated":
    case "age_required":
    case "flag_disabled":
    case "sharing_disabled":
    case "deletion_pending":
      return 403;
    case "invalid_payload":
      return 400;
    case "not_found":
    case "lease_expired":
      return 404;
    case "window_closed":
      return 409;
    case "already_submitted":
      return 409;
    case "rate_limited":
      return 429;
    case "deletion_incomplete":
      return 409;
    case "not_implemented":
      return 501;
    case "rotate_failed":
      return 502;
    default:
      return 503;
  }
}

// supabase/functions/admin-api/router.ts
function corsHeaders(origin, allowed) {
  const headers = {
    "access-control-allow-headers": "authorization, content-type, x-request-id, apikey",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS"
  };
  const allowList = parseAllowedOrigins(allowed);
  if (origin && allowList.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  return headers;
}
function parseAllowedOrigins(allowed) {
  if (allowed && allowed.trim().length > 0) {
    return allowed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"];
}
function withCors(res, origin, allowed) {
  const extra = corsHeaders(origin, allowed);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}
function routePath(pathname) {
  const marker = "/admin-api";
  const idx = pathname.indexOf(marker);
  const rest = idx >= 0 ? pathname.slice(idx + marker.length) : pathname;
  const cleaned = rest.replace(/\/+$/, "") || "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}
async function resolveUser(token, env) {
  const userRes = await fetch(`${env.url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: env.anon }
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user.id) return null;
  return { id: user.id };
}
function makeRpcCaller(env) {
  return async (name, body) => {
    const res = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.service}`,
        apikey: env.service,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, json: parsed, text };
  };
}
function makeSignMedia(env) {
  return async (bucket, path, expiresIn) => {
    const res = await fetch(
      `${env.url}/storage/v1/object/sign/${bucket}/${path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.service}`,
          apikey: env.service,
          "content-type": "application/json"
        },
        body: JSON.stringify({ expiresIn })
      }
    );
    if (!res.ok) {
      return { signedUrl: null, error: "sign_failed" };
    }
    const body = await res.json();
    const relative = body.signedURL ?? body.signedUrl;
    if (!relative) return { signedUrl: null, error: "sign_failed" };
    const signedUrl = relative.startsWith("http") ? relative : `${env.url}/storage/v1${relative.startsWith("/") ? "" : "/"}${relative}`;
    return { signedUrl };
  };
}
function rpcError(text, requestId) {
  const code = mapRpcError(text) ?? "unavailable";
  return errorResponse(code, statusForError(code), requestId);
}
async function handleAdminRequest(req, deps) {
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
      deps.env.adminOrigin
    );
  }
  const path = routePath(new URL(req.url).pathname);
  const method = req.method.toUpperCase();
  try {
    if (method === "GET" && path === "/support" || method === "POST" && path === "/support/reply") {
      const params = new URL(req.url).searchParams;
      const before = params.get("before");
      const beforeId = params.get("before_id");
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (Boolean(before) !== Boolean(beforeId) || before !== null && !Number.isFinite(Date.parse(before)) || beforeId !== null && !uuidPattern.test(beforeId)) return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      const body = method === "POST" ? await req.json().catch(() => null) : null;
      if (method === "POST" && (!body || typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) || typeof body.reply !== "string" || !body.reply.trim() || body.reply.trim().length > 2e3)) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const result = await deps.rpc("service_admin_support", { p_actor_id: user.id, p_id: body?.id ?? null, p_reply: body?.reply ?? null, p_before: before, p_before_id: beforeId });
      if (!result.ok) return withCors(rpcError(result.text, requestId), origin, deps.env.adminOrigin);
      const response = json(result.json, 200, requestId);
      response.headers.set("cache-control", "no-store");
      return withCors(response, origin, deps.env.adminOrigin);
    }
    if (method === "GET" && path === "/contributions" || method === "POST" && path === "/contributions/export") {
      const params = new URL(req.url).searchParams;
      const limit = Number(params.get("limit") ?? "50");
      const before = params.get("before");
      const beforeKey = params.get("before_key");
      if (!Number.isInteger(limit) || limit < 1 || limit > 200 || Boolean(before) !== Boolean(beforeKey) || before !== null && (!before || !Number.isFinite(Date.parse(before))) || beforeKey !== null && (!beforeKey || beforeKey.length > 80)) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_admin_contributions", {
        p_actor_id: user.id,
        p_limit: limit,
        p_before: before,
        p_before_key: beforeKey,
        p_export: method === "POST"
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      const response = json(res.json, 200, requestId);
      response.headers.set("cache-control", "no-store");
      return withCors(response, origin, deps.env.adminOrigin);
    }
    if (method === "GET" && path === "/dashboard") {
      const res = await deps.rpc("service_admin_dashboard_summary", {});
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }
    if (method === "GET" && path === "/review") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const res = await deps.rpc("service_admin_contributions", {
        p_actor_id: user.id,
        p_limit: Number.isInteger(limit) && limit > 0 && limit <= 200 ? limit : 50,
        p_before: null,
        p_before_key: null,
        p_export: false
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      const records = res.json?.records ?? [];
      const response = json({
        reports: records.filter((row) => row.record_type === "text").map((row) => ({
          ...row,
          item_type: "translation_report",
          source_preview: row.source,
          model_preview: row.result,
          correction_preview: row.correction
        })),
        media: records.filter((row) => row.record_type === "speech").map((row) => ({ ...row, item_type: "contribution_media", kind: "speech" }))
      }, 200, requestId);
      response.headers.set("cache-control", "no-store");
      return withCors(response, origin, deps.env.adminOrigin);
    }
    if (method === "POST" && (path === "/review/approve" || path === "/review/reject")) {
      const body = await req.json().catch(() => null);
      if (!body?.item_type || !body?.item_id) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const decision = path.endsWith("approve") ? "approve" : "reject";
      const res = await deps.rpc("service_admin_review_decide", {
        p_actor_id: user.id,
        p_item_type: body.item_type,
        p_item_id: body.item_id,
        p_decision: decision,
        p_reason: body.reason ?? null
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }
    if (method === "GET" && path === "/alerts") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const res = await deps.rpc("service_admin_list_alerts", {
        p_limit: Number.isFinite(limit) ? limit : 50
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }
    if (method === "GET" && path === "/deletions") {
      const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
      const res = await deps.rpc("service_admin_list_deletions", {
        p_limit: Number.isFinite(limit) ? limit : 50
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
        p_patch: patch
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }
    if (method === "POST" && path === "/dataset/export") {
      const body = await req.json().catch(() => null);
      if (!body?.version || !body?.object_path) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_admin_stage_dataset_export", {
        p_actor_id: user.id,
        p_version: body.version,
        p_filter_manifest: body.filter_manifest ?? {},
        p_object_path: body.object_path,
        p_row_count: body.row_count ?? 0,
        p_content_hash: body.content_hash ?? "pending"
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json, 200, requestId), origin, deps.env.adminOrigin);
    }
    if (method === "POST" && path === "/media/sign") {
      const body = await req.json().catch(() => null);
      if (!body?.media_id) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const preview = await deps.rpc("service_admin_media_preview", {
        p_actor_id: user.id,
        p_media_id: body.media_id
      });
      if (!preview.ok) {
        return withCors(rpcError(preview.text, requestId), origin, deps.env.adminOrigin);
      }
      const meta = preview.json;
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
            expires_in: 120
          },
          200,
          requestId
        ),
        origin,
        deps.env.adminOrigin
      );
    }
    if (method === "POST" && path === "/public-review/unsatisfactory") {
      const body = await req.json().catch(() => null);
      if (!body?.submission_id || !body.reason) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_mark_review_unsatisfactory", {
        p_submission_id: body.submission_id,
        p_admin: user.id,
        p_reason: body.reason
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json(res.json ?? { ok: true }, 200, requestId), origin, deps.env.adminOrigin);
    }
    if (method === "POST" && path === "/public-review/quarantine") {
      const body = await req.json().catch(() => null);
      if (!body?.content_hash || !body.reason) {
        return withCors(errorResponse("invalid_payload", 400, requestId), origin, deps.env.adminOrigin);
      }
      const res = await deps.rpc("service_add_review_exclusion", {
        p_content_hash: body.content_hash,
        p_reason: "admin_quarantine",
        p_source_lineage: "admin:public-review",
        p_actor_user_id: user.id,
        p_notes: body.reason
      });
      if (!res.ok) return withCors(rpcError(res.text, requestId), origin, deps.env.adminOrigin);
      return withCors(json({ ok: true }, 200, requestId), origin, deps.env.adminOrigin);
    }
    return withCors(errorResponse("not_found", 404, requestId), origin, deps.env.adminOrigin);
  } catch {
    return withCors(errorResponse("unavailable", 503, requestId), origin, deps.env.adminOrigin);
  }
}

// supabase/functions/admin-api/index.ts
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) {
    return errorResponse("unavailable", 503, requestId);
  }
  const env = {
    url,
    anon,
    service,
    adminOrigin: Deno.env.get("ADMIN_ORIGIN") ?? void 0
  };
  return await handleAdminRequest(req, {
    env,
    rpc: makeRpcCaller(env),
    signMedia: makeSignMedia(env),
    resolveUser: (token) => resolveUser(token, env)
  });
});
