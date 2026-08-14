// tests/sov-rollup.test.ts
//
// The database-facing half of AI Share of Voice: tenant isolation on every
// query, the upsert's idempotency, the week-over-week drop check, and the
// notification it fans out to.
//
// Prisma and the logger are stubbed; everything else — the scoping, the window
// arithmetic, the weighting, the dedupe keys, the severity — is the real code
// path. Same approach as tests/notifications.test.ts, and for the same reason:
// this box's .env is not readable by the test account and there is no test
// database, so what can be verified without one is verified thoroughly.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { brandProfile, promptRun, sovSnapshot, notification, loggerFns } = vi.hoisted(() => ({
  brandProfile: { findMany: vi.fn() },
  promptRun: { findMany: vi.fn() },
  sovSnapshot: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  notification: { createMany: vi.fn() },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { brandProfile, promptRun, sovSnapshot, notification },
}));

vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));

import {
  listPromptSets,
  loadWindowRuns,
  shareByEngineOn,
  utcDay,
  windowStart,
  writeSovSnapshots,
  SOV_WINDOW_DAYS,
} from "@/lib/sov/store";
import { detectShareDrops } from "@/lib/sov/alerts";
import { notifySovShareDrop } from "@/lib/notifications/adapters";

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";
const SET = "brand_1";
const DAY = new Date("2026-08-14T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  brandProfile.findMany.mockResolvedValue([]);
  promptRun.findMany.mockResolvedValue([]);
  sovSnapshot.upsert.mockResolvedValue({});
  sovSnapshot.findMany.mockResolvedValue([]);
  sovSnapshot.findFirst.mockResolvedValue(null);
  sovSnapshot.deleteMany.mockResolvedValue({ count: 0 });
  notification.createMany.mockResolvedValue({ count: 1 });
});

// ─── The window ─────────────────────────────────────────────────────────────

describe("the rolling window", () => {
  it("is 28 days, inclusive of both ends", () => {
    expect(SOV_WINDOW_DAYS).toBe(28);
    // 2026-08-14 back 27 days is 2026-07-18, and both days are in the window.
    expect(windowStart(DAY).toISOString()).toBe("2026-07-18T00:00:00.000Z");
  });

  it("snaps to UTC midnight regardless of the clock time", () => {
    expect(utcDay(new Date("2026-08-14T23:59:59.999Z")).toISOString()).toBe(
      "2026-08-14T00:00:00.000Z",
    );
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the run query by tenant as well as by prompt set", async () => {
    await loadWindowRuns(SET, TENANT, windowStart(DAY), DAY);

    const where = promptRun.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.prompt).toEqual({ brandProfileId: SET });
    // Only answered runs. A run skipped at the spend cap is a question we never
    // asked, and counting it would dilute every share in the window.
    expect(where.status).toBe("OK");
  });

  it("will not read another tenant's runs even with a valid prompt set id", async () => {
    await loadWindowRuns(SET, OTHER_TENANT, windowStart(DAY), DAY);
    expect(promptRun.findMany.mock.calls[0][0].where.tenantId).toBe(OTHER_TENANT);
    expect(promptRun.findMany.mock.calls[0][0].where.tenantId).not.toBe(TENANT);
  });

  it("stamps the tenant onto every row it writes", async () => {
    await writeSovSnapshots(TENANT, SET, DAY, [
      { engine: "CLAUDE", brand: "Us", mentionWeighted: 1, promptCount: 3, share: 1 },
    ]);

    const call = sovSnapshot.upsert.mock.calls[0][0];
    expect(call.create.tenantId).toBe(TENANT);
    expect(call.where.promptSetId_engine_date_brand).toEqual({
      promptSetId: SET,
      engine: "CLAUDE",
      date: DAY,
      brand: "Us",
    });
  });

  it("scopes the orphan cleanup by tenant, so it can never delete another's rows", async () => {
    await writeSovSnapshots(TENANT, SET, DAY, [
      { engine: "CLAUDE", brand: "Us", mentionWeighted: 1, promptCount: 3, share: 1 },
    ]);
    expect(sovSnapshot.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      promptSetId: SET,
      date: DAY,
    });
  });

  it("scopes the share read by tenant", async () => {
    await shareByEngineOn(TENANT, SET, "Us", DAY);
    expect(sovSnapshot.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      promptSetId: SET,
      brand: "Us",
    });
  });

  it("lists only the requested tenant's prompt sets when one is named", async () => {
    await listPromptSets(TENANT);
    expect(brandProfile.findMany.mock.calls[0][0].where).toEqual({
      trackingActive: true,
      tenantId: TENANT,
    });
  });

  it("lists every tenant's sets for the nightly sweep, and only tracked ones", async () => {
    await listPromptSets();
    expect(brandProfile.findMany.mock.calls[0][0].where).toEqual({ trackingActive: true });
  });
});

