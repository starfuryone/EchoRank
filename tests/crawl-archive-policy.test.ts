// tests/crawl-archive-policy.test.ts — the pure parts of the crawl archive:
// which crawls are hot / archived / deleted (policy.ts) across plans, pinned,
// running, recently restored and scheduled crawls and several sites per
// tenant; the manifest parser and column-drift plan (format.ts); the flags;
// the worker's cron schedule check and its no-Spaces no-op.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { crawlsToPurge } from "@/lib/site-crawler/retention-policy";
import { planTenant, siteOf, type PolicyCrawl } from "@/lib/site-crawler/archive/policy";
import { ARCHIVED_TABLES, DELETE_ORDER, ManifestError, manifestKey, parseManifest, planColumns, tableObjectKey } from "@/lib/site-crawler/archive/format";
import { ARCHIVE_SWEEP_CRON, ARCHIVE_SWEEP_MAX, HOT_PER_SITE, RESTORED_HOT_DAYS, archiveDryRun, archiveEnabled, exportsViaSpacesFlag } from "@/lib/site-crawler/archive/constants";
import { PLAN_CONFIGS } from "@/lib/plan-config";

const NOW = new Date("2026-11-05T12:00:00Z");
const DAY = 86_400_000;
let seq = 0;
function crawl(over: Partial<PolicyCrawl> & { daysAgo: number; site?: string }): PolicyCrawl {
  const createdAt = new Date(NOW.getTime() - over.daysAgo * DAY);
  return {
    id: over.id ?? `c${++seq}`,
    status: over.status ?? "COMPLETED",
    pinned: over.pinned ?? false,
    finishedAt: createdAt,
    createdAt,
    rootUrl: `https://${over.site ?? "a.example.com"}/`,
    storageState: over.storageState ?? "HOT",
    restoredAt: over.restoredAt ?? null,
  };
}

