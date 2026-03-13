import * as Crypto from "expo-crypto";

/**
 * Compute a SHA-256 hash of base64 image data.
 * Returns the hex digest string.
 */
export async function hashBase64(base64: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  );
}

/**
 * Return the current ISO timestamp string.
 */
export function captureTimestamp(): string {
  return new Date().toISOString();
}
