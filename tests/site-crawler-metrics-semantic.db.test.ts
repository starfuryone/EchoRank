// tests/site-crawler-metrics-semantic.db.test.ts — Phase 4g semantic
// duplicates against Postgres: the top N HTML pages' text embedded on the
// tenant's own key (1 KB vectors in crawl_pages.embedding), pairwise cosine
// and centroid distance in the worker, the content rules on those pages; a
// missing key stops the step. SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("semantic duplicates against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let r: typeof import("@/lib/site-crawler/metrics-runner");
  const tenantId = `t_sem_${Date.now()}`;
  const url = (p: string) => `https://sem.example/${p}`;
  const DIMS = 256;
  // Pages "twin-a" / "twin-b" say the same thing; "ufo" is far from the rest.
  const axis = (p: string): [number, number, number] =>
    p.startsWith("twin") ? [0, 1, p === "twin-a" ? 0.01 : 0.012] : p === "ufo" ? [200, 201, 0] : [0, 2 + Number(p.slice(1)), 0.6];
  const vector = (text: string) => {
    const [a, b, e] = axis(text.split(" ")[1]!);
    const v = new Float32Array(DIMS);
    v[a] = 1;
    v[b] += e;
    return v;
  };
  let calls = 0;
  const deps = (key: string | null = "sk-tenant") => ({
    aiKey: async () => key,
    aiFetchHtml: async (u: string) => `<html><body><p>About ${u.split("/").pop()} things.</p></body></html>`,
    embed: async (_k: string, texts: string[]) => (calls++, { vectors: texts.map(vector), tokens: texts.length * 10 }),
  });
  const makeJob = async (id: string, names: string[]) => {
    await prisma.crawlJob.create({ data: { id, tenantId, rootUrl: url(""), urlCap: 50, status: "COMPLETED", summary: {}, config: { semantic: { pages: names.length, segment: null } } } });
    for (const [i, n] of names.entries()) {
      await prisma.crawlPage.create({ data: { crawlJobId: id, url: url(n), depth: 1, statusCode: 200, contentType: "text/html", noindex: false, inlinkCount: 100 - i } });
    }
  };
  const run = async (id: string, d: ReturnType<typeof deps>) => {
    let tick = await r.runCrawlMetrics(id, d as never);
    while (!tick.done) tick = await r.runCrawlMetrics(id, d as never);
    return (await prisma.crawlJob.findUnique({ where: { id }, select: { summary: true } }))!.summary as { metrics: { semantic: Record<string, unknown> } };
  };
  const fired = async (id: string, rule: string) =>
    (await prisma.crawlIssue.findMany({ where: { crawlJobId: id, ruleId: rule }, include: { crawlPage: { select: { url: true } } } })).map((i) => i.crawlPage.url).sort();

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    r = await import("@/lib/site-crawler/metrics-runner");
    await prisma.tenant.create({ data: { id: tenantId, name: "sem", slug: tenantId, planType: "GROWTH" } });
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("embeds the top N, stores 1 KB vectors, flags the twins and the off-topic page", async () => {
    const id = `${tenantId}_a`;
    await makeJob(id, ["twin-a", "twin-b", ...Array.from({ length: 18 }, (_, i) => `p${i}`), "ufo"]);
    const s = await run(id, deps());
    expect(s.metrics.semantic).toMatchObject({ status: "done", targets: 21, completed: 21, embedded: 21, tokens: 210 });
    const bytes = await prisma.crawlPage.findMany({ where: { crawlJobId: id }, select: { embedding: true } });
    expect(bytes.every((b) => b.embedding?.length === 1024)).toBe(true);
    expect(await fired(id, "content.semantic_duplicate")).toEqual([url("twin-a"), url("twin-b")]);
    expect(await fired(id, "content.off_topic")).toEqual([url("ufo")]);
    const ev = await prisma.crawlIssue.findFirst({ where: { crawlJobId: id, ruleId: "content.semantic_duplicate", crawlPage: { url: url("twin-a") } } });
    expect(ev?.evidence).toMatchObject({ value: url("twin-b") });
    // A second run embeds nothing again.
    calls = 0;
    await run(id, deps());
    expect(calls).toBe(0);
  }, 60_000);

  it("stops with key_missing when the tenant has no OpenAI key, embedding nothing", async () => {
    const id = `${tenantId}_b`;
    await makeJob(id, ["p0", "p1"]);
    calls = 0;
    const s = await run(id, deps(null));
    expect(calls).toBe(0);
    expect(s.metrics.semantic).toMatchObject({ status: "stopped", stoppedReason: "key_missing" });
  });

  it("Phase 4g: embeds the kept snippet without fetching; falls back to a fetch only where it is null", async () => {
    const id = `${tenantId}_c`;
    await makeJob(id, ["p0", "p1", "p2"]);
    await prisma.crawlPage.updateMany({ where: { crawlJobId: id, url: { in: [url("p0"), url("p1")] } }, data: { textSnippet: "About kept things." } });
    const fetched: string[] = [];
    const d = { ...deps(), aiFetchHtml: async (u: string) => (fetched.push(u), `<html><body><p>About ${u.split("/").pop()} things.</p></body></html>`) };
    const s = await run(id, d as never);
    expect(fetched).toEqual([url("p2")]);
    expect(s.metrics.semantic).toMatchObject({ status: "done", embedded: 3 });
  }, 30_000);
});
