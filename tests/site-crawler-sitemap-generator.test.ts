// XML sitemap generator (Phase 4a): which pages, which fields, the 50,000 split,
// the image sitemap, and a zip any unzip can open.
import { crc32, inflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn() };
const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

const { SITEMAP_MAX_URLS, depthPriority, w3cDate, writeSitemaps } = await import("@/lib/site-crawler/sitemap-generator");
const { ZipWriter } = await import("@/lib/site-crawler/zip");
const { GET } = await import("@/app/api/seo/v1/crawl/[id]/sitemap/route");

type Opts = import("@/lib/site-crawler/sitemap-generator").SitemapOptions;
type Row = import("@/lib/site-crawler/sitemap-generator").SitemapRow;

/** Read a zip: every entry's name and text, CRC-checked. */
function unzip(buf: Buffer): Record<string, string> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const lName = buf.readUInt16LE(local + 26);
    const lExtra = buf.readUInt16LE(local + 28);
    const data = inflateRawSync(buf.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size));
    expect(crc32(data) >>> 0, name).toBe(crc >>> 0);
    out[name] = data.toString("utf8");
    p += 46 + nameLen;
  }
  return out;
}

const OPTS: Opts = { lastmod: "none", changefreq: "none", priority: "none", exclude: [], images: false };
const CRAWLED = new Date("2026-11-03T10:00:00Z");
const row = (i: number, over: Partial<Row> = {}): Row => ({
  id: `p${String(i).padStart(6, "0")}`,
  url: `https://x.com/p/${i}`,
  depth: 1,
  lastModified: null,
  imgSrcs: [],
  ...over,
});

async function build(rows: Row[], opts: Partial<Opts> = {}) {
  const chunks: Uint8Array[] = [];
  const zip = new ZipWriter((c) => chunks.push(c), CRAWLED);
  const listed = await writeSitemaps(
    zip,
    { jobId: "c1", origin: "https://x.com", crawlDate: CRAWLED, opts: { ...OPTS, ...opts } },
    async (cursor) => {
      const start = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
      return rows.slice(start, start + 5000);
    },
  );
  zip.finish();
  return { listed, files: unzip(Buffer.concat(chunks)) };
}

describe("sitemap files", () => {
  it("one file is sitemap.xml, escaped, with no optional fields by default", async () => {
    const { files, listed } = await build([row(1, { url: "https://x.com/a?b=1&c=2" })]);
    expect(listed).toBe(1);
    expect(Object.keys(files)).toEqual(["sitemap.xml"]);
    expect(files["sitemap.xml"]).toContain("<url><loc>https://x.com/a?b=1&amp;c=2</loc></url>");
  });

  it.each([
    [{ lastmod: "header" as const }, row(1, { lastModified: "Tue, 03 Nov 2026 09:00:00 GMT" }), "<lastmod>2026-11-03T09:00:00+00:00</lastmod>"],
    [{ lastmod: "header" as const }, row(1, { lastModified: "garbage" }), "<url><loc>https://x.com/p/1</loc></url>"],
    [{ lastmod: "crawl" as const }, row(1), "<lastmod>2026-11-03T10:00:00+00:00</lastmod>"],
    [{ changefreq: "weekly" as const }, row(1), "<changefreq>weekly</changefreq>"],
    [{ priority: 0.5 }, row(1), "<priority>0.5</priority>"],
    [{ priority: "depth" as const }, row(1, { depth: 0 }), "<priority>1.0</priority>"],
  ])("%o", async (opts, r, expected) => {
    expect((await build([r], opts)).files["sitemap.xml"]).toContain(expected);
  });

  it("priority by depth steps down 0.2 a level, never below 0.1", () => {
    expect([0, 1, 2, 4, 9].map(depthPriority)).toEqual(["1.0", "0.8", "0.6", "0.2", "0.1"]);
    expect(w3cDate(null)).toBeNull();
  });

  it("drops excluded URLs", async () => {
    const { files, listed } = await build([row(1, { url: "https://x.com/tag/a" }), row(2)], { exclude: ["*/tag/*"] });
    expect(listed).toBe(1);
    expect(files["sitemap.xml"]).not.toContain("/tag/");
  });

  it("splits at 50,000 URLs and writes an index pointing at the site root", async () => {
    const rows = Array.from({ length: SITEMAP_MAX_URLS + 1 }, (_, i) => row(i));
    const { files } = await build(rows);
    expect(Object.keys(files).sort()).toEqual(["sitemap-1.xml", "sitemap-2.xml", "sitemap_index.xml"]);
    expect(files["sitemap-1.xml"]!.match(/<url>/g)).toHaveLength(SITEMAP_MAX_URLS);
    expect(files["sitemap-2.xml"]!.match(/<url>/g)).toHaveLength(1);
    expect(files["sitemap_index.xml"]).toContain("<loc>https://x.com/sitemap-2.xml</loc>");
  }, 30_000);

  it("image sitemap lists each page's images under the image namespace", async () => {
    const { files } = await build([row(1, { imgSrcs: ["https://cdn.x.com/a.png", "https://x.com/b&c.jpg"] }), row(2)], { images: true });
    expect(Object.keys(files).sort()).toEqual(["image-sitemap.xml", "sitemap.xml"]);
    expect(files["image-sitemap.xml"]).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(files["image-sitemap.xml"]).toContain("<image:loc>https://x.com/b&amp;c.jpg</image:loc>");
    expect(files["image-sitemap.xml"]!.match(/<url>/g)).toHaveLength(1);
  });
});

describe("GET /crawl/[id]/sitemap", () => {
  const params = { params: Promise.resolve({ id: "c1" }) };
  const get = (qs = "") => GET(new Request(`https://app.test/api/seo/v1/crawl/c1/sitemap${qs}`), params);
  const crawl = (over: Record<string, unknown> = {}) =>
    crawlJob.findFirst.mockResolvedValue({ id: "c1", rootUrl: "https://x.com/", status: "COMPLETED", mode: "spider", dataPurgedAt: null, finishedAt: CRAWLED, ...over });

  beforeEach(() => {
    vi.clearAllMocks();
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    queryRaw.mockResolvedValueOnce([row(1)]).mockResolvedValue([]);
  });

  it("streams a zip named after the host and date", async () => {
    crawl();
    const res = await get("?images=1&priority=depth");
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain('filename="sitemaps-x.com-2026-11-03.zip"');
    expect(Object.keys(unzip(Buffer.from(await res.arrayBuffer())))).toEqual(["sitemap.xml"]);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", tenantId: "t1" });
  });

  it.each([
    [{ status: "RUNNING" }],
    [{ dataPurgedAt: new Date() }],
    [{ mode: "list" }],
  ])("409 for %o", async (over) => {
    crawl(over);
    expect((await get()).status).toBe(409);
  });

  it.each(["?priority=2", "?changefreq=sometimes", "?exclude=/(a%2B)%2B/"])("400 on %s", async (qs) => {
    crawl();
    expect((await get(qs)).status).toBe(400);
  });
});
