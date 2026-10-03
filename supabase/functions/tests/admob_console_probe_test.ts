import { assertEquals } from "jsr:@std/assert@1";
import { stub } from "jsr:@std/testing@1/mock";
import {
  generateTestKeyPair,
  seedAdmobKeyCache,
  signSsvContentForTest,
} from "../_shared/admobSsv.ts";

let handler: (req: Request) => Promise<Response>;
const serve = stub(Deno, "serve", ((callback: typeof handler) => {
  handler = callback;
}) as typeof Deno.serve);
try {
  await import("../admob-ssv/index.ts");
} finally {
  serve.restore();
}

Deno.test("console probe checks signed sentinel fields and never calls reward RPC", async () => {
  const pair = await generateTestKeyPair();
  seedAdmobKeyCache([pair.publicKey]);
  const env = stub(Deno.env, "get", (name: string) => ({
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-only",
    ADMOB_REWARDED_UNIT_ID: "ca-app-pub-4740685179017246/7882267470",
  }[name]));
  let rpcCalls = 0;
  const fetchStub = stub(globalThis, "fetch", () => {
    rpcCalls++;
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  const base = {
    ad_network: "5450213213286189855",
    ad_unit: "1234567890",
    custom_data: "verification-only-no-reward",
    reward_amount: "20",
    reward_item: "ad_free_minutes",
    timestamp: String(Date.now()),
    transaction_id: "123456789",
    user_id: "bola-admob-console-verification",
  };
  async function request(changes: Partial<typeof base> = {}, tamper = false) {
    const content = new URLSearchParams({ ...base, ...changes }).toString();
    const signature = await signSsvContentForTest(content, pair.privateKey);
    const query = `${content}&signature=${encodeURIComponent(signature)}&key_id=${pair.keyId}`;
    return handler(new Request(`https://example.invalid/?${tamper ? query.replace("reward_amount=20", "reward_amount=21") : query}`));
  }
  try {
    const result = await request();
    assertEquals(result.status, 200);
    assertEquals((await result.json()).verification_only, true);
    assertEquals((await request()).status, 200); // Repeated probes still have no effects.
    for (const changes of [
      { ad_unit: "7882267471" },
      { user_id: "11111111-1111-4111-8111-111111111111" },
      { custom_data: "real-session-token" },
      { transaction_id: "real-transaction" },
      { reward_amount: "30" },
      { reward_item: "coins" },
      { timestamp: String(Date.now() - 10 * 60 * 1000) },
    ]) assertEquals((await request(changes)).status, 400);
    assertEquals((await request({}, true)).status, 400);
    assertEquals(rpcCalls, 0);
    // A real owner unit remains on the existing session/ledger RPC path.
    assertEquals((await request({ ad_unit: "7882267470", transaction_id: "real-tx", user_id: "11111111-1111-4111-8111-111111111111", custom_data: "real-session" })).status, 200);
    assertEquals(rpcCalls, 1);
  } finally {
    fetchStub.restore();
    env.restore();
  }
});
