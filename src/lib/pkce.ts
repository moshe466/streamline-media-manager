// src/lib/pkce.ts
import crypto from "crypto";

export function base64url(input: Buffer | string): string {
  return (input instanceof Buffer ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createCodeVerifier(): string {
  // 64 bytes -> 86 chars base64url (within 43-128 spec)
  return base64url(crypto.randomBytes(64));
}

export function createCodeChallengeS256(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64url(hash);
}
