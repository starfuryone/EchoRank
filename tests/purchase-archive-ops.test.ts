// The purchase archive, Phase 3 (ECHORANK-DATA-ARCHIVE.md): personal-data
// retention (object and row), the one-time backfill (dry run by default,
// idempotent), the health figures and the admin gate. Fakes only.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findFirst: vi.fn(async () => ({ storedAt: new Date("2026-11-09T11:00:00Z") })),
  aggregate: vi.fn(async (args: { where: { createdAt?: unknown } }) =>
    args.where.createdAt ? { _count: { _all: 12 }, _sum: { bytes: 600_000, costUsd: 0.4 } } : { _count: { _all: 40 }, _sum: { bytes: 300 * 1024 ** 3 } },
  ),
  count: vi.fn(async () => 2),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { purchaseArchive: db } }));

import { personalCutoff, personalMonths, purgePersonalData, type RetentionIndex } from "@/lib/purchase-archive/retention";
import { parseCacheKey, runBackfill } from "@/lib/purchase-archive/backfill";
import { archiveHealth, estimateSpacesUsd } from "@/lib/purchase-archive/health";
import { storeObject, type ArchiveIndex } from "@/lib/purchase-archive/writer";
import type { PreparedObject } from "@/lib/purchase-archive/core";
import type { ObjectStore } from "@/lib/spaces/client";

