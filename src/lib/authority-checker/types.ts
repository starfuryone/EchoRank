// src/lib/authority-checker/types.ts — the stored check and the two views of it.
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

/** What the email unlock adds: bought at unlock, stored on the check. */
export interface FullSection {
  referringDomains: ReferringDomainRow[];
  /** The visitor's domain first, then the competitors, in the order entered. */
  comparison: DomainRow[];
  at: string;
}

/** A check as stored in Redis under its token (RESULT_TTL_DAYS). */
export interface StoredCheck {
  token: string;
  createdAt: string;
  domain: string;
  competitors: string[];
  /** Echorank Authority (0–100) per domain, from one bulk_ranks call. */
  authority: Record<string, number | null>;
  links: LinkMetrics;
  full: FullSection | null;
}

/** What the API returns. `full` is present only for a browser that unlocked. */
export interface CheckView {
  token: string;
  createdAt: string;
  domain: string;
  competitors: string[];
  authority: number | null;
  links: LinkMetrics;
  unlocked: boolean;
  full: FullSection | null;
  /** Unlocked, but the full section could not be bought today (budget). */
  fullPending: boolean;
}
