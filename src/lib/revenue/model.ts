// src/lib/revenue/model.ts
//
// AI Revenue Dashboard — the arithmetic, and nothing else.
//
// PURE. No Prisma, no clock, no i18n. Everything here is a function of its
// arguments, which is what lets the rollup table in tests/revenue-model.test.ts
// assert all four attribution models against numbers worked out by hand.
//
// ── THE LEADS RULING, ENCODED ───────────────────────────────────────────────
// leads(source) = measured AI-source conversions where they exist, otherwise a
// proxy of distinct AI-attributed visitors in the month.
//
// A rollup NEVER mixes the two. That is not a rule this module documents and
// hopes callers follow — it is enforced by the shape: `LeadCredits` carries its
// `mode` alongside its per-source numbers, and every function that produces one
// derives it from a single input set. There is no code path that adds a
// measured credit to a proxy credit, because there is no function that takes
// two LeadCredits.
//
// ── WHAT "MEASURED" MEANS TODAY ─────────────────────────────────────────────
// Nothing, yet. `measured` binds to AiConversion, which attribution P2 has not
// shipped. FunnelLead is deliberately NOT a measured source: it carries no
// source, no visitorId and no referrer (prisma/schema.prisma), and it is
// captured by an embed on the agency's CLIENT's site while AiVisit.visitorId is
// an er_vid cookie on the tenant's OWN domain — there is no join key, not even
// a lossy one. Counting funnel captures as AI-source conversions would book
// walk-in traffic as AI revenue.
//
// So every tenant is in `proxy` today. That is the honest state, not a
// degraded one, and the mode label rides with every figure on the page.

/**
 * How credit for a lead is spread across the assistants that touched it.
 *
 * The four are the standard set, and they genuinely disagree — a visitor who
 * arrived from Perplexity and came back via ChatGPT is one lead, but which
 * assistant earned it is a question with four defensible answers. `first` and
 * `last` pick one; `linear` splits; `influenced` credits both in full.
 */
export type AttributionModel = "first" | "last" | "influenced" | "linear";

export const ATTRIBUTION_MODELS: readonly AttributionModel[] = [
  "first",
  "last",
  "influenced",
  "linear",
] as const;

/** Where a row's leads came from. Part of the row's identity, never a display flag. */
export type RevenueMode = "measured" | "proxy";

export const REVENUE_MODES: readonly RevenueMode[] = ["measured", "proxy"] as const;

/**
 * The divide-by-zero guard on `addressable`.
 *
 * A tenant with no measurable share of the answers has ownShare = 0, and
 * leads/0 is Infinity — which would render as an unbounded "lost revenue"
 * number on the one page where an unbounded number is least excusable. The
 * floor says "treat an unmeasurable share as at most 1%", which caps
 * addressable at 100x the leads actually seen. Still a large number, but a
 * finite and explicable one.
 *
 * Tested directly: tests/revenue-model.test.ts, the share=0 guard.
 */
export const SHARE_FLOOR = 0.01;

/**
 * One AI-attributed touch inside the month.
 *
 * In proxy mode this is an ai_visits row — the table already collapses a
 * visitor's repeat arrivals on one page from one assistant into a single row,
 * so counting rows counts distinct (visitor, source, page), and grouping by
 * visitorId below counts distinct visitors. In measured mode it will be an
 * AiConversion row with the same three fields.
 */
