// src/lib/explain/labels.ts
//
// English labels and units for the six factors.
//
// ── Why this is not the dashboard catalog ──────────────────────────────────
// The dashboard renders factors through EXPLAIN_COPY in src/lib/i18n/
// dashboard.ts, in all three DashLocales. The PDF does not: every report the
// av-visibility sidecar builds is English, because the sidecar has no i18n and
// giving one report a fourth locale model would be a worse problem than an
// English PDF. So these strings exist for the PDF payload and for the `detail`
// fallback stored on the row — the same fallback role Notification.title and
// CitationOpportunity.howTo play.
//
// The UNIT, unlike the labels, is not copy: it decides how the PDF formats a
// number (stars to one decimal, share as a percentage, counts with thousands
// separators) and it is the same in every language.

import type { RecommendationType } from "@/generated/prisma";
import type { FactorKey, LinkedFix } from "./types";

/** How a factor's `them`/`you`/`gap` should be formatted. */
export type FactorUnit = "count" | "points" | "stars";

export const FACTOR_UNIT: Record<FactorKey, FactorUnit> = {
  share_of_voice: "points",
  cited_sources: "count",
  authority: "count",
  entities: "count",
  site_readiness: "count",
  reviews: "stars",
};

export const FACTOR_LABEL_EN: Record<FactorKey, string> = {
  share_of_voice: "Share of voice",
  cited_sources: "Cited sources",
  authority: "Backlink authority",
  entities: "Knowledge-graph presence",
  site_readiness: "Site AI-readiness",
  reviews: "Reviews",
};

/**
 * Where a fix points, in words.
 *
 * Returns null for "none" rather than a string like "No action" — the PDF omits
 * the Fix line entirely in that case, and a report that printed "No action"
 * under an unmeasured factor would read as advice rather than as an absence.
 */
export function fixLabelEn(fix: LinkedFix): string | null {
  if (fix.kind === "none") return null;
  if (fix.kind === "opportunity") {
    return `Get listed on ${fix.domain} — it is on your Citation Opportunity worklist`;
  }
  return ROADMAP_WORK_EN[fix.type];
}

/**
 * What each roadmap type asks the customer to go do, in a sentence.
 *
 * Prose rather than a de-slugged enum name ("entity signal" reads as jargon and
 * tells nobody what to do). These are the strings that carry the whole value of
 * a roadmap fix, because it has no link behind it — see the LinkedFix doc in
 * types.ts for why.
 */
const ROADMAP_WORK_EN: Record<RecommendationType, string> = {
  HIGH_VALUE_PROMPT:
    "Publish answers to the prompts they are winning — the engines cite what exists.",
  CITATION_OPPORTUNITY:
    "Get listed on the sources that cite them and not you.",
  AUTHORITY_SIGNAL:
    "Earn links from the domains that already trust them.",
  ENTITY_SIGNAL:
    "Claim the knowledge-graph entries they hold and you do not.",
  STRUCTURED_DATA:
    "Fix the structured-data and crawlability gaps on your own site.",
  NEGATIVE_SENTIMENT:
    "Close the review-quality gap on the platforms buyers check.",
  CONTENT_GAP:
    "Cover the topics they rank for and you have not written about.",
  WEAK_ASSOCIATION:
    "Strengthen how clearly your brand is tied to this category.",
};

/**
 * The href a fix resolves to, or null when there is nowhere real to go.
 *
 * ONLY the opportunity shape returns a link. A roadmap fix names the work but
 * has no destination: `recommendations` has no page in this app, and a link to
 * one would be a 404. The UI renders a null href as plain text rather than a
 * dead anchor — see the LinkedFix doc in types.ts.
 */
export function fixHref(fix: LinkedFix): string | null {
  if (fix.kind !== "opportunity") return null;
  return `/visibility/tools/citation-opportunities?highlight=${encodeURIComponent(fix.opportunityId)}`;
}
