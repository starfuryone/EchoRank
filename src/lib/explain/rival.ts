// src/lib/explain/rival.ts
//
// Resolving a rival NAME to a rival DOMAIN.
//
// The two halves of this feature are keyed differently and neither key is
// derivable from the other by rule. `sov_snapshots.brand` and
// `sources.citesCompetitors` carry the name the ENGINES used ("Otterly.AI");
// the backlinks and site gatherers need a registrable domain. A customer can
// always type the domain, but making them type one the system already knows is
// a worse product, so this guesses first and asks only when it cannot.
//
// ── Why the guess is safe to make automatically ────────────────────────────
// It only ever proposes a domain THIS TENANT'S OWN citation rows already
// contain. The candidate set is `sources.domain` for the tenant's brand
// profile — domains an engine actually cited while talking about this rival —
// so a wrong guess costs a lookup of a domain that was already in the report's
// evidence, not of a stranger's site. The UI still shows the proposal and lets
// it be overridden before anything is bought.

import { prisma } from "@/lib/prisma";

/** Letters and digits only, lowercased. "Otterly.AI" and "otterly.ai" and
 *  "Otterly AI" all collapse to "otterlyai", which is what makes a name match a
 *  domain whose dots fall in a different place than the name's spaces. */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The tenant's own cited domain that most likely IS this rival, or null.
 *
 * Two passes, strictest first:
 *
 *   1. The whole domain folds to the rival's folded name — "otterly.ai" for
 *      "Otterly.AI". This is exact and is what the observed data looks like.
 *   2. The domain's first label folds to it — "profound.com" for "Profound".
 *      Weaker, because a common word could collide, which is why it runs only
 *      after the exact pass has found nothing.
 *
 * A rival cited only by third parties (a company with no site in this tenant's
 * citation rows) resolves to null, and the caller asks the customer.
 */
export async function suggestRivalDomain(input: {
  tenantId: string;
  brandProfileId: string;
  rivalName: string;
}): Promise<string | null> {
  const { tenantId, brandProfileId, rivalName } = input;
  const wanted = fold(rivalName);
  if (!wanted) return null;

  const rows = await prisma.source.findMany({
    where: { tenantId, brandProfileId },
    select: { domain: true },
  });

  const exact = rows.find((row) => fold(row.domain) === wanted);
  if (exact) return exact.domain;

  const byLabel = rows.find((row) => fold(row.domain.split(".")[0] ?? "") === wanted);
  return byLabel?.domain ?? null;
}

/**
 * Rivals worth offering, newest evidence first.
 *
 * The union of two populations, because neither alone is the answer: a rival
 * named on the BrandProfile is one the customer chose to track, and a rival
 * appearing in `sources.citesCompetitors` is one the engines actually brought
 * up. The second is where the surprises are, and dropping it would mean the
 * feature could only ever explain competitors the customer already knew about.
 */
export async function listRivals(input: {
  tenantId: string;
  brandProfileId: string;
}): Promise<{ name: string; suggestedDomain: string | null; citations: number }[]> {
  const { tenantId, brandProfileId } = input;

  const [profile, sources] = await Promise.all([
    prisma.brandProfile.findFirst({
      where: { id: brandProfileId, tenantId },
      select: { competitors: true },
    }),
    prisma.source.findMany({
      where: { tenantId, brandProfileId, competitorCitations: { gt: 0 } },
      select: { domain: true, citesCompetitors: true },
    }),
  ]);

  // Folded key → the best-cased spelling seen, plus a citation total. Folding
  // is what merges "Otterly.AI" and "Otterly.ai" into one rival; without it the
  // picker would offer the same company twice, which is exactly the bug the SOV
  // aggregator's case-insensitive grouping exists to prevent.
  const merged = new Map<string, { name: string; citations: number }>();

  const add = (name: string, citations: number) => {
    const key = fold(name);
    if (!key) return;
    const slot = merged.get(key);
    if (!slot) {
      merged.set(key, { name, citations });
      return;
    }
    slot.citations += citations;
    // Keep the spelling with more citations behind it — that is the one the
    // engines used most, and it is what the report should print.
    if (citations > 0 && name.length > slot.name.length) slot.name = name;
  };

  for (const name of profile?.competitors ?? []) add(name, 0);
  for (const row of sources) {
    for (const [name, count] of Object.entries((row.citesCompetitors ?? {}) as Record<string, unknown>)) {
      if (typeof count === "number") add(name, count);
    }
  }

  const domainByFold = new Map<string, string>();
  for (const row of sources) {
    domainByFold.set(fold(row.domain), row.domain);
    const label = fold(row.domain.split(".")[0] ?? "");
    if (label && !domainByFold.has(label)) domainByFold.set(label, row.domain);
  }

  return [...merged.entries()]
    .map(([key, value]) => ({
      name: value.name,
      suggestedDomain: domainByFold.get(key) ?? null,
      citations: value.citations,
    }))
    .sort((a, b) => b.citations - a.citations || a.name.localeCompare(b.name));
}
