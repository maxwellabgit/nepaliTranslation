/**
 * Admin API client — anon key + user JWT only. Never embed service role.
 */

export type AdminErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_payload"
  | "not_found"
  | "unavailable"
  | string;

export class AdminApiError extends Error {
  readonly code: AdminErrorCode;
  readonly status: number;

  constructor(code: AdminErrorCode, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export type AdminClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export function createAdminClient(opts: AdminClientOptions) {
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await opts.getAccessToken();
    if (!token) {
      throw new AdminApiError("unauthorized", 401);
    }
    const url = `${opts.baseUrl.replace(/\/$/, "")}/functions/v1/admin-api${path}`;
    const res = await fetchImpl(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = (body?.error?.code as string) ?? "unavailable";
      throw new AdminApiError(code, res.status);
    }
    return body as T;
  }

  return {
    dashboard: () => request<Record<string, number>>("/dashboard"),
    review: (limit = 50) =>
      request<{ reports: unknown[]; media: unknown[] }>(`/review?limit=${limit}`),
    approve: (item_type: string, item_id: string) =>
      request("/review/approve", {
        method: "POST",
        body: JSON.stringify({ item_type, item_id }),
      }),
    reject: (item_type: string, item_id: string, reason?: string) =>
      request("/review/reject", {
        method: "POST",
        body: JSON.stringify({ item_type, item_id, reason }),
      }),
    alerts: (limit = 50) =>
      request<{ alerts: unknown[] }>(`/alerts?limit=${limit}`),
    deletions: (limit = 50) =>
      request<{ deletions: unknown[] }>(`/deletions?limit=${limit}`),
    getFlags: () => request<Record<string, unknown>>("/flags"),
    patchFlags: (patch: Record<string, boolean>) =>
      request<Record<string, unknown>>("/flags", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    stageExport: (payload: {
      version: string;
      object_path: string;
      filter_manifest?: Record<string, unknown>;
      row_count?: number;
    }) =>
      request("/dataset/export", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    signMedia: (media_id: string) =>
      request<{ signed_url: string; content_type?: string; kind?: string }>(
        "/media/sign",
        {
          method: "POST",
          body: JSON.stringify({ media_id }),
        },
      ),
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
