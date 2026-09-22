import { assertEquals } from "jsr:@std/assert@1";
import {
  handleAdminRequest,
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
