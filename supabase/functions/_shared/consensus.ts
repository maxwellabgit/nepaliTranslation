import { knownCheckPasses, similarity, THRESHOLDS } from "./scoring.ts";

export type ContributorBand = "normal" | "probation";

export type ConsensusVote = {
  userId: string;
  band: ContributorBand;
  normalizedResponse: string;
  /** Model similarity alone must never resolve. */
  modelSimilarity?: number | null;
};

export type ConsensusResult =
  | { status: "pending" }
  | { status: "resolved"; winner: string; rewardEligible: true }
  | { status: "disputed"; rewardEligible: false }
  | { status: "rejected"; reason: string; rewardEligible: false };

function agree(a: string, b: string): boolean {
  if (a === b) return true;
  const score = similarity(a, b);
  return score !== null && score >= THRESHOLDS.strongAgreement;
}

/**
 * Consensus never uses model similarity alone.
 * Two matching normal contributors resolve. Probation-only pairs do not.
 * Three distinct disagreeing answers become disputed with no reward.
 */
export function resolveConsensus(votes: ConsensusVote[]): ConsensusResult {
  const uniqueUsers = new Set(votes.map((v) => v.userId));
  if (uniqueUsers.size !== votes.length) {
    return { status: "rejected", reason: "duplicate_user", rewardEligible: false };
  }
  if (votes.length < 2) return { status: "pending" };

  const normals = votes.filter((v) => v.band === "normal");
  for (let i = 0; i < normals.length; i++) {
    for (let j = i + 1; j < normals.length; j++) {
      if (agree(normals[i].normalizedResponse, normals[j].normalizedResponse)) {
        return {
          status: "resolved",
          winner: normals[i].normalizedResponse,
          rewardEligible: true,
        };
      }
    }
  }

  if (votes.length >= 3) {
    const answers = votes.map((v) => v.normalizedResponse);
    const allDisagree =
      !agree(answers[0], answers[1]) &&
      !agree(answers[0], answers[2]) &&
      !agree(answers[1], answers[2]);
    if (allDisagree) {
      return { status: "disputed", rewardEligible: false };
    }
  }

  return { status: "pending" };
}

export function scoreKnownSubmission(
  response: string,
  references: string[],
): { pass: boolean; similarity: number | null } {
  const pass = knownCheckPasses(response, references);
  let best: number | null = null;
  for (const ref of references) {
    const s = similarity(response, ref);
    if (s === null) continue;
    if (best === null || s > best) best = s;
  }
  return { pass, similarity: best };
}

/** Deterministic mulberry32 for assignment ratio simulations. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Known-check share targets by trust band.
 * Returns "known_check" or "unknown".
 */
export function pickTaskType(
  band: ContributorBand,
  rng: () => number,
): "known_check" | "unknown" {
  const knownShare = band === "probation" ? 0.45 : 0.25;
  return rng() < knownShare ? "known_check" : "unknown";
}
