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

// supabase/functions/public-review/index.ts
Deno.serve((req) => {
  const requestId = requestIdFrom(req);
  return errorResponse("review_retired", 410, requestId);
});
