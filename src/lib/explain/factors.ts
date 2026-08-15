// src/lib/explain/factors.ts
//
// Turning six gather outcomes into one ranked list of factors.
//
// ── Why severity is separate from `gap` ────────────────────────────────────
// The six factors are measured in five different units: percentage points,
// citation counts, referring domains, a 0-100 score, stars. `gap` keeps the
// provider's own unit because that is the number the customer should read.
// Ranking them against each other needs a common scale, which is `severity` —
// 0..1, "how far ahead are they on this, relative to what being ahead can
// mean here". Every formula below is stated in its own comment, because a
// normalisation nobody can see is a ranking nobody can argue with.
//
// ── Why unavailable factors still rank ─────────────────────────────────────
// They sort last (score -1) but they are IN the list, ordered among themselves
// by weight. A tenant whose share-of-voice row is unmeasured should see it at
// the top of the unmeasured group, because it is the one worth waiting for.

import { prisma } from "@/lib/prisma";
import type { RecommendationType } from "@/generated/prisma";
import { entityCount } from "./gather";
import type {
  AuthorityStanding,
  EntityPresence,
  ExplainFactor,
  ExplainGather,
  FactorKey,
  GatherOutcome,
  LinkedFix,
  ReviewStanding,
  RivalSource,
  SiteReadiness,
  SovGap,
} from "./types";

/**
 * How much each factor counts toward the ranking.
 *
 * Ordered by how directly the factor moves AI visibility, which is what the
 * customer is here about. Share of voice is the outcome itself, so it leads.
 * Cited sources is the strongest lever ON that outcome — it is what the
 * Citation Opportunity worklist is built from — so it is next. Reviews sit
 * last: they matter enormously for a local business and barely at all for the
 * SaaS rivals this surface mostly compares, and a rival with no Places listing
 * reports the factor unavailable anyway.
 */
export const FACTOR_WEIGHT: Record<FactorKey, number> = {
  share_of_voice: 1.0,
  cited_sources: 0.9,
  authority: 0.7,
  entities: 0.6,
  site_readiness: 0.5,
  reviews: 0.4,
};

/** Roadmap item type each factor's fix lands on when no concrete row exists. */
export const FACTOR_ROADMAP_TYPE: Record<FactorKey, RecommendationType> = {
  share_of_voice: "HIGH_VALUE_PROMPT",
  cited_sources: "CITATION_OPPORTUNITY",
  authority: "AUTHORITY_SIGNAL",
  entities: "ENTITY_SIGNAL",
  site_readiness: "STRUCTURED_DATA",
  reviews: "NEGATIVE_SENTIMENT",
};

/** 0..1, never NaN. A denominator of zero means "they have none either", which
 *  is a gap of nothing rather than an infinite one. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** The share of the leader's own total that the follower is behind by. Used
 *  wherever the unit is an unbounded count (citations, referring domains,
 *  reviews): being 50 behind means nothing without knowing 50 out of what. */
function relativeGap(them: number, you: number): number {
  if (them <= 0) return 0;
  return clamp01((them - you) / them);
}

export interface FactorContext {
  tenantId: string;
  brandProfileId: string;
}

/**
 * The ranked report body.
 *
 * One pass to build every factor, one batched pair of queries to resolve the
 * fix links, then a sort. The fix lookups are deliberately NOT done inside each
 * factor builder: two of them would hit the same Recommendation table, and a
 * report that ran six correlated queries to decorate six rows would be paying
 * for tidiness with latency.
 */
