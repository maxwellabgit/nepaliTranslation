type StorageRow = { bucket_id?: string; object_path?: string };

/** Delete all contribution media objects for a user before DB purge. */
export async function purgeUserStorageObjects(
  userId: string,
  deps: { url: string; service: string; fetchImpl?: typeof fetch },
): Promise<number> {
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
  if (!listRes.ok) return 0;

  const rows = await listRes.json() as StorageRow[];
  let removed = 0;
  for (const row of rows) {
    if (!row.bucket_id || !row.object_path) continue;
    const encoded = row.object_path.split("/").map(encodeURIComponent).join("/");
    const delRes = await fetchImpl(
      `${deps.url}/storage/v1/object/${row.bucket_id}/${encoded}`,
      { method: "DELETE", headers },
    );
    if (delRes.ok) removed += 1;
  }
  return removed;
}
