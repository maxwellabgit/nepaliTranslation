import {
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";
import {
  fetchAdmobVerifierKeys,
  verifyAdmobSsv,
} from "../_shared/admobSsv.ts";

const EXPECTED_REWARD_AMOUNT = "15";
const EXPECTED_REWARD_ITEM = "ad_free_minutes";

/** Seen transaction IDs in-process (DB unique is authoritative). */
const seenTx = new Set<string>();

/**
 * Google AdMob rewarded SSV callback.
 * Verifies ECDSA over the exact query, binds user/session, grants once.
 */
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "GET") {
    return errorResponse("invalid_payload", 405, requestId);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const allowedUnit = Deno.env.get("ADMOB_REWARDED_UNIT_ID");
  if (!url || !service || !allowedUnit) {
    return errorResponse("unavailable", 503, requestId);
  }

  const reqUrl = new URL(req.url);
  const query = reqUrl.search.startsWith("?")
    ? reqUrl.search.slice(1)
    : reqUrl.search;
  if (!query) return errorResponse("invalid_payload", 400, requestId);

  let keys;
  try {
    keys = await fetchAdmobVerifierKeys();
  } catch {
    return errorResponse("unavailable", 503, requestId);
  }

  const verified = await verifyAdmobSsv({
    query,
    keys,
    allowedAdUnit: allowedUnit,
    expectedRewardAmount: EXPECTED_REWARD_AMOUNT,
    expectedRewardItem: EXPECTED_REWARD_ITEM,
    nowMs: Date.now(),
  });
  if (!verified.ok) {
    return errorResponse("invalid_payload", 400, requestId);
  }

  const { params } = verified;
  const userId = params.user_id;
  const sessionToken = params.custom_data;
  const transactionId = params.transaction_id;
  if (!userId || !sessionToken || !transactionId) {
    return errorResponse("invalid_payload", 400, requestId);
  }

  if (seenTx.has(transactionId)) {
    return json({ ok: true, duplicate: true }, 200, requestId);
  }

  const rpc = await fetch(
    `${url}/rest/v1/rpc/service_consume_rewarded_ssv`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${service}`,
        apikey: service,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_session_token: sessionToken,
        p_transaction_id: transactionId,
        p_reward_amount: Number(params.reward_amount),
        p_reward_item: params.reward_item,
      }),
    },
  );

  if (rpc.status === 404) {
    return errorResponse("not_found", 404, requestId);
  }
  if (!rpc.ok) {
    return errorResponse("invalid_payload", 400, requestId);
  }

  seenTx.add(transactionId);
  return json({ ok: true }, 200, requestId);
});
