import { errorResponse, requestIdFrom } from "../_shared/http.ts";

/**
 * Retired. Bundled samples stay on the device. This route no longer returns
 * a review window, accepts a submission, or grants credits.
 */
Deno.serve((req) => {
  const requestId = requestIdFrom(req);
  return errorResponse("review_retired", 410, requestId);
});
