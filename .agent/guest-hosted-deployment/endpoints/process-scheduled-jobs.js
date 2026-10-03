// supabase/functions/_shared/http.ts
function json(body, status = 200, requestId) {
  const headers = {
    "content-type": "application/json; charset=utf-8"
  };
  if (requestId) headers["x-request-id"] = requestId;
  return new Response(JSON.stringify(body), { status, headers });
}
function errorBody(code, requestId) {
  return { error: { code, request_id: requestId } };
}
function errorResponse(code, status, requestId) {
  return json(errorBody(code, requestId), status, requestId);
}
function requestIdFrom(req) {
  const header = req.headers.get("x-request-id")?.trim();
  if (header && header.length <= 80) return header;
  return crypto.randomUUID();
}
function bearerToken(req) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

// supabase/functions/_shared/storagePurge.ts
async function purgeUserStorageObjects(userId, deps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const headers = {
    authorization: `Bearer ${deps.service}`,
    apikey: deps.service,
    "content-type": "application/json"
  };
  const listRes = await fetchImpl(`${deps.url}/rest/v1/rpc/service_list_user_media_objects`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_user_id: userId })
  });
  if (!listRes.ok) {
    return { ok: false, removed: 0, failed: 0, error: "list_failed" };
  }
  const rows = await listRes.json();
  let removed = 0;
  let failed = 0;
  let errorDetail = null;
  for (const row of rows) {
    if (!row.bucket_id || !row.object_path) {
      failed += 1;
      errorDetail = "missing_path";
      continue;
    }
    const encoded = row.object_path.split("/").map(encodeURIComponent).join("/");
    const delRes = await fetchImpl(
      `${deps.url}/storage/v1/object/${row.bucket_id}/${encoded}`,
      {
        method: "DELETE",
        headers: {
          authorization: headers.authorization,
          apikey: headers.apikey
        }
      }
    );
    if (delRes.ok) removed += 1;
    else {
      failed += 1;
      errorDetail = `delete_${delRes.status}`;
    }
  }
  if (failed > 0) {
    return { ok: false, removed, failed, error: errorDetail ?? "partial_delete" };
  }
  return { ok: true, removed, failed: 0, error: null };
}

// supabase/functions/_shared/deletionExecutor.ts
async function rpc(deps, name, body) {
  const res = await deps.fetchImpl(`${deps.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${deps.service}`,
      apikey: deps.service,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const json2 = await res.json().catch(() => ({}));
  return { ok: res.ok && json2.ok !== false, json: json2 };
}
async function executeDeletionRequest(row, deps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const rpcDeps = { url: deps.url, service: deps.service, fetchImpl };
  const base = { id: row.id, request_kind: row.request_kind };
  if (!row.storage_completed) {
    const purged = deps.purgeStorage ? await deps.purgeStorage(row.user_id) : await purgeUserStorageObjects(row.user_id, rpcDeps);
    const recorded = await rpc(rpcDeps, "service_record_deletion_storage", {
      p_request_id: row.id,
      p_ok: purged.ok,
      p_error: purged.error
    });
    if (!purged.ok || !recorded.ok) {
      return { ...base, stage: "storage", ok: false };
    }
  }
  if (!row.database_completed) {
    const database = await rpc(rpcDeps, "service_complete_deletion_database", {
      p_request_id: row.id
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
  const deleted = deps.deleteAuth ? await deps.deleteAuth(row.user_id) : await deleteAuthUser(row.user_id, rpcDeps);
  const auth = await rpc(rpcDeps, "service_record_deletion_auth", {
    p_request_id: row.id,
    p_ok: deleted,
    p_error: deleted ? null : "auth_delete_failed"
  });
  if (!deleted || !auth.ok) return { ...base, stage: "auth", ok: false };
  return { ...base, stage: "complete", ok: true };
}
async function deleteAuthUser(userId, deps) {
  const res = await deps.fetchImpl(`${deps.url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${deps.service}`,
      apikey: deps.service
    }
  });
  return res.ok;
}

// supabase/functions/_shared/scheduledDeletion.ts
async function handleScheduledDeletion(req) {
  const requestId = requestIdFrom(req);
  if (req.method !== "POST") return errorResponse("invalid_payload", 405, requestId);
  const cronSecret = Deno.env.get("CRON_SECRET");
  const token = bearerToken(req);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !service) return errorResponse("unavailable", 503, requestId);
  const deletionService = Deno.env.get("STORAGE_SERVICE_ROLE_KEY") ?? service;
  const authorized = cronSecret && token === cronSecret || service && token === service;
  if (!authorized) return errorResponse("unauthorized", 401, requestId);
  const headers = {
    authorization: `Bearer ${service}`,
    apikey: service,
    "content-type": "application/json"
  };
  const dueRes = await fetch(`${url}/rest/v1/rpc/service_list_due_deletion_requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_limit: 50 })
  });
  if (!dueRes.ok) return errorResponse("unavailable", 503, requestId);
  const dueRequests = await dueRes.json();
  const deletionResults = [];
  for (const row of dueRequests) {
    if (!row?.id || !row.user_id || !row.request_kind) continue;
    deletionResults.push(await executeDeletionRequest(row, { url, service: deletionService }));
  }
  return json(
    {
      ok: true,
      reward_close: { retired: true, applied: 0 },
      deletion_results: deletionResults
    },
    200,
    requestId
  );
}

// supabase/functions/process-scheduled-jobs/index.ts
Deno.serve(handleScheduledDeletion);
