import { z } from "npm:zod@3.24.2";
import {
  parseDeletionProgress,
  revokeAppleAuthorizationCode,
  runAccountDeletion,
  type DeletionStep,
} from "../_shared/deletion.ts";
import {
  bearerToken,
  errorResponse,
  json,
  requestIdFrom,
} from "../_shared/http.ts";
import { purgeUserStorageObjects } from "../_shared/storagePurge.ts";

const bodySchema = z.object({
  authorization_code: z.string().min(8).optional(),
});

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

  const parsed = bodySchema.safeParse(
    req.headers.get("content-type")?.includes("application/json")
      ? await req.json().catch(() => ({}))
      : {},
  );
  if (!parsed.success) return errorResponse("invalid_payload", 400, requestId);

  const serviceHeaders = {
    authorization: `Bearer ${service}`,
    apikey: service,
    "content-type": "application/json",
  };

  const flagRes = await fetch(`${url}/rest/v1/rpc/service_deletion_processing_enabled`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({}),
  });
  const scheduledDeletion = flagRes.ok && (await flagRes.json() as boolean) === true;

  const loaded = await fetch(`${url}/rest/v1/rpc/service_get_deletion_progress`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({ p_user_id: user.id }),
  });
  if (!loaded.ok) return errorResponse("unavailable", 503, requestId);
  const completed = parseDeletionProgress(await loaded.json());

  if (scheduledDeletion) {
    let deletionDueAt: string | null = null;
    const progress = await runAccountDeletion(completed, {
      onProgress: async (steps: DeletionStep[]) => {
        const saved = await fetch(`${url}/rest/v1/rpc/service_set_deletion_progress`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify({ p_user_id: user.id, p_completed: steps }),
        });
        if (!saved.ok) throw new Error("progress_not_saved");
      },
      revoke: async () => {
        const result = await revokeAppleAuthorizationCode(
          parsed.data.authorization_code ?? "",
          {
            appleClientId: Deno.env.get("APPLE_CLIENT_ID"),
            appleClientSecret: Deno.env.get("APPLE_CLIENT_SECRET"),
          },
        );
        if (result !== "revoked") return result;
        const recorded = await fetch(`${url}/rest/v1/rpc/service_record_apple_revoke`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify({ p_user_id: user.id }),
        });
        return recorded.ok ? "revoked" : "failed";
      },
      purge: async () => {
        const res = await fetch(`${url}/rest/v1/rpc/service_request_account_deletion`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify({ p_user_id: user.id }),
        });
        if (!res.ok) throw new Error("schedule_failed");
        const body = await res.json() as { deletion_due_at?: string };
        deletionDueAt = body.deletion_due_at ?? null;
      },
      deleteAuth: async () => {
        /* 30-day path retains auth until the purge job; skip immediate auth delete. */
      },
    });

    if (progress.status !== "done") {
      return json(
        {
          error: {
            code: progress.code ?? "deletion_incomplete",
            request_id: requestId,
          },
          completed: progress.completed,
        },
        progress.status === "blocked" ? 503 : 409,
        requestId,
      );
    }

    return json(
      {
        deleted: true,
        scheduled: true,
        deletion_due_at: deletionDueAt,
        note: "Deleting this account does not cancel an Apple subscription. Personal data will be removed within 30 days.",
      },
      200,
      requestId,
    );
  }

  const progress = await runAccountDeletion(completed, {
    onProgress: async (steps: DeletionStep[]) => {
      const saved = await fetch(`${url}/rest/v1/rpc/service_set_deletion_progress`, {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({ p_user_id: user.id, p_completed: steps }),
      });
      if (!saved.ok) throw new Error("progress_not_saved");
    },
    revoke: async () => {
      const result = await revokeAppleAuthorizationCode(
        parsed.data.authorization_code ?? "",
        {
          appleClientId: Deno.env.get("APPLE_CLIENT_ID"),
          appleClientSecret: Deno.env.get("APPLE_CLIENT_SECRET"),
        },
      );
      if (result !== "revoked") return result;
      const recorded = await fetch(`${url}/rest/v1/rpc/service_record_apple_revoke`, {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({ p_user_id: user.id }),
      });
      return recorded.ok ? "revoked" : "failed";
    },
    purge: async () => {
      await purgeUserStorageObjects(user.id, { url, service });
      const res = await fetch(`${url}/rest/v1/rpc/service_purge_user_data`, {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({ p_user_id: user.id }),
      });
      if (!res.ok) throw new Error("purge_failed");
    },
    deleteAuth: async () => {
      const res = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${service}`,
          apikey: service,
        },
      });
      if (!res.ok) throw new Error("delete_auth_failed");
    },
  });

  if (progress.status !== "done") {
    return json(
      {
        error: {
          code: progress.code ?? "deletion_incomplete",
          request_id: requestId,
        },
        completed: progress.completed,
      },
      progress.status === "blocked" ? 503 : 409,
      requestId,
    );
  }

  return json(
    {
      deleted: true,
      note: "Deleting this account does not cancel an Apple subscription.",
    },
    200,
    requestId,
  );
});