export async function buildFactors(
  gather: ExplainGather,
  ctx: FactorContext,
): Promise<ExplainFactor[]> {
  const drafts: Omit<ExplainFactor, "linkedFix">[] = [
    sovFactor(gather.sovGaps),
    sourcesFactor(gather.rivalSources),
    authorityFactor(gather.authority),
    entitiesFactor(gather.entities),
    siteFactor(gather.site),
    reviewsFactor(gather.reviews),
  ];

  const fixes = await resolveFixes(drafts, gather, ctx);
  const factors = drafts.map((draft) => ({
    ...draft,
    linkedFix: fixes.get(draft.factor) ?? { kind: "none" as const },
  }));

  // Highest score first. Ties broken by weight, then by key, so two factors
  // scoring identically cannot swap places between one read and the next —
  // the same stability rule the opportunity worklist follows.
  factors.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (FACTOR_WEIGHT[b.factor] !== FACTOR_WEIGHT[a.factor]) {
      return FACTOR_WEIGHT[b.factor] - FACTOR_WEIGHT[a.factor];
    }
    return a.factor.localeCompare(b.factor);
  });
  return factors;
}

/** The shape every unavailable factor collapses to. Score -1 sinks it below
 *  every measured factor, including one the customer is winning at 0. */
function unavailable(
  factor: FactorKey,
  reason: NonNullable<ExplainFactor["unavailable"]>,
  detail: string,
): Omit<ExplainFactor, "linkedFix"> {
  return { factor, them: null, you: null, gap: null, severity: 0, score: -1, unavailable: reason, detail };
}

function measured(
  factor: FactorKey,
  them: number,
  you: number,
  severity: number,
  detail: string,
): Omit<ExplainFactor, "linkedFix"> {
  return {
    factor,
    them,
    you,
    gap: them - you,
    severity,
    score: severity * FACTOR_WEIGHT[factor],
    detail,
  };
}

// ─── Per-factor builders ────────────────────────────────────────────────────

/** Unit: percentage points of share. Severity: the worst single-engine gap,
 *  over 100 — the most they could possibly be ahead by. The worst engine
 *  rather than the average because a rival owning one engine outright is a
 *  sharper problem than one slightly ahead everywhere, and the average hides
 *  exactly that. */
function sovFactor(outcome: GatherOutcome<SovGap[]>) {
  if (!outcome.ok) {
    return unavailable(
      "share_of_voice",
      outcome.reason,
      "Share of voice has not been measured for this project yet.",
    );
  }
  const gaps = outcome.value;
  if (gaps.length === 0) {
    return measured("share_of_voice", 0, 0, 0, "They do not out-rank you on any engine.");
  }
  const worst = gaps[0];
  return measured(
    "share_of_voice",
    worst.theirShare,
    worst.yourShare,
    clamp01((worst.theirShare - worst.yourShare) / 100),
    `On ${worst.engine} they hold ${worst.theirShare.toFixed(1)}% of answers to your ${worst.yourShare.toFixed(1)}%, across ${worst.promptCount} prompts.` +
      (gaps.length > 1 ? ` They also lead on ${gaps.length - 1} other engine${gaps.length > 2 ? "s" : ""}.` : ""),
  );
}

/** Unit: citations across the domains that cite them. Severity: the relative
 *  gap on that total — being out-cited 12 to 1 and 120 to 10 are the same
 *  problem at different scales, and the ranking should treat them alike. */
function sourcesFactor(outcome: GatherOutcome<RivalSource[]>) {
  if (!outcome.ok) {
    return unavailable(
      "cited_sources",
      outcome.reason,
      "The sources behind AI answers have not been rolled up for this project yet.",
    );
  }
  const sources = outcome.value;
  if (sources.length === 0) {
    return measured("cited_sources", 0, 0, 0, "No source in your project cites them.");
  }
  const theirs = sources.reduce((sum, source) => sum + source.rivalCitations, 0);
  const yours = sources.reduce((sum, source) => sum + source.brandCitations, 0);
  const blind = sources.filter((source) => source.brandCitations === 0);
  return measured(
    "cited_sources",
    theirs,
    yours,
    relativeGap(theirs, yours),
    `${sources.length} source${sources.length === 1 ? "" : "s"} cite them ${theirs} time${theirs === 1 ? "" : "s"} against your ${yours}.` +
      (blind.length > 0
        ? ` ${blind.length} of them (${blind.slice(0, 3).map((s) => s.domain).join(", ")}) never cite you at all.`
        : ""),
  );
}

