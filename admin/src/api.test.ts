import { describe, expect, it, vi } from "vitest";
import { AdminApiError, createAdminClient } from "./api";

const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-test-key";

describe("admin API client", () => {
  it("throws unauthorized when no access token", async () => {
    const client = createAdminClient({
      baseUrl: "https://example.supabase.co",
      anonKey: ANON,
      getAccessToken: async () => null,
      fetchImpl: vi.fn(),
    });
    await expect(client.dashboard()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });

  it("maps non-admin 403 to AdminApiError forbidden", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "forbidden", request_id: "r1" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createAdminClient({
      baseUrl: "https://example.supabase.co",
      anonKey: ANON,
      getAccessToken: async () => "user-jwt",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    try {
      await client.dashboard();
      expect.unreachable("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect((err as AdminApiError).code).toBe("forbidden");
      expect((err as AdminApiError).status).toBe(403);
    }
    expect(fetchImpl).toHaveBeenCalled();
    const first = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(first[0]).toContain("/functions/v1/admin-api/dashboard");
    const headers = first[1].headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer user-jwt");
    expect(headers.apikey).toBe(ANON);
  });

  it("returns JSON on success and always sends apikey", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ triage_reports: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createAdminClient({
      baseUrl: "https://example.supabase.co",
      anonKey: ANON,
      getAccessToken: async () => "admin-jwt",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const data = await client.dashboard();
    expect(data.triage_reports).toBe(3);
    const first = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((first[1].headers as Record<string, string>).apikey).toBe(ANON);
  });
});
