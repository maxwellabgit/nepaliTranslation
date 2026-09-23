import {
  purgeUserStorageObjects,
  type StoragePurgeResult,
} from "./storagePurge.ts";

export type DueDeletionRequest = {
  id: string;
  user_id: string;
  request_kind: "consent_withdrawal" | "account_deletion";
  storage_completed: boolean;
  database_completed: boolean;
  auth_completion: string;
};

export type DeletionStepResult = {
  id: string;
  request_kind: DueDeletionRequest["request_kind"];
  stage: "storage" | "database" | "auth" | "complete";
  ok: boolean;
};

type FetchImpl = typeof fetch;

async function rpc(
  deps: { url: string; service: string; fetchImpl: FetchImpl },
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await deps.fetchImpl(`${deps.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${deps.service}`,
      apikey: deps.service,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok && json.ok !== false, json };
}

/**
 * Advance one deletion request. Storage failure stops the request.
 * Auth deletion runs only for account deletion, and only after storage
 * and database completion. A failed auth delete leaves the row retryable.
 */
export async function executeDeletionRequest(
  row: DueDeletionRequest,
  deps: {
    url: string;
    service: string;
    fetchImpl?: FetchImpl;
    purgeStorage?: (userId: string) => Promise<StoragePurgeResult>;
    deleteAuth?: (userId: string) => Promise<boolean>;
  },
): Promise<DeletionStepResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const rpcDeps = { url: deps.url, service: deps.service, fetchImpl };
  const base = { id: row.id, request_kind: row.request_kind };

  if (!row.storage_completed) {
    const purged = deps.purgeStorage
      ? await deps.purgeStorage(row.user_id)
      : await purgeUserStorageObjects(row.user_id, rpcDeps);
    const recorded = await rpc(rpcDeps, "service_record_deletion_storage", {
      p_request_id: row.id,
      p_ok: purged.ok,
      p_error: purged.error,
    });
    if (!purged.ok || !recorded.ok) {
      return { ...base, stage: "storage", ok: false };
    }
  }

  if (!row.database_completed) {
    const database = await rpc(rpcDeps, "service_complete_deletion_database", {
      p_request_id: row.id,
    });
    if (!database.ok) return { ...base, stage: "database", ok: false };
    if (row.request_kind === "consent_withdrawal") {
      return { ...base, stage: "complete", ok: true };
    }
  } else if (row.request_kind === "consent_withdrawal") {
    return { ...base, stage: "complete", ok: true };
  }

  if (row.auth_completion === "completed") {
    return { ...base, stage: "complete", ok: true };
  }

  const deleted = deps.deleteAuth
    ? await deps.deleteAuth(row.user_id)
    : await deleteAuthUser(row.user_id, rpcDeps);
  const auth = await rpc(rpcDeps, "service_record_deletion_auth", {
    p_request_id: row.id,
    p_ok: deleted,
    p_error: deleted ? null : "auth_delete_failed",
  });
  if (!deleted || !auth.ok) return { ...base, stage: "auth", ok: false };
  return { ...base, stage: "complete", ok: true };
}

async function deleteAuthUser(
  userId: string,
  deps: { url: string; service: string; fetchImpl: FetchImpl },
): Promise<boolean> {
  const res = await deps.fetchImpl(`${deps.url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${deps.service}`,
      apikey: deps.service,
    },
  });
  return res.ok;
}
