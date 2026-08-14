// tests/citation-opportunities-worker.test.ts
//
// The weekly worker's one piece of real logic: which of the week's findings are
// worth a notification.
//
// That decision has two halves and both are easy to get subtly wrong:
//   - the cut is taken over the WHOLE sweep, so "top quartile" means top
//     quartile of this tenant's opportunities and not of this week's newcomers;
//   - only NEW rows can fire, so a customer is not re-alerted every Monday
//     about a row they have been looking at for a month.
// Get either backwards and the tray fills with noise, which is how a
// notification surface stops being read.
//
// Everything the worker touches is stubbed. BullMQ and Redis are never
// constructed — only the exported job handler runs.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { listOpportunityTenants, loadCandidates, sweepTenant, checkListed, notify, loggerFns } =
  vi.hoisted(() => ({
    listOpportunityTenants: vi.fn(),
    loadCandidates: vi.fn(),
    sweepTenant: vi.fn(),
    checkListed: vi.fn(),
    notify: vi.fn(),
    loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));

vi.mock("@/lib/citation-opportunities/store", () => ({
  listOpportunityTenants,
  loadCandidates,
  sweepTenant,
}));
vi.mock("@/lib/citation-opportunities/listed", () => ({ checkListed }));
vi.mock("@/lib/notifications/adapters", () => ({ notifyCitationOpportunity: notify }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: () => ({}) }));
vi.mock("@/infrastructure/redis/config", () => ({ REDIS_CONFIG: { queues: { prefix: "test" } } }));

const { addJob, getQueue } = vi.hoisted(() => ({
  addJob: vi.fn(),
  getQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob, getQueue }));

import {
  scoreOne,
  sweep,
  SWEEP_CRON,
} from "@/infrastructure/queue/workers/citation-opportunities.worker";
import { p75 } from "@/lib/citation-opportunities/score";

const TENANT = "tenant_a";
const TENANT_ROW = { tenantId: TENANT, target: "acme.com", theme: "review software" };

/** A scored row, with only the fields the alert pass reads. */
function scored(domain: string, priority: number) {
  return {
    domain,
    kind: "DIRECTORY" as const,
    impact: priority,
    priority,
    effort: "LOW" as const,
    howTo: "…",
    theme: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listOpportunityTenants.mockResolvedValue([TENANT_ROW]);
  loadCandidates.mockResolvedValue([]);
  checkListed.mockResolvedValue({ verdicts: new Map(), costUsd: 0, called: false });
  notify.mockResolvedValue(undefined);
});

describe("the weekly cadence", () => {
  it("runs on Mondays, not nightly", () => {
    // Weekly is a spend decision as much as a product one — see the worker
    // header. A cron that drifted to daily would be seven times the DataForSEO
    // bill for the same worklist.
    expect(SWEEP_CRON).toBe("20 4 * * 1");
  });

  it("enqueues one job per tenant, keyed so two cannot run at once", async () => {
    listOpportunityTenants.mockResolvedValue([
      TENANT_ROW,
      { tenantId: "tenant_b", target: "b.com", theme: null },
    ]);

    const count = await sweep();

    expect(count).toBe(2);
    expect(addJob).toHaveBeenCalledTimes(2);
    // The jobId is the mutual exclusion: two concurrent passes would both read
    // the same monthly spend and both decide they were under the cap.
    expect(addJob.mock.calls[0]![3]).toEqual({ jobId: `citation-opps:${TENANT}` });
  });
});

