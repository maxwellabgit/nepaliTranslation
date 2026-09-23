import {
  bearerToken,
  errorResponse,
  json,
  mapRpcError,
  requestIdFrom,
  statusForError,
} from "../_shared/http.ts";

/**
 * G1 public-review pool endpoint.
 *
 *   GET/POST { op: "current" } -> the shared global 10-item window (open only).
 *   POST     { op: "submit", window_id, source_item_id, action, corrected_text? }
 *
 * Requires a signed-in Supabase user JWT. Guests must not reach this route;
 * mobile hides the Review surface for signed-out users.
 */
Deno.serve(async (req) => {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);

  const token = bearerToken(req);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return errorResponse("unauthorized", 401, requestId);
  if (!url || !anon || !service) return errorResponse("unavailable", 503, requestId);

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });
  if (!userRes.ok) return errorResponse("unauthorized", 401, requestId);
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("invalid_payload", 400, requestId);
  }
  const op = String(body.op ?? "current");

  const serviceHeaders = {
    authorization: `Bearer ${service}`,
    apikey: service,
    "content-type": "application/json",
  };

  if (op === "current") {
    const winRes = await fetch(
      `${url}/rest/v1/review_current_window?select=window_id,ny_close_at,slot,length_tier_snapshot,scheduled_credits,source_item_id,direction,register,script,source_text,proposed_target&order=slot.asc`,
      { headers: serviceHeaders },
    );
    if (!winRes.ok) return errorResponse("unavailable", 503, requestId);
    const rows = (await winRes.json()) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return json({ window: null, items: [], mine: [] }, 200, requestId);
    }
    const first = rows[0];
    const windowId = String(first.window_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(windowId)) {
      return errorResponse("unavailable", 503, requestId);
    }
    const mineRes = await fetch(
      `${url}/rest/v1/review_submissions?window_id=eq.${windowId}&select=source_item_id,action,corrected_text,reward_granted`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          apikey: anon,
          accept: "application/json",
        },
      },
    );
    if (!mineRes.ok) return errorResponse("unavailable", 503, requestId);
    const mineRows = (await mineRes.json()) as Array<Record<string, unknown>>;
    return json(
      {
        window: {
          window_id: first.window_id,
          ny_close_at: first.ny_close_at,
          size: rows.length,
        },
        items: rows.map((r) => ({
          slot: r.slot,
          source_item_id: r.source_item_id,
          direction: r.direction,
          register: r.register,
          script: r.script,
          source_text: r.source_text,
          proposed_target: r.proposed_target,
          length_tier: r.length_tier_snapshot,
          scheduled_credits: r.scheduled_credits,
        })),
        mine: mineRows.map((r) => ({
          source_item_id: r.source_item_id,
          action: r.action,
          corrected_text: r.corrected_text ?? null,
          reward_granted: r.reward_granted === true,
        })),
      },
      200,
      requestId,
    );
  }

  if (op === "submit") {
    const windowId = String(body.window_id ?? "");
    const sourceItemId = String(body.source_item_id ?? "");
    const action = String(body.action ?? "");
    const correctedText = typeof body.corrected_text === "string"
      ? (body.corrected_text as string)
      : null;
    if (!windowId || !sourceItemId) {
      return errorResponse("invalid_payload", 400, requestId);
    }
    if (!["confirm", "edit", "skip", "report"].includes(action)) {
      return errorResponse("invalid_payload", 400, requestId);
    }

    const rpc = await fetch(`${url}/rest/v1/rpc/rpc_submit_review`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        apikey: anon,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_window_id: windowId,
        p_source_item_id: sourceItemId,
        p_action: action,
        p_corrected_text: correctedText,
      }),
    });
    if (!rpc.ok) {
      const errText = await rpc.text();
      const code = mapRpcError(errText) ?? "unavailable";
      return errorResponse(code, statusForError(code), requestId);
    }
    const submission = (await rpc.json()) as unknown;
    return json({ submission }, 200, requestId);
  }

  return errorResponse("invalid_payload", 400, requestId);
});
