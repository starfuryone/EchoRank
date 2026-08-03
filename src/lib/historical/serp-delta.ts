// src/lib/historical/serp-delta.ts
//
// What changed between two SERP checks for the same query. Pure functions over
// rows we already have — this file makes no network call and reads no database.
//
// WHY DOMAIN, NOT URL, IS THE IDENTITY. A site that moves a result from
// /plumbers to /plumbers-toronto has not entered or dropped; it has the same
// position with a different path. Keying on URL would report that as one drop
// plus one entry and bury the actual movement. Domain is the unit a user is
// tracking ("am I in the top 10"), so domain is the key, and the URL is carried
// along for display.
//
// A domain can legitimately hold several positions in one SERP (sitelinks,
// multiple pages ranking). We keep its BEST position — that is the one a user
// means when they ask where they rank.

import type { SerpResultItem } from "@/lib/serp/types";

export type DeltaKind = "entered" | "dropped" | "moved" | "held";

export interface SerpDeltaRow {
  domain: string;
  kind: DeltaKind;
  /** Position in the older check; null when the domain entered. */
  from: number | null;
  /** Position in the newer check; null when the domain dropped. */
  to: number | null;
  /**
   * Positions gained. POSITIVE means the domain moved UP the page (7 -> 4 is
   * +3), which is the direction a reader expects a positive number to mean.
   * Null for entered/dropped, where "gained" has no meaning.
   */
  change: number | null;
  /** Best URL seen for this domain, newer check preferred. */
  url: string | null;
  title: string | null;
}

export interface SerpDelta {
  /** Window the comparison covers — top N of each check. */
  depth: number;
  entered: SerpDeltaRow[];
  dropped: SerpDeltaRow[];
  moved: SerpDeltaRow[];
  held: SerpDeltaRow[];
  /** Every row, ordered by the newer position then the older one. */
  rows: SerpDeltaRow[];
}

/** Default comparison window. The top 10 is the page-one question. */
export const DEFAULT_DELTA_DEPTH = 10;

interface Best {
  position: number;
  url: string;
  title: string;
}

/**
 * Best (lowest) position per domain within the first `depth` results.
 *
 * Exported because the position-over-time chart needs exactly this reduction
 * for a single domain across many checks, and duplicating it there would be two
 * definitions of "where did we rank" that could drift apart.
 */
export function bestByDomain(items: SerpResultItem[], depth: number): Map<string, Best> {
  const out = new Map<string, Best>();
  for (const item of items) {
    if (typeof item.position !== "number" || item.position > depth) continue;
    const domain = normalizeDomain(item.domain);
    if (!domain) continue;
    const prior = out.get(domain);
    if (!prior || item.position < prior.position) {
      out.set(domain, { position: item.position, url: item.url, title: item.title });
    }
  }
  return out;
}

/** Lower-cased, www-stripped. "WWW.Example.com" and "example.com" are one site. */
export function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return "";
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * Where one domain sat in a check, or null if it was outside the window.
 * Powers the position-over-time series.
 */
export function positionOf(
  items: SerpResultItem[],
  domain: string,
  depth = 100,
): number | null {
  return bestByDomain(items, depth).get(normalizeDomain(domain))?.position ?? null;
}

/**
 * Diff two checks. `older` and `newer` are the stored `results.items` arrays;
 * the caller is responsible for passing them in chronological order.
 */
export function diffSerpChecks(
  older: SerpResultItem[],
  newer: SerpResultItem[],
  depth = DEFAULT_DELTA_DEPTH,
): SerpDelta {
  const before = bestByDomain(older, depth);
  const after = bestByDomain(newer, depth);

  const entered: SerpDeltaRow[] = [];
  const dropped: SerpDeltaRow[] = [];
  const moved: SerpDeltaRow[] = [];
  const held: SerpDeltaRow[] = [];

  for (const [domain, now] of after) {
    const then = before.get(domain);
    if (!then) {
      entered.push({ domain, kind: "entered", from: null, to: now.position, change: null, url: now.url, title: now.title });
    } else if (then.position === now.position) {
      held.push({ domain, kind: "held", from: then.position, to: now.position, change: 0, url: now.url, title: now.title });
    } else {
      moved.push({
        domain,
        kind: "moved",
        from: then.position,
        to: now.position,
        // Up the page is positive: 7 -> 4 is +3.
        change: then.position - now.position,
        url: now.url,
        title: now.title,
      });
    }
  }

  for (const [domain, then] of before) {
    if (after.has(domain)) continue;
    dropped.push({ domain, kind: "dropped", from: then.position, to: null, change: null, url: then.url, title: then.title });
  }

  const sortKey = (r: SerpDeltaRow) => r.to ?? r.from ?? Number.MAX_SAFE_INTEGER;
  const rows = [...entered, ...held, ...moved, ...dropped].sort(
    (a, b) => sortKey(a) - sortKey(b) || a.domain.localeCompare(b.domain),
  );

  // Deterministic ordering inside each bucket too, so the UI does not reshuffle
  // between renders of the same data.
  const byPos = (a: SerpDeltaRow, b: SerpDeltaRow) => sortKey(a) - sortKey(b) || a.domain.localeCompare(b.domain);
  entered.sort(byPos);
  dropped.sort(byPos);
  held.sort(byPos);
  // Biggest climb first — that is the finding, not the alphabet.
  moved.sort((a, b) => (b.change ?? 0) - (a.change ?? 0) || a.domain.localeCompare(b.domain));

  return { depth, entered, dropped, moved, held, rows };
}

export interface TimelinePoint {
  checkId: string;
  at: string;
  /** null = outside the tracked depth in that check. */
  position: number | null;
}

/** Position-over-time for one domain across chronologically ordered checks. */
export function positionSeries(
  checks: Array<{ id: string; createdAt: Date; items: SerpResultItem[] }>,
  domain: string,
  depth = 100,
): TimelinePoint[] {
  return checks.map((c) => ({
    checkId: c.id,
    at: c.createdAt.toISOString(),
    position: positionOf(c.items, domain, depth),
  }));
}

/** Domains appearing in the top `depth` of any check — the chart's picker. */
export function trackedDomains(
  checks: Array<{ items: SerpResultItem[] }>,
  depth = DEFAULT_DELTA_DEPTH,
): string[] {
  const seen = new Set<string>();
  for (const c of checks) for (const d of bestByDomain(c.items, depth).keys()) seen.add(d);
  return [...seen].sort();
}
