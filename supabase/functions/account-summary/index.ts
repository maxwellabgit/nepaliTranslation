import { buildAccountSummary } from "../_shared/schemas.ts";
import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";

type ProfileRow = {
  consent_version: string | null;
  consented_at: string | null;
  age_confirmed_at: string | null;
};

async function authedGet(url: string, token: string, apikey: string) {
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey,
      accept: "application/json",
    },
  });
  if (res.status === 401 || res.status === 403) return { status: res.status, body: null };
  if (!res.ok) return { status: 503, body: null };
  return { status: 200, body: await res.json() };
}

Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "GET") return errorResponse("invalid_payload", 405, requestId);
  const token = bearerToken(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!url || !anon) return errorResponse("unavailable", 503, requestId);

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);

  const profileRes = await authedGet(
    `${url}/rest/v1/profiles?select=consent_version,consented_at,age_confirmed_at`,
    token,
    anon,
  );
  if (profileRes.status === 401 || profileRes.status === 403) {
    return errorResponse("unauthorized", 401, requestId);
  }
  if (profileRes.status !== 200) return errorResponse("unavailable", 503, requestId);

  const receiptsRes = await authedGet(
    `${url}/rest/v1/contribution_receipts?select=id`,
    token,
    anon,
  );
  const entitlementRes = await authedGet(
    `${url}/rest/v1/earned_entitlements?select=lifetime_credits,earned_ad_free_until`,
    token,
    anon,
  );
  if (receiptsRes.status !== 200 || entitlementRes.status !== 200) {
    return errorResponse("unavailable", 503, requestId);
  }

  const profiles = (profileRes.body ?? []) as ProfileRow[];
  const receipts = (receiptsRes.body ?? []) as unknown[];
  const entitlements = (entitlementRes.body ?? []) as Array<{
    lifetime_credits: number;
    earned_ad_free_until: string | null;
  }>;
  const profile = profiles[0];
  const entitlement = entitlements[0];

  return json(
    buildAccountSummary({
      consent_version: profile?.consent_version,
      consented_at: profile?.consented_at,
      age_confirmed_at: profile?.age_confirmed_at,
      receipt_count: receipts.length,
      lifetime_credits: entitlement?.lifetime_credits ?? 0,
      earned_ad_free_until: entitlement?.earned_ad_free_until,
    }),
    200,
    requestId,
  );
});
