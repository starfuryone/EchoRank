import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Browser-extension API tokens.
 *
 * Design: opaque bearer tokens, not JWTs. The extension stores the plaintext in
 * `chrome.storage.local` and sends it as `Authorization: Bearer <token>`. We
 * store ONLY a SHA-256 hash, so a DB leak does not expose usable credentials,
 * and — unlike a stateless JWT — a token is revocable instantly by flipping
 * `revokedAt` (no denylist gymnastics). Rotation = revoke old + issue new.
 *
 * Wire format:  er_ext_<24-hex-id>.<48-hex-secret>
 *   - the id segment is public, surfaced as `prefix` for UI identification
 *   - the secret segment is hashed; only its hash is persisted
 */

const TOKEN_PREFIX = "er_ext_";
const ID_BYTES = 12; // 24 hex chars
const SECRET_BYTES = 24; // 48 hex chars

export interface IssuedToken {
  /** Plaintext token — shown to the user exactly once. */
  token: string;
  id: string;
  prefix: string;
}

export interface VerifiedToken {
  tokenId: string;
  tenantId: string;
  userId: string;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Parse a wire token into its id + secret segments, or null if malformed. */
function parse(token: string): { idPart: string; secret: string } | null {
  if (typeof token !== "string" || !token.startsWith(TOKEN_PREFIX)) return null;
  const body = token.slice(TOKEN_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot <= 0 || dot >= body.length - 1) return null;
  const idPart = body.slice(0, dot);
  const secret = body.slice(dot + 1);
  if (!/^[0-9a-f]+$/.test(idPart) || !/^[0-9a-f]+$/.test(secret)) return null;
  return { idPart, secret };
}

/**
 * Issue a new extension token for a (tenant, user). Returns the plaintext once.
 */
export async function issueExtensionToken(params: {
  tenantId: string;
  userId: string;
  label: string;
  scopes?: string[];
  expiresAt?: Date | null;
}): Promise<IssuedToken> {
  const idPart = randomBytes(ID_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const token = `${TOKEN_PREFIX}${idPart}.${secret}`;
  const prefix = idPart.slice(0, 8);

  const row = await prisma.extensionToken.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      label: params.label.trim().slice(0, 120) || "Browser extension",
      tokenHash: sha256(secret),
      prefix,
      scopes: params.scopes ?? [],
      expiresAt: params.expiresAt ?? null,
    },
    select: { id: true, prefix: true },
  });

  return { token, id: row.id, prefix: row.prefix };
}

/**
 * Verify a presented bearer token. Returns the owning tenant/user or null.
 * Uses a constant-time compare and lazily stamps lastUsedAt (best-effort).
 */
export async function verifyExtensionToken(token: string): Promise<VerifiedToken | null> {
  const parsed = parse(token);
  if (!parsed) return null;

  const presentedHash = sha256(parsed.secret);

  const row = await prisma.extensionToken.findUnique({
    where: { tokenHash: presentedHash },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      tokenHash: true,
      revokedAt: true,
      expiresAt: true,
    },
  });
  if (!row) return null;

  // Constant-time confirm (findUnique already matched the hash, but keep the
  // discipline so this stays correct if lookup strategy ever changes).
  const a = Buffer.from(row.tokenHash, "hex");
  const b = Buffer.from(presentedHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Fire-and-forget usage stamp; never block the request on it.
  void prisma.extensionToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { tokenId: row.id, tenantId: row.tenantId, userId: row.userId };
}

/** Revoke a token (idempotent). Scoped to tenant to prevent cross-tenant revoke. */
export async function revokeExtensionToken(tenantId: string, tokenId: string): Promise<boolean> {
  const res = await prisma.extensionToken.updateMany({
    where: { id: tokenId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/**
 * Rotate a token: revoke the existing one and issue a fresh secret, preserving
 * the label/scopes. Returns the new plaintext.
 */
export async function rotateExtensionToken(
  tenantId: string,
  userId: string,
  tokenId: string,
): Promise<IssuedToken | null> {
  const old = await prisma.extensionToken.findFirst({
    where: { id: tokenId, tenantId },
    select: { label: true, scopes: true, expiresAt: true },
  });
  if (!old) return null;
  await revokeExtensionToken(tenantId, tokenId);
  return issueExtensionToken({
    tenantId,
    userId,
    label: old.label,
    scopes: old.scopes,
    expiresAt: old.expiresAt,
  });
}

export const __testing = { sha256, parse, TOKEN_PREFIX };
