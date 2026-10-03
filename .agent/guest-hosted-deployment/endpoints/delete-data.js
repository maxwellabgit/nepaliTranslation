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

// supabase/functions/_shared/guestDataDeletion.ts
async function handleGuestDataDeletion(req, deps) {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);
  const token = bearerToken(req);
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!deps.url || !deps.anonKey) return errorResponse("unavailable", 503, requestId);
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length !== 0) {
    return errorResponse("invalid_payload", 400, requestId);
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${token}`, apikey: deps.anonKey, "content-type": "application/json" };
  try {
    const userRes = await fetchImpl(`${deps.url}/auth/v1/user`, { headers });
    if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
    const user = await userRes.json();
    if (typeof user.id !== "string" || !user.id) return errorResponse("unauthorized", 401, requestId);
    const res = await fetchImpl(`${deps.url}/rest/v1/rpc/request_shared_data_deletion`, {
      method: "POST",
      headers,
      body: "{}"
    });
    if (!res.ok) {
      const code = mapRpcError(await res.text()) ?? "unavailable";
      return errorResponse(code, statusForError(code), requestId);
    }
    const result = await res.json();
    if (result.scheduled !== true || typeof result.deletion_due_at !== "string" || !Number.isFinite(Date.parse(result.deletion_due_at))) {
      return errorResponse("unavailable", 503, requestId);
    }
    return json({ deleted: false, scheduled: true, deletion_due_at: result.deletion_due_at, scope: "contributions" }, 200, requestId);
  } catch {
    return errorResponse("unavailable", 503, requestId);
  }
}

// supabase/functions/delete-data/index.ts
Deno.serve((req) => handleGuestDataDeletion(req, {
  url: Deno.env.get("SUPABASE_URL"),
  anonKey: Deno.env.get("SUPABASE_ANON_KEY")
}));
