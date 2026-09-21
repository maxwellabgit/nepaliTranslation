import { assertEquals } from "jsr:@std/assert@1";
import {
  clearAdmobKeyCache,
  generateTestKeyPair,
  signSsvContentForTest,
  verifyAdmobSsv,
  type AdmobPublicKey,
} from "../_shared/admobSsv.ts";

const UNIT = "ca-app-pub-test/rewarded";
const USER = "11111111-1111-4111-8111-111111111111";
const SESSION = "sess_opaque_token_abc";

async function buildValidQuery(opts?: {
  rewardAmount?: string;
  rewardItem?: string;
  userId?: string;
  customData?: string;
  unit?: string;
  timestamp?: string;
  transactionId?: string;
}): Promise<{ query: string; pub: AdmobPublicKey; keyId: number }> {
  const pair = await generateTestKeyPair();
  const timestamp = opts?.timestamp ?? String(Date.now());
  const transactionId =
    opts?.transactionId ?? "18fa792de1bca816048293fc71035638";
  const content = [
    `ad_network=5450213213286189855`,
    `ad_unit=${opts?.unit ?? UNIT}`,
    `custom_data=${opts?.customData ?? SESSION}`,
    `reward_amount=${opts?.rewardAmount ?? "10"}`,
    `reward_item=${opts?.rewardItem ?? "ad_free_minutes"}`,
    `timestamp=${timestamp}`,
    `transaction_id=${transactionId}`,
    `user_id=${opts?.userId ?? USER}`,
  ].join("&");

  const signature = await signSsvContentForTest(content, pair.privateKey);
  const query =
    `${content}&signature=${encodeURIComponent(signature)}&key_id=${pair.keyId}`;
  return { query, pub: pair.publicKey, keyId: pair.keyId };
}

Deno.test("SSV valid fixture passes", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery();
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [built.pub],
    allowedAdUnit: UNIT,
    expectedUserId: USER,
    expectedSessionToken: SESSION,
    expectedRewardAmount: "10",
    expectedRewardItem: "ad_free_minutes",
  });
  assertEquals(ok.ok, true);
});

Deno.test("SSV altered query fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery();
  const altered = built.query.replace("reward_amount=10", "reward_amount=99");
  const ok = await verifyAdmobSsv({
    query: altered,
    keys: [built.pub],
    allowedAdUnit: UNIT,
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "bad_signature");
});

Deno.test("SSV wrong key fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery();
  const other = await generateTestKeyPair();
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [{ keyId: built.keyId, base64: other.publicKey.base64 }],
    allowedAdUnit: UNIT,
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "bad_signature");
});

Deno.test("SSV wrong unit fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery();
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [built.pub],
    allowedAdUnit: "ca-app-pub-other/unit",
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "wrong_unit");
});

Deno.test("SSV wrong user fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery();
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [built.pub],
    allowedAdUnit: UNIT,
    expectedUserId: "00000000-0000-4000-8000-000000000000",
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "wrong_user");
});

Deno.test("SSV wrong session fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery();
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [built.pub],
    allowedAdUnit: UNIT,
    expectedSessionToken: "other_session",
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "wrong_session");
});

Deno.test("SSV stale timestamp fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery({
    timestamp: String(Date.now() - 72 * 60 * 60 * 1000),
  });
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [built.pub],
    allowedAdUnit: UNIT,
    maxAgeMs: 48 * 60 * 60 * 1000,
    nowMs: Date.now(),
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "stale_timestamp");
});

Deno.test("SSV wrong reward fails", async () => {
  clearAdmobKeyCache();
  const built = await buildValidQuery({ rewardAmount: "5" });
  const ok = await verifyAdmobSsv({
    query: built.query,
    keys: [built.pub],
    allowedAdUnit: UNIT,
    expectedRewardAmount: "10",
    expectedRewardItem: "ad_free_minutes",
  });
  assertEquals(ok.ok, false);
  if (!ok.ok) assertEquals(ok.reason, "wrong_reward");
});

Deno.test("SSV duplicate transaction id is stable across verifications", async () => {
  clearAdmobKeyCache();
  const tx = "dup_tx_001";
  const a = await buildValidQuery({ transactionId: tx });
  const first = await verifyAdmobSsv({
    query: a.query,
    keys: [a.pub],
    allowedAdUnit: UNIT,
  });
  const second = await verifyAdmobSsv({
    query: a.query,
    keys: [a.pub],
    allowedAdUnit: UNIT,
  });
  assertEquals(first.ok, true);
  assertEquals(second.ok, true);
  if (first.ok && second.ok) {
    assertEquals(first.params.transaction_id, tx);
    assertEquals(second.params.transaction_id, tx);
  }
});

Deno.test("SSV key rotation: unknown key_id fails; rotated key passes", async () => {
  clearAdmobKeyCache();
  const oldPair = await generateTestKeyPair();
  const newPair = await generateTestKeyPair();
  const newKeyId = 3901585526;
  const timestamp = String(Date.now());
  const content = [
    `ad_network=5450213213286189855`,
    `ad_unit=${UNIT}`,
    `custom_data=${SESSION}`,
    `reward_amount=10`,
    `reward_item=ad_free_minutes`,
    `timestamp=${timestamp}`,
    `transaction_id=rot_tx_1`,
    `user_id=${USER}`,
  ].join("&");
  const signature = await signSsvContentForTest(content, newPair.privateKey);
  const query =
    `${content}&signature=${encodeURIComponent(signature)}&key_id=${newKeyId}`;

  const withOldOnly = await verifyAdmobSsv({
    query,
    keys: [oldPair.publicKey],
    allowedAdUnit: UNIT,
  });
  assertEquals(withOldOnly.ok, false);
  if (!withOldOnly.ok) assertEquals(withOldOnly.reason, "unknown_key");

  const withRotated = await verifyAdmobSsv({
    query,
    keys: [
      oldPair.publicKey,
      { keyId: newKeyId, base64: newPair.publicKey.base64 },
    ],
    allowedAdUnit: UNIT,
  });
  assertEquals(withRotated.ok, true);
});
