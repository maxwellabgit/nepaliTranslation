/**
 * Google AdMob rewarded SSV ECDSA verification (P-256 / SHA-256 / DER).
 * Verifies the exact query content before signature=&key_id= (order preserved).
 */

export type AdmobPublicKey = {
  keyId: number;
  /** SPKI base64 (from Google verifier-keys.json `base64` field). */
  base64: string;
};

export type SsvVerifyInput = {
  /** Full query string including signature and key_id. */
  query: string;
  keys: AdmobPublicKey[];
  allowedAdUnit: string;
  /** Max age of timestamp (ms). Google sends epoch ms. */
  maxAgeMs?: number;
  nowMs?: number;
  expectedUserId?: string;
  expectedSessionToken?: string;
  expectedRewardAmount?: string;
  expectedRewardItem?: string;
};

export type SsvVerifyResult =
  | {
      ok: true;
      params: Record<string, string>;
      keyId: number;
    }
  | { ok: false; reason: string };

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

let keyCache: { fetchedAtMs: number; keys: AdmobPublicKey[] } | null = null;
const KEY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function fetchAdmobVerifierKeys(
  fetchImpl: typeof fetch = fetch,
  nowMs = Date.now(),
): Promise<AdmobPublicKey[]> {
  if (keyCache && nowMs - keyCache.fetchedAtMs < KEY_CACHE_TTL_MS) {
    return keyCache.keys;
  }
  const res = await fetchImpl(KEYS_URL);
  if (!res.ok) throw new Error('key_fetch_failed');
  const body = (await res.json()) as {
    keys?: Array<{ keyId?: number; base64?: string }>;
  };
  const keys: AdmobPublicKey[] = [];
  for (const k of body.keys ?? []) {
    if (typeof k.keyId === 'number' && typeof k.base64 === 'string') {
      keys.push({ keyId: k.keyId, base64: k.base64 });
    }
  }
  if (keys.length === 0) throw new Error('no_keys');
  keyCache = { fetchedAtMs: nowMs, keys };
  return keys;
}

/** Test helper: clear key cache between fixture runs. */
export function clearAdmobKeyCache(): void {
  keyCache = null;
}

/** Inject keys into cache (tests / key rotation fixtures). */
export function seedAdmobKeyCache(keys: AdmobPublicKey[], nowMs = Date.now()): void {
  keyCache = { fetchedAtMs: nowMs, keys };
}

