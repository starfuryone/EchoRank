// src/lib/dataforseo/backlinks-summary.ts
//
// The ONE definition of backlinks/summary/live: how the task is built and how
// the envelope is read.
//
// Two features consume it — Site Explorer's Backlinks card and the dedicated
// Backlinks tool — and they must agree. A second copy of this parser would
// drift the moment DataForSEO changed a field name, and the two tools would
// then quietly disagree about the same domain in the same UI.
//
// The shape below is what Site Explorer has ALREADY persisted, so the required
// fields cannot be renamed without a data migration. New fields are optional
// and additive: rows written before they existed simply read back undefined.

/** Raw backlinks/summary result item. Everything upstream is optional. */
export type BacklinksSummaryItem = {
  target?: string;
  rank?: number;
  backlinks?: number;
  referring_domains?: number;
  /** Directly reported — the same base as referring_domains, so the pair can
   * be differenced into a dofollow count without inference. */
  referring_domains_nofollow?: number;
  referring_main_domains?: number;
  referring_main_domains_nofollow?: number;
  referring_ips?: number;
  referring_subnets?: number;
  referring_pages?: number;
  referring_pages_nofollow?: number;
  broken_backlinks?: number;
  broken_pages?: number;
  backlinks_spam_score?: number;
  first_seen?: string;
  lost_date?: string | null;
  crawled_pages?: number;
  referring_links_types?: Record<string, number>;
  /** Per-attribute counts against `referring_pages`, NOT against `backlinks` —
   * differencing them from the backlink total mixes bases. */
  referring_links_attributes?: Record<string, number>;
};

/**
 * Normalized summary.
 *
 * The dofollow split is reported at the REFERRING-DOMAIN level, not the link
 * level: `referring_domains` / `referring_domains_nofollow` is a directly
 * reported pair on the same base, whereas the per-link `nofollow` figure lives
 * in an attributes block counted against referring pages. Differencing across
 * those two bases would produce a plausible number that means nothing.
 */
export interface BacklinksSummary {
  backlinks: number;
  referringDomains: number;
  referringMainDomains: number;
  /** DataForSEO domain rank, 0–1000. */
  rank: number;
  brokenBacklinks: number;
  /** Referring domains linking without rel=nofollow. */
  dofollowDomains: number;
  nofollowDomains: number;
  /** dofollowDomains / referringDomains, 0–1. Null when there are no domains. */
  dofollowRatio: number | null;

  // ── Added for the dedicated Backlinks tool. Optional so rows written by
  // ── Site Explorer before these existed still deserialize cleanly.
  referringIps?: number;
  referringPages?: number;
  brokenPages?: number;
  /** 0–100; higher is worse. */
  spamScore?: number;
  /** ISO timestamp of the oldest link DataForSEO still holds. */
  firstSeen?: string | null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Task payload for backlinks/summary/live.
 *
 * `include_subdomains` only applies to domain targets — DataForSEO ignores it
 * when `target` is an absolute page URL, which is exactly what exact-URL mode
 * sends. */
export function backlinksSummaryTask(
  target: string,
  opts?: { includeSubdomains?: boolean; internalListLimit?: number },
): Record<string, unknown> {
  return {
    target,
    internal_list_limit: opts?.internalListLimit ?? 10,
    backlinks_status_type: "live",
    include_subdomains: opts?.includeSubdomains ?? true,
  };
}

export function parseBacklinksSummary(
  result: BacklinksSummaryItem[] | undefined,
): BacklinksSummary {
  const item = result?.[0] ?? {};
  const referringDomains = num(item.referring_domains);

  // There is no "dofollow" count upstream; it is the complement of the
  // nofollow figure on the SAME base. See the interface comment above.
  const nofollowDomains = Math.min(num(item.referring_domains_nofollow), referringDomains);
  const dofollowDomains = Math.max(referringDomains - nofollowDomains, 0);

  return {
    backlinks: num(item.backlinks),
    referringDomains,
    referringMainDomains: num(item.referring_main_domains),
    rank: num(item.rank),
    brokenBacklinks: num(item.broken_backlinks),
    dofollowDomains,
    nofollowDomains,
    dofollowRatio: referringDomains > 0 ? dofollowDomains / referringDomains : null,
    referringIps: num(item.referring_ips),
    referringPages: num(item.referring_pages),
    brokenPages: num(item.broken_pages),
    spamScore: num(item.backlinks_spam_score),
    firstSeen: typeof item.first_seen === "string" ? item.first_seen : null,
  };
}
