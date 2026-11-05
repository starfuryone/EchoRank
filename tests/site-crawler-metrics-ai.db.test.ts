// tests/site-crawler-metrics-ai.db.test.ts — Phase 4e AI prompts against
// Postgres: the top N HTML pages by inlinks, each prompt once per page
// (kind ai rows), Claude metered on the token budget with a hard stop before
// a call that would cross it, a missing tenant key stops the step, and the
// ai rules on the pages that were answered. Batch mode (crawl.aiBatch) with a
// mocked provider: submit → "queued in batch" → results stored and metered,
// PSI not held up behind a waiting batch, and the synchronous fallback when a
// batch is not accepted within 2 minutes or leaves requests unanswered.
// SKIPPED UNLESS TEST_DATABASE_URL IS SET.
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
    // The synchronous path; batch mode has its own tests below.
    aiBatch: { enabled: () => false },
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
    const row = await run(id, deps(3_500));
    // Each call must fit its 2,400-token estimate under the limit: two calls (1,660 used) fit, a third would cross 3,500.
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

  describe("batch mode", () => {
    type Item = { customId: string; req: { body: Record<string, unknown>; model: string } };
    const T0 = Date.parse("2026-11-05T10:00:00Z");
    /** A mocked provider batch: what was submitted, the poll answers in order, and the results. */
    const batchDeps = (o: {
      limit?: number | null;
      key?: string;
      submitFails?: boolean;
      polls?: ({ state: "validating" } | { state: "running" } | { state: "failed" } | { state: "ended" })[];
      errored?: (customId: string) => boolean;
    } = {}) => {
      const clock = { t: T0 };
      const seen = { submitted: [] as Item[], submits: 0, cancels: 0, removes: 0 };
      const polls = [...(o.polls ?? [{ state: "running" }, { state: "ended" }])];
      const base = deps(o.limit === undefined ? 100_000 : o.limit, o.key ?? "house-key");
      const d = {
        ...base,
        now: () => clock.t,
        aiBatch: {
          enabled: () => true,
          submit: async (_p: string, _k: string, items: Item[]) => {
            seen.submits++;
            if (o.submitFails) throw new Error("HTTP 503");
            seen.submitted = items;
            return { provider: _p, id: "batch_1", inputFileId: _p === "openai" ? "file-in" : null };
          },
          poll: async () => {
            const p = polls.shift() ?? { state: "ended" };
            return p.state === "ended" ? { state: "ended", resultsUrl: "https://r", outputFileId: null, errorFileId: null } : p;
          },
          results: async () =>
            seen.submitted.map((it) => {
              if (o.errored?.(it.customId)) return { customId: it.customId, ok: false, reason: "errored" };
              const title = it.customId.endsWith("_0");
              return {
                customId: it.customId,
                ok: true,
                result: { text: title ? "Title: Handmade oak tables\nDescription: x" : "- Teh → The", inputTokens: 800, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 30, model: it.req.model },
              };
            }),
          cancel: async () => void seen.cancels++,
          remove: async () => void seen.removes++,
        },
      };
      return { d, clock, seen };
    };
    const tick = (id: string, d: unknown) => r.runCrawlMetrics(id, d as never);
    const aiState = async (id: string) =>
      ((await prisma.crawlJob.findUnique({ where: { id }, select: { summary: true } }))!.summary as { metrics: { ai: Record<string, unknown> & { batch?: Record<string, unknown> } } }).metrics.ai;

    it("claude: one batch with every request, 'queued in batch' while it waits, then stored and metered like a synchronous run", async () => {
      const id = `${tenantId}_batch_a`;
      await makeJob(id);
      calls.length = 0;
      used = 0;
      const { d, seen } = batchDeps();
      const t1 = await tick(id, d);
      expect(t1).toEqual({ done: false, delayMs: 60_000, parked: true });
      expect(seen.submitted.map((i) => i.customId).sort()).toHaveLength(4);
      // The same body the synchronous call would send.
      expect(seen.submitted[0]!.req.body).toHaveProperty("system");
      expect(await aiState(id)).toMatchObject({ status: "queued_batch", completed: 0, batch: { provider: "claude", phase: "queued", id: "batch_1", requests: 4 } });
      expect(await aiState(id)).toHaveProperty("batch.acceptedAt");
      const t2 = await tick(id, d);
      expect(t2).toMatchObject({ done: false, parked: true });
      expect((await aiState(id)).status).toBe("queued_batch");
      await tick(id, d); // ended: results stored
      expect(await prisma.crawlExtraction.count({ where: { crawlJobId: id, kind: "ai" } })).toBe(4);
      expect(seen.removes).toBe(1);
      expect(await tick(id, d)).toEqual({ done: true });
      expect(calls).toEqual([]); // nothing ran synchronously
      expect(seen.submits).toBe(1);
      expect(await aiState(id)).toMatchObject({ status: "done", completed: 2, failed: 0, batch: { phase: "ended", answered: 4 } });
      // Metered at the batch price: 4 calls × (800 + 30) halved.
      expect(used).toBe(4 * 415);
      expect(await aiState(id)).toMatchObject({ tokens: 4 * 415 });
      const fired = (await prisma.crawlIssue.findMany({ where: { crawlJobId: id, ruleId: "ai.grammar_issues" } })).length;
      expect(fired).toBe(2);
    });

    it("falls back to the synchronous path when the batch is not accepted within 2 minutes", async () => {
      const id = `${tenantId}_batch_b`;
      await makeJob(id);
      calls.length = 0;
      used = 0;
      const { d, clock, seen } = batchDeps({ submitFails: true });
      expect(await tick(id, d)).toEqual({ done: false, delayMs: 20_000, parked: true });
      expect((await aiState(id)).status).toBe("queued_batch");
      clock.t += 60_000;
      await tick(id, d);
      expect(calls).toEqual([]);
      clock.t += 61_000; // past 2 minutes since the first try
      let t = await tick(id, d);
      while (!t.done) t = await tick(id, d);
      expect(seen.submits).toBe(2);
      expect(calls).toHaveLength(4);
      expect(await aiState(id)).toMatchObject({ status: "done", completed: 2, batch: { phase: "fallback" } });
    });

    it("openai: still validating after 2 minutes → cancelled, then synchronous", async () => {
      const id = `${tenantId}_batch_c`;
      await makeJob(id, "openai");
      calls.length = 0;
      const { d, clock, seen } = batchDeps({ key: "tenant-key", polls: [{ state: "validating" }, { state: "validating" }] });
      expect(await tick(id, d)).toEqual({ done: false, delayMs: 20_000, parked: true });
      expect(await aiState(id)).toMatchObject({ status: "queued_batch", batch: { provider: "openai", acceptedAt: null } });
      clock.t += 30_000;
      await tick(id, d); // validating, inside the window
      expect(seen.cancels).toBe(0);
      clock.t += 120_000;
      let t = await tick(id, d);
      while (!t.done) t = await tick(id, d);
      expect(seen.cancels).toBe(1);
      expect(calls).toHaveLength(4);
      expect(await aiState(id)).toMatchObject({ status: "done", batch: { phase: "fallback" } });
    });

    it("what a batch leaves unanswered (errored, expired) runs synchronously afterwards", async () => {
      const id = `${tenantId}_batch_d`;
      await makeJob(id);
      calls.length = 0;
      const { d, seen } = batchDeps({ errored: (cid) => cid.endsWith("_1") });
      let t = await tick(id, d);
      while (!t.done) t = await tick(id, d);
      expect(seen.submits).toBe(1);
      // The two grammar prompts errored in the batch and ran synchronously.
      expect(calls.sort()).toEqual([url("chairs#grammar"), url("tables#grammar")].sort());
      expect(await prisma.crawlExtraction.count({ where: { crawlJobId: id, kind: "ai" } })).toBe(4);
      expect(await aiState(id)).toMatchObject({ status: "done", failed: 0, batch: { phase: "ended", answered: 2 } });
    });

    it("a waiting batch parks the AI step: PSI runs meanwhile", async () => {
      const id = `${tenantId}_batch_e`;
      await makeJob(id);
      await prisma.crawlJob.update({ where: { id }, data: { config: { ai: { provider: "claude", prompts: [{ preset: "title", text: null }], top: { pages: 2, segment: null } }, addData: { psi: { pages: 2, segment: null }, backlinks: null } } } });
      const { d } = batchDeps({ polls: [{ state: "running" }] });
      const { LighthouseRateLimitedError } = await import("@/lib/lighthouse/service");
      const withPsi = { ...d, runAudit: (async () => {
        // The hourly allowance is spent: PSI waits on its own clock.
        throw new LighthouseRateLimitedError(10);
      }) as never, msUntilNextAudit: async () => 123_000 };
      const t = await tick(id, withPsi);
      // PSI ran (and is waiting on its own allowance) instead of queueing behind the batch.
      const psi = ((await prisma.crawlJob.findUnique({ where: { id }, select: { summary: true } }))!.summary as { metrics: { psi?: { status: string } } }).metrics.psi;
      expect(psi?.status).toBe("waiting_quota");
      expect(t).toEqual({ done: false, delayMs: 60_000 });
      expect((await aiState(id)).status).toBe("queued_batch");
    });
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