describe("the p75 alert pass", () => {
  it("alerts only on NEW rows above the cut", async () => {
    const rows = [scored("a.com", 100), scored("b.com", 50), scored("c.com", 10), scored("d.com", 5)];
    sweepTenant.mockResolvedValue({
      scored: rows,
      created: ["a.com", "c.com"],
      updated: ["b.com", "d.com"],
      retired: 0,
      skippedListed: 0,
      skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });

    // p75 of [5,10,50,100] by nearest rank is 50. Only a.com is both new and
    // strictly above it; c.com is new but below, b.com is above but not new.
    expect(p75(rows.map((r) => r.priority))).toBe(50);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({ tenantId: TENANT, domain: "a.com", priority: 100 });
  });

  it("takes the cut over the whole sweep, not just the new rows", async () => {
    // One newcomer, and a weak one. Cutting over the newcomers alone would make
    // it "the top 25% of one row" and alert every single week.
    const rows = [scored("strong.com", 100), scored("mid.com", 60), scored("weak.com", 1)];
    sweepTenant.mockResolvedValue({
      scored: rows,
      created: ["weak.com"],
      updated: ["strong.com", "mid.com"],
      retired: 0,
      skippedListed: 0,
      skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });
    expect(notify).not.toHaveBeenCalled();
  });

  it("says nothing when a sweep finds nothing", async () => {
    sweepTenant.mockResolvedValue({
      scored: [],
      created: [],
      updated: [],
      retired: 0,
      skippedListed: 0,
      skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not re-alert about a row that already existed", async () => {
    sweepTenant.mockResolvedValue({
      scored: [scored("a.com", 100), scored("b.com", 1)],
      created: [],
      updated: ["a.com", "b.com"],
      retired: 0,
      skippedListed: 0,
      skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("the pass itself", () => {
  it("re-reads the tenant rather than trusting the job payload", async () => {
    sweepTenant.mockResolvedValue({
      scored: [], created: [], updated: [], retired: 0, skippedListed: 0, skippedManual: 0,
    });
    await scoreOne({ tenantId: TENANT });
    expect(listOpportunityTenants).toHaveBeenCalledWith(TENANT);
  });

  it("does nothing at all when the tenant stopped tracking mid-sweep", async () => {
    listOpportunityTenants.mockResolvedValue([]);
    await scoreOne({ tenantId: TENANT });

    expect(checkListed).not.toHaveBeenCalled();
    expect(sweepTenant).not.toHaveBeenCalled();
    expect(loggerFns.warn).toHaveBeenCalled();
  });

  it("refuses a job with no tenantId rather than sweeping everybody", async () => {
    await expect(scoreOne({})).rejects.toThrow(/tenantId/);
    expect(checkListed).not.toHaveBeenCalled();
  });

  it("hands the listed check its candidates most-cited first", async () => {
    loadCandidates.mockResolvedValue([
      { domain: "small.com", kind: "DIRECTORY", seenCount: 2, engineSpread: 1, rivalLift: 1 },
      { domain: "big.com", kind: "DIRECTORY", seenCount: 90, engineSpread: 3, rivalLift: 8 },
    ]);
    sweepTenant.mockResolvedValue({
      scored: [], created: [], updated: [], retired: 0, skippedListed: 0, skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });

    // If the per-call ceiling ever bites, what goes unchecked must be the tail.
    expect(checkListed.mock.calls[0]![0].domains).toEqual(["big.com", "small.com"]);
    expect(checkListed.mock.calls[0]![0].target).toBe("acme.com");
  });

  it("passes only positively-listed domains through to the sweep", async () => {
    checkListed.mockResolvedValue({
      verdicts: new Map([
        ["g2.com", "listed"],
        ["yelp.com", "not_listed"],
        ["capterra.com", "unknown"],
      ]),
      costUsd: 0.0258,
      called: true,
    });
    sweepTenant.mockResolvedValue({
      scored: [], created: [], updated: [], retired: 0, skippedListed: 0, skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });

    // `unknown` must NOT be treated as listed — that is the fail-open contract.
    expect([...sweepTenant.mock.calls[0]![0].listed]).toEqual(["g2.com"]);
  });

  it("logs the dollars spent, per tenant, every week", async () => {
    checkListed.mockResolvedValue({ verdicts: new Map(), costUsd: 0.0258, called: true });
    sweepTenant.mockResolvedValue({
      scored: [], created: [], updated: [], retired: 0, skippedListed: 0, skippedManual: 0,
    });

    await scoreOne({ tenantId: TENANT });

    const logged = loggerFns.info.mock.calls.at(-1)![0];
    expect(logged.costUsd).toBeCloseTo(0.0258, 6);
    expect(logged.tenantId).toBe(TENANT);
    expect(logged.dataforseoCalled).toBe(true);
  });
});
