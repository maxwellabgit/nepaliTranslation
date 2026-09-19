import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  knownCheckPasses,
  nextEarnedExpiry,
  normalizeForScore,
  similarity,
  toPublicContribution,
} from "../_shared/scoring.ts";

Deno.test("NFC makes Devanagari combining marks match", () => {
  const composed = "का";
  const decomposed = "क\u093e";
  assertEquals(normalizeForScore(decomposed), normalizeForScore(composed));
  assertEquals(similarity(decomposed, composed), 1);
});

Deno.test("roman case and repeated terminal punctuation normalize", () => {
  assertEquals(normalizeForScore("  Hello!!!  "), "hello!");
  assertEquals(similarity("HELLO", "hello"), 1);
  assertEquals(similarity("Hello...", "hello."), 1);
});

Deno.test("empty pairs are invalid and mixed empty pairs score 0", () => {
  assertEquals(similarity("   ", ""), null);
  assertEquals(similarity("", "namaste"), 0);
});

Deno.test("very short answers require an exact alias", () => {
  assertEquals(knownCheckPasses("हो", ["हो"]), true);
  assertEquals(knownCheckPasses("हो", ["हुन"]), false);
  assertEquals(knownCheckPasses("okay", ["ok"]), false);
});

Deno.test("formal and informal Nepali do not pass a known check against each other", () => {
  assertEquals(
    knownCheckPasses("तपाईं जानुहोस्", ["तिमी जाऊ"]),
    false,
  );
  const score = similarity("तपाईं जानुहोस्", "तिमी जाऊ");
  assert(score !== null && score < 0.72);
});

Deno.test("negation does not pass a known check", () => {
  assertEquals(knownCheckPasses("म आज जान्छु", ["म आज जाँदिन"]), false);
  const score = similarity("म आज जान्छु", "म आज जाँदिन");
  assert(score !== null && score < 0.72);
});

Deno.test("public task JSON drops known-check fields", () => {
  const pub = toPublicContribution({
    public_task_id: "c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0",
    source_text: "SYNQC01 the blue kettle sits on the roof",
    model_output: "निलो केतली छानामा छ",
    direction: "en-ne",
    formality: "formal",
    script: "deva",
    task_type: "known_check",
    reference_set_id: "secret",
    is_known: true,
    normalized_text: "secret",
    reliability: 0.99,
  });
  const keys = Object.keys(pub).sort();
  assertEquals(keys, [
    "direction",
    "formality",
    "model_output",
    "public_task_id",
    "reward_label",
    "script",
    "source_text",
  ]);
  assertEquals(JSON.stringify(pub).includes("known_check"), false);
  assertEquals(JSON.stringify(pub).includes("secret"), false);
  assertEquals(pub.reward_label, "Earn 1–6 credits after validation");
});

Deno.test("earned expiry stacks from the later of now and current expiry", () => {
  const now = new Date("2026-09-19T12:00:00.000Z");
  const later = nextEarnedExpiry(now, new Date("2026-09-19T12:10:00.000Z"), 5);
  assertEquals(later.toISOString(), "2026-09-19T12:15:00.000Z");
  const fromNow = nextEarnedExpiry(now, new Date("2026-09-19T11:00:00.000Z"), 5);
  assertEquals(fromNow.toISOString(), "2026-09-19T12:05:00.000Z");
});
