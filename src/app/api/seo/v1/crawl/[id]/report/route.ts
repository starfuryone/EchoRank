/**
 * /api/seo/v1/crawl/[id]/report — the crawl's PDF report (Phase 4c, crawl.reports).
 *
 *   GET  → { available } — drives ReportDownloadButton's visibility.
 *   POST → assemble this crawl's payload (src/lib/site-crawler/report.ts),
 *          render it on the sidecar's secret-gated POST /crawl-report and
 *          send application/pdf back. Nothing is stored; no link is minted.
 *
 * requirePaidPlan (session + tenant + paid); the crawl is looked up by id AND
 * tenantId. Logged-in only — AUTHENTICATED, do not add /api/seo/v1/* to
 * publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { flag } from "@/lib/flags";
import { archivedResponse, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT, crawlDataState } from "@/lib/site-crawler/data-state";
import { crawlReportPayload } from "@/lib/site-crawler/report";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

type Ctx = { params: Promise<{ id: string }> };
const DEFAULT_PDF_NAME = "Echorank-360-Site-Crawl-Report.pdf";

async function lookup(id: string, tenantId: string) {
  return prisma.crawlJob.findFirst({
    where: { id, tenantId },
    select: { id: true, rootUrl: true, createdAt: true, pagesCrawled: true, urlCap: true, stoppedReason: true, renderMode: true, summary: true, config: true, status: true, finishedAt: true, ...DATA_STATE_SELECT },
  });
}

/** The report reads findings and pages: a completed crawl whose rows are in Postgres. */
async function reportable(id: string, tenantId: string) {
  const crawl = await lookup(id, tenantId);
  return crawl && crawl.status === "COMPLETED" && crawlDataState(crawl) === "hot" ? crawl : null;
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
    const found = await lookup(id, tenant.tenantId);
    if (found && crawlDataState(found) === "archived") return archivedResponse(found);
    const crawl = found && found.status === "COMPLETED" && crawlDataState(found) === "hot" ? found : null;
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    const render = async (): Promise<Response | null> => {
      const payload = await crawlReportPayload(crawl);
      try {
        return await fetch(`${SIDECAR_URL}/crawl-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_SECRET },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(35_000),
          cache: "no-store",
        });
      } catch {
        return null;
      }
    };
    // The sidecar's own error text never reaches the browser.
    const refusal = (res: Response | null) =>
      res === null
        ? NextResponse.json({ error: "report_unavailable" }, { status: 502 })
        : NextResponse.json({ error: "report_failed" }, { status: res.status === 504 ? 504 : 502 });

    const res = await render();
    if (!res || !res.ok) return refusal(res);

    const pdf = new Uint8Array(await res.arrayBuffer());
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="${DEFAULT_PDF_NAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
