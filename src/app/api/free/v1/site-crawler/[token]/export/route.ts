// GET /api/free/v1/site-crawler/{token}/export — the free crawl's issues CSV
// (one row per finding, the dashboard's ISSUE_COLUMNS), for a browser that
// unlocked this result (its erfc_<token> cookie); 403 otherwise.

import { NextResponse } from "next/server";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse } from "@/lib/csv-stream";
import { flag } from "@/lib/flags";
import { prisma } from "@/lib/prisma";
import { ISSUE_COLUMNS, type CrawlIssueRow } from "@/lib/site-crawler/csv-columns";
import { freeCrawlByToken, isUnlocked, unlockCookieName } from "@/lib/site-crawler/free-result";

function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!flag("crawl.free")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { token } = await ctx.params;
  const row = await freeCrawlByToken(token);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!isUnlocked(row.token, cookieValue(request, unlockCookieName(row.token)))) return NextResponse.json({ error: "locked" }, { status: 403 });
  if (row.crawlJob.status !== "COMPLETED") return NextResponse.json({ error: "not_ready" }, { status: 409 });
  const crawlJobId = row.crawlJob.id;
  return csvStreamResponse<CrawlIssueRow>({
    columns: ISSUE_COLUMNS,
    filename: csvFilename(`free-crawl-${row.host}`),
    cursorOf: (r) => r.id,
    fetchPage: (cursor, take) =>
      prisma.crawlIssue.findMany({
        where: { crawlPage: { crawlJobId }, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take,
        select: { id: true, type: true, severity: true, detail: true, crawlPage: { select: { url: true, statusCode: true, segmentIds: true } } },
      }),
  });
}
