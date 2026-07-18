// src/app/api/intelligence/report/route.ts
// Authenticated 360° Competitive Intelligence PDF. Mirrors the
// /api/ai/visibility/report pattern: requireTenant() + requirePlan("GROWTH") — the
// same tier that gates /intelligence/risk and /intelligence/competitors — so a user
// can only ever generate their OWN active tenant's report. All data is assembled
// here, server-side, scoped to membership.tenantId; no client-supplied tenant id is
// ever trusted. The payload combines the signals module (RiskSnapshot risk score,
// revenue-at-risk, competitors/snapshots, AlertEvents) and the AI module
// (ReputationScore breakdown + EscalationAlerts), then is POSTed to the secret-gated
// sidecar POST /intelligence-report. Nothing is written to disk.
//
//   GET  → lightweight probe: { available, brand } (drives button visibility)
//   POST → assemble + render + stream application/pdf
import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requirePlan, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { csrfProtection } from "@/lib/csrf-protection";
import { prisma } from "@/lib/prisma";
import { riskOverview } from "@/lib/signals/scoring";
import { getRevenueAtRisk } from "@/lib/signals/revenue";
import { competitorDeltas, ownReviewPace7d } from "@/lib/signals/competitors";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

function unauthorized(error: unknown) {
  const enforcement = enforcementErrorResponse(error);
  if (enforcement) return enforcement;
  if (
    error instanceof Error &&
    error.message === "Not authenticated or no tenant access"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ─── Data assembly (tenant-scoped) ──────────────────────────────────────────
async function assemble(tenantId: string, brand: string) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since90 = new Date(Date.now() - 90 * 86_400_000);

  const [overview, competitorRows, reputationRows, escalationRows, alertRows] =
    await Promise.all([
      riskOverview(tenantId).catch(() => null),
      prisma.competitor.findMany({
        where: { tenantId, active: true },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, name: true },
      }),
      prisma.reputationScore.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          overallScore: true,
          sentimentScore: true,
          responseRateScore: true,
          recoveryScore: true,
          reviewVelocityScore: true,
          volatilityIndex: true,
          riskLevel: true,
          trendDirection: true,
          sampleSize: true,
          confidence: true,
          createdAt: true,
        },
      }),
      prisma.escalationAlert.findMany({
        where: { tenantId, acknowledged: false },
        orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: {
          alertType: true,
          riskLevel: true,
          probability: true,
          title: true,
          suggestedAction: true,
        },
      }),
      prisma.alertEvent.findMany({
        where: { tenantId, createdAt: { gte: since30 } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { kind: true, severity: true, title: true, createdAt: true },
      }),
    ]);

  // signals — reputation risk (omit for a brand-new tenant with no signals/history)
  let risk: Record<string, unknown> | null = null;
  if (overview && (overview.current.signalCount > 0 || overview.history.length > 0)) {
    risk = {
      score: overview.current.score,
      grade: overview.current.grade,
      signal_count: overview.current.signalCount,
      components: overview.current.components,
      deltas: overview.deltas,
      history: overview.history.map((h) => ({ day: h.day, score: h.score })),
    };
  }

  // signals — revenue at risk (null unless TenantRiskConfig.monthlyRevenue is set)
  let revenue_at_risk: Record<string, unknown> | null = null;
  if (overview) {
    const rev = await getRevenueAtRisk(tenantId, overview.current.score);
    if (rev)
      revenue_at_risk = {
        monthly_revenue: rev.monthlyRevenue,
        currency: rev.currency,
        elasticity: rev.elasticity,
        at_risk: rev.atRisk,
      };
  }

  // AI module — reputation health (persisted ReputationScore rows)
  let reputation: Record<string, unknown> | null = null;
  if (reputationRows.length) {
    const latest = reputationRows[0];
    reputation = {
      overall: latest.overallScore,
      sentiment: latest.sentimentScore,
      response_rate: latest.responseRateScore,
      recovery: latest.recoveryScore,
      velocity: latest.reviewVelocityScore,
      volatility: latest.volatilityIndex,
      risk_level: latest.riskLevel,
      trend: latest.trendDirection,
      sample_size: latest.sampleSize,
      confidence: latest.confidence,
      history: [...reputationRows]
        .reverse()
        .map((r) => ({ date: r.createdAt.toISOString(), score: r.overallScore })),
    };
  }

  // signals — competitors: deltas + 90-day snapshot series
  const competitors = await Promise.all(
    competitorRows.map(async (c) => {
      const [d, snaps] = await Promise.all([
        competitorDeltas(c.id),
        prisma.competitorSnapshot.findMany({
          where: { competitorId: c.id, day: { gte: since90 } },
          orderBy: { day: "asc" },
          select: { day: true, rating: true, reviewCount: true },
        }),
      ]);
      return {
        name: c.name,
        rating: d.rating,
        review_count: d.reviewCount,
        d_rating_30: d.dRating30,
        d_reviews_7: d.dReviews7,
        d_reviews_30: d.dReviews30,
        series: snaps.map((s) => ({
          day: s.day.toISOString().slice(0, 10),
          rating: s.rating,
          reviewCount: s.reviewCount,
        })),
      };
    }),
  );

  const own = { review_pace_7d: await ownReviewPace7d(tenantId) };

  const alerts = {
    events: alertRows.map((a) => ({
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      date: a.createdAt.toISOString(),
    })),
    escalations: escalationRows.map((a) => ({
      type: a.alertType,
      risk_level: a.riskLevel,
      probability: a.probability,
      title: a.title,
      action: a.suggestedAction ?? "",
    })),
  };

  // recommendations derived from the data
  const recommendations: { title: string; detail: string }[] = [];
  const gainers = competitors
    .filter((c) => typeof c.d_reviews_7 === "number")
    .sort((a, b) => (b.d_reviews_7 as number) - (a.d_reviews_7 as number));
  const topGain = gainers[0];
  if (topGain && (topGain.d_reviews_7 as number) > own.review_pace_7d) {
    recommendations.push({
      title: "Close the review-velocity gap",
      detail: `${topGain.name} gained ${topGain.d_reviews_7} reviews in 7 days vs your ${own.review_pace_7d} — launch a post-purchase review ask.`,
    });
  }
  if (risk && (risk.score as number) >= 60) {
    recommendations.push({
      title: "Reduce reputation risk",
      detail: `Your risk score is ${risk.score}/100 (grade ${risk.grade}). Prioritise resolving the top risk drivers.`,
    });
  }
  if (revenue_at_risk) {
    recommendations.push({
      title: "Protect revenue at risk",
      detail: `An estimated ${revenue_at_risk.currency} ${(
        revenue_at_risk.at_risk as number
      ).toLocaleString()} of monthly revenue is exposed at the current risk score.`,
    });
  }

  const hasData = Boolean(
    risk ||
      reputation ||
      competitors.length ||
      alerts.events.length ||
      alerts.escalations.length,
  );

  const payload = {
    brand,
    period: { label: "Last 90 days" },
    risk,
    revenue_at_risk,
    reputation,
    alerts,
    competitors,
    own,
    recommendations,
  };

  return { hasData, payload };
}

