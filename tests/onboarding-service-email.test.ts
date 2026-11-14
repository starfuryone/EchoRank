// The onboarding drip is a service email (2026-11-14): every new account gets
// it, once, without the marketing-consent check, and its own unsubscribe stops
// it. Jobs queued before that change keep the consent check (no backfill).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  addJob: vi.fn(async () => undefined),
  send: vi.fn(async () => ({ status: "sent" as const })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
m.log.child.mockReturnValue(m.log);
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: m.addJob }));
vi.mock("@/lib/onboarding-email", () => ({ sendOnboardingEmail: m.send }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: m.log }));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: vi.fn() }));
vi.mock("@/infrastructure/observability/telemetry", () => ({
  withSpan: async (_n: string, fn: (s: { setAttributes: () => void }) => unknown) => fn({ setAttributes: () => {} }),
}));

import { enqueueOnboardingDrip, onboardingJobId, ONBOARDING_DRIP_STAGES } from "@/lib/onboarding-drip";
import { processOnboardingEmail } from "@/infrastructure/queue/workers/onboarding-email.worker";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (name === "generated" || name.includes(".bak")) continue;
    if (statSync(join(ROOT, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

beforeEach(() => vi.clearAllMocks());

describe("once per account", () => {
  it("/api/auth/register is the only place that schedules the drip", () => {
    const callers = sourceFiles("src").filter(
      (f) => f !== "src/lib/onboarding-drip.ts" && /\benqueueOnboardingDrip\(/.test(read(f)),
    );
    // Stripe checkout always attaches to the tenant register created
    // (flow=upgrade), so paying never schedules a second sequence.
    expect(callers).toEqual(["src/app/api/auth/register/route.ts"]);
  });

  it("schedules each stage under its fixed id, marked as a service email", async () => {
    await enqueueOnboardingDrip("tenant_1");
    expect(m.addJob).toHaveBeenCalledTimes(ONBOARDING_DRIP_STAGES.length);
    for (const [i, stage] of ONBOARDING_DRIP_STAGES.entries()) {
      const [queue, name, data, opts] = m.addJob.mock.calls[i] as unknown as [string, string, Record<string, unknown>, { jobId: string }];
      expect([queue, name]).toEqual(["onboarding-email", "drip"]);
      expect(data).toEqual({ tenantId: "tenant_1", correlationId: "tenant_1", stage, serviceEmail: true });
      expect(opts.jobId).toBe(onboardingJobId("tenant_1", stage));
    }
  });
});

describe("the worker", () => {
  const job = (data: Record<string, unknown>) =>
    ({ id: "onboarding-tenant_1-d0", data: { tenantId: "tenant_1", correlationId: "tenant_1", stage: "d0", ...data } }) as never;

  it("sends a service-email job without the consent check", async () => {
    await processOnboardingEmail(job({ serviceEmail: true }));
    expect(m.send).toHaveBeenCalledWith("tenant_1", "d0", { requireMarketingConsent: false });
  });

  it("keeps the consent check for a job queued before the change", async () => {
    await processOnboardingEmail(job({}));
    expect(m.send).toHaveBeenCalledWith("tenant_1", "d0", { requireMarketingConsent: true });
  });
});

describe("the opt-out column", () => {
  it("is a nullable tenant column added by an additive, guarded migration", () => {
    expect(read("prisma/schema.prisma")).toMatch(/\n\s+onboardingEmailsOptedOutAt DateTime\?\n/);
    const sql = read("prisma/migrations/20261204090000_tenant_onboarding_email_opt_out/migration.sql");
    expect(sql).toContain('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboardingEmailsOptedOutAt" TIMESTAMP(3);');
    expect(sql).not.toMatch(/\bUPDATE\b|\bDROP\b/);
  });
});