export function parseSsvQuery(query: string): {
  content: string;
  signatureB64: string;
  keyId: number;
  params: Record<string, string>;
} | null {
  const sigMarker = 'signature=';
  const keyMarker = 'key_id=';
  const sigIdx = query.indexOf(sigMarker);
  if (sigIdx <= 0) return null;
  const content = query.slice(0, sigIdx - 1); // drop trailing &
  const afterSig = query.slice(sigIdx + sigMarker.length);
  const keyIdx = afterSig.indexOf(`&${keyMarker}`);
  if (keyIdx < 0) return null;
  const signatureB64 = afterSig.slice(0, keyIdx);
  const keyId = Number(afterSig.slice(keyIdx + 1 + keyMarker.length));
  if (!Number.isFinite(keyId)) return null;

  const params: Record<string, string> = {};
  for (const part of content.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
    params[k] = v;
  }
  params.signature = decodeURIComponent(signatureB64.replace(/\+/g, ' '));
  params.key_id = String(keyId);
  return { content, signatureB64: params.signature, keyId, params };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Deno/WebCrypto types require BufferSource; sliced ArrayBuffer avoids SharedArrayBuffer. */
function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/** Convert ECDSA DER signature to WebCrypto P-256 raw (r||s, 64 bytes). */
export function derEcdsaToRaw(der: Uint8Array): Uint8Array {
  // Expect SEQUENCE { INTEGER r, INTEGER s }
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('bad_der');
  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < n; i++) seqLen = (seqLen << 8) | der[offset++];
  }
  const readInt = (): Uint8Array => {
    if (der[offset++] !== 0x02) throw new Error('bad_der_int');
    let len = der[offset++];
    let bytes = der.slice(offset, offset + len);
    offset += len;
    // Strip leading zero padding from DER INTEGER
    while (bytes.length > 32 && bytes[0] === 0x00) bytes = bytes.slice(1);
    if (bytes.length > 32) throw new Error('bad_der_int_len');
    if (bytes.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(bytes, 32 - bytes.length);
      return padded;
    }
    return bytes;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

async function importSpkiKey(base64: string): Promise<CryptoKey> {
  const spki = b64ToBytes(base64);
  return crypto.subtle.importKey(
    'spki',
    toBufferSource(spki),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

export async function verifyAdmobSsv(
  input: SsvVerifyInput,
): Promise<SsvVerifyResult> {
  const parsed = parseSsvQuery(input.query);
  if (!parsed) return { ok: false, reason: 'bad_query' };

  const { content, signatureB64, keyId, params } = parsed;
  const key = input.keys.find((k) => k.keyId === keyId);
  if (!key) return { ok: false, reason: 'unknown_key' };

  let signatureDer: Uint8Array;
  try {
    signatureDer = b64ToBytes(signatureB64);
  } catch {
    return { ok: false, reason: 'bad_signature_encoding' };
  }

  let rawSig: Uint8Array;
  try {
    rawSig = derEcdsaToRaw(signatureDer);
  } catch {
    return { ok: false, reason: 'bad_signature_der' };
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await importSpkiKey(key.base64);
  } catch {
    return { ok: false, reason: 'bad_key' };
  }

  const data = new TextEncoder().encode(content);
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    toBufferSource(rawSig),
    toBufferSource(data),
  );
  if (!valid) return { ok: false, reason: 'bad_signature' };

  if (params.ad_unit !== input.allowedAdUnit) {
    return { ok: false, reason: 'wrong_unit' };
  }

  const ts = Number(params.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  const now = input.nowMs ?? Date.now();
  const maxAge = input.maxAgeMs ?? 48 * 60 * 60 * 1000;
  if (ts > now + 5 * 60 * 1000 || now - ts > maxAge) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  if (input.expectedUserId && params.user_id !== input.expectedUserId) {
    return { ok: false, reason: 'wrong_user' };
  }
  if (
    input.expectedSessionToken &&
    params.custom_data !== input.expectedSessionToken
  ) {
    return { ok: false, reason: 'wrong_session' };
  }
  if (
    input.expectedRewardAmount &&
    params.reward_amount !== input.expectedRewardAmount
  ) {
    return { ok: false, reason: 'wrong_reward' };
  }
  if (
    input.expectedRewardItem &&
    params.reward_item !== input.expectedRewardItem
  ) {
    return { ok: false, reason: 'wrong_reward' };
  }
  if (!params.transaction_id) {
    return { ok: false, reason: 'missing_transaction' };
  }

  return { ok: true, params, keyId };
}

/** Sign content with a test P-256 key (DER) for fixtures. */
export async function signSsvContentForTest(
  content: string,
  privateKey: CryptoKey,
): Promise<string> {
  const data = new TextEncoder().encode(content);
  const raw = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data),
  );
  return btoa(String.fromCharCode(...rawEcdsaToDer(raw)));
}

function rawEcdsaToDer(raw: Uint8Array): Uint8Array {
  const encInt = (slice: Uint8Array): Uint8Array => {
    let v = slice;
    while (v.length > 1 && v[0] === 0x00 && (v[1] & 0x80) === 0) {
      v = v.slice(1);
    }
    if (v[0] & 0x80) {
      const out = new Uint8Array(v.length + 1);
      out[0] = 0x00;
      out.set(v, 1);
      v = out;
    }
    const out = new Uint8Array(2 + v.length);
    out[0] = 0x02;
    out[1] = v.length;
    out.set(v, 2);
    return out;
  };
  const r = encInt(raw.slice(0, 32));
  const s = encInt(raw.slice(32, 64));
  const bodyLen = r.length + s.length;
  const out = new Uint8Array(2 + bodyLen);
  out[0] = 0x30;
  out[1] = bodyLen;
  out.set(r, 2);
  out.set(s, 2 + r.length);
  return out;
}

export async function generateTestKeyPair(): Promise<{
  keyId: number;
  publicKey: AdmobPublicKey;
  privateKey: CryptoKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const base64 = btoa(String.fromCharCode(...spki));
  const keyId = 1916455855;
  return {
    keyId,
    publicKey: { keyId, base64 },
    privateKey: pair.privateKey,
  };
}
