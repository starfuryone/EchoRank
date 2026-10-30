// src/lib/home-stats.ts
//
// REAL numbers for the homepage, kept apart from the illustrative ones.
//
// Every figure inside the homepage's product mockups (Plomberie Acme, the 74,
// "+9/30d", "$3.2k at risk"...) is invented to show what the product looks
// like, and each such panel now carries data-sample="true" plus an
// "Illustrative example" caption. A number that is TRUE goes here instead, and
// HomeStats renders only the slots that hold one — an empty slot renders
// nothing, so the illustrative panels remain the fallback and nothing on the
// page is a placeholder dressed as a measurement.
//
// Filling a slot is a claim the company makes publicly. Each carries the date
// it was read and where from; update both when the value changes.
//
// Dependency-free: HomeClient is a Client Component.

export interface HomeStat {
  /** Null = no real figure yet; the slot does not render. */
  value: number | null;
  /** Rendered after the value, e.g. "/100". */
  suffix?: string;
  /** ISO date the value was read. Required when value is set. */
  asOf: string | null;
  /** Where the number comes from — for the next person, not rendered. */
  source: string;
}

export interface HomeStats {
  /** AI readability of echorank360.com, from the same audit the free tool runs. */
  ownerReadability: HomeStat;
  /** Free audits completed to date. */
  freeAuditsRun: HomeStat;
  /**
   * EchoPilot's /findings headline. Value is a percentage; the sentence it
   * belongs to is per-locale because it is copy, and both must be set.
   */
  echopilotFindings: HomeStat & { label: { en: string; fr: string } | null; href: string };
}

export const HOME_STATS: HomeStats = {
  ownerReadability: {
    value: 98,
    suffix: "/100",
    asOf: "2026-10-30",
    source: "Free-audit score for https://echorank360.com (av sidecar audit_site), as reported by the owner on 2026-10-30",
  },
  freeAuditsRun: {
    value: null,
    asOf: null,
    // No running total exists: /api/av/audit only records a per-IP daily key
    // (src/lib/av-free-limit.ts). Add a month-keyed Redis INCR beside it, then
    // read the sum here.
    source: "not counted yet",
  },
  echopilotFindings: {
    value: null,
    asOf: null,
    label: null,
    href: "https://echopilotlabs.com/findings",
    source: "EchoPilot /findings headline cards — fill once the study is published",
  },
};

export type HomeStatKey = keyof HomeStats;

/** The slots that hold a real figure, in render order. */
export function filledHomeStats(stats: HomeStats = HOME_STATS): HomeStatKey[] {
  return (Object.keys(stats) as HomeStatKey[]).filter((k) => {
    const s = stats[k];
    if (s.value === null || s.asOf === null) return false;
    if (k === "echopilotFindings" && !stats.echopilotFindings.label) return false;
    return true;
  });
}
