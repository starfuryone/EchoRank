// src/app/api/ai/visibility/report/route.ts
// Authenticated dashboard PDF report (paid tiers). Follows the /api/ai/visibility/*
// pattern: requireTenant() + requireFeature("ai_visibility") so a user can only
// ever generate their OWN active tenant's report — data is assembled here,
// server-side, scoped to membership.tenantId, and never trusts a client-supplied
// tenant id. The assembled payload is POSTed to the secret-gated sidecar POST
// /report, which renders and returns the PDF. Nothing is written to disk.
//
//   GET  → lightweight probe: { available, brand } (drives button visibility)
//   POST → assemble + render + stream application/pdf
import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { csrfProtection } from "@/lib/csrf-protection";
import { prisma } from "@/lib/prisma";
import { markOnboardingStep } from "@/lib/onboarding";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";
const WINDOW_DAYS = 30;

type Check = {
  category: string;
  points: number;
  max: number;
  status: string;
  recommendation: string;
};
type CompetitorMention = { name?: string; mentioned?: boolean };

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
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [latestAudit, auditHistory, prompts, runs] = await Promise.all([
    prisma.visibilityAudit.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.visibilityAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { score: true, createdAt: true },
    }),
    prisma.trackedPrompt.findMany({
      where: { tenantId },
      select: { id: true, text: true },
    }),
    prisma.promptRun.findMany({
      where: { tenantId, createdAt: { gte: since }, error: null },
      orderBy: { createdAt: "asc" },
      select: {
        promptId: true,
        engine: true,
        brandMentioned: true,
        competitors: true,
        createdAt: true,
      },
    }),
  ]);

  const hasData = Boolean(latestAudit) || runs.length > 0;

  // score history (oldest→newest) + delta vs previous snapshot
  const history = [...auditHistory]
    .reverse()
    .map((h) => ({ date: h.createdAt.toISOString(), score: h.score }));
  let scoreDelta: number | null = null;
  if (history.length >= 2) {
    scoreDelta = history[history.length - 1].score - history[history.length - 2].score;
  }

  // per-engine mention rate — only engines actually present
  const engineAgg = new Map<string, { hit: number; total: number }>();
  for (const r of runs) {
    const e = engineAgg.get(r.engine) ?? { hit: 0, total: 0 };
    e.total += 1;
    if (r.brandMentioned) e.hit += 1;
    engineAgg.set(r.engine, e);
  }
  const platforms = [...engineAgg.entries()]
    .map(([engine, v]) => ({ engine, mentionRate: Math.round((100 * v.hit) / v.total) }))
    .sort((a, b) => b.mentionRate - a.mentionRate);

  // per-prompt trend (daily latest mention) + best/worst
  const promptText = new Map(prompts.map((p) => [p.id, p.text]));
  const byPrompt = new Map<string, Map<string, boolean>>();
  for (const r of runs) {
    const day = r.createdAt.toISOString().slice(0, 10);
    let m = byPrompt.get(r.promptId);
    if (!m) {
      m = new Map();
      byPrompt.set(r.promptId, m);
    }
    m.set(day, r.brandMentioned); // asc order → last write is the day's latest
  }
  const series = [...byPrompt.entries()]
    .map(([pid, days]) => {
      const spark: number[] = [...days.values()].map((b) => (b ? 1 : 0));
      const rate = spark.length
        ? Math.round((100 * spark.reduce<number>((a, b) => a + b, 0)) / spark.length)
        : 0;
      return { text: promptText.get(pid) ?? "(removed prompt)", spark, rate };
    })
    .sort((a, b) => b.rate - a.rate);
  const best = series.length ? series[0] : null;
  const worst = series.length ? series[series.length - 1] : null;

  // competitor mention rate from prompt-run snapshots (only if any exist)
  const compAgg = new Map<string, number>();
  for (const r of runs) {
    const list = Array.isArray(r.competitors)
      ? (r.competitors as CompetitorMention[])
      : [];
    for (const c of list) {
      if (c && typeof c.name === "string" && c.mentioned) {
        compAgg.set(c.name, (compAgg.get(c.name) ?? 0) + 1);
      }
    }
  }
  const competitors =
    runs.length > 0
      ? [...compAgg.entries()]
          .map(([name, hit]) => ({ name, mentionRate: Math.round((100 * hit) / runs.length) }))
          .filter((c) => c.mentionRate > 0)
          .sort((a, b) => b.mentionRate - a.mentionRate)
      : [];

  // recommendations from latest audit, grouped by horizon
  const checks: Check[] = Array.isArray(latestAudit?.checks)
    ? (latestAudit!.checks as unknown as Check[])
    : [];
  const buckets = { immediate: [] as unknown[], near_term: [] as unknown[], long_term: [] as unknown[] };
  for (const c of checks) {
    if (!c || !c.recommendation || !String(c.recommendation).trim()) continue;
    const max = Number(c.max) || 0;
    const points = Number(c.points) || 0;
    const ratio = max ? points / max : 1;
    const gap = Math.max(0, max - points);
    const item = {
      title: c.category,
      finding: c.status,
      impact: `Recover up to +${gap} points`,
      priority: ratio < 0.5 ? "High" : ratio < 0.9 ? "Medium" : "Low",
      action: c.recommendation,
    };
    if (ratio < 0.5) buckets.immediate.push(item);
    else if (ratio < 0.9) buckets.near_term.push(item);
    else buckets.long_term.push(item);
  }

  const domain = latestAudit?.url
    ? latestAudit.url.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "";
  const primaryOpportunity = (buckets.immediate[0] as { title?: string } | undefined)?.title ?? null;

  const payload = {
    brand,
    domain,
    period: { label: `Last ${WINDOW_DAYS} days` },
    audit: latestAudit
      ? {
          score: latestAudit.score,
          grade: latestAudit.grade,
          checks,
          robots: { bots: latestAudit.bots ?? {} },
        }
      : null,
    score_history: history,
    score_delta: scoreDelta,
    platforms,
    prompts: { series, best, worst },
    competitors,
    recommendations: buckets,
    primary_opportunity: primaryOpportunity,
    methodology: {
      sources:
        "Echorank360 audit signals (robots.txt, rendered HTML, structured data, metadata, sitemaps) and scheduled prompt runs against major AI assistants",
      prompt_count: prompts.length,
    },
  };

  return { hasData, payload, domain: domain || brand };
}

