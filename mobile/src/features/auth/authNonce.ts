import * as Crypto from 'expo-crypto';

export type AuthNoncePair = {
  /** Raw nonce — pass to Supabase signInWithIdToken. */
  raw: string;
  /** SHA-256 hex digest of raw — pass to Apple signInAsync / refreshAsync. */
  hashed: string;
};

/**
 * Cryptographically secure nonce pair for Apple ↔ Supabase.
 * Uses expo-crypto only — no Math.random fallback.
 */
export async function createAuthNonce(byteLength = 32): Promise<AuthNoncePair> {
  if (byteLength < 16 || byteLength > 64) {
    throw new Error('nonce byteLength out of range');
  }
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );
  return { raw, hashed };
}