// ─── Writing ────────────────────────────────────────────────────────────────

describe("writing a night", () => {
  it("upserts, so a retried job restates the day rather than doubling it", async () => {
    const rows = [
      { engine: "CLAUDE", brand: "Us", mentionWeighted: 1, promptCount: 2, share: 0.6 },
      { engine: "CLAUDE", brand: "Rival", mentionWeighted: 0.5, promptCount: 2, share: 0.4 },
    ];
    await writeSovSnapshots(TENANT, SET, DAY, rows);

    expect(sovSnapshot.upsert).toHaveBeenCalledTimes(2);
    // The update branch carries the values but never the key columns.
    const update = sovSnapshot.upsert.mock.calls[0][0].update;
    expect(update).toEqual({ mentionWeighted: 1, promptCount: 2, share: 0.6 });
    expect(update).not.toHaveProperty("tenantId");
  });

  it("writes nothing, and says so, for a window with no observations", async () => {
    const written = await writeSovSnapshots(TENANT, SET, DAY, []);
    expect(written).toBe(0);
    expect(sovSnapshot.upsert).not.toHaveBeenCalled();
    expect(loggerFns.info).toHaveBeenCalled();
  });

  it("deletes a brand that fell out of the window, so shares still sum to 1", async () => {
    // Yesterday the window held Ghost; tonight it does not. Leaving the row
    // behind would leave its share in the group and push the total past 1.
    sovSnapshot.findMany.mockResolvedValue([
      { id: "keep", engine: "CLAUDE", brand: "Us" },
      { id: "drop", engine: "CLAUDE", brand: "Ghost" },
    ]);

    await writeSovSnapshots(TENANT, SET, DAY, [
      { engine: "CLAUDE", brand: "Us", mentionWeighted: 1, promptCount: 2, share: 1 },
    ]);

    expect(sovSnapshot.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["drop"] } } });
  });

  it("keeps a brand that still holds share on another engine", async () => {
    sovSnapshot.findMany.mockResolvedValue([
      { id: "a", engine: "CLAUDE", brand: "Rival" },
      { id: "b", engine: "PERPLEXITY", brand: "Rival" },
    ]);

    await writeSovSnapshots(TENANT, SET, DAY, [
      { engine: "CLAUDE", brand: "Rival", mentionWeighted: 1, promptCount: 1, share: 1 },
      { engine: "PERPLEXITY", brand: "Rival", mentionWeighted: 1, promptCount: 1, share: 1 },
    ]);

    expect(sovSnapshot.deleteMany).not.toHaveBeenCalled();
  });
});

// ─── The drop alert ─────────────────────────────────────────────────────────

/** shareByEngineOn reads sovSnapshot.findMany; this drives the two calls it makes. */
function givenShares(
  now: Record<string, number>,
  weekAgo: Record<string, number>,
) {
  const asRows = (shares: Record<string, number>) =>
    Object.entries(shares).map(([engine, share]) => ({ engine, share }));
  sovSnapshot.findMany
    .mockResolvedValueOnce(asRows(now))
    .mockResolvedValueOnce(asRows(weekAgo));
}

