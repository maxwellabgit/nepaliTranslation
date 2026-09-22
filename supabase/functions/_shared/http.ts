/** Map Postgres/Edge consent and rate errors without logging payload text. */
export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_payload"
  | "not_found"
  | "rate_limited"
  | "not_implemented"
  | "unavailable"
  | "deletion_incomplete"
  | "consent_required"
  | "consent_outdated"
  | "age_required"
  | "lease_expired"
  | "flag_disabled"
  | "deletion_pending";

export function json(body: unknown, status = 200, requestId?: string): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };
  if (requestId) headers["x-request-id"] = requestId;
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorBody(code: ErrorCode, requestId: string) {
  return { error: { code, request_id: requestId } };
}

export function errorResponse(code: ErrorCode, status: number, requestId: string): Response {
  return json(errorBody(code, requestId), status, requestId);
}

export function requestIdFrom(req: Request): string {
  const header = req.headers.get("x-request-id")?.trim();
  if (header && header.length <= 80) return header;
  return crypto.randomUUID();
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

/** Parse PostgREST/RPC error bodies for stable client codes. Never log raw text. */
export function mapRpcError(errText: string): ErrorCode | null {
  const lower = errText.toLowerCase();
  if (lower.includes("consent_required")) return "consent_required";
  if (lower.includes("consent_outdated")) return "consent_outdated";
  if (lower.includes("age_required")) return "age_required";
  if (lower.includes("flag_disabled")) return "flag_disabled";
  if (lower.includes("deletion_pending")) return "deletion_pending";
  if (lower.includes("rate_limited")) return "rate_limited";
  if (lower.includes("lease_expired")) return "lease_expired";
  if (lower.includes("not_found") || lower.includes("p0002")) return "not_found";
  if (lower.includes("invalid_payload") || lower.includes("22023")) return "invalid_payload";
  if (lower.includes("unauthorized") || lower.includes("28000")) return "unauthorized";
  return null;
}

export function statusForError(code: ErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
    case "consent_required":
    case "consent_outdated":
    case "age_required":
    case "flag_disabled":
    case "deletion_pending":
      return 403;
    case "invalid_payload":
      return 400;
    case "not_found":
    case "lease_expired":
      return 404;
    case "rate_limited":
      return 429;
    case "deletion_incomplete":
      return 409;
    case "not_implemented":
      return 501;
    default:
      return 503;
  }
}

type Bucket = { tokens: number; resetAt: number };

/** Soft client-side hint only — DB private.check_rate_limit is authoritative. */
export function allowRate(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  store: Map<string, Bucket>,
): boolean {
  const current = store.get(key);
  if (!current || now >= current.resetAt) {
    store.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return true;
  }
  if (current.tokens <= 0) return false;
  current.tokens -= 1;
  return true;
}