describe("planTenant", () => {
  it("one site, Starter (3 kept): newest 2 hot, the 3rd archived, the rest deleted — exactly retention's split", () => {
    const cs = Array.from({ length: 6 }, (_, i) => crawl({ id: `s${i}`, daysAgo: i }));
    const p = planTenant(cs, 3, NOW);
    expect(p.hot).toEqual(["s0", "s1"]);
    expect(p.archive).toEqual(["s2"]);
    expect(p.purge.sort()).toEqual(["s3", "s4", "s5"]);
    // Retention semantics unchanged: purge is crawlsToPurge, verbatim.
    expect(p.purge).toEqual(crawlsToPurge(cs, 3, NOW));
  });

  it.each([
    ["STARTER", 3],
    ["GROWTH", 10],
    ["AGENCY", 50],
    ["ENTERPRISE", 50],
  ] as const)("%s keeps %i: hot + archive = kept, every plan", (plan, kept) => {
    expect(PLAN_CONFIGS[plan].crawlsKept).toBe(kept);
    const cs = Array.from({ length: kept + 5 }, (_, i) => crawl({ daysAgo: i }));
    const p = planTenant(cs, kept, NOW);
    expect(p.hot).toHaveLength(Math.min(HOT_PER_SITE, kept));
    expect(p.hot.length + p.archive.length).toBe(kept);
    expect(p.purge).toHaveLength(5);
  });

  it("several sites: the newest two of EACH site stay hot, inside the tenant-wide kept set", () => {
    const cs = [
      crawl({ id: "a0", daysAgo: 0, site: "a.example.com" }),
      crawl({ id: "b0", daysAgo: 1, site: "b.example.com" }),
      crawl({ id: "a1", daysAgo: 2, site: "a.example.com" }),
      crawl({ id: "a2", daysAgo: 3, site: "a.example.com" }),
      crawl({ id: "b1", daysAgo: 4, site: "B.Example.com" }),
      crawl({ id: "b2", daysAgo: 5, site: "b.example.com" }),
      crawl({ id: "c0", daysAgo: 30, site: "c.example.com" }),
    ];
    // Growth keeps 10: all kept. Hot: a0 a1 (a), b0 b1 (b, host case-folded), c0 (c's only one).
    const g = planTenant(cs, 10, NOW);
    expect(g.purge).toEqual([]);
    expect(g.hot.sort()).toEqual(["a0", "a1", "b0", "b1", "c0"]);
    expect(g.archive.sort()).toEqual(["a2", "b2"]);
    // Starter keeps 3 (a0, b0, a1): retention wins, c0 is deleted even though it is c's latest.
    const s = planTenant(cs, 3, NOW);
    expect(s.purge.sort()).toEqual(["a2", "b1", "b2", "c0"]);
    expect(s.hot.sort()).toEqual(["a0", "a1", "b0"]);
    expect(s.archive).toEqual([]);
  });

  it("www is its own site", () => {
    expect(siteOf("https://WWW.Example.com:8443/x")).toBe("www.example.com");
    expect(siteOf("https://example.com/")).not.toBe(siteOf("https://www.example.com/"));
  });

  it("pinned crawls are hot (and kept beyond crawlsKept, as before)", () => {
    const cs = Array.from({ length: 6 }, (_, i) => crawl({ id: `p${i}`, daysAgo: i, pinned: i === 4 }));
    const p = planTenant(cs, 3, NOW);
    expect(p.hot).toContain("p4");
    expect(p.purge).not.toContain("p4");
    expect(p.archive).toEqual(["p2"]);
  });

  it("queued / running crawls are never archived nor deleted; failed / cancelled only deleted after 7 days", () => {
    const cs = [
      crawl({ id: "r", daysAgo: 0, status: "RUNNING" }),
      crawl({ id: "q", daysAgo: 0, status: "QUEUED" }),
      crawl({ id: "f", daysAgo: 2, status: "FAILED" }),
      crawl({ id: "x", daysAgo: 9, status: "CANCELLED" }),
      ...Array.from({ length: 4 }, (_, i) => crawl({ id: `k${i}`, daysAgo: 1 + i })),
    ];
    const p = planTenant(cs, 3, NOW);
    for (const id of ["r", "q", "f"]) {
      expect(p.archive).not.toContain(id);
      expect(p.purge).not.toContain(id);
    }
    expect(p.purge).toContain("x");
    expect(p.archive).toEqual(["k2"]);
  });

  it(`a crawl restored in the last ${RESTORED_HOT_DAYS} days stays hot; after that it may be archived again`, () => {
    const cs = Array.from({ length: 4 }, (_, i) => crawl({ id: `r${i}`, daysAgo: i, restoredAt: i === 3 ? new Date(NOW.getTime() - 2 * DAY) : null }));
    expect(planTenant(cs, 10, NOW).archive).toEqual(["r2"]);
    cs[3]!.restoredAt = new Date(NOW.getTime() - (RESTORED_HOT_DAYS + 1) * DAY);
    expect(planTenant(cs, 10, NOW).archive).toEqual(["r2", "r3"]);
  });

  it("a schedule's last run (the scheduled diff's baseline) stays hot", () => {
    const cs = Array.from({ length: 5 }, (_, i) => crawl({ id: `d${i}`, daysAgo: i }));
    expect(planTenant(cs, 10, NOW, new Set(["d3"])).archive).toEqual(["d2", "d4"]);
  });

  it("already-archived crawls are kept (counted by retention) but not archived twice; an archived pinned one is not restored by the sweep", () => {
    const cs = Array.from({ length: 5 }, (_, i) => crawl({ id: `z${i}`, daysAgo: i, storageState: i >= 2 ? "ARCHIVED" : "HOT", pinned: i === 4 }));
    const p = planTenant(cs, 3, NOW);
    expect(p.archive).toEqual([]);
    expect(p.purge).toEqual(["z3"]);
    expect(p.hot).toContain("z4");
  });
});

