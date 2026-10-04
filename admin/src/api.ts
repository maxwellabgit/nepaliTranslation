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
  /** Public anon key — sent as `apikey` on Edge Function calls (never service role). */
  anonKey: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export type ContributionCursor = { created_at: string; key: string };
export type ContributionRecord = {
  id: string; record_type: 'text' | 'speech'; owner_id: string;
  created_at: string; source?: string; result?: string; correction?: string | null;
  normalized_source?: string; consent_version: string;
  metadata: Record<string, unknown>; content_type?: string; byte_size?: number;
  direction?: string; formality?: string; script?: string;
  classification: 'private_review_only'; training_eligible: false; public_display_eligible: false;
};
export type ContributionPage = {
  schema_version: number; classification: 'private_review_only'; generated_at: string;
  records: ContributionRecord[]; next_cursor: ContributionCursor | null;
};

export function createAdminClient(opts: AdminClientOptions) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!opts.anonKey || opts.anonKey.length < 10) {
    throw new Error("anonKey required");
  }

  async function postgrestGet<T>(rel: string): Promise<T> {
    const token = await opts.getAccessToken();
    if (!token) {
      throw new AdminApiError("unauthorized", 401);
    }
    const url = `${opts.baseUrl.replace(/\/$/, "")}/rest/v1${rel}`;
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        apikey: opts.anonKey,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = (body?.message as string) ?? "unavailable";
      throw new AdminApiError(code, res.status);
    }
    return (await res.json()) as T;
  }

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
        apikey: opts.anonKey,
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
    support: (cursor: { created_at: string; id: string } | null = null) => request<{ requests: Array<{ id: string; message: string; category: string; app_version: string; reply: string | null; created_at: string }>; next_cursor: { created_at: string; id: string } | null }>(`/support${cursor ? `?before=${encodeURIComponent(cursor.created_at)}&before_id=${encodeURIComponent(cursor.id)}` : ''}`),
    replySupport: (id: string, reply: string) => request('/support/reply', { method: 'POST', body: JSON.stringify({ id, reply }) }),
    contributions: (cursor: ContributionCursor | null = null, exporting = false) => {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) { params.set('before', cursor.created_at); params.set('before_key', cursor.key); }
      return request<ContributionPage>(`/contributions${exporting ? '/export' : ''}?${params}`, {
        method: exporting ? 'POST' : 'GET',
      });
    },
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
    signMedia: async (media_id: string) => {
      const signed = await request<{ signed_url: string; content_type?: string; kind?: string }>(
        "/media/sign",
        {
          method: "POST",
          body: JSON.stringify({ media_id }),
        },
      );
      // Local Edge uses Docker's internal Kong origin. Use the configured public
      // API origin, retaining only the expected signed-storage path and query.
      const target = new URL(signed.signed_url, opts.baseUrl);
      if (!target.pathname.startsWith('/storage/v1/object/sign/')) throw new AdminApiError('invalid_payload', 502);
      return { ...signed, signed_url: new URL(target.pathname + target.search, opts.baseUrl).href };
    },
    // R3 public review — reads the RLS-safe view directly via PostgREST.
    // Mutating admin actions (mark unsatisfactory / late reject / quarantine
    // resolution) require a service-role admin-api endpoint scheduled for
    // R7/R8 polish; see plans/active/v1-testflight-runbook.md.
    publicReviewCurrentWindow: () =>
      postgrestGet<Array<Record<string, unknown>>>(
        "/review_current_window?select=window_id,slot,ny_close_at,state,source_item_id&order=slot.asc",
      ),
    markReviewUnsatisfactory: (submission_id: string, reason: string) =>
      request("/public-review/unsatisfactory", {
        method: "POST",
        body: JSON.stringify({ submission_id, reason }),
      }),
    quarantineReviewHash: (content_hash: string, reason: string) =>
      request("/public-review/quarantine", {
        method: "POST",
        body: JSON.stringify({ content_hash, reason }),
      }),
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
