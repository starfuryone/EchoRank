// src/app/api/ai/visibility/bots/route.ts
// Bot Analytics v1: crawler ACCESS POSTURE (what the tenant's site permits),
// not traffic — the app stores no crawler hit logs, so no traffic numbers
// are shown anywhere. Live robots.txt/sitemap/llms.txt evaluation comes from
// the sidecar's secret-gated POST /bots (which reuses the audit engine's
// fetch + robots parser). If the live check fails, we fall back to the bot
// snapshot stored with the tenant's latest VisibilityAudit, marked stale.
//
// The site URL is resolved from the tenant's own data only (active monitor →
// latest audit → onboarding auditDomain) — no URL parameter is accepted, so
// the route cannot be pointed at another tenant's (or an arbitrary) site
// beyond what the tenant already configured.
//
// INTEGRATION POINT: log-based crawler analytics (real hit counts per bot)
// would slot in here once tenant access logs are ingested; the sidecar's
// /attribute endpoint already parses pasted logs one-off on /visibility.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";
import { BOT_TOKENS } from "@/lib/bot-catalog";
import { prisma } from "@/lib/prisma";

interface BotState {
  status: "ALLOWED" | "BLOCKED";
  detail: string;
}
interface BotsResponse {
  url?: string;
  robots_present?: boolean;
  bots?: Record<string, BotState>;
  sitemap?: { found: boolean; urls: string[] };
  llms_txt?: boolean;
  error?: string;
}

async function resolveSiteUrl(tenantId: string): Promise<string | null> {
  const monitor = await prisma.visibilityMonitor.findFirst({
    where: { tenantId, active: true },
    orderBy: { updatedAt: "desc" },
    select: { url: true },
  });
  if (monitor) return monitor.url;
  const audit = await prisma.visibilityAudit.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  if (audit) return audit.url;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { auditDomain: true },
  });
  return tenant?.auditDomain ?? null;
}

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const tenantId = membership.tenantId;

    const url = await resolveSiteUrl(tenantId);
    if (!url) {
      // Honest empty state: nothing configured that identifies the tenant's site.
      return NextResponse.json({ url: null });
    }

    const { status, data } = await sidecarPost<BotsResponse>("/bots", {
      url,
      bots: BOT_TOKENS,
    });

    if (status === 200 && data.bots && !data.error) {
      return NextResponse.json({
        url: data.url ?? url,
        source: "live",
        checkedAt: new Date().toISOString(),
        robotsPresent: data.robots_present ?? false,
        bots: data.bots,
        sitemap: data.sitemap ?? { found: false, urls: [] },
        llmsTxt: data.llms_txt ?? false,
      });
    }

    // Live check failed → stored snapshot from the latest audit, marked stale.
    const audit = await prisma.visibilityAudit.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { url: true, bots: true, createdAt: true },
    });
    if (audit && audit.bots && typeof audit.bots === "object") {
      return NextResponse.json({
        url: audit.url,
        source: "audit_snapshot",
        checkedAt: audit.createdAt,
        robotsPresent: true,
        bots: audit.bots as unknown as Record<string, BotState>,
        sitemap: null, // not part of the stored snapshot — omitted, not guessed
        llmsTxt: null,
      });
    }

    return NextResponse.json(
      { error: data.error || "Bot check failed." },
      { status: 502 },
    );
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[visibility/bots GET]", error);
    return NextResponse.json({ error: "Failed to load bot posture." }, { status: 500 });
  }
}
