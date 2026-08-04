// src/lib/matrix-accounts.ts
//
// Deriving a Matrix localpart, and keeping MatrixAccount rows honest when a
// plan changes. The Synapse HTTP calls live in src/lib/matrix/provision.ts.
//
// FILE LOCATION IS NOT A PREFERENCE. This belongs next to provision.ts in
// src/lib/matrix/, but that directory is owned by root (it was created by the
// operator) and the app builds as `deploy`, which cannot write into it. Once
// `sudo chown -R deploy:deploy src/lib/matrix` has been run this should move to
// src/lib/matrix/accounts.ts — the import path is the only thing that changes.

import { prisma } from "@/lib/prisma";
import type { PlanType } from "@/generated/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { deactivateMatrixAccount } from "@/lib/matrix/provision";

/**
 * Synapse localparts allow [a-z0-9._=/-]. Accents are decomposed first so "é"
 * contributes "e" rather than vanishing; anything still outside the set is
 * dropped rather than guessed at, because transliterating by locale would give
 * one tenant two different handles depending on who typed the name.
 */
export function sanitizeLocalpart(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9._=/-]/g, "")
    // Collapse separator runs and trim the ends — a localpart that starts or
    // ends with "." or "-" reads as a typo.
    .replace(/[._=/-]{2,}/g, ".")
    .replace(/^[._=/-]+|[._=/-]+$/g, "");
}

/** Synapse rejects an empty localpart, and very long ones are unusable. */
export const MAX_LOCALPART = 60;

/**
 * tenant slug + user identifier, e.g. "acme.jane".
 *
 * Both halves are present because the same person can belong to two tenants
 * and must not collide, and because a bare user identifier would make one
 * tenant's chat handles guessable from another's.
 */
export function deriveLocalpart(tenantSlug: string, userIdentifier: string): string {
  const tenant = sanitizeLocalpart(tenantSlug);
  const user = sanitizeLocalpart(userIdentifier);
  const joined = [tenant, user].filter(Boolean).join(".");
  const trimmed = joined.slice(0, MAX_LOCALPART).replace(/[._=/-]+$/g, "");
  // A name that sanitizes away entirely (CJK-only, say) still needs an account.
  return trimmed || `user${Date.now().toString(36)}`;
}

/**
 * First available localpart, suffixing -2, -3 … on collision.
 *
 * `isAvailable` is injected so the collision walk is testable without a live
 * Synapse; the route passes usernameAvailable from provision.ts.
 */
export async function resolveAvailableLocalpart(
  base: string,
  isAvailable: (username: string) => Promise<boolean>,
  maxAttempts = 20,
): Promise<string> {
  if (await isAvailable(base)) return base;
  for (let n = 2; n <= maxAttempts; n++) {
    const candidate = `${base.slice(0, MAX_LOCALPART - 4)}-${n}`;
    if (await isAvailable(candidate)) return candidate;
  }
  throw new Error(`no available Matrix localpart after ${maxAttempts} attempts`);
}

/** The live account for this user on this tenant, or null. */
export async function activeMatrixAccount(tenantId: string, appUserId: string) {
  // findFirst on both keys, never findUnique by one.
  return prisma.matrixAccount.findFirst({
    where: { tenantId, appUserId, deactivatedAt: null },
  });
}

export interface ReconcileResult {
  checked: number;
  deactivated: number;
  failed: number;
  details: Array<{ mxid: string; ok: boolean; error?: string }>;
}

/**
 * Deactivate every live Matrix account on a tenant whose plan no longer
 * carries matrix_chat.
 *
 * NEVER THROWS PAST A SINGLE ACCOUNT. This runs inside the Stripe webhook, and
 * a Synapse blip must not make Stripe retry a plan change that already
 * succeeded — the billing record is the thing that has to be right. Failures
 * are logged and counted, and reconcileMatrixAccounts() finishes the job by
 * hand.
 */
export async function reconcileTenantMatrixAccounts(
  tenantId: string,
  plan: PlanType,
): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, deactivated: 0, failed: 0, details: [] };
  if (hasFeature(plan, "matrix_chat")) return result;

  const live = await prisma.matrixAccount.findMany({
    where: { tenantId, deactivatedAt: null },
    select: { id: true, mxid: true },
  });
  result.checked = live.length;

  for (const account of live) {
    try {
      await deactivateMatrixAccount(account.mxid);
      await prisma.matrixAccount.update({
        where: { id: account.id },
        data: { deactivatedAt: new Date() },
      });
      result.deactivated++;
      result.details.push({ mxid: account.mxid, ok: true });
    } catch (err) {
      result.failed++;
      const message = err instanceof Error ? err.message : String(err);
      // The mxid is not a secret. The admin token that failed to authenticate
      // is, and never appears in this message.
      console.error(`[matrix] deactivate failed for ${account.mxid}: ${message}`);
      result.details.push({ mxid: account.mxid, ok: false, error: message });
    }
  }

  return result;
}

/**
 * Sweep every tenant holding a live account. For running by hand after a
 * webhook reconcile reported failures:
 *
 *   npx tsx -e "import('./src/lib/matrix-accounts').then(m => m.reconcileMatrixAccounts()).then(r => console.log(r))"
 */
export async function reconcileMatrixAccounts(): Promise<ReconcileResult> {
  const total: ReconcileResult = { checked: 0, deactivated: 0, failed: 0, details: [] };

  const tenants = await prisma.matrixAccount.findMany({
    where: { deactivatedAt: null },
    select: { tenantId: true },
    distinct: ["tenantId"],
  });

  for (const { tenantId } of tenants) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { planType: true },
    });
    if (!tenant) continue;
    const one = await reconcileTenantMatrixAccounts(tenantId, tenant.planType);
    total.checked += one.checked;
    total.deactivated += one.deactivated;
    total.failed += one.failed;
    total.details.push(...one.details);
  }

  return total;
}
