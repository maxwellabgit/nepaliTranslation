type StorageRow = { bucket_id?: string; object_path?: string };

export type StoragePurgeResult = {
  ok: boolean;
  removed: number;
  failed: number;
  error: string | null;
};

/** Delete contribution media objects. A partial failure is not success. */
export async function purgeUserStorageObjects(
  userId: string,
  deps: { url: string; service: string; fetchImpl?: typeof fetch },
): Promise<StoragePurgeResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const headers = {
    authorization: `Bearer ${deps.service}`,
    apikey: deps.service,
    "content-type": "application/json",
  };

  const listRes = await fetchImpl(`${deps.url}/rest/v1/rpc/service_list_user_media_objects`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!listRes.ok) {
    return { ok: false, removed: 0, failed: 0, error: "list_failed" };
  }

  const rows = await listRes.json() as StorageRow[];
  let removed = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.bucket_id || !row.object_path) {
      failed += 1;
      continue;
    }
    const encoded = row.object_path.split("/").map(encodeURIComponent).join("/");
    const delRes = await fetchImpl(
      `${deps.url}/storage/v1/object/${row.bucket_id}/${encoded}`,
      { method: "DELETE", headers },
    );
    if (delRes.ok) removed += 1;
    else failed += 1;
  }
  if (failed > 0) {
    return { ok: false, removed, failed, error: "partial_delete" };
  }
  return { ok: true, removed, failed: 0, error: null };
}
