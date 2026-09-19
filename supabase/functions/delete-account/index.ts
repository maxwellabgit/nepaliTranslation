import { bearerToken, errorResponse, requestIdFrom } from "../_shared/http.ts";

Deno.serve((req) => {
  const requestId = requestIdFrom(req);
  if (!bearerToken(req)) return errorResponse("unauthorized", 401, requestId);
  return errorResponse("not_implemented", 501, requestId);
});
