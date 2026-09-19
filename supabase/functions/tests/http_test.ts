import { assertEquals } from "jsr:@std/assert@1";
import { buildAccountSummary, contributionSubmitSchema } from "../_shared/schemas.ts";
import { allowRate, errorBody, requestIdFrom } from "../_shared/http.ts";

Deno.test("account summary uses stable nullable fields", () => {
  const summary = buildAccountSummary({
    receipt_count: 2,
    lifetime_credits: 4,
  });
  assertEquals(summary.consent_version, null);
  assertEquals(summary.receipt_count, 2);
  assertEquals(summary.earned_ad_free_until, null);
});

Deno.test("contribution schema rejects missing idempotency", () => {
  const parsed = contributionSubmitSchema.safeParse({
    assignment_id: "c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0",
    action: "skip",
  });
  assertEquals(parsed.success, false);
});

Deno.test("errors do not include database text", () => {
  const body = errorBody("unavailable", "req-1");
  assertEquals(body, { error: { code: "unavailable", request_id: "req-1" } });
  assertEquals(JSON.stringify(body).includes("relation"), false);
});

Deno.test("request id prefers the inbound header", () => {
  const req = new Request("http://localhost/health", {
    headers: { "x-request-id": "abc-123" },
  });
  assertEquals(requestIdFrom(req), "abc-123");
});

Deno.test("rate limit blocks the call past the window budget", () => {
  const store = new Map();
  assertEquals(allowRate("u1", 2, 1000, 0, store), true);
  assertEquals(allowRate("u1", 2, 1000, 10, store), true);
  assertEquals(allowRate("u1", 2, 1000, 20, store), false);
  assertEquals(allowRate("u1", 2, 1000, 1001, store), true);
});
