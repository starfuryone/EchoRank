// src/lib/site-crawler/sitemap-generator.ts
//
// XML sitemaps from a completed crawl (Phase 4a). Streamed from SQL into a
// zip; nothing is stored. Which pages: 200, HTML, not noindex, and either no
// canonical or a canonical to themselves (a page that canonicalises elsewhere
// is not the URL to list), minus the tenant's exclude patterns.
//
// Files: sitemap.xml, or sitemap-1.xml … sitemap-N.xml plus
// sitemap_index.xml once a file reaches the protocol's 50,000 URLs; the same
// for image-sitemap.xml when images are asked for. Index entries point at the
// site root, where the files are meant to be uploaded.
//
// Memory: one keyset batch of rows and the sitemap file being filled (at most
// 50,000 <url> entries, ~10 MB) at a time.

import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { compilePattern } from "./crawl-config";
import type { ZipWriter } from "./zip";

export const SITEMAP_MAX_URLS = 50_000;
const BATCH = 5_000;

export const CHANGEFREQS = ["none", "always", "hourly", "daily", "weekly", "monthly", "yearly", "never"] as const;

export interface SitemapOptions {
  lastmod: "header" | "crawl" | "none";
  changefreq: (typeof CHANGEFREQS)[number];
  /** "none", "depth" (1.0 at the root, 0.2 less per level, 0.1 floor), or a fixed 0–1 value. */
  priority: "none" | "depth" | number;
  exclude: string[];
  images: boolean;
}

export interface SitemapRow {
  id: string;
  url: string;
  depth: number;
  lastModified: string | null;
  imgSrcs: string[];
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function depthPriority(depth: number): string {
  return Math.max(0.1, 1 - 0.2 * depth).toFixed(1);
}

/** Last-Modified (an HTTP date) → W3C datetime; null when it does not parse. */
export function w3cDate(httpDate: string | null): string | null {
  if (!httpDate) return null;
  const t = Date.parse(httpDate);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, "+00:00") : null;
}

export function urlEntry(row: SitemapRow, opts: SitemapOptions, crawlDate: Date): string {
  const lastmod =
    opts.lastmod === "header" ? w3cDate(row.lastModified) : opts.lastmod === "crawl" ? w3cDate(crawlDate.toUTCString()) : null;
  const priority = opts.priority === "none" ? null : opts.priority === "depth" ? depthPriority(row.depth) : opts.priority.toFixed(1);
  return (
    `<url><loc>${xmlEscape(row.url)}</loc>` +
    (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
    (opts.changefreq !== "none" ? `<changefreq>${opts.changefreq}</changefreq>` : "") +
    (priority ? `<priority>${priority}</priority>` : "") +
    `</url>`
  );
}

export function imageEntry(row: SitemapRow): string {
  return (
    `<url><loc>${xmlEscape(row.url)}</loc>` +
    row.imgSrcs.map((src) => `<image:image><image:loc>${xmlEscape(src)}</image:loc></image:image>`).join("") +
    `</url>`
  );
}

const URLSET = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const IMAGE_URLSET =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

/**
 * One family of files (pages or images). Holds the file being filled; a full
 * file is written only once another entry needs room, so a crawl that fits in
 * one file gets the plain name (sitemap.xml) rather than sitemap-1.xml.
 */
class FileSeries {
  private entries: string[] = [];
  readonly written: string[] = [];

  constructor(
    private readonly base: string,
    private readonly head: string,
    private readonly zip: ZipWriter,
  ) {}

  add(entry: string): void {
    if (this.entries.length >= SITEMAP_MAX_URLS) this.flush(`${this.base}-${this.written.length + 1}.xml`);
    this.entries.push(entry);
  }

  end(): void {
    if (!this.entries.length) return;
    this.flush(this.written.length ? `${this.base}-${this.written.length + 1}.xml` : `${this.base}.xml`);
  }

  private flush(name: string): void {
    this.zip.addFile(name, `${this.head}${this.entries.join("\n")}\n</urlset>\n`);
    this.written.push(name);
    this.entries = [];
  }
}

/** Indexable pages, a keyset batch at a time. */
export async function sitemapRowsPage(jobId: string, cursor: string | null, take = BATCH): Promise<SitemapRow[]> {
  return prisma.$queryRaw<SitemapRow[]>`
    SELECT "id", "url", "depth", "lastModified", "imgSrcs"
    FROM "crawl_pages"
    WHERE "crawlJobId" = ${jobId}
      AND "statusCode" = 200
      AND "contentType" ILIKE '%html%'
      AND "noindex" IS NOT TRUE
      AND ("canonical" IS NULL OR rtrim("canonical", '/') = rtrim("url", '/'))
      ${cursor ? Prisma.sql`AND "id" > ${cursor}` : Prisma.empty}
    ORDER BY "id"
    LIMIT ${take}`;
}

/** Write the sitemap files for a crawl into `zip`. Returns how many URLs were listed. */
export async function writeSitemaps(
  zip: ZipWriter,
  args: { jobId: string; origin: string; crawlDate: Date; opts: SitemapOptions },
  page: (cursor: string | null) => Promise<SitemapRow[]> = (c) => sitemapRowsPage(args.jobId, c),
): Promise<number> {
  const excluded = args.opts.exclude.map(compilePattern).flatMap((c) => (c.ok ? [c.test] : []));
  const pages = new FileSeries("sitemap", URLSET, zip);
  const images = new FileSeries("image-sitemap", IMAGE_URLSET, zip);
  let listed = 0;
  for (let cursor: string | null = null; ; ) {
    const rows = await page(cursor);
    if (!rows.length) break;
    cursor = rows.at(-1)!.id;
    for (const row of rows) {
      if (excluded.some((t) => t(row.url))) continue;
      pages.add(urlEntry(row, args.opts, args.crawlDate));
      if (args.opts.images && row.imgSrcs?.length) images.add(imageEntry(row));
      listed++;
    }
  }
  pages.end();
  images.end();
  const parts = [...pages.written, ...images.written];
  if (pages.written.length > 1 || images.written.length > 1) {
    const now = w3cDate(args.crawlDate.toUTCString());
    zip.addFile(
      "sitemap_index.xml",
      '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        parts.map((n) => `<sitemap><loc>${xmlEscape(`${args.origin}/${n}`)}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n") +
        "\n</sitemapindex>\n",
    );
  }
  return listed;
}
