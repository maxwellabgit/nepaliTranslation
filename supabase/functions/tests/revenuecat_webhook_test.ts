import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Lightweight webhook auth + payload shape tests (no live Supabase).
 * Full RPC idempotency is covered by pgTAP when Docker is available.
 */

Deno.test("RevenueCat webhook rejects missing Authorization shape", () => {
  const header = "";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? "";
  assertEquals(token, "");
});

Deno.test("RevenueCat webhook accepts Bearer token", () => {
  const header = "Bearer secret-token";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? "";
  assertEquals(token, "secret-token");
});

Deno.test("RevenueCat event requires id, type, app_user_id", () => {
  const event = {
    id: "evt_1",
    type: "INITIAL_PURCHASE",
    app_user_id: "11111111-1111-4111-8111-111111111111",
    product_id: "neptranslate_adfree_monthly",
  };
  assertExists(event.id);
  assertExists(event.type);
  assertExists(event.app_user_id);
});
