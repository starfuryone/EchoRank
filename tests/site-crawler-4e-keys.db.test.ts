// tests/site-crawler-4e-keys.db.test.ts — Phase 4e storage against Postgres:
// tenant AI keys are encrypted at rest, never readable back through the
// status read, replaced on save and gone with the tenant; crawl_extractions
// keep one row per (page, kind, index).
// SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

const SECRET = "test-encryption-secret-4e";
const KEY = "sk-test-" + "a".repeat(40);

describe.skipIf(!TEST_DB)("4e storage against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let k: typeof import("@/lib/site-crawler/ai-keys");
  const tenantId = `t_4e_${Date.now()}`;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    k = await import("@/lib/site-crawler/ai-keys");
    await prisma.tenant.create({ data: { id: tenantId, name: "4e", slug: tenantId, planType: "GROWTH" } });
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("stores the key encrypted and reports only set / dates", async () => {
    await k.saveAiKey(tenantId, "openai", KEY, SECRET);
    const row = await prisma.tenantAiKey.findFirstOrThrow({ where: { tenantId, provider: "openai" } });
    expect(row.encryptedKey).not.toContain(KEY);
    expect(row.encryptedKey.startsWith("v1:")).toBe(true);
    const status = await k.aiKeyStatus(tenantId);
    expect(status.openai.set).toBe(true);
    expect(status.gemini).toEqual({ set: false, createdAt: null, lastUsedAt: null });
    expect(JSON.stringify(status)).not.toContain("sk-test");
  });

  it("opens the key for a call and marks it used", async () => {
    expect(await k.openAiKey(tenantId, "openai", SECRET)).toBe(KEY);
    expect((await k.aiKeyStatus(tenantId)).openai.lastUsedAt).not.toBeNull();
    expect(await k.openAiKey(tenantId, "gemini", SECRET)).toBeNull();
  });

  it("replaces on save, deletes on request", async () => {
    await k.saveAiKey(tenantId, "openai", KEY + "b", SECRET);
    expect(await prisma.tenantAiKey.count({ where: { tenantId } })).toBe(1);
    expect((await k.aiKeyStatus(tenantId)).openai.lastUsedAt).toBeNull();
    await k.deleteAiKey(tenantId, "openai");
    expect((await k.aiKeyStatus(tenantId)).openai.set).toBe(false);
  });

  it("keeps extract, js and ai rows apart at the same index", async () => {
    const job = await prisma.crawlJob.create({ data: { tenantId, rootUrl: "https://x.com/", urlCap: 5, status: "COMPLETED" } });
    const page = await prisma.crawlPage.create({ data: { crawlJobId: job.id, url: "https://x.com/", depth: 0 } });
    await prisma.crawlExtraction.createMany({
      data: (["extract", "js", "ai"] as const).map((kind) => ({ crawlJobId: job.id, pageId: page.id, kind, extractorIndex: 0, values: [kind] })),
    });
    await expect(
      prisma.crawlExtraction.create({ data: { crawlJobId: job.id, pageId: page.id, kind: "js", extractorIndex: 0, values: ["dup"] } }),
    ).rejects.toThrow();
    const { extractionOffsetPage } = await import("@/lib/site-crawler/extraction-rows");
    const { rows } = await extractionOffsetPage({ crawlJobId: job.id }, 1, 10, 1, []);
    expect(rows[0]!.values).toEqual([["extract"]]);
  });

  it("goes with the tenant", async () => {
    await k.saveAiKey(tenantId, "gemini", KEY, SECRET);
    await prisma.tenant.delete({ where: { id: tenantId } });
    expect(await prisma.tenantAiKey.count({ where: { tenantId } })).toBe(0);
  });
});