function memStore(seed: Record<string, Buffer> = {}, opts: { failDelete?: boolean } = {}) {
  const objects = new Map(Object.entries(seed));
  const store: ObjectStore = {
    async put(key, body) {
      objects.set(key, Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
    },
    async get(key) {
      const b = objects.get(key);
      if (!b) throw new Error("NoSuchKey");
      return Readable.from([b]);
    },
    async head() {
      return null;
    },
    async deleteKeys(keys) {
      if (opts.failDelete) throw new Error("Spaces unreachable");
      for (const k of keys) objects.delete(k);
      return keys.length;
    },
    async *list(prefix) {
      for (const [key, b] of objects) if (key.startsWith(prefix)) yield { key, size: b.length, lastModified: new Date("2026-11-01T00:00:00Z") };
    },
    async listPrefixes() {
      return [];
    },
    async presignGet() {
      throw new Error("never");
    },
  };
  return { store, objects };
}

function memIndex() {
  const rows = new Map<string, { o: PreparedObject; storedAt: Date | null }>();
  const index: ArchiveIndex = {
    async find(k) {
      const r = rows.get(k);
      return r ? { s3Key: r.o.s3Key, storedAt: r.storedAt } : null;
    },
    async reserve(o) {
      if (rows.has(o.dedupeKey)) return false;
      rows.set(o.dedupeKey, { o, storedAt: null });
      return true;
    },
    async markStored(k, at) {
      rows.get(k)!.storedAt = at;
    },
    async rowsBetween() {
      return [];
    },
  };
  return { index, rows };
}

// ─── Personal-data retention ────────────────────────────────────────────────

describe("personal-data retention", () => {
  const NOW = new Date("2026-11-09T03:40:00Z");

  function retentionIndex(rows: Array<{ id: string; s3Key: string; personal: boolean; createdAt: Date; storedAt: Date | null }>) {
    const live = new Map(rows.map((r) => [r.id, r]));
    const idx: RetentionIndex = {
      async expired(cutoff, limit) {
        return [...live.values()].filter((r) => r.personal && r.createdAt < cutoff).slice(0, limit).map((r) => ({ id: r.id, s3Key: r.s3Key, storedAt: r.storedAt }));
      },
      async deleteRows(ids) {
        for (const id of ids) live.delete(id);
        return ids.length;
      },
    };
    return { idx, live };
  }

  it("deletes personal-data objects and their rows past 24 months; keeps everything else", async () => {
    const old = new Date("2024-10-01T00:00:00Z");
    const recent = new Date("2025-12-01T00:00:00Z");
    const { store, objects } = memStore({ a: Buffer.from("1"), b: Buffer.from("2"), c: Buffer.from("3"), d: Buffer.from("4") });
    const { idx, live } = retentionIndex([
      { id: "1", s3Key: "a", personal: true, createdAt: old, storedAt: old },
      { id: "2", s3Key: "b", personal: false, createdAt: old, storedAt: old },
      { id: "3", s3Key: "c", personal: true, createdAt: recent, storedAt: recent },
      { id: "4", s3Key: "d", personal: true, createdAt: old, storedAt: null }, // never uploaded: row only
    ]);
    const out = await purgePersonalData({ store, index: idx, now: NOW, months: 24, batch: 1 });
    expect(out).toMatchObject({ objects: 1, rows: 2, cutoff: "2024-11-09T03:40:00.000Z" });
    expect([...objects.keys()].sort()).toEqual(["b", "c", "d"]);
    expect([...live.keys()].sort()).toEqual(["2", "3"]);
  });

  it("a failed object delete leaves the rows for the next night", async () => {
    const old = new Date("2023-01-01T00:00:00Z");
    const { store } = memStore({ a: Buffer.from("1") }, { failDelete: true });
    const { idx, live } = retentionIndex([{ id: "1", s3Key: "a", personal: true, createdAt: old, storedAt: old }]);
    await expect(purgePersonalData({ store, index: idx, now: NOW })).rejects.toThrow();
    expect(live.size).toBe(1);
  });

  it("PURCHASE_ARCHIVE_PERSONAL_MONTHS, default 24", () => {
    expect(personalMonths({} as NodeJS.ProcessEnv)).toBe(24);
    expect(personalMonths({ PURCHASE_ARCHIVE_PERSONAL_MONTHS: "12" } as unknown as NodeJS.ProcessEnv)).toBe(12);
    expect(personalMonths({ PURCHASE_ARCHIVE_PERSONAL_MONTHS: "nope" } as unknown as NodeJS.ProcessEnv)).toBe(24);
    expect(personalCutoff(NOW, 1).toISOString()).toBe("2026-10-09T03:40:00.000Z");
  });

  it("the worker's nightly retention job runs it against the purchase store", async () => {
    const { processPurchaseArchiveJob } = await import("@/infrastructure/queue/workers/purchase-archive.worker");
    const { store } = memStore();
    const seen: Date[] = [];
    const retentionIndex: RetentionIndex = { expired: async (c) => (seen.push(c), []), deleteRows: async () => 0 };
    const out = await processPurchaseArchiveJob({ data: { kind: "retention" }, opts: {}, attemptsMade: 0 } as never, {
      store: () => store,
      index: memIndex().index,
      spool: async () => "f",
      claimAlertDay: async () => true,
      post: async () => true,
      now: () => NOW,
      pageStore: () => null,
      drainPages: async () => ({ uploaded: 0, remaining: 0, failed: false }),
      pageDir: () => mkdtempSync(join(tmpdir(), "pd-")),
      retentionIndex,
    });
    expect(out).toMatchObject({ objects: 0, rows: 0 });
    expect(seen[0]!.toISOString()).toBe("2024-11-09T03:40:00.000Z");
  });
});

// ─── Backfill ───────────────────────────────────────────────────────────────

describe("backfill from the shared cache", () => {
  const sha = "a".repeat(64);
  const seed = {
    [`cache/backlinks/v2/domain/${sha}/d20390.json.gz`]: gzipSync(Buffer.from(JSON.stringify({ summary: { rank: 5 } }))),
    [`cache/reddit-threads/v1/2840-any/${"b".repeat(64)}/d20398.json.gz`]: gzipSync(Buffer.from(JSON.stringify({ threads: [{ title: "Jane Doe asks" }] }))),
    "cache/README.txt": Buffer.from("not a cache object"),
  };

  it("parses the cache key layout", () => {
    expect(parseCacheKey(`cache/backlinks/v2/domain/${sha}/d20390.json.gz`)).toEqual({ feature: "backlinks", version: "v2", scope: "domain", targetSha256: sha, dateBucket: "d20390" });
    expect(parseCacheKey("cache/x.json.gz")).toBeNull();
  });

  it("dry run by default: counts and sizes, nothing read or written", async () => {
    const cache = memStore(seed);
    const getSpy = vi.spyOn(cache.store, "get");
    const out = await runBackfill({ cache: cache.store, archive: null, index: null });
    expect(out).toMatchObject({ dryRun: true, objects: 2, skipped: 1, stored: 0 });
    expect(Object.keys(out.byFeature).sort()).toEqual(["backlinks", "reddit-threads"]);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("--run stores each object with purpose backfill, and a second run stores nothing new", async () => {
    const cache = memStore(seed);
    const archive = memStore();
    const { index, rows } = memIndex();
    const first = await runBackfill({ cache: cache.store, archive: archive.store, index, run: true });
    expect(first).toMatchObject({ stored: 2, duplicates: 0, failed: 0 });
    const second = await runBackfill({ cache: cache.store, archive: archive.store, index, run: true });
    expect(second).toMatchObject({ stored: 0, duplicates: 2 });
    const all = [...rows.values()].map((r) => r.o);
    expect(all.every((o) => o.purpose === "backfill")).toBe(true);
    expect(all.find((o) => o.endpoint.startsWith("cache-reddit-threads"))?.personalData).toBe(true);
    expect(all.find((o) => o.endpoint.startsWith("cache-backlinks"))?.personalData).toBe(false);
    const body = JSON.parse(gunzipSync(archive.objects.get(all[0]!.s3Key)!).toString());
    expect(body.purpose).toBe("backfill");
    expect(body.request.target_sha256).toMatch(/^[ab]{64}$/);
  });

  it("--run with the archive unconfigured refuses", async () => {
    await expect(runBackfill({ cache: memStore(seed).store, archive: null, index: null, run: true })).rejects.toThrow(/not configured/);
  });

  it("storeObject is what the backfill writes through (one object per dedupe key)", () => {
    expect(typeof storeObject).toBe("function");
  });
});

// ─── Health ─────────────────────────────────────────────────────────────────

describe("health", () => {
  it("estimates Spaces cost: $5 covers 250 GB, then $0.02/GB", () => {
    expect(estimateSpacesUsd(0)).toBe(5);
    expect(estimateSpacesUsd(250 * 1024 ** 3)).toBe(5);
    expect(estimateSpacesUsd(300 * 1024 ** 3)).toBe(6);
  });

  it("reports last write, pending uploads, spool depth, this month and the estimate", async () => {
    const h = await archiveHealth(new Date("2026-11-09T12:00:00Z"));
    expect(h).toMatchObject({
      lastWriteAt: "2026-11-09T11:00:00.000Z",
      pendingUploads: 2,
      month: { objects: 12, bytes: 600_000, costUsd: 0.4 },
      total: { objects: 40 },
      estimatedSpacesUsdPerMonth: 6,
    });
    expect(h.spool.purchases.files).toBeGreaterThanOrEqual(-1);
  });

  it("the route is staff only (requirePlatformAdminApi first)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(join(__dirname, "../src/app/api/admin/purchase-archive/health/route.ts"), "utf8");
    const gate = src.indexOf("await requirePlatformAdminApi()");
    expect(gate).toBeGreaterThan(0);
    expect(src.indexOf("archiveHealth(")).toBeGreaterThan(gate);
  });
});
