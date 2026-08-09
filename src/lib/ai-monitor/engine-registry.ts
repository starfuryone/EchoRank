// src/lib/ai-monitor/engine-registry.ts
//
// The database half of the engine catalogue: seeding AIEngine rows from
// engines.ts, and reading back the one thing the row owns — the operator's
// kill switch.
//
// SEPARATE FILE FROM engines.ts BECAUSE THAT ONE IS PURE. engines.ts is
// imported by scoring paths, by tests with no DATABASE_URL, and potentially by
// a client component rendering an engine name; importing Prisma there would
// drag the server bundle along and break the build. cap.ts and pricing.ts were
// split from metering.ts for exactly this reason — see the note in cap.ts,
// which was written after a production build failed on it.
//
// THE CATALOGUE IS THE SOURCE OF TRUTH FOR CAPABILITIES, THE ROW ONLY FOR
// `enabled`. Seeding therefore UPDATES capability columns on every run — if a
// vendor ships citations and the catalogue says so, the row must follow — but
// it NEVER touches `enabled`, because that is the field a human set at 3am and
// the deploy that follows must not quietly undo it.

import { prisma } from "@/lib/prisma";
import { ENGINE_CATALOGUE } from "./engines";

export interface SeedResult {
  created: number;
  updated: number;
}

/**
 * Bring the AIEngine table in line with the catalogue.
 *
 * Idempotent, so it is safe to call at worker boot and from the seed script.
 */
export async function seedEngines(): Promise<SeedResult> {
  let created = 0;
  let updated = 0;

  for (const spec of ENGINE_CATALOGUE) {
    const result = await prisma.aIEngine.upsert({
      where: { provider_modelName: { provider: spec.provider, modelName: spec.modelName } },
      create: {
        provider: spec.provider,
        modelName: spec.modelName,
        displayName: spec.displayName,
        supportsSearch: spec.supportsSearch,
        supportsCitations: spec.supportsCitations,
        sortOrder: spec.sortOrder,
        enabled: true,
      },
      update: {
        displayName: spec.displayName,
        supportsSearch: spec.supportsSearch,
        supportsCitations: spec.supportsCitations,
        sortOrder: spec.sortOrder,
        // `enabled` is deliberately absent. See the header.
      },
      select: { createdAt: true, updatedAt: true },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    else updated += 1;
  }

  return { created, updated };
}

/**
 * Providers an operator has switched off.
 *
 * Returned as a Set of PROVIDER ids, not row ids, because that is what
 * availableEngines() takes. A provider is disabled when every one of its rows
 * is — today that is one row each, but pinning a second model for an engine
 * should not silently disable it.
 *
 * FAILS OPEN. If this query throws, the caller gets an empty set and every
 * available engine runs. The alternative — treating a database blip as "all
 * engines off" — would silently produce checkups with no data and a visibility
 * score of zero, which reads as a catastrophic ranking collapse rather than as
 * an outage.
 */
export async function disabledProviders(): Promise<Set<string>> {
  try {
    const rows = await prisma.aIEngine.findMany({ select: { provider: true, enabled: true } });

    const anyEnabled = new Set(rows.filter((row) => row.enabled).map((row) => row.provider));
    return new Set(
      rows.map((row) => row.provider).filter((provider) => !anyEnabled.has(provider)),
    );
  } catch {
    return new Set();
  }
}
