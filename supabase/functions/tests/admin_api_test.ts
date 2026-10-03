import { assertEquals } from "jsr:@std/assert@1";
import {
  corsHeaders,
  handleAdminRequest,
  parseAllowedOrigins,
  routePath,
  type AdminDeps,
  type RpcCaller,
} from "../admin-api/router.ts";
import { mapRpcError, statusForError } from "../_shared/http.ts";

Deno.test("routePath strips function prefix", () => {
  assertEquals(routePath("/functions/v1/admin-api/dashboard"), "/dashboard");
  assertEquals(routePath("/admin-api/flags"), "/flags");
  assertEquals(routePath("/admin-api"), "/");
});

Deno.test("CORS soft-allows local Vite origins when ADMIN_ORIGIN unset", () => {
  assertEquals(parseAllowedOrigins(undefined).includes("http://localhost:5173"), true);
  const headers = corsHeaders("http://localhost:5173", undefined) as Record<string, string>;
  assertEquals(headers["access-control-allow-origin"], "http://localhost:5173");
});

Deno.test("forbidden maps to 403", () => {
  assertEquals(mapRpcError("ERROR: forbidden"), "forbidden");
  assertEquals(statusForError("forbidden"), 403);
});

function mockDeps(opts: {
  userId?: string | null;
  assertOk?: boolean;
  assertText?: string;
  rpcOk?: boolean;
  rpcJson?: unknown;
}): AdminDeps {
  const rpc: RpcCaller = async (name) => {
    if (name === "service_assert_admin") {
      if (opts.assertOk === false) {
        return {
          ok: false,
          status: 400,
          json: null,
          text: opts.assertText ?? "ERROR: forbidden",
        };
      }
      return { ok: true, status: 200, json: { ok: true, role: "ops" }, text: "" };
    }
    return {
      ok: opts.rpcOk !== false,
      status: 200,
      json: opts.rpcJson ?? { triage_reports: 0 },
      text: "",
    };
  };

  return {
    env: {
      url: "http://localhost",
      anon: "anon",
      service: "service",
      adminOrigin: "http://localhost:5173",
    },
    rpc,
    signMedia: async () => ({ signedUrl: "http://localhost/signed" }),
    resolveUser: async () =>
      opts.userId === null ? null : { id: opts.userId ?? "admin-user" },
  };
}

Deno.test("admin-api missing bearer returns 401", async () => {
  const res = await handleAdminRequest(
    new Request("http://localhost/functions/v1/admin-api/dashboard"),
    mockDeps({}),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error.code, "unauthorized");
});

Deno.test("admin-api non-admin returns 403", async () => {
  const res = await handleAdminRequest(
    new Request("http://localhost/functions/v1/admin-api/dashboard", {
      headers: { authorization: "Bearer user-jwt" },
    }),
    mockDeps({ assertOk: false }),
  );
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error.code, "forbidden");
});

Deno.test("admin-api admin dashboard mocked ok", async () => {
  const res = await handleAdminRequest(
    new Request("http://localhost/functions/v1/admin-api/dashboard", {
      headers: { authorization: "Bearer admin-jwt" },
    }),
    mockDeps({
      rpcJson: {
        triage_reports: 2,
        uploaded_media: 1,
        open_alerts: 0,
        pending_deletions: 0,
        dataset_exports: 0,
      },
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.triage_reports, 2);
  assertEquals(body.uploaded_media, 1);
});

Deno.test("admin-api invalid user returns 401", async () => {
  const res = await handleAdminRequest(
    new Request("http://localhost/functions/v1/admin-api/flags", {
      headers: { authorization: "Bearer bad" },
    }),
    mockDeps({ userId: null }),
  );
  assertEquals(res.status, 401);
});

Deno.test("contribution routes deny non-admin before querying raw data", async () => {
  for (const [path, method] of [["contributions", "GET"], ["contributions/export", "POST"]]) {
    const deps = mockDeps({ assertOk: false });
    let reads = 0;
    const original = deps.rpc;
    deps.rpc = (name, body) => { if (name !== "service_assert_admin") reads++; return original(name, body); };
    const res = await handleAdminRequest(new Request(`http://localhost/admin-api/${path}`, {
      method, headers: { authorization: "Bearer guest" },
    }), deps);
    assertEquals(res.status, 403); assertEquals(reads, 0);
  }
});

Deno.test("export derives actor from Auth and marks no-store, ignoring supplied actor", async () => {
  const deps = mockDeps({ userId: "trusted-admin" });
  let input: Record<string, unknown> = {};
  deps.rpc = async (name, body) => {
    if (name === "service_admin_contributions") input = body;
    return { ok: true, status: 200, json: { records: [] }, text: "" };
  };
  const res = await handleAdminRequest(new Request("http://localhost/admin-api/contributions/export?limit=100", {
    method: "POST", headers: { authorization: "Bearer admin", 'content-type': 'application/json' },
    body: JSON.stringify({ p_actor_id: 'forged' }),
  }), deps);
  assertEquals(res.status, 200); assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals(input, { p_actor_id: 'trusted-admin', p_limit: 100, p_before: null, p_before_key: null, p_export: true });
});

Deno.test("contribution pagination rejects malformed, unbounded and half cursors", async () => {
  for (const query of ['limit=0', 'limit=201', 'limit=1.5', 'before=x&before_key=report:x', 'before_key=orphan', 'before=&before_key=']) {
    const res = await handleAdminRequest(new Request(`http://localhost/admin-api/contributions?${query}`, {
      headers: { authorization: 'Bearer admin' },
    }), mockDeps({}));
    assertEquals(res.status, 400, query);
  }
});

Deno.test('legacy review route uses the same audited consent-filtered RPC', async () => {
  const deps = mockDeps({}); const calls: string[] = [];
  deps.rpc = async (name) => { calls.push(name); return { ok: true, status: 200,
    json: { records: [{ record_type: 'text', id: 'a', source: 'allowed only' }] }, text: '' }; };
  const res = await handleAdminRequest(new Request('http://localhost/admin-api/review', {
    headers: { authorization: 'Bearer admin' },
  }), deps);
  assertEquals(calls, ['service_assert_admin', 'service_admin_contributions']);
  assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals((await res.json()).reports[0].source_preview, 'allowed only');
});
