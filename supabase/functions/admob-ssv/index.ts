import { errorResponse, requestIdFrom } from "../_shared/http.ts";

/** Signature verification lands in a later slice. This skeleton grants nothing. */
Deno.serve((req) => {
  return errorResponse("not_implemented", 501, requestIdFrom(req));
});
