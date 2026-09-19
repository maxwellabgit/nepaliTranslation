import { assertEquals } from "jsr:@std/assert@1";
import {
  nextDeletionStep,
  revokeAppleAuthorizationCode,
  runAccountDeletion,
} from "../_shared/deletion.ts";

Deno.test("deletion resumes after a failed purge", async () => {
  let purges = 0;
  const first = await runAccountDeletion([], {
    revoke: async () => "revoked",
    purge: async () => {
      purges += 1;
      throw new Error("db down");
    },
    deleteAuth: async () => undefined,
  });
  assertEquals(first.status, "retry");
  assertEquals(first.completed, ["revoke_apple"]);
  assertEquals(nextDeletionStep(first.completed), "purge_data");

  const second = await runAccountDeletion(first.completed, {
    revoke: async () => {
      throw new Error("should not revoke again");
    },
    purge: async () => {
      purges += 1;
    },
    deleteAuth: async () => undefined,
  });
  assertEquals(second.status, "done");
  assertEquals(purges, 2);
  assertEquals(second.completed.includes("revoke_apple"), true);
});

Deno.test("missing Apple provider secrets block deletion", async () => {
  let purged = false;
  const result = await runAccountDeletion([], {
    revoke: async () => "unconfigured",
    purge: async () => {
      purged = true;
    },
    deleteAuth: async () => undefined,
  });
  assertEquals(result.status, "blocked");
  assertEquals(result.code, "apple_unconfigured");
  assertEquals(purged, false);
});

Deno.test("failed auth delete resumes without repeating purge", async () => {
  let purges = 0;
  let deletes = 0;
  const first = await runAccountDeletion(["revoke_apple"], {
    revoke: async () => "revoked",
    purge: async () => {
      purges += 1;
    },
    deleteAuth: async () => {
      deletes += 1;
      throw new Error("auth admin down");
    },
  });
  assertEquals(first.status, "retry");
  assertEquals(first.code, "delete_auth_failed");
  assertEquals(first.completed, ["revoke_apple", "purge_data"]);

  const second = await runAccountDeletion(first.completed, {
    revoke: async () => "revoked",
    purge: async () => {
      purges += 1;
    },
    deleteAuth: async () => {
      deletes += 1;
    },
  });
  assertEquals(second.status, "done");
  assertEquals(purges, 1);
  assertEquals(deletes, 2);
});

Deno.test("revoke exchanges the authorization code before revoking the refresh token", async () => {
  const calls: string[] = [];
  const result = await revokeAppleAuthorizationCode("auth-code-1", {
    appleClientId: "com.neptranslate.app",
    appleClientSecret: "test-secret",
  }, async (input, init) => {
    const url = String(input);
    calls.push(url);
    const body = String(init?.body ?? "");
    if (url.endsWith("/auth/token")) {
      if (!body.includes("grant_type=authorization_code") || !body.includes("code=auth-code-1")) {
        throw new Error("token exchange did not send the authorization code");
      }
      return new Response(JSON.stringify({
        refresh_token: "refresh-1",
        access_token: "access-1",
      }), { status: 200 });
    }
    if (url.endsWith("/auth/revoke")) {
      if (body.includes("auth-code-1") || !body.includes("token=refresh-1")) {
        throw new Error("revoke must use the refresh token, not the authorization code");
      }
      if (!body.includes("token_type_hint=refresh_token")) {
        throw new Error("missing refresh token hint");
      }
      return new Response(null, { status: 200 });
    }
    return new Response("missing", { status: 404 });
  });
  assertEquals(result, "revoked");
  assertEquals(calls, [
    "https://appleid.apple.com/auth/token",
    "https://appleid.apple.com/auth/revoke",
  ]);
});

Deno.test("unsaved progress does not count the step", async () => {
  const first = await runAccountDeletion([], {
    revoke: async () => "revoked",
    purge: async () => undefined,
    deleteAuth: async () => undefined,
    onProgress: async (completed) => {
      if (completed.includes("purge_data")) throw new Error("db down");
    },
  });
  assertEquals(first.status, "retry");
  assertEquals(first.code, "progress_not_saved");
  assertEquals(first.completed, ["revoke_apple"]);
});
