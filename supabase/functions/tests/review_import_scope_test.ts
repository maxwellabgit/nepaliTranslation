import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { selectReviewCorpus } from "../../scripts/reviewImportScope.ts";

const review = {
  id: "approved-review",
  purpose: "review",
  rights_status: "cleared_public_display",
  visibility: "public_review_gated",
  format: "jsonl-review-candidate",
};

Deno.test("review imports require an explicit rights-cleared review corpus", () => {
  assertEquals(selectReviewCorpus([review], review.id), review);
  assertThrows(() => selectReviewCorpus([review]), Error, "--corpus=ID");
  assertThrows(() => selectReviewCorpus([review], "unknown"), Error, "Unknown");
  for (const disallowed of [
    { ...review, purpose: "gold" },
    { ...review, purpose: "training" },
    { ...review, purpose: "benchmark" },
    { ...review, rights_status: "unresolved" },
    { ...review, visibility: "public_review_eligible" },
    { ...review, format: "gold-pair" },
  ]) {
    assertThrows(() => selectReviewCorpus([disallowed], review.id), Error, "not cleared");
  }
  assertThrows(() => selectReviewCorpus([review, review], review.id), Error, "duplicate");
});
