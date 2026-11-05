/**
 * GET /api/seo/v1/crawl/[id]/sitemap — XML sitemaps from a completed crawl,
 * as a zip (Phase 4a). Nothing is stored: rows stream from SQL into the zip.
 *
 * Query: lastmod=header|crawl|none (default crawl), changefreq=none|daily|…
 * (default none), priority=none|depth|0.0–1.0 (default none), exclude=<glob
 * or /regex/> (repeatable, ≤ 20), images=1 for image-sitemap.xml.
 *
 * Refused while the crawl runs, after retention deleted its pages, and for a
 * list-mode crawl (a pasted list is not a site).
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { CONFIG_LIMITS, compilePattern } from "@/lib/site-crawler/crawl-config";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";
import { CHANGEFREQS, writeSitemaps } from "@/lib/site-crawler/sitemap-generator";
import { ZipWriter } from "@/lib/site-crawler/zip";

const QuerySchema = z.object({
  lastmod: z.enum(["header", "crawl", "none"]).default("crawl"),
  changefreq: z.enum(CHANGEFREQS).default("none"),
  priority: z
    .union([z.enum(["none", "depth"]), z.coerce.number().min(0).max(1)])
    .default("none"),
  exclude: z.array(z.string().max(CONFIG_LIMITS.patternChars)).max(CONFIG_LIMITS.patterns).default([]),
  images: z.enum(["0", "1"]).default("0"),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, rootUrl: true, status: true, mode: true, finishedAt: true, ...DATA_STATE_SELECT },
    });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    const archived = archivedGuard(crawl);
    if (archived) return archived;
    if (crawl.status !== "COMPLETED" || crawl.dataPurgedAt || crawl.mode === "list") {
      return NextResponse.json(
        { error: "Sitemaps are generated from a completed site crawl whose pages are kept.", code: "NOT_AVAILABLE" },
        { status: 409 },
      );
    }

    const sp = new URL(request.url).searchParams;
    const parsed = QuerySchema.safeParse({
      lastmod: sp.get("lastmod") ?? undefined,
      changefreq: sp.get("changefreq") ?? undefined,
      priority: sp.get("priority") ?? undefined,
      exclude: sp.getAll("exclude").filter(Boolean),
      images: sp.get("images") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid options", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
    }
    const bad = parsed.data.exclude.map((p) => ({ p, c: compilePattern(p) })).filter((x) => !x.c.ok);
    if (bad.length) {
      return NextResponse.json({ error: "Invalid exclude pattern", code: "INVALID_REQUEST", patterns: bad.map((x) => x.p) }, { status: 400 });
    }

    const origin = new URL(crawl.rootUrl).origin;
    const crawlDate = crawl.finishedAt ?? new Date();
    const opts = { ...parsed.data, images: parsed.data.images === "1" };
    const host = new URL(crawl.rootUrl).hostname.replace(/[^a-z0-9.-]/gi, "");
    const filename = `sitemaps-${host}-${crawlDate.toISOString().slice(0, 10)}.zip`;


    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const zip = new ZipWriter((chunk) => controller.enqueue(chunk), crawlDate);
          await writeSitemaps(zip, { jobId: crawl.id, origin, crawlDate, opts });
          zip.finish();
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