export interface Touch {
  visitorId: string;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Per-source lead credit, carrying the mode it was derived under.
 *
 * `total` is NOT always the sum of `bySource` rounded — under `influenced` the
 * per-source figures deliberately sum to more than the number of leads, because
 * a visitor touched by two assistants is credited to both in full. `total` is
 * the distinct-lead count in every model except `influenced`, where it is the
 * same distinct count while the breakdown over-sums. Keeping both means the
 * headline cannot silently inherit influenced's double-count.
 */
export interface LeadCredits {
  mode: RevenueMode;
  model: AttributionModel;
  /** Distinct leads in the month. Model-independent by construction. */
  total: number;
  /** source -> credit. Sums to `total` except under `influenced`. */
  bySource: Map<string, number>;
}

/** The two assumptions a tenant sets on /settings/account. */
export interface RevenueAssumptions {
  /** 0 < convRate <= 1. */
  convRate: number;
  /** > 0, in the tenant's billing currency. */
  avgSaleValue: number;
}

/** Share-of-voice inputs, as FRACTIONS 0..1 — not the percentage points the SoV page renders. */
export interface ShareInputs {
  ownShare: number;
  topRivalShare: number;
}

export interface RollupFigures {
  mode: RevenueMode;
  model: AttributionModel;
  leads: number;
  wonRevenue: number;
  lostRevenueEst: number;
  /** Leads the tenant would see at its rivals' share. Surfaced for the "how" copy. */
  addressable: number;
}

/**
 * Round to cents.
 *
 * Applied at the boundary of every stored and rendered money figure, so the
 * number in the table is the number on the page. Float accumulation across a
 * per-source loop otherwise produces 1234.5600000000002, which reads as a bug
 * to a customer even where it is not one.
 */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Group touches by visitor, oldest touch first.
 *
 * Ordering is by firstSeen for `first` and lastSeen for `last`, with the source
 * name as a deterministic tie-break — two touches recorded in the same
 * millisecond must not make the rollup depend on row order out of Postgres.
 */
function byVisitor(touches: readonly Touch[]): Map<string, Touch[]> {
  const groups = new Map<string, Touch[]>();
  for (const touch of touches) {
    const list = groups.get(touch.visitorId) ?? [];
    list.push(touch);
    groups.set(touch.visitorId, list);
  }
  return groups;
}

/**
 * Spread one mode's touches across sources under one attribution model.
 *
 * The `mode` argument is passed straight through onto the result and is never
 * inspected: this function does the same arithmetic whether the touches are
 * measured conversions or proxied visits. That is the point — the mode changes
 * what a lead IS, not how credit for it is divided.
 */
export function creditLeads(
  touches: readonly Touch[],
  model: AttributionModel,
  mode: RevenueMode,
): LeadCredits {
  const bySource = new Map<string, number>();
  const add = (source: string, credit: number) => {
    bySource.set(source, (bySource.get(source) ?? 0) + credit);
  };

  const visitors = byVisitor(touches);

  for (const list of visitors.values()) {
    switch (model) {
      case "first": {
        const winner = [...list].sort(
          (a, b) =>
            a.firstSeen.getTime() - b.firstSeen.getTime() ||
            a.source.localeCompare(b.source),
        )[0];
        add(winner.source, 1);
        break;
      }
      case "last": {
        const winner = [...list].sort(
          (a, b) =>
            b.lastSeen.getTime() - a.lastSeen.getTime() ||
            a.source.localeCompare(b.source),
        )[0];
        add(winner.source, 1);
        break;
      }
      case "influenced": {
        // Full credit to every distinct assistant that touched this visitor.
        // The breakdown over-sums against `total` on purpose; see LeadCredits.
        for (const source of new Set(list.map((t) => t.source))) add(source, 1);
        break;
      }
      case "linear": {
        const sources = [...new Set(list.map((t) => t.source))];
        for (const source of sources) add(source, 1 / sources.length);
        break;
      }
    }
  }

  return { mode, model, total: visitors.size, bySource };
}

/**
 * The three formulas, verbatim from the spec.
 *
 *   won         = leads x convRate x avgSaleValue
 *   addressable = leads / max(ownShare, SHARE_FLOOR)
 *   lostEst     = max(topRivalShare - ownShare, 0) x addressable x convRate
 *                 x avgSaleValue
 *
 * `lostEst` clamps the share gap at zero rather than going negative: a tenant
 * who already outranks every rival has lost nothing, and a negative "lost
 * revenue" figure is not a fact about the world, it is a subtraction that ran
 * the wrong way.
 */
export function computeRollup(
  credits: LeadCredits,
  assumptions: RevenueAssumptions,
  shares: ShareInputs,
): RollupFigures {
  const { convRate, avgSaleValue } = assumptions;
  const leads = credits.total;

  const won = leads * convRate * avgSaleValue;

  const addressable = leads / Math.max(shares.ownShare, SHARE_FLOOR);
  const gap = Math.max(shares.topRivalShare - shares.ownShare, 0);
  const lost = gap * addressable * convRate * avgSaleValue;

  return {
    mode: credits.mode,
    model: credits.model,
    leads,
    wonRevenue: toCents(won),
    lostRevenueEst: toCents(lost),
    addressable: Math.round(addressable * 100) / 100,
  };
}

/**
 * Per-source money, under the same assumptions as the headline.
 *
 * Revenue only — there is no per-source `lost`, because lost revenue is derived
 * from share of voice, and share of voice is measured per ENGINE, not per
 * referral source. Splitting one number across the other axis would invent a
 * figure the data cannot support. The page shows lost per engine and won per
 * source, which is what each side actually knows.
 */
export function wonBySource(
  credits: LeadCredits,
  assumptions: RevenueAssumptions,
): { source: string; leads: number; wonRevenue: number }[] {
  return [...credits.bySource]
    .map(([source, leads]) => ({
      source,
      leads: Math.round(leads * 100) / 100,
      wonRevenue: toCents(leads * assumptions.convRate * assumptions.avgSaleValue),
    }))
    .sort((a, b) => b.wonRevenue - a.wonRevenue || a.source.localeCompare(b.source));
}

/**
 * Per-engine lost revenue, from that engine's own share gap.
 *
 * Each engine gets the SAME lead count — the tenant's leads for the month are
 * not divisible by engine, because ai_visits records which assistant sent a
 * visitor and sov_snapshots records which engine's answers were sampled, and
 * those are different measurements that happen to share some names. Pretending
 * otherwise would let a per-engine table sum to a different total than the
 * headline. What varies per engine here is the share gap, which is the honest
 * per-engine fact.
 */
export function lostByEngine(
  credits: LeadCredits,
  assumptions: RevenueAssumptions,
  engines: readonly { engine: string; ownShare: number; topRivalShare: number }[],
): { engine: string; ownShare: number; topRivalShare: number; lostRevenueEst: number }[] {
  return engines
    .map((e) => ({
      engine: e.engine,
      ownShare: e.ownShare,
      topRivalShare: e.topRivalShare,
      lostRevenueEst: computeRollup(credits, assumptions, {
        ownShare: e.ownShare,
        topRivalShare: e.topRivalShare,
      }).lostRevenueEst,
    }))
    .sort((a, b) => b.lostRevenueEst - a.lostRevenueEst || a.engine.localeCompare(b.engine));
}

/**
 * Pick the row a reader should see when a month has both modes.
 *
 * MEASURED WINS, PROXY SURVIVES. A tenant that gains AiConversion rows mid-run
 * flips modes, and the unique key (tenantId, month, model, mode) means that
 * writes a NEW row rather than restating a number somebody already read. This
 * is the read side of that decision: the page renders measured and keeps proxy
 * as history, so last month's screenshot still has a row behind it.
 */
export function preferMeasured<T extends { mode: RevenueMode }>(rows: readonly T[]): T | null {
  return rows.find((r) => r.mode === "measured") ?? rows.find((r) => r.mode === "proxy") ?? null;
}
