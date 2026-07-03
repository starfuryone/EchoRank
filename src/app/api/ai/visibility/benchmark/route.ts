import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

/**
 * Competitor benchmark (GROWTH+). Quota: GROWTH compares 1 distinct
 * competitor per rolling 24h, AGENCY+ compares 5. Each benchmark persists
 * as a VisibilityAudit row with monitorId=null (history feeds reports).
 * The public /audit route stays ungated (lead magnet).
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface AuditBot {
  status: string;
  detail: string;
}
interface AuditResult {
  url?: string;
  score?: number;
  grade?: string;
  checks?: unknown[];
  robots?: { bots?: Record<string, AuditBot> };
  error?: string;
}

function limitFor(planType: string): number {
  return planType === "AGENCY" || planType === "ENTERPRISE" ? 5 : 1;
}

function summarize(url: string, score: number, grade: string, bots: Record<string, AuditBot>) {
  const botTotal = Object.keys(bots).length;
  const blocked = Object.values(bots).filter((b) => b.status === "BLOCKED").length;
  return { url, score, grade, blocked, botTotal };
}

async function recentBenchmarks(tenantId: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  return prisma.visibilityAudit.findMany({
    where: { tenantId, monitorId: null, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { url: true, score: true, grade: true, bots: true },
  });
}

export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const limit = limitFor(membership.tenant.planType);

    const rows = await recentBenchmarks(membership.tenantId);
    const seen = new Set<string>();
    const recent = [];
    for (const r of rows) {
      if (seen.has(r.url)) continue; // keep latest per url only
      seen.add(r.url);
      recent.push(summarize(r.url, r.score, r.grade, (r.bots ?? {}) as unknown as Record<string, AuditBot>));
    }
    return NextResponse.json({ limit, used: seen.size, recent });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/benchmark GET]", error);
    return NextResponse.json({ error: "Failed to load benchmarks." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");
    const tenantId = membership.tenantId;
    const limit = limitFor(membership.tenant.planType);

    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url || url.length > 300 || /\s/.test(url)) {
      return NextResponse.json({ error: "A valid url is required." }, { status: 400 });
    }

    const { status, data } = await sidecarPost<AuditResult>("/audit", { url });
    if (status !== 200 || typeof data.score !== "number") {
      return NextResponse.json(
        { error: data.error || "Could not audit that site." },
        { status: status === 200 ? 502 : status },
      );
    }
    const canonUrl = data.url ?? url;
    const bots = data.robots?.bots ?? {};

    // Quota: distinct competitor URLs in the rolling window. Re-comparing an
    // already-counted URL is always allowed (refresh, not new usage).
    const rows = await recentBenchmarks(tenantId);
    const distinct = new Set(rows.map((r) => r.url));
    if (!distinct.has(canonUrl) && distinct.size >= limit) {
      return NextResponse.json(
        {
          error:
            limit === 1
              ? "Your Growth plan includes 1 competitor per day. Agency includes 5."
              : `Your plan includes ${limit} competitors per day.`,
          code: "BenchmarkLimit",
          used: distinct.size,
          limit,
        },
        { status: 403 },
      );
    }

    await prisma.visibilityAudit.create({
      data: {
        tenantId,
        monitorId: null,
        url: canonUrl,
        score: data.score,
        grade: data.grade ?? "?",
        checks: (data.checks ?? []) as unknown as Prisma.InputJsonValue,
        bots: bots as unknown as Prisma.InputJsonValue,
        raw: data as unknown as Prisma.InputJsonValue,
      },
    });

    distinct.add(canonUrl);
    return NextResponse.json({
      result: summarize(canonUrl, data.score, data.grade ?? "?", bots),
      used: distinct.size,
      limit,
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/benchmark POST]", error);
    return NextResponse.json({ error: "Benchmark failed." }, { status: 500 });
  }
}
