import {
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";

Deno.serve((req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "GET") {
    return errorResponse("invalid_payload", 405, requestId);
  }
  return json({ ok: true, service: "neptranslate" }, 200, requestId);
});
