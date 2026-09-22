import {
  handleAdminRequest,
  makeRpcCaller,
  makeSignMedia,
  resolveUser,
  type AdminEnv,
} from "./router.ts";
import { errorResponse, requestIdFrom } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) {
    return errorResponse("unavailable", 503, requestId);
  }

  const env: AdminEnv = {
    url,
    anon,
    service,
    adminOrigin: Deno.env.get("ADMIN_ORIGIN") ?? undefined,
  };

  return await handleAdminRequest(req, {
    env,
    rpc: makeRpcCaller(env),
    signMedia: makeSignMedia(env),
    resolveUser: (token) => resolveUser(token, env),
  });
});
