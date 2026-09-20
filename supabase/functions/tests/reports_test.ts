import { assertEquals } from "jsr:@std/assert@1";
import { translationReportSchema } from "../_shared/schemas.ts";

Deno.test("translation report schema requires consent and idempotency", () => {
  const ok = translationReportSchema.safeParse({
    source_text: "hello",
    model_output: "नमस्ते",
    direction: "en-ne",
    formality: "formal",
    script: "deva",
    surface: "live_translate",
    idempotency_key: "corr_abc12345",
    consent_version: "2026-09-19.draft",
  });
  assertEquals(ok.success, true);

  const bad = translationReportSchema.safeParse({
    source_text: "hello",
    model_output: "नमस्ते",
    direction: "en-ne",
    formality: "formal",
    script: "deva",
    surface: "live_translate",
    idempotency_key: "short",
    consent_version: "2026-09-19.draft",
  });
  assertEquals(bad.success, false);
});
