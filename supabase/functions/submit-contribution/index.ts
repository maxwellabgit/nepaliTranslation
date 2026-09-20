import { resolveConsensus, scoreKnownSubmission } from "../_shared/consensus.ts";
import { normalizeForScore, similarity } from "../_shared/scoring.ts";
import { contributionSubmitSchema } from "../_shared/schemas.ts";
import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";

type Bundle = {
  assignment_id: string;
  user_id: string;
  leased_until: string;
  completed_at: string | null;
  task_id: string;
  task_type: "known_check" | "unknown";
  model_output: string;
  references: string[];
  contributor_state: string;
};

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
  const user = await userRes.json() as { id?: string };
  if (!user.id) return errorResponse("unauthorized", 401, requestId);

  const parsed = contributionSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_payload", 400, requestId);
  const body = parsed.data;

  const headers = {
    authorization: `Bearer ${service}`,
    apikey: service,
    "content-type": "application/json",
  };

  const bundleRes = await fetch(`${url}/rest/v1/rpc/service_get_assignment_bundle`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_user_id: user.id,
      p_assignment_id: body.assignment_id,
    }),
  });
  if (!bundleRes.ok) return errorResponse("unavailable", 503, requestId);
  const bundle = await bundleRes.json() as Bundle | null;
  if (!bundle?.assignment_id) return errorResponse("not_found", 404, requestId);
  if (bundle.completed_at) {
    return json({
      status: "already_submitted",
      reward_label: "Earn 1–6 credits after validation",
    }, 200, requestId);
  }
  if (new Date(bundle.leased_until).getTime() < Date.now()) {
    return errorResponse("not_found", 404, requestId);
  }

  const raw = body.response_text?.trim() ?? "";
  const normalized = normalizeForScore(
    body.action === "looks_correct" ? bundle.model_output : raw,
  );
  const modelSim = similarity(normalized, bundle.model_output);

  let decision = "pending";
  let knownPass: boolean | null = null;
  if (bundle.task_type === "known_check" && body.action !== "skip" && body.action !== "report_task") {
    const scored = scoreKnownSubmission(normalized, bundle.references ?? []);
    knownPass = scored.pass;
    decision = scored.pass ? "known_pass" : "known_fail";
    await fetch(`${url}/rest/v1/rpc/service_bump_known_stats`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_user_id: user.id, p_passed: scored.pass }),
    });
  }

  const record = await fetch(`${url}/rest/v1/rpc/service_record_submission`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_user_id: user.id,
      p_assignment_id: body.assignment_id,
      p_action: body.action,
      p_raw_response: raw || normalized,
      p_normalized_response: normalized,
      p_model_similarity: modelSim,
      p_decision_status: decision,
      p_idempotency_key: body.idempotency_key,
    }),
  });
  if (!record.ok) {
    const errText = await record.text();
    if (errText.includes("not_found") || record.status === 404) {
      return errorResponse("not_found", 404, requestId);
    }
    return errorResponse("unavailable", 503, requestId);
  }

  let consensus: ReturnType<typeof resolveConsensus> = { status: "pending" };
  let reward: unknown = null;
  if (bundle.task_type === "unknown" && (body.action === "looks_correct" || body.action === "edit")) {
    const votesRes = await fetch(`${url}/rest/v1/rpc/service_list_task_votes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_task_id: bundle.task_id }),
    });
    if (votesRes.ok) {
      const votesJson = await votesRes.json() as Array<{
        user_id: string;
        band: "normal" | "probation";
        normalized_response: string;
        model_similarity: number | null;
      }>;
      consensus = resolveConsensus(
        (Array.isArray(votesJson) ? votesJson : []).map((v) => ({
          userId: v.user_id,
          band: v.band,
          normalizedResponse: v.normalized_response,
          modelSimilarity: v.model_similarity,
        })),
      );
      if (consensus.status === "resolved" && consensus.rewardEligible) {
        const rewardRes = await fetch(
          `${url}/rest/v1/rpc/service_apply_contribution_reward`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              p_user_id: user.id,
              p_source_id: `task:${bundle.task_id}`,
              p_credits: 2,
              p_minutes: 15,
            }),
          },
        );
        if (rewardRes.ok) reward = await rewardRes.json();
      }
    }
  } else if (knownPass === true) {
    const rewardRes = await fetch(
      `${url}/rest/v1/rpc/service_apply_contribution_reward`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_user_id: user.id,
          p_source_id: `known:${body.assignment_id}`,
          p_credits: 2,
          p_minutes: 15,
        }),
      },
    );
    if (rewardRes.ok) reward = await rewardRes.json();
  }

  // Never expose task_type, references, or known outcome labels to the client.
  return json({
    status: consensus.status === "resolved"
      ? "accepted"
      : consensus.status === "disputed"
      ? "disputed"
      : "received",
    reward_label: "Earn 1–6 credits after validation",
    reward: reward && typeof reward === "object" && (reward as { applied?: boolean }).applied
      ? { credits: 2, minutes: 15 }
      : null,
  }, 200, requestId);
});
