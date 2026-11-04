/**
 * /api/seo/v1/crawl/[id]/report — the crawl's PDF report (Phase 4c, crawl.reports).
 *
 *   GET  → { available } — drives ReportDownloadButton's visibility.
 *   POST → assemble this crawl's payload (src/lib/site-crawler/report.ts),
 *          render it on the sidecar's secret-gated POST /crawl-report and
 *          stream application/pdf back. Nothing is stored; no link is minted.
 *
 * requirePaidPlan (session + tenant + paid); the crawl is looked up by id AND
 * tenantId. Logged-in only — AUTHENTICATED, do not add /api/seo/v1/* to
 * publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { flag } from "@/lib/flags";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { crawlReportPayload } from "@/lib/site-crawler/report";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

type Ctx = { params: Promise<{ id: string }> };

async function reportable(id: string, tenantId: string) {
  const crawl = await prisma.crawlJob.findFirst({
    where: { id, tenantId },
    select: { id: true, rootUrl: true, createdAt: true, pagesCrawled: true, urlCap: true, stoppedReason: true, renderMode: true, summary: true, config: true, status: true, dataPurgedAt: true },
  });
  return crawl && crawl.status === "COMPLETED" && !crawl.dataPurgedAt ? crawl : null;
}

export async function GET(_request: Request, { params }: Ctx) {
  try {
    if (!flag("crawl.reports")) return NextResponse.json({ available: false });
    const tenant = await requirePaidPlan();
    const { id } = await params;
    return NextResponse.json({ available: Boolean(await reportable(id, tenant.tenantId)) });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function POST(_request: Request, { params }: Ctx) {
  try {
    if (!flag("crawl.reports")) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await reportable(id, tenant.tenantId);
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    const payload = await crawlReportPayload(crawl);

    let res: Response;
    try {
      res = await fetch(`${SIDECAR_URL}/crawl-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35_000),
        cache: "no-store",
      });
    } catch {
      return NextResponse.json({ error: "report_unavailable" }, { status: 502 });
    }
    if (!res.ok) return NextResponse.json({ error: "report_failed" }, { status: res.status === 504 ? 504 : 502 });

    const pdf = new Uint8Array(await res.arrayBuffer());
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="Echorank-360-Site-Crawl-Report.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