// ─── GET: availability probe ────────────────────────────────────────────────
export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const brand = membership.tenant.name;
    const [auditCount, runCount] = await Promise.all([
      prisma.visibilityAudit.count({ where: { tenantId: membership.tenantId } }),
      prisma.promptRun.count({ where: { tenantId: membership.tenantId, error: null } }),
    ]);
    return NextResponse.json({ available: auditCount > 0 || runCount > 0, brand });
  } catch (error) {
    const resp = unauthorized(error);
    if (resp) return resp;
    console.error("[visibility/report GET]", error);
    return NextResponse.json({ error: "Failed to check report availability." }, { status: 500 });
  }
}

// ─── POST: assemble + render + stream ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");

    const { hasData, payload, domain } = await assemble(
      membership.tenantId,
      membership.tenant.name,
    );
    if (!hasData) {
      return NextResponse.json({ error: "no_data" }, { status: 404 });
    }

    let res: Response;
    try {
      res = await fetch(`${SIDECAR_URL}/report`, {
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

    // Onboarding checklist marker; must never interfere with the PDF stream.
    markOnboardingStep(membership.tenantId, "pdf_downloaded").catch(() => {});

    const pdf = new Uint8Array(await res.arrayBuffer());
    const disposition =
      res.headers.get("content-disposition") ??
      `attachment; filename="Echorank-360-AI-Visibility-Report-${domain}.pdf"`;

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
    console.error("[visibility/report POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
