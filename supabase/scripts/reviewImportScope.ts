/** Only an explicitly selected, display-cleared review corpus may enter the review pool. */
export function selectReviewCorpus<T extends {
  id: string;
  purpose: string;
  rights_status?: string;
  visibility: string;
  format: string;
}>(corpora: readonly T[], corpusId?: string): T {
  if (!corpusId) throw new Error("Specify --corpus=ID for a rights-cleared review corpus");
  const matches = corpora.filter((corpus) => corpus.id === corpusId);
  if (matches.length !== 1) throw new Error(`Unknown or duplicate review corpus: ${corpusId}`);
  const corpus = matches[0];
  if (
    corpus.purpose !== "review" ||
    corpus.rights_status !== "cleared_public_display" ||
    corpus.visibility !== "public_review_gated" ||
    corpus.format !== "jsonl-review-candidate"
  ) {
    throw new Error(`Corpus ${corpusId} is not cleared for public review import`);
  }
  return corpus;
}
