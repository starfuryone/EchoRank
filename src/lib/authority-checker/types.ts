// src/lib/authority-checker/types.ts — the Link Authority Checker's report.
// Dependency-free (the client component imports the view types).

/** Link counts from backlinks/summary. dofollowShare is 0–1, null with no referring domains. */
export interface LinkMetrics {
  referringDomains: number;
  backlinks: number;
  dofollowShare: number | null;
}

/** One domain in the competitor comparison. authority is null when the index has no rank for it. */
export interface DomainRow extends LinkMetrics {
  domain: string;
  authority: number | null;
}

/** One of the top referring domains, strongest first. */
export interface ReferringDomainRow {
  domain: string;
  authority: number | null;
  backlinks: number;
}

/** Where the tenant stands against this month's allowance. limit null = unlimited. */
export interface LinkAuthorityUsage {
  used: number;
  limit: number | null;
  /** First instant of next month, UTC (ISO). */
  resetsAt: string;
}

/** What one check returns: the full report, on every plan. */
export interface LinkAuthorityReport {
  domain: string;
  competitors: string[];
  checkedAt: string;
  /** Echorank Authority (0–100) of the checked domain. */
  authority: number | null;
  links: LinkMetrics;
  /** The checked domain first, then the competitors, in the order entered. */
  comparison: DomainRow[];
  referringDomains: ReferringDomainRow[];
  /** Every answer came from the 7-day domain cache: nothing bought, nothing counted. */
  cached: boolean;
  usage: LinkAuthorityUsage;
}
