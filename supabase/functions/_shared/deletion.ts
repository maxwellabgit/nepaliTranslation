export type DeletionStep = "revoke_apple" | "purge_data" | "delete_auth" | "done";

const ORDER: DeletionStep[] = ["revoke_apple", "purge_data", "delete_auth", "done"];

export function nextDeletionStep(completed: DeletionStep[]): DeletionStep {
  for (const step of ORDER) {
    if (!completed.includes(step)) return step;
  }
  return "done";
}

export type RevokeResult = "revoked" | "unconfigured" | "failed";

export type DeletionProgress = {
  completed: DeletionStep[];
  status: "done" | "blocked" | "retry";
  code?:
    | "apple_unconfigured"
    | "apple_revoke_failed"
    | "purge_failed"
    | "delete_auth_failed"
    | "progress_not_saved";
};

const STEP_SET = new Set<DeletionStep>(ORDER);

export function parseDeletionProgress(value: unknown): DeletionStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter((step): step is DeletionStep =>
    typeof step === "string" && STEP_SET.has(step as DeletionStep) && step !== "done"
  );
}

/**
 * Exchange the one-time authorization code for a refresh token, then revoke that token.
 * Never send the authorization code itself to /auth/revoke.
 */
export async function revokeAppleAuthorizationCode(
  authorizationCode: string,
  env: { appleClientId?: string; appleClientSecret?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<RevokeResult> {
  if (!env.appleClientId || !env.appleClientSecret || !authorizationCode) {
    return "unconfigured";
  }
  const tokenRes = await fetchImpl("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.appleClientId,
      client_secret: env.appleClientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return "failed";
  const tokenJson = await tokenRes.json() as {
    refresh_token?: string;
    access_token?: string;
  };
  const token = tokenJson.refresh_token || tokenJson.access_token;
  if (!token) return "failed";
  const res = await fetchImpl("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.appleClientId,
      client_secret: env.appleClientSecret,
      token,
      token_type_hint: tokenJson.refresh_token ? "refresh_token" : "access_token",
    }),
  });
  return res.ok ? "revoked" : "failed";
}

/**
 * Runs remaining steps. A failed step is not recorded, so the next call resumes there.
 * Missing Apple provider secrets block deletion instead of pretending the token was revoked.
 */
export async function runAccountDeletion(
  completed: DeletionStep[],
  deps: {
    revoke: () => Promise<RevokeResult>;
    purge: () => Promise<void>;
    deleteAuth: () => Promise<void>;
    /** Persist completed steps before they count. A throw leaves the step unfinished. */
    onProgress?: (completed: DeletionStep[]) => Promise<void>;
  },
): Promise<DeletionProgress> {
  const done = [...completed];

  const commit = async (step: DeletionStep): Promise<boolean> => {
    const next = [...done, step];
    try {
      if (deps.onProgress) await deps.onProgress(next);
    } catch {
      return false;
    }
    done.push(step);
    return true;
  };

  let step = nextDeletionStep(done);
  while (step !== "done") {
    if (step === "revoke_apple") {
      const revoked = await deps.revoke();
      if (revoked === "unconfigured") {
        return { completed: done, status: "blocked", code: "apple_unconfigured" };
      }
      if (revoked !== "revoked") {
        return { completed: done, status: "retry", code: "apple_revoke_failed" };
      }
      if (!await commit("revoke_apple")) {
        return { completed: done, status: "retry", code: "progress_not_saved" };
      }
    } else if (step === "purge_data") {
      try {
        await deps.purge();
      } catch {
        return { completed: done, status: "retry", code: "purge_failed" };
      }
      if (!await commit("purge_data")) {
        return { completed: done, status: "retry", code: "progress_not_saved" };
      }
    } else if (step === "delete_auth") {
      try {
        await deps.deleteAuth();
      } catch {
        return { completed: done, status: "retry", code: "delete_auth_failed" };
      }
      if (!await commit("delete_auth")) {
        return { completed: done, status: "retry", code: "progress_not_saved" };
      }
    }
    step = nextDeletionStep(done);
  }
  return { completed: done, status: "done" };
}