// ─── GET: availability probe ────────────────────────────────────────────────
export async function GET() {
  try {
    const membership = await requireTenant();
    await requirePlan("GROWTH");
    const tenantId = membership.tenantId;
    const [riskSnaps, competitors, reputation, alerts, escalations] = await Promise.all([
      prisma.riskSnapshot.count({ where: { tenantId } }),
      prisma.competitor.count({ where: { tenantId, active: true } }),
      prisma.reputationScore.count({ where: { tenantId } }),
      prisma.alertEvent.count({ where: { tenantId } }),
      prisma.escalationAlert.count({ where: { tenantId } }),
    ]);
    return NextResponse.json({
      available: riskSnaps + competitors + reputation + alerts + escalations > 0,
      brand: membership.tenant.name,
    });
  } catch (error) {
    const resp = unauthorized(error);
    if (resp) return resp;
    console.error("[intelligence/report GET]", error);
    return NextResponse.json({ error: "Failed to check report availability." }, { status: 500 });
  }
}

// ─── POST: assemble + render + stream ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  try {
    const membership = await requireTenant();
    await requirePlan("GROWTH");

    const { hasData, payload } = await assemble(membership.tenantId, membership.tenant.name);
    if (!hasData) {
      return NextResponse.json({ error: "no_data" }, { status: 404 });
    }

    let res: Response;
    try {
      res = await fetch(`${SIDECAR_URL}/intelligence-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": INTERNAL_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35_000),
        cache: "no-store",
      });
    } catch {
      return NextResponse.json({ error: "report_unavailable" }, { status: 502 });
    }
    if (!res.ok) {
      const status = res.status === 504 ? 504 : 502;
      return NextResponse.json({ error: "report_failed" }, { status });
    }

    const pdf = new Uint8Array(await res.arrayBuffer());
    const disposition =
      res.headers.get("content-disposition") ??
      `attachment; filename="Echorank-360-Competitive-Intelligence-Report-${membership.tenant.name}.pdf"`;

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const resp = unauthorized(error);
    if (resp) return resp;
    console.error("[intelligence/report POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
