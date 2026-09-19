/** Grapheme similarity used by contribution scoring. Server is authoritative. */

export const THRESHOLDS = {
  knownPass: 0.72,
  strongAgreement: 0.8,
  borderlineLow: 0.72,
  borderlineHigh: 0.79,
  substantiveModelBelow: 0.92,
  shortGraphemeMax: 4,
} as const;

export function normalizeForScore(input: string): string {
  let s = input.normalize("NFC").trim().replace(/\s+/g, " ");
  s = s.replace(/[A-Za-z]+/g, (m) => m.toLowerCase());
  s = s.replace(/[。．.]+$/u, ".");
  s = s.replace(/[！!]+$/u, "!");
  s = s.replace(/[？?]+$/u, "?");
  s = s.replace(/([.!?])\1+$/u, "$1");
  return s;
}

export function graphemes(input: string): string[] {
  const intl = Intl as unknown as {
    Segmenter?: new (
      locale: string,
      opts: { granularity: "grapheme" },
    ) => { segment(input: string): Iterable<{ segment: string }> };
  };
  if (typeof intl.Segmenter === "function") {
    const segmenter = new intl.Segmenter("ne", { granularity: "grapheme" });
    return [...segmenter.segment(input)].map((part) => part.segment);
  }
  return Array.from(input);
}

export function levenshtein(a: string[], b: string[]): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(cols);
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j < cols; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[cols - 1];
}

function tokenDice(a: string, b: string): number {
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  if (ta.length + tb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const token of tb) counts.set(token, (counts.get(token) ?? 0) + 1);
  let inter = 0;
  for (const token of ta) {
    const n = counts.get(token) ?? 0;
    if (n > 0) {
      inter += 1;
      counts.set(token, n - 1);
    }
  }
  return (2 * inter) / (ta.length + tb.length);
}

/** null = invalid pair (both empty). 0 = one side empty. */
export function similarity(a: string, b: string): number | null {
  const na = normalizeForScore(a);
  const nb = normalizeForScore(b);
  if (na.length === 0 && nb.length === 0) return null;
  if (na.length === 0 || nb.length === 0) return 0;
  const ga = graphemes(na);
  const gb = graphemes(nb);
  const edit = 1 - levenshtein(ga, gb) / Math.max(ga.length, gb.length);
  return 0.75 * edit + 0.25 * tokenDice(na, nb);
}

export function knownCheckPasses(answer: string, references: string[]): boolean {
  const normalized = normalizeForScore(answer);
  if (!normalized) return false;
  const answerLen = graphemes(normalized).length;
  for (const reference of references) {
    const refNorm = normalizeForScore(reference);
    if (!refNorm) continue;
    if (normalized === refNorm) return true;
    const refLen = graphemes(refNorm).length;
    if (answerLen <= THRESHOLDS.shortGraphemeMax || refLen <= THRESHOLDS.shortGraphemeMax) {
      continue;
    }
    const score = similarity(answer, reference);
    if (score !== null && score >= THRESHOLDS.knownPass) return true;
  }
  return false;
}

export const PUBLIC_TASK_KEYS = [
  "public_task_id",
  "source_text",
  "model_output",
  "direction",
  "formality",
  "script",
  "reward_label",
] as const;

const REWARD_LABEL = "Earn 1–6 credits after validation";

/** Allowlist. Extra fields such as task_type or references are dropped. */
export function toPublicContribution(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_TASK_KEYS) {
    if (key === "reward_label") continue;
    out[key] = row[key] ?? null;
  }
  out.reward_label = REWARD_LABEL;
  return out;
}

export function nextEarnedExpiry(
  now: Date,
  current: Date | null,
  minutes: number,
): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + minutes * 60_000);
}
