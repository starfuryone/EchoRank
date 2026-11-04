// tests/site-crawler-metrics-ai.db.test.ts — Phase 4e AI prompts against
// Postgres: the top N HTML pages by inlinks, each prompt once per page
// (kind ai rows), Claude metered on the token budget with a hard stop before
// a call that would cross it, a missing tenant key stops the step, and the
// ai rules on the pages that were answered. SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("AI prompts against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let r: typeof import("@/lib/site-crawler/metrics-runner");
  const tenantId = `t_ai_${Date.now()}`;
  const url = (p: string) => `https://ai.example/${p}`;
  const html = (title: string) => `<html><head><title>${title}</title></head><body><p>Our ${title} are handmade. Teh wood is oak.</p></body></html>`;
  let used = 0;
  const calls: string[] = [];
  const deps = (limit: number | null, key: string | null = "house-key") => ({
    aiKey: async () => key,
    aiFetchHtml: async (u: string) => html(u.endsWith("/tables") ? "Tables" : "Chairs"),
    tokenBudget: async () => ({ used, limit }),
    recordTokens: async (_t: string, n: number) => void (used += n),
    aiCall: async (_p: unknown, _k: string, prompt: { preset: string }, page: { url: string; text: string }) => {
      calls.push(`${page.url}#${prompt.preset}`);
      expect(page.text).toContain("handmade");
      const text = prompt.preset === "title" ? "Title: Handmade oak tables\nDescription: x" : "- Teh → The";
      return { text, inputTokens: 800, outputTokens: 30, model: "m" };
    },
  });
  const makeJob = async (id: string, provider = "claude") => {
    await prisma.crawlJob.create({
      data: {
        id, tenantId, rootUrl: url(""), urlCap: 10, status: "COMPLETED", summary: {},
        config: { ai: { provider, prompts: [{ preset: "title", text: null }, { preset: "grammar", text: null }], top: { pages: 2, segment: null } } },
      },
    });
    const page = (p: string, inlinks: number, over: Record<string, unknown> = {}) =>
      prisma.crawlPage.create({ data: { crawlJobId: id, url: url(p), depth: 1, statusCode: 200, contentType: "text/html", noindex: false, inlinkCount: inlinks, title: p === "tables" ? "Tables" : "Handmade oak tables", ...over } });
    await page("tables", 30);
    await page("chairs", 20);
    await page("gone", 50, { statusCode: 404 });
    await page("tail", 1);
  };
  const run = async (id: string, d: ReturnType<typeof deps>) => {
    let tick = await r.runCrawlMetrics(id, d as never);
    while (!tick.done) tick = await r.runCrawlMetrics(id, d as never);
    return (await prisma.crawlJob.findUnique({ where: { id }, select: { summary: true, issueCount: true } }))!;
  };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    r = await import("@/lib/site-crawler/metrics-runner");
    await prisma.tenant.create({ data: { id: tenantId, name: "ai", slug: tenantId, planType: "GROWTH" } });
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("answers each prompt once on the top 2 HTML pages, meters the tokens, and runs the ai rules", async () => {
    const id = `${tenantId}_a`;
    await makeJob(id);
    const row = await run(id, deps(100_000));
    expect(calls.sort()).toEqual([url("chairs#grammar"), url("chairs#title"), url("tables#grammar"), url("tables#title")].sort());
    expect(used).toBe(4 * 830);
    const rows = await prisma.crawlExtraction.findMany({ where: { crawlJobId: id, kind: "ai" } });
    expect(rows).toHaveLength(4);
    expect((row.summary as { metrics: { ai: unknown } }).metrics.ai).toMatchObject({ status: "done", targets: 2, completed: 2, failed: 0, tokens: 3320 });
    const fired = async (rule: string) =>
      (await prisma.crawlIssue.findMany({ where: { crawlJobId: id, ruleId: rule }, include: { crawlPage: { select: { url: true } } } })).map((i) => i.crawlPage.url).sort();
    // /chairs already carries the suggested title; /tables does not.
    expect(await fired("ai.suggested_title_differs")).toEqual([url("tables")]);
    expect(await fired("ai.grammar_issues")).toEqual([url("chairs"), url("tables")]);
    expect(row.issueCount).toBe(3);
    expect(await prisma.aiApiCall.count({ where: { tenantId, categoryId: "site_crawler_ai" } })).toBe(4);
    // A second run is a no-op.
    calls.length = 0;
    await run(id, deps(100_000));
    expect(calls).toEqual([]);
  });

  it("stops before a call that would cross the token budget, and says so", async () => {
    const id = `${tenantId}_b`;
    await makeJob(id);
    calls.length = 0;
    used = 0;
    const row = await run(id, deps(3_000));
    // Each call must fit 2,000 tokens under the limit: two calls (1,660 used) fit, a third would cross 3,000.
    expect(calls).toHaveLength(2);
    expect((row.summary as { metrics: { ai: unknown } }).metrics.ai).toMatchObject({ status: "stopped", stoppedReason: "token_budget" });
  });

  it("stops with key_missing when the tenant's own key is gone; never meters it", async () => {
    const id = `${tenantId}_c`;
    await makeJob(id, "openai");
    calls.length = 0;
    used = 0;
    const row = await run(id, deps(null, null));
    expect(calls).toEqual([]);
    expect(used).toBe(0);
    expect((row.summary as { metrics: { ai: unknown } }).metrics.ai).toMatchObject({ status: "stopped", stoppedReason: "key_missing" });
  });

  it("Phase 4g: reads the snippet the crawl kept instead of fetching the page", async () => {
    const id = `${tenantId}_d`;
    await makeJob(id);
    await prisma.crawlPage.updateMany({ where: { crawlJobId: id }, data: { textSnippet: "Our Tables are handmade. Kept during the crawl." } });
    calls.length = 0;
    used = 0;
    const d = { ...deps(100_000), aiFetchHtml: async () => {
      throw new Error("must not fetch");
    } };
    const row = await run(id, d as never);
    expect(calls).toHaveLength(4);
    expect((row.summary as { metrics: { ai: unknown } }).metrics.ai).toMatchObject({ status: "done", failed: 0 });
  });
});
