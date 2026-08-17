import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";
import { hydratableAudit } from "@/lib/visibility-audit-hydrate";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

interface AuditResponse {
  url?: string;
  score?: number;
  grade?: string;
  checks?: unknown[];
  robots?: { bots?: Record<string, unknown> };
  error?: string;
}

/**
 * Stores the audit attached to an inactive monitor row for the audited URL.
 * Attaching a monitorId keeps these rows out of the competitor-benchmark
 * queries (which key on monitorId = null), and the inactive monitor never
 * gets picked up by the scheduled sweep — but seeds the MonitorCard with the
 * latest score and flips to active seamlessly if monitoring is enabled later.
 */
async function persistAudit(tenantId: string, url: string, data: AuditResponse) {
  const canonUrl = data.url ?? url;
  const now = new Date();
  const monitor = await prisma.visibilityMonitor.upsert({
    where: { tenantId_url: { tenantId, url: canonUrl } },
    update: { lastRunAt: now, lastScore: data.score, lastGrade: data.grade ?? "?" },
    create: {
      tenantId,
      url: canonUrl,
      active: false,
      lastRunAt: now,
      lastScore: data.score,
      lastGrade: data.grade ?? "?",
    },
  });
  await prisma.visibilityAudit.create({
    data: {
      tenantId,
      monitorId: monitor.id,
      url: canonUrl,
      score: data.score as number,
      grade: data.grade ?? "?",
      checks: (data.checks ?? []) as unknown as Prisma.InputJsonValue,
      bots: (data.robots?.bots ?? {}) as unknown as Prisma.InputJsonValue,
      raw: data as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * GET → the tenant's most recent stored audit, so a reload does not blank the
 * results panel.
 *
 * Same guard as POST — requireTenant() only, deliberately: this reads back
 * exactly what the write path just stored, and a GET that gated harder than
 * the POST would let a tenant create rows it then could not see. Scoped by
 * tenantId on the query itself, never by an id from the client.
 */
export async function GET() {
  try {
    const membership = await requireTenant();

    const row = await prisma.visibilityAudit.findFirst({
      where: { tenantId: membership.tenantId },
      orderBy: { createdAt: "desc" },
      select: { url: true, score: true, grade: true, raw: true, createdAt: true },
    });
    if (!row) return NextResponse.json({ audit: null });

    const audit = hydratableAudit(row.raw, row);
    return NextResponse.json({
      audit,
      auditedAt: audit ? row.createdAt.toISOString() : null,
    });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error loading latest visibility audit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requireTenant();

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Enter a URL to audit." }, { status: 400 });
    }
    const crawl = body?.crawl !== false;
    const persist = body?.persist === true;

    const { status, data } = await sidecarPost<AuditResponse>("/audit", { url, crawl });

    if (persist && status === 200 && typeof data.score === "number" && !data.error) {
      // Best-effort: a failed write must not eat a successful audit result.
      try {
        await persistAudit(membership.tenantId, url, data);
      } catch (err) {
        console.error("Failed to persist visibility audit:", err);
      }
    }

    return NextResponse.json(data, { status });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error running visibility audit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