describe("format", () => {
  const prefix = "tenants/t1/crawls/c1/";
  const good = () => ({
    format: 1,
    crawlId: "c1",
    tenantId: "t1",
    createdAt: "2026-11-05T00:00:00Z",
    appCommit: "abc",
    migration: "20261118090000_crawl_archive",
    tables: ARCHIVED_TABLES.map((table) => ({ table, key: tableObjectKey(prefix, table), rows: 1, columns: ["id"], bytes: 10, sha256: "a".repeat(64) })),
  });

  it("FK order for inserts, children first for deletes", () => {
    expect(ARCHIVED_TABLES[0]).toBe("crawl_pages");
    expect(DELETE_ORDER.at(-1)).toBe("crawl_pages");
    expect([...DELETE_ORDER].sort()).toEqual([...ARCHIVED_TABLES].sort());
    expect(manifestKey(prefix)).toBe("tenants/t1/crawls/c1/manifest.json");
  });

  it("parseManifest accepts its own shape and refuses anything else", () => {
    expect(parseManifest(JSON.stringify(good()), { crawlId: "c1", tenantId: "t1", prefix }).tables).toHaveLength(5);
    const bad = (m: unknown, re: RegExp) => expect(() => parseManifest(typeof m === "string" ? m : JSON.stringify(m), { crawlId: "c1", tenantId: "t1", prefix })).toThrow(re);
    bad("{", /not JSON/);
    bad({ ...good(), format: 2 }, /format 1/);
    bad({ ...good(), tenantId: "t2" }, /another crawl/);
    bad({ ...good(), tables: good().tables.slice(1) }, /in order/);
    const outside = good();
    outside.tables[1]!.key = "tenants/t2/crawls/c9/crawl_issues.ndjson.gz";
    bad(outside, /outside/);
    const sha = good();
    sha.tables[0]!.sha256 = "nope";
    expect(() => parseManifest(JSON.stringify(sha), { crawlId: "c1", tenantId: "t1", prefix })).toThrow(ManifestError);
  });

  it("planColumns: by name; dropped ignored; new nullable/defaulted take defaults; new required blocks", () => {
    const live = [
      { name: "id", nullable: false, hasDefault: false, generated: false },
      { name: "url", nullable: false, hasDefault: false, generated: false },
      { name: "newNullable", nullable: true, hasDefault: false, generated: false },
      { name: "newDefault", nullable: false, hasDefault: true, generated: false },
      { name: "newRequired", nullable: false, hasDefault: false, generated: false },
      { name: "computed", nullable: true, hasDefault: false, generated: true },
    ];
    expect(planColumns(["url", "id", "gone"], live)).toEqual({
      insert: ["id", "url"],
      dropped: ["gone"],
      defaulted: ["newNullable", "newDefault"],
      missingRequired: ["newRequired"],
    });
  });
});

describe("flags and schedule", () => {
  it("off by default, dry run unless explicitly false, exports off by default", () => {
    expect(archiveEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(archiveEnabled({ CRAWL_ARCHIVE_ENABLED: "true" } as never)).toBe(true);
    expect(archiveDryRun({} as NodeJS.ProcessEnv)).toBe(true);
    expect(archiveDryRun({ CRAWL_ARCHIVE_DRY_RUN: "0" } as never)).toBe(true);
    expect(archiveDryRun({ CRAWL_ARCHIVE_DRY_RUN: "false" } as never)).toBe(false);
    expect(exportsViaSpacesFlag({} as NodeJS.ProcessEnv)).toBe(false);
    expect(exportsViaSpacesFlag({ EXPORTS_VIA_SPACES: "true" } as never)).toBe(true);
  });

  it("05:17 UTC, after the 04:00–04:35 backups; 50 crawls a run", () => {
    expect(ARCHIVE_SWEEP_CRON).toBe("17 5 * * *");
    expect(ARCHIVE_SWEEP_MAX).toBe(50);
  });

  it("the worker keeps only the cron sweep (an `every` from Redis arrives as a string)", async () => {
    vi.doMock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: () => ({}), getRedisConnection: () => ({}), createNewConnection: () => ({}) }));
    const w = await import("@/infrastructure/queue/workers/crawl-archive.worker");
    expect(w.sweepScheduleIsCurrent({ name: "sweep", pattern: ARCHIVE_SWEEP_CRON })).toBe(true);
    expect(w.sweepScheduleIsCurrent({ name: "sweep", pattern: ARCHIVE_SWEEP_CRON, every: "86400000" })).toBe(false);
    expect(w.sweepScheduleIsCurrent({ name: "sweep", pattern: "0 5 * * *" })).toBe(false);
    expect(w.sweepScheduleIsCurrent({ name: "other", pattern: ARCHIVE_SWEEP_CRON })).toBe(false);
    expect(w.restoreJobId("c1")).toBe("crawl-restore-c1");
  });

  it("the queue is registered", async () => {
    const { QUEUE_NAMES } = await import("@/infrastructure/redis/config");
    expect(QUEUE_NAMES).toContain("crawl-archive");
  });
});
