// src/app/api/monitoring/report/route.ts
// Authenticated 360° Review Monitoring PDF. Mirrors the /api/ai/visibility/report
// pattern: requireTenant() + requireFeature("reputation_monitoring") so a user can
// only ever generate their OWN active tenant's report — data is assembled here,
// server-side, scoped to membership.tenantId, and never trusts a client-supplied
// tenant id. The assembled payload is POSTed to the secret-gated sidecar POST
// /monitoring-report, which renders and returns the PDF. Nothing is written to disk.
//
//   GET  → lightweight probe: { available, brand } (drives button visibility)
//   POST → assemble + render + stream application/pdf
import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { csrfProtection } from "@/lib/csrf-protection";
import { prisma } from "@/lib/prisma";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";
const WINDOW_DAYS = 90;

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

/** ISO-week bucket key + label for a date, e.g. "2026-W29" / "W29". */
function isoWeek(d: Date): { key: string; label: string } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return {
    key: `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`,
    label: `W${String(week).padStart(2, "0")}`,
  };
}

// ─── Data assembly (tenant-scoped) ──────────────────────────────────────────
async function assemble(tenantId: string, brand: string) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [sourceRows, reviews] = await Promise.all([
    prisma.monitoringSource.findMany({
      where: { tenantId },
      include: { _count: { select: { reviews: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.externalReview.findMany({
      where: { tenantId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        rating: true,
        publishedAt: true,
        createdAt: true,
        repliedAt: true,
        replyContent: true,
        riskLevel: true,
        sentimentLabel: true,
        platform: true,
      },
    }),
  ]);

  const hasData = sourceRows.length > 0 || reviews.length > 0;

  const now = Date.now();
  const sources = sourceRows.map((s) => {
    let status: "active" | "inactive" | "stale" = "active";
    if (!s.isActive) status = "inactive";
    else if (
      s.lastCheckedAt &&
      now - s.lastCheckedAt.getTime() > s.checkInterval * 1000
    )
      status = "stale";
    return {
      platform: s.platform,
      status,
      review_count: s._count.reviews,
      last_checked: s.lastCheckedAt ? s.lastCheckedAt.toISOString() : null,
    };
  });

  // ratings + distribution (only reviews that carry a rating)
  const rated = reviews.filter((r) => typeof r.rating === "number");
  const distMap = new Map<number, number>();
  let ratingSum = 0;
  for (const r of rated) {
    const bucket = Math.max(1, Math.min(5, Math.round(r.rating as number)));
    distMap.set(bucket, (distMap.get(bucket) ?? 0) + 1);
    ratingSum += r.rating as number;
  }
  const ratings = rated.length
    ? {
        average: Number((ratingSum / rated.length).toFixed(2)),
        count: rated.length,
        distribution: [1, 2, 3, 4, 5]
          .filter((s) => distMap.has(s))
          .map((s) => ({ stars: s, count: distMap.get(s) ?? 0 })),
      }
    : {};

  // review volume trend by ISO week (publishedAt ?? createdAt)
  const weekMap = new Map<string, { label: string; count: number; sort: string }>();
  for (const r of reviews) {
    const when = r.publishedAt ?? r.createdAt;
    const { key, label } = isoWeek(when);
    const cur = weekMap.get(key) ?? { label, count: 0, sort: key };
    cur.count += 1;
    weekMap.set(key, cur);
  }
  const volume = [...weekMap.values()]
    .sort((a, b) => (a.sort < b.sort ? -1 : 1))
    .map(({ label, count }) => ({ label, count }));

  // reply rate
  const total = reviews.length;
  const replied = reviews.filter((r) => r.repliedAt || r.replyContent).length;
  const replies = total
    ? { replied, total, rate: Math.round((100 * replied) / total) }
    : {};

  // needs attention — counts only, never review text
  const isFlagged = (r: (typeof reviews)[number]) =>
    r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL" || r.sentimentLabel === "negative";
  const highCritical = reviews.filter(
    (r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL",
  ).length;
  const negative = reviews.filter((r) => r.sentimentLabel === "negative").length;
  const byPlatform = new Map<string, number>();
  for (const r of reviews) if (isFlagged(r)) byPlatform.set(r.platform, (byPlatform.get(r.platform) ?? 0) + 1);
  const riskCounts = { HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const r of reviews) if (r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL") riskCounts[r.riskLevel] += 1;
  const sentCounts = { negative: 0, neutral: 0 } as Record<string, number>;
  for (const r of reviews) if (r.sentimentLabel === "negative" || r.sentimentLabel === "neutral") sentCounts[r.sentimentLabel] += 1;
  const attention =
    highCritical || negative
      ? {
          high_critical: highCritical,
          negative,
          by_platform: [...byPlatform.entries()]
            .map(([platform, count]) => ({ platform, count }))
            .sort((a, b) => b.count - a.count),
          by_risk: Object.entries(riskCounts)
            .filter(([, c]) => c > 0)
            .map(([level, count]) => ({ level, count })),
          by_sentiment: Object.entries(sentCounts)
            .filter(([, c]) => c > 0)
            .map(([label, count]) => ({ label, count })),
        }
      : {};

  // recommendations derived from the data
  const recommendations: { title: string; detail: string }[] = [];
  const unreplied = total - replied;
  if (unreplied > 0)
    recommendations.push({
      title: "Clear the unreplied backlog",
      detail: `${unreplied} of ${total} reviews are still awaiting a reply${
        highCritical ? ` — prioritise the ${highCritical} high/critical-risk ones first` : ""
      }.`,
    });
  const stale = sources.filter((s) => s.status === "stale").map((s) => s.platform);
  if (stale.length)
    recommendations.push({
      title: "Reconnect stale sources",
      detail: `These sources have not been checked within their interval: ${stale.join(
        ", ",
      )}. Re-authorise them to resume collection.`,
    });
  if (highCritical > 0)
    recommendations.push({
      title: "Address high-risk reviews",
      detail: `${highCritical} reviews are flagged high or critical risk. Respond and resolve to protect your rating.`,
    });

  const payload = {
    brand,
    period: { label: `Last ${WINDOW_DAYS} days` },
    sources,
    ratings,
    volume,
    replies,
    attention,
    recommendations,
  };

  return { hasData, payload };
}

// ─── GET: availability probe ────────────────────────────────────────────────
export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("reputation_monitoring");
    const [sourceCount, reviewCount] = await Promise.all([
      prisma.monitoringSource.count({ where: { tenantId: membership.tenantId } }),
      prisma.externalReview.count({ where: { tenantId: membership.tenantId } }),
    ]);
    return NextResponse.json({
      available: sourceCount > 0 || reviewCount > 0,
      brand: membership.tenant.name,
    });
  } catch (error) {
    const resp = unauthorized(error);
    if (resp) return resp;
    console.error("[monitoring/report GET]", error);
    return NextResponse.json({ error: "Failed to check report availability." }, { status: 500 });
  }
}

// ─── POST: assemble + render + stream ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  try {
    const membership = await requireTenant();
    await requireFeature("reputation_monitoring");

    const { hasData, payload } = await assemble(membership.tenantId, membership.tenant.name);
    if (!hasData) {
      return NextResponse.json({ error: "no_data" }, { status: 404 });
    }

    let res: Response;
    try {
      res = await fetch(`${SIDECAR_URL}/monitoring-report`, {
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
      `attachment; filename="Echorank-360-Review-Monitoring-Report-${membership.tenant.name}.pdf"`;

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
    console.error("[monitoring/report POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
