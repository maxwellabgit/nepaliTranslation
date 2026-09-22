import {
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";

type RcEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  event_timestamp_ms?: number;
};

type RcPayload = {
  api_version?: string;
  event?: RcEvent;
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * RevenueCat server webhook.
 * Verifies Authorization bearer secret; applies events idempotently via RPC.
 */
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") {
    return errorResponse("invalid_payload", 405, requestId);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!url || !service || !expectedAuth) {
    return errorResponse("unavailable", 503, requestId);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1] ?? "";
  if (!token || token !== expectedAuth) {
    return errorResponse("unauthorized", 401, requestId);
  }

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return errorResponse("invalid_payload", 400, requestId);
  }

  let body: RcPayload;
  try {
    body = JSON.parse(raw) as RcPayload;
  } catch {
    return errorResponse("invalid_payload", 400, requestId);
  }

  const event = body.event;
  if (!event?.id || !event.type || !event.app_user_id) {
    return errorResponse("invalid_payload", 400, requestId);
  }

  const payloadHash = await sha256Hex(raw);
  const expiresAt =
    typeof event.expiration_at_ms === "number" &&
      Number.isFinite(event.expiration_at_ms)
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

  const rpc = await fetch(
    `${url}/rest/v1/rpc/service_apply_revenuecat_event`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${service}`,
        apikey: service,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_provider_event_id: event.id,
        p_payload_hash: payloadHash,
        p_app_user_id: event.app_user_id,
        p_event_type: event.type,
        p_product_id: event.product_id ?? null,
        p_expires_at: expiresAt,
      }),
    },
  );

  if (!rpc.ok) {
    const text = await rpc.text().catch(() => "");
    if (text.toLowerCase().includes("invalid_payload")) {
      return errorResponse("invalid_payload", 400, requestId);
    }
    return errorResponse("unavailable", 503, requestId);
  }

  const result = await rpc.json().catch(() => ({ ok: true }));
  return json({ ok: true, ...result }, 200, requestId);
});
