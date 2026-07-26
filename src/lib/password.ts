import bcrypt from "bcryptjs";

/**
 * Single source of truth for password hashing.
 *
 * Registration, any admin/reset tooling, and the credentials `authorize()`
 * check all go through here so a cost-factor or algorithm change can never
 * leave one call site writing hashes the others cannot verify.
 */
export const BCRYPT_COST = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
