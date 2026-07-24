// AES-256-GCM encryption for GSC refresh tokens at rest. The 32-byte key is
// derived via SHA-256 from GSC_TOKEN_ENCRYPTION_KEY, so any sufficiently
// random secret string works regardless of format. Wire format:
//   v1:<iv b64url>:<tag b64url>:<ciphertext b64url>
// Pure functions with an injectable key so the roundtrip is unit-testable
// without env; never log inputs or outputs.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function envSecret(): string {
  const s = process.env.GSC_TOKEN_ENCRYPTION_KEY;
  if (!s) throw new Error("GSC_TOKEN_ENCRYPTION_KEY is not set");
  return s;
}

export function encryptToken(plaintext: string, secret = envSecret()): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

export function decryptToken(encrypted: string, secret = envSecret()): string {
  const parts = encrypted.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unrecognized token ciphertext format");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = deriveKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