/** Unit: referring domains. Severity: the relative gap on their own count. */
function authorityFactor(
  outcome: GatherOutcome<{ them: AuthorityStanding; you: AuthorityStanding }>,
) {
  if (!outcome.ok) {
    return unavailable("authority", outcome.reason, authorityReasonCopy(outcome.reason));
  }
  const { them, you } = outcome.value;
  return measured(
    "authority",
    them.referringDomains,
    you.referringDomains,
    relativeGap(them.referringDomains, you.referringDomains),
    `${them.referringDomains.toLocaleString("en-US")} referring domains against your ${you.referringDomains.toLocaleString("en-US")} (domain rank ${them.rank} vs ${you.rank}).`,
  );
}

function authorityReasonCopy(reason: NonNullable<ExplainFactor["unavailable"]>): string {
  if (reason === "cap_reached") {
    return "This workspace has reached its monthly data budget, so backlink authority was not bought for this report.";
  }
  return "Backlink authority could not be retrieved for this domain.";
}

/** Unit: how many of the three knowledge-graph entities exist (0-3).
 *  Severity: the gap over 3, the most anyone can be ahead by. */
function entitiesFactor(
  outcome: GatherOutcome<{ them: EntityPresence; you: EntityPresence }>,
) {
  if (!outcome.ok) {
    return unavailable("entities", outcome.reason, "Knowledge-graph presence could not be checked.");
  }
  const them = entityCount(outcome.value.them);
  const you = entityCount(outcome.value.you);
  const missing = (["wikipedia", "wikidata", "crunchbase"] as const).filter(
    (key) => outcome.value.them[key] && !outcome.value.you[key],
  );
  return measured(
    "entities",
    them,
    you,
    clamp01((them - you) / 3),
    missing.length > 0
      ? `They are listed on ${missing.join(", ")} and you are not.`
      : `They carry ${them} of 3 knowledge-graph entries to your ${you}.`,
  );
}

/** Unit: the sidecar's 0-100 AI-readiness score. Severity: the gap over 100. */
function siteFactor(
  outcome: GatherOutcome<{ them: SiteReadiness; you: SiteReadiness }>,
) {
  if (!outcome.ok) {
    return unavailable("site_readiness", outcome.reason, "Their site could not be read.");
  }
  const { them, you } = outcome.value;
  // A null score means the sidecar answered without one, which is not the same
  // as a zero. Treated as "no gap measurable" rather than as a perfect loss.
  if (them.score === null || you.score === null) {
    return unavailable("site_readiness", "upstream_failed", "Their site could not be scored.");
  }
  return measured(
    "site_readiness",
    them.score,
    you.score,
    clamp01((them.score - you.score) / 100),
    you.failures.length > 0
      ? `Their site scores ${them.score}/100 for AI readiness against your ${you.score}. You are losing points on: ${you.failures.slice(0, 3).join(", ")}.`
      : `Their site scores ${them.score}/100 for AI readiness against your ${you.score}.`,
  );
}

/** Unit: star rating. Severity: a blend, 60% the rating gap over 5 stars and
 *  40% the relative gap in review volume. Rating alone would score a rival with
 *  ten times the reviews at the same stars as no threat, which is wrong —
 *  volume is what makes a rating persuasive. Volume alone would rank a
 *  badly-reviewed rival above a well-reviewed one, which is worse. */
