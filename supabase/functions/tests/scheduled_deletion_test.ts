import { assertEquals } from "jsr:@std/assert@1";
import { handleScheduledDeletion } from "../_shared/scheduledDeletion.ts";

Deno.test("scheduled deletion retains authorization and never invokes retired reward close", async () => {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "STORAGE_SERVICE_ROLE_KEY"];
  const before = keys.map(key => Deno.env.get(key));
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  try {
    Deno.env.set("SUPABASE_URL", "https://local.example");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
    Deno.env.set("CRON_SECRET", "test-cron");
    Deno.env.delete("STORAGE_SERVICE_ROLE_KEY");
    const request = (token: string) => new Request("https://local.example/worker", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
    });
    globalThis.fetch = (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify(calls.length === 1 ? [{
        id: "request", user_id: "guest", request_kind: "consent_withdrawal",
        storage_completed: true, database_completed: false, auth_completion: "pending",
      }] : { ok: true, stage: "complete" }));
    }) as typeof fetch;
    assertEquals((await handleScheduledDeletion(request("wrong"))).status, 401);
    assertEquals(calls, []);
    const response = await handleScheduledDeletion(request("test-cron"));
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      ok: true, reward_close: { retired: true, applied: 0 },
      deletion_results: [{ id: "request", request_kind: "consent_withdrawal", stage: "complete", ok: true }],
    });
    assertEquals(calls, [
      "https://local.example/rest/v1/rpc/service_list_due_deletion_requests",
      "https://local.example/rest/v1/rpc/service_complete_deletion_database",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => before[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, before[i]!));
  }
});
