// GET /api/free/v1/site-crawler/{token} — a free crawl's progress, for the
// polling view: {status, host, pagesCrawled, urlCap, queuePosition,
// estimatedStart}. The token is the result link's secret; an unknown or
// expired one (FREE_CRAWL_RETENTION_DAYS) is a 404. The result itself is
// rendered by the result page, not returned here.

import { NextResponse } from "next/server";
import { flag } from "@/lib/flags";
import { freeCrawlByToken, freeStatus } from "@/lib/site-crawler/free-result";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!flag("crawl.free")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { token } = await ctx.params;
  const row = await freeCrawlByToken(token);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(await freeStatus(row), { headers: { "cache-control": "no-store" } });
}
