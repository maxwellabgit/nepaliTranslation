import { assertEquals } from "jsr:@std/assert@1";
import { executeDeletionRequest } from "../_shared/deletionExecutor.ts";
import { purgeUserStorageObjects } from "../_shared/storagePurge.ts";

Deno.test("withdrawal completes without auth deletion", async () => {
  const calls: string[] = [];
  const result = await executeDeletionRequest({
    id: "req-withdraw",
    user_id: "user-w",
    request_kind: "consent_withdrawal",
    storage_completed: false,
    database_completed: false,
    auth_completion: "not_applicable",
  }, {
    url: "https://example.supabase.co",
    service: "service-key",
    purgeStorage: async () => ({ ok: true, removed: 1, failed: 0, error: null }),
    deleteAuth: async () => {
      calls.push("auth");
      return true;
    },
    fetchImpl: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("service_record_deletion_storage")) {
        return new Response(JSON.stringify({ ok: true, stage: "database" }), { status: 200 });
      }
      if (url.includes("service_complete_deletion_database")) {
        return new Response(JSON.stringify({ ok: true, stage: "complete" }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    },
  });
  assertEquals(result.ok, true);
  assertEquals(result.stage, "complete");
  assertEquals(calls.includes("auth"), false);
  assertEquals(calls.some((url) => url.includes("service_complete_deletion_database")), true);
});

Deno.test("partial storage failure does not purge the database or auth user", async () => {
  const calls: string[] = [];
  const result = await executeDeletionRequest({
    id: "req-storage",
    user_id: "user-s",
    request_kind: "account_deletion",
    storage_completed: false,
    database_completed: false,
    auth_completion: "pending",
  }, {
    url: "https://example.supabase.co",
    service: "service-key",
    purgeStorage: async () => ({ ok: false, removed: 1, failed: 1, error: "partial_delete" }),
    deleteAuth: async () => {
      calls.push("auth");
      return true;
    },
    fetchImpl: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("service_record_deletion_storage")) {
        return new Response(JSON.stringify({ ok: false, stage: "storage" }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    },
  });
  assertEquals(result.stage, "storage");
  assertEquals(result.ok, false);
  assertEquals(calls.some((url) => url.includes("service_complete_deletion_database")), false);
  assertEquals(calls.includes("auth"), false);
});

Deno.test("auth failure retries without repeating storage or database purge", async () => {
  let authAttempts = 0;
  let storageCalls = 0;
  const first = await executeDeletionRequest({
    id: "req-auth",
    user_id: "user-a",
    request_kind: "account_deletion",
    storage_completed: true,
    database_completed: true,
    auth_completion: "pending",
  }, {
    url: "https://example.supabase.co",
    service: "service-key",
    purgeStorage: async () => {
      storageCalls += 1;
      return { ok: true, removed: 0, failed: 0, error: null };
    },
    deleteAuth: async () => {
      authAttempts += 1;
      return false;
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("service_record_deletion_auth")) {
        return new Response(JSON.stringify({ ok: false, stage: "auth" }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    },
  });
  assertEquals(first.stage, "auth");
  assertEquals(first.ok, false);
  assertEquals(storageCalls, 0);

  const second = await executeDeletionRequest({
    id: "req-auth",
    user_id: "user-a",
    request_kind: "account_deletion",
    storage_completed: true,
    database_completed: true,
    auth_completion: "failed",
  }, {
    url: "https://example.supabase.co",
    service: "service-key",
    purgeStorage: async () => {
      storageCalls += 1;
      return { ok: true, removed: 0, failed: 0, error: null };
    },
    deleteAuth: async () => {
      authAttempts += 1;
      return true;
    },
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("service_record_deletion_auth")) {
        return new Response(JSON.stringify({ ok: true, stage: "complete" }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    },
  });
  assertEquals(second.ok, true);
  assertEquals(second.stage, "complete");
  assertEquals(authAttempts, 2);
  assertEquals(storageCalls, 0);
});

Deno.test("purgeUserStorageObjects reports a partial object failure", async () => {
  const result = await purgeUserStorageObjects("user-1", {
    url: "https://example.supabase.co",
    service: "service-key",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("service_list_user_media_objects")) {
        return new Response(JSON.stringify([
          { bucket_id: "contribution-photos", object_path: "user/a.jpg" },
          { bucket_id: "contribution-photos", object_path: "user/b.jpg" },
        ]), { status: 200 });
      }
      if (url.endsWith("/a.jpg")) return new Response(null, { status: 200 });
      return new Response("no", { status: 500 });
    },
  });
  assertEquals(result.ok, false);
  assertEquals(result.removed, 1);
  assertEquals(result.failed, 1);
  assertEquals(result.error, "delete_500");
});
