// src/lib/site-crawler/ai-keys.ts
//
// A tenant's own OpenAI / Gemini key for the crawler's AI prompts (Phase 4e),
// in tenant_ai_keys. Encrypted with the GSC_TOKEN_ENCRYPTION_KEY pattern
// (src/lib/gsc/crypto.ts) like every other secret at rest. The plaintext
// leaves this module only through openAiKey, for the worker's call; the UI
// sees whether a key is set and when it was last used, never the key, not
// even its last four characters.

import "server-only";
import { decryptToken, encryptToken } from "@/lib/gsc/crypto";
import { prisma } from "@/lib/prisma";

export const AI_KEY_PROVIDERS = ["openai", "gemini"] as const;
export type AiKeyProvider = (typeof AI_KEY_PROVIDERS)[number];

export interface AiKeyStatus {
  set: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** Printable ASCII, no whitespace, a plausible length. Says nothing about validity. */
export function plausibleAiKey(key: string): boolean {
  return /^[\x21-\x7e]{20,256}$/.test(key);
}

export async function saveAiKey(tenantId: string, provider: AiKeyProvider, key: string, secret?: string): Promise<void> {
  const encryptedKey = encryptToken(key, secret);
  await prisma.tenantAiKey.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    create: { tenantId, provider, encryptedKey },
    update: { encryptedKey, createdAt: new Date(), lastUsedAt: null },
  });
}

export async function deleteAiKey(tenantId: string, provider: AiKeyProvider): Promise<void> {
  await prisma.tenantAiKey.deleteMany({ where: { tenantId, provider } });
}

export async function aiKeyStatus(tenantId: string): Promise<Record<AiKeyProvider, AiKeyStatus>> {
  const rows = await prisma.tenantAiKey.findMany({
    where: { tenantId },
    select: { provider: true, createdAt: true, lastUsedAt: true },
  });
  const out = {} as Record<AiKeyProvider, AiKeyStatus>;
  for (const p of AI_KEY_PROVIDERS) {
    const r = rows.find((x) => x.provider === p);
    out[p] = { set: Boolean(r), createdAt: r?.createdAt.toISOString() ?? null, lastUsedAt: r?.lastUsedAt?.toISOString() ?? null };
  }
  return out;
}

/** The plaintext key for one call, or null when none is saved. Marks it used. */
export async function openAiKey(tenantId: string, provider: AiKeyProvider, secret?: string): Promise<string | null> {
  const row = await prisma.tenantAiKey.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
    select: { id: true, encryptedKey: true },
  });
  if (!row) return null;
  await prisma.tenantAiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return decryptToken(row.encryptedKey, secret);
}