describe("the week-over-week drop alert", () => {
  it("reads exactly seven days back", async () => {
    givenShares({}, {});
    await detectShareDrops(TENANT, SET, "Us", DAY);

    const dates = sovSnapshot.findMany.mock.calls.map((call) => call[0].where.date);
    expect(dates[0]).toEqual(DAY);
    expect(dates[1]).toEqual(new Date("2026-08-07T00:00:00.000Z"));
  });

  it("reports an engine that fell more than five points", async () => {
    // 0.30 -> 0.20 is ten points.
    givenShares({ CLAUDE: 0.2 }, { CLAUDE: 0.3 });
    const drops = await detectShareDrops(TENANT, SET, "Us", DAY);

    expect(drops).toEqual([{ engine: "CLAUDE", before: 30, after: 20 }]);
  });

  it("converts the stored fraction to percentage points", async () => {
    givenShares({ CLAUDE: 0.121 }, { CLAUDE: 0.4 });
    const [drop] = await detectShareDrops(TENANT, SET, "Us", DAY);
    // Not 0.4 and 0.121 — the alert speaks in points, as the copy reads.
    expect(drop.before).toBeCloseTo(40, 9);
    expect(drop.after).toBeCloseTo(12.1, 9);
  });

  it("stays quiet for a drop of exactly five points", async () => {
    givenShares({ CLAUDE: 0.15 }, { CLAUDE: 0.2 });
    expect(await detectShareDrops(TENANT, SET, "Us", DAY)).toEqual([]);
  });

  it("stays quiet when share rose", async () => {
    givenShares({ CLAUDE: 0.4 }, { CLAUDE: 0.1 });
    expect(await detectShareDrops(TENANT, SET, "Us", DAY)).toEqual([]);
  });

  it("treats an engine missing this week as a fall to zero", async () => {
    // The most severe version of this alert: we held 30% and now appear in no
    // row at all. Skipping it for want of a row would mute the worst case.
    givenShares({}, { CLAUDE: 0.3 });
    expect(await detectShareDrops(TENANT, SET, "Us", DAY)).toEqual([
      { engine: "CLAUDE", before: 30, after: 0 },
    ]);
  });

  it("never alerts on an engine with no snapshot a week ago", async () => {
    // A prompt set that started six days ago would otherwise alert on every
    // engine at once, for losing a share it never had.
    givenShares({ CLAUDE: 0.05 }, {});
    expect(await detectShareDrops(TENANT, SET, "Us", DAY)).toEqual([]);
  });

  it("reports each engine separately, worst first", async () => {
    givenShares(
      { CLAUDE: 0.1, PERPLEXITY: 0.2 },
      { CLAUDE: 0.4, PERPLEXITY: 0.5 },
    );
    const drops = await detectShareDrops(TENANT, SET, "Us", DAY);
    expect(drops.map((d) => d.engine)).toEqual(["CLAUDE", "PERPLEXITY"]);
    expect(drops).toHaveLength(2);
  });
});

// ─── The notification ───────────────────────────────────────────────────────

describe("the share-drop notification", () => {
  it("writes a warning row with a typed payload in points", async () => {
    await notifySovShareDrop({
      tenantId: TENANT,
      promptSetId: SET,
      engine: "CLAUDE",
      before: 30,
      after: 18.44,
    });

    const row = notification.createMany.mock.calls[0][0].data[0];
    expect(row.tenantId).toBe(TENANT);
    expect(row.type).toBe("sov_share_drop");
    // The spec calls this "warn"; this codebase's three levels are
    // info/warning/critical, so it lands on the middle one.
    expect(row.severity).toBe("warning");
    expect(row.payload).toEqual({ engine: "CLAUDE", before: 30, after: 18.4 });
    expect(row.href).toBe("/visibility/tools/share-of-voice");
  });

  it("dedupes per prompt set, engine and day", async () => {
    await notifySovShareDrop({
      tenantId: TENANT,
      promptSetId: SET,
      engine: "CLAUDE",
      before: 30,
      after: 20,
    });
    const { dedupeKey } = notification.createMany.mock.calls[0][0].data[0];
    expect(dedupeKey).toMatch(/^notif:sov-drop-brand_1-CLAUDE-\d{8}$/);
    // skipDuplicates is what makes a retried nightly job a no-op.
    expect(notification.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("gives two engines two rows, not one pooled row", async () => {
    for (const engine of ["CLAUDE", "PERPLEXITY"]) {
      await notifySovShareDrop({
        tenantId: TENANT,
        promptSetId: SET,
        engine,
        before: 30,
        after: 20,
      });
    }
    const keys = notification.createMany.mock.calls.map((c) => c[0].data[0].dedupeKey);
    expect(new Set(keys).size).toBe(2);
  });
});
