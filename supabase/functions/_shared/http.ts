export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_payload"
  | "not_found"
  | "rate_limited"
  | "not_implemented"
  | "unavailable";

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

type Bucket = { tokens: number; resetAt: number };

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
