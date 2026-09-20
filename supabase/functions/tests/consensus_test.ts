import { assertEquals } from "jsr:@std/assert@1";
import {
  mulberry32,
  pickTaskType,
  resolveConsensus,
  scoreKnownSubmission,
} from "../_shared/consensus.ts";

Deno.test("two matching normal contributors resolve", () => {
  const result = resolveConsensus([
    { userId: "a", band: "normal", normalizedResponse: "नमस्ते" },
    { userId: "b", band: "normal", normalizedResponse: "नमस्ते" },
  ]);
  assertEquals(result.status, "resolved");
});

Deno.test("duplicate user is rejected", () => {
  const result = resolveConsensus([
    { userId: "a", band: "normal", normalizedResponse: "नमस्ते" },
    { userId: "a", band: "normal", normalizedResponse: "नमस्ते" },
  ]);
  assertEquals(result.status, "rejected");
});

Deno.test("two probation users do not resolve", () => {
  const result = resolveConsensus([
    { userId: "a", band: "probation", normalizedResponse: "नमस्ते" },
    { userId: "b", band: "probation", normalizedResponse: "नमस्ते" },
  ]);
  assertEquals(result.status, "pending");
});

Deno.test("model similarity alone does not resolve", () => {
  const result = resolveConsensus([
    {
      userId: "a",
      band: "normal",
      normalizedResponse: "hello",
      modelSimilarity: 0.99,
    },
  ]);
  assertEquals(result.status, "pending");
});

Deno.test("three-way disagreement is disputed without reward", () => {
  const result = resolveConsensus([
    { userId: "a", band: "normal", normalizedResponse: "एक" },
    { userId: "b", band: "normal", normalizedResponse: "दुई" },
    { userId: "c", band: "normal", normalizedResponse: "तीन" },
  ]);
  assertEquals(result.status, "disputed");
  if (result.status === "disputed") assertEquals(result.rewardEligible, false);
});

Deno.test("register and negation fail known check", () => {
  assertEquals(
    scoreKnownSubmission("तपाईं जानुहोस्", ["तिमी जाऊ"]).pass,
    false,
  );
  assertEquals(
    scoreKnownSubmission("म आज जाँदिन", ["म आज जान्छु"]).pass,
    false,
  );
});

Deno.test("assignment ratios stay near target for 1000 draws", () => {
  const rng = mulberry32(42);
  let known = 0;
  for (let i = 0; i < 1000; i++) {
    if (pickTaskType("normal", rng) === "known_check") known += 1;
  }
  const share = known / 1000;
  assertEquals(share > 0.18 && share < 0.32, true);
});
