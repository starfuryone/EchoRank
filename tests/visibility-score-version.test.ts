// tests/visibility-score-version.test.ts
//
// The AI readiness score changed version in Nov 2026 (av-service
// ai_readiness.py, SCORE_VERSION 2). These pin the rollout rules:
//   - every stored audit carries the sidecar's score version;
//   - monitoring compares only audits of the same version, and the first audit
//     after a change is a SILENT new baseline (no "your score dropped" email);
//   - within one version, a drop of 5 points or more alerts;
//   - charts split into one segment per version.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_SCORE_VERSION,
  monitorAlertDecision,
  scoreVersionOf,
  versionSegments,
  crossesVersions,
} from "@/lib/visibility-score";

describe("scoreVersionOf", () => {
  it("reads the sidecar's score_version, and calls a response without one version 1", () => {
    expect(scoreVersionOf({ score: 70, score_version: 2 })).toBe(2);
    expect(scoreVersionOf({ score: 90 })).toBe(1);
    expect(scoreVersionOf({ score_version: "2" })).toBe(1);
    expect(scoreVersionOf(null)).toBe(1);
    expect(CURRENT_SCORE_VERSION).toBe(2);
  });
});

describe("monitorAlertDecision", () => {
  const allowed = { GPTBot: { status: "ALLOWED", detail: "" } };
  const blocked = { GPTBot: { status: "BLOCKED", detail: "Disallow: /" } };

  it("the first audit is a baseline", () => {
    expect(monitorAlertDecision(null, { score: 40, scoreVersion: 2 })).toMatchObject({ kind: "baseline", alert: false });
  });

  it("a version change re-baselines silently, even with a 50-point drop and a crawler flip", () => {
    const d = monitorAlertDecision(
      { score: 94, scoreVersion: 1, bots: allowed },
      { score: 44, scoreVersion: 2, bots: blocked },
    );
    expect(d).toMatchObject({ kind: "rebaseline", alert: false, dropped: false, flippedBlocked: [] });
  });

  it("within one version, a drop of 5 or more alerts and 4 does not", () => {
    expect(monitorAlertDecision({ score: 70, scoreVersion: 2 }, { score: 65, scoreVersion: 2 }).alert).toBe(true);
    expect(monitorAlertDecision({ score: 70, scoreVersion: 2 }, { score: 66, scoreVersion: 2 }).alert).toBe(false);
  });

  it("within one version, a crawler newly blocked alerts", () => {
    const d = monitorAlertDecision({ score: 70, scoreVersion: 2, bots: allowed }, { score: 70, scoreVersion: 2, bots: blocked });
    expect(d.alert).toBe(true);
    expect(d.flippedBlocked).toEqual([{ bot: "GPTBot", detail: "Disallow: /" }]);
  });

  it("a crawler token v1 never reported is not a flip", () => {
    const d = monitorAlertDecision(
      { score: 70, scoreVersion: 2, bots: allowed },
      { score: 70, scoreVersion: 2, bots: { ...allowed, "Claude-SearchBot": { status: "BLOCKED", detail: "" } } },
    );
    expect(d.alert).toBe(false);
  });
});

describe("versionSegments", () => {
  it("splits history at each version change, oldest first", () => {
    const pts = [
      { score: 90, scoreVersion: 1 },
      { score: 92, scoreVersion: 1 },
      { score: 61, scoreVersion: 2 },
      { score: 64, scoreVersion: 2 },
    ];
    expect(versionSegments(pts).map((s) => s.map((p) => p.score))).toEqual([[90, 92], [61, 64]]);
    expect(crossesVersions(pts)).toBe(true);
    expect(crossesVersions(pts.slice(2))).toBe(false);
    expect(versionSegments([{ score: 1 }, { score: 2, scoreVersion: 1 }])).toHaveLength(1);
  });
});

// ─── The monitoring worker ───────────────────────────────────────────────────
const db = vi.hoisted(() => ({
  visibilityMonitor: { findUnique: vi.fn(), update: vi.fn() },
  visibilityAudit: { findFirst: vi.fn(), create: vi.fn() },
}));
const { sidecarPost, record, checkQuota, sendVisibilityAlert, log } = vi.hoisted(() => ({
  sidecarPost: vi.fn(),
  record: vi.fn(),
  checkQuota: vi.fn(),
  sendVisibilityAlert: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  Worker: class {},
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/generated/prisma", () => ({ Prisma: {} }));
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost }));
vi.mock("@/infrastructure/metering/service", () => ({ meteringService: { record, checkQuota } }));
vi.mock("@/lib/visibility-alerts", () => ({ sendVisibilityAlert, recordPromptAlerts: vi.fn() }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: log }));
vi.mock("@/infrastructure/observability/telemetry", () => ({ withSpan: (_n: string, f: () => unknown) => f() }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: vi.fn(), getQueue: vi.fn() }));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: () => ({}) }));

import { processMonitorRun } from "@/infrastructure/queue/workers/visibility-monitoring.worker";

const monitor = { id: "m1", tenantId: "t1", url: "https://acme.example", active: true, cadence: "WEEKLY" };
const audit = (score: number, version?: number) => ({
  status: 200,
  data: {
    url: "https://acme.example/",
    score,
    grade: "C",
    ...(version ? { score_version: version } : {}),
    checks: [{ category: "About page", points: 0, max: 4, status: "none", recommendation: "Publish one." }],
    robots: { bots: { GPTBot: { status: "ALLOWED", detail: "" } } },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.visibilityMonitor.findUnique.mockResolvedValue(monitor);
  checkQuota.mockResolvedValue({ allowed: true });
});

describe("processMonitorRun across a score version change", () => {
  it("stores the sidecar's score version on the audit", async () => {
    sidecarPost.mockResolvedValue(audit(58, 2));
    db.visibilityAudit.findFirst.mockResolvedValue(null);
    await processMonitorRun("m1");
    expect(db.visibilityAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 58, scoreVersion: 2 }) }),
    );
  });

  it("a v1 sidecar (no score_version) stores version 1", async () => {
    sidecarPost.mockResolvedValue(audit(91));
    db.visibilityAudit.findFirst.mockResolvedValue(null);
    await processMonitorRun("m1");
    expect(db.visibilityAudit.create.mock.calls[0][0].data.scoreVersion).toBe(1);
  });

  it("the first v2 audit after v1 audits is a silent new baseline: no alert for 94 -> 58", async () => {
    sidecarPost.mockResolvedValue(audit(58, 2));
    db.visibilityAudit.findFirst.mockResolvedValue({ score: 94, scoreVersion: 1, bots: {} });
    await processMonitorRun("m1");
    expect(sendVisibilityAlert).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ scoreVersion: 2, prevVersion: 1 }),
      "Score version changed: new baseline stored, no alert",
    );
  });

  it("the next v2 audit compares against that baseline and alerts on a real drop", async () => {
    sidecarPost.mockResolvedValue(audit(52, 2));
    db.visibilityAudit.findFirst.mockResolvedValue({ score: 58, scoreVersion: 2, bots: {} });
    await processMonitorRun("m1");
    expect(sendVisibilityAlert).toHaveBeenCalledWith(expect.objectContaining({ prevScore: 58, newScore: 52 }));
  });

  it("a v2 drop under 5 points does not alert", async () => {
    sidecarPost.mockResolvedValue(audit(54, 2));
    db.visibilityAudit.findFirst.mockResolvedValue({ score: 58, scoreVersion: 2, bots: {} });
    await processMonitorRun("m1");
    expect(sendVisibilityAlert).not.toHaveBeenCalled();
  });
});