function reviewsFactor(
  outcome: GatherOutcome<{ them: ReviewStanding; you: ReviewStanding }>,
) {
  if (!outcome.ok) {
    return unavailable("reviews", outcome.reason, reviewsReasonCopy(outcome.reason));
  }
  const { them, you } = outcome.value;
  const theirRating = them.rating ?? 0;
  const yourRating = you.rating ?? 0;
  const theirCount = them.reviewCount ?? 0;
  const yourCount = you.reviewCount ?? 0;
  const severity =
    0.6 * clamp01((theirRating - yourRating) / 5) + 0.4 * relativeGap(theirCount, yourCount);
  return measured(
    "reviews",
    theirRating,
    yourRating,
    severity,
    `${theirRating.toFixed(1)}★ from ${theirCount.toLocaleString("en-US")} reviews against your ${yourRating.toFixed(1)}★ from ${yourCount.toLocaleString("en-US")}.`,
  );
}

function reviewsReasonCopy(reason: NonNullable<ExplainFactor["unavailable"]>): string {
  if (reason === "no_place_id") {
    return "This competitor has no Google Business listing to compare reviews against.";
  }
  if (reason === "cap_reached") {
    return "This workspace has reached its monthly data budget, so reviews were not bought for this report.";
  }
  if (reason === "not_configured") {
    return "Google Places is not configured for this deployment.";
  }
  return "Their review standing could not be retrieved.";
}

// ─── Fix links ──────────────────────────────────────────────────────────────

/**
 * What each factor should point the customer at.
 *
 * ONE query, tenant-scoped, batched across every factor that needs it:
 *
 *   1. A real CitationOpportunity row — a named domain, already scored, already
 *      in their worklist, and a working link. Only cited_sources can produce
 *      one, and only once the weekly sweep has run.
 *   2. The factor's roadmap TYPE, naming the kind of work without claiming to
 *      route to it. See the LinkedFix doc in types.ts: `recommendations` has no
 *      writer and no page in this app, so there is nothing to query and nowhere
 *      to link. Emitting an href here would ship a 404 per factor.
 *   3. "none" — for an unavailable factor, which has no fix by definition, and
 *      for one the customer is already winning.
 *
 * Step 2 is what keeps an empty citation_opportunities table from silently
 * degrading every fix to "none": the customer is still told what kind of work
 * closes the gap, and the factor's own copy says the worklist has not been
 * built yet.
 */
async function resolveFixes(
  drafts: readonly Omit<ExplainFactor, "linkedFix">[],
  gather: ExplainGather,
  ctx: Pick<FactorContext, "tenantId">,
): Promise<Map<FactorKey, LinkedFix>> {
  const fixes = new Map<FactorKey, LinkedFix>();

  // Factors with nothing to fix: unmeasured, or measured and not behind.
  const actionable = drafts.filter((draft) => !draft.unavailable && draft.severity > 0);
  const actionableKeys = new Set(actionable.map((draft) => draft.factor));
  for (const draft of drafts) {
    if (!actionableKeys.has(draft.factor)) fixes.set(draft.factor, { kind: "none" });
  }
  if (actionable.length === 0) return fixes;

  // The domains a citation fix could point at: sources that cite the rival and
  // have never cited this brand. An opportunity for a domain that already cites
  // you is not a fix, it is a fact.
  const blindDomains = gather.rivalSources.ok
    ? gather.rivalSources.value.filter((s) => s.brandCitations === 0).map((s) => s.domain)
    : [];

  const opportunity =
    blindDomains.length > 0
      ? await prisma.citationOpportunity.findFirst({
          where: { tenantId: ctx.tenantId, domain: { in: blindDomains }, status: "OPEN" },
          // Best first, exactly as the worklist ranks it — the fix link and the
          // worklist must not disagree about which domain is the top job.
          orderBy: [{ priority: "desc" }, { domain: "asc" }],
          select: { id: true, domain: true },
        })
      : null;

  for (const draft of actionable) {
    if (draft.factor === "cited_sources" && opportunity) {
      fixes.set(draft.factor, {
        kind: "opportunity",
        opportunityId: opportunity.id,
        domain: opportunity.domain,
      });
      continue;
    }
    fixes.set(draft.factor, { kind: "roadmap", type: FACTOR_ROADMAP_TYPE[draft.factor] });
  }

  return fixes;
}
