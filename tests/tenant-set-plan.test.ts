// `npm run tenant:set-plan` (src/lib/tenant-set-plan.ts): plan + status +
// quotas in one transaction with an audit row, through the webhook's own
// quota function; dry run by default; a live Stripe subscription refused
// unless --force. A fake DB whose $transaction rolls back on a throw.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { planQuotaDefaults } from "@/lib/plan-config";

type Tenant = { id: string; slug: string; name: string; planType: string; billingStatus: string; stripeSubscriptionId: string | null };
type Quota = Record<string, unknown> & { tenantId: string };
type State = {
  tenants: Tenant[];
  subs: { tenantId: string; status: string; stripeSubscriptionId: string | null }[];
  quotas: Quota[];
  audits: Record<string, unknown>[];
};
let state: State;
let failAudit = false;

function client(s: State) {
  return {
    tenant: {
      findUnique: async ({ where }: { where: { slug: string } }) => {
        const t = s.tenants.find((x) => x.slug === where.slug);
        return t ? { ...t } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Tenant> }) => {
        const t = s.tenants.find((x) => x.id === where.id)!;
        Object.assign(t, data);
        return { ...t };
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => s.subs.find((x) => x.tenantId === where.tenantId) ?? null,
    },
    tenantQuota: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => {
        const q = s.quotas.find((x) => x.tenantId === where.tenantId);
        return q ? { ...q } : null;
      },
      upsert: async ({ where, create, update }: { where: { tenantId: string }; create: Quota; update: Record<string, unknown> }) => {
        const q = s.quotas.find((x) => x.tenantId === where.tenantId);
        if (q) Object.assign(q, update);
        else s.quotas.push({ ...create });
        return {};
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (failAudit) throw new Error("audit insert failed");
        s.audits.push(data);
        return data;
      },
    },
  };
}

const db = {
  ...client({} as State),
  get tenant() {
    return client(state).tenant;
  },
  get subscription() {
    return client(state).subscription;
  },
  get tenantQuota() {
    return client(state).tenantQuota;
  },
  // All or nothing: the callback works on a copy, kept only if it returns.
  $transaction: async <T,>(fn: (tx: ReturnType<typeof client>) => Promise<T>): Promise<T> => {
    const copy: State = structuredClone(state);
    const out = await fn(client(copy));
    state = copy;
    return out;
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/infrastructure/metering/service", () => ({ meteringService: { invalidateCache: vi.fn() } }));

const { parseSetPlanArgs, setTenantPlan, QUOTA_FIELDS } = await import("@/lib/tenant-set-plan");

const NOSY_ZEROS = {
  maxEmailsPerMonth: 0,
  maxSmsPerMonth: 0,
  maxWebhooksPerMonth: 0,
  maxApiRequestsPerDay: 0,
  maxAiInferencesPerMonth: 0,
  maxMonitoringChecks: 0,
  overageAllowed: true,
};

beforeEach(() => {
  failAudit = false;
  state = {
    tenants: [
      // test-agency after the raw SQL: plan moved, quotas left behind.
      { id: "t_agency", slug: "test-agency", name: "Test Agency", planType: "AGENCY", billingStatus: "ACTIVE", stripeSubscriptionId: null },
      { id: "t_paid", slug: "paying", name: "Paying Co", planType: "STARTER", billingStatus: "ACTIVE", stripeSubscriptionId: "sub_live" },
      { id: "t_gone", slug: "gone", name: "Gone Co", planType: "STARTER", billingStatus: "CANCELED", stripeSubscriptionId: "sub_old" },
    ],
    subs: [
      { tenantId: "t_paid", status: "ACTIVE", stripeSubscriptionId: "sub_live" },
      { tenantId: "t_gone", status: "CANCELED", stripeSubscriptionId: "sub_old" },
    ],
    quotas: [
      { tenantId: "t_agency", ...NOSY_ZEROS },
      { tenantId: "t_paid", ...NOSY_ZEROS },
    ],
    audits: [],
  };
});

const run = (argv: string[], deps: Partial<Parameters<typeof setTenantPlan>[1]> = {}) => {
  const p = parseSetPlanArgs(argv);
  if (!p.ok) throw new Error(p.error);
  return setTenantPlan(p.args, { db: db as never, runBy: "root", ...deps });
};

function expected(plan: "AGENCY" | "GROWTH") {
  const d = planQuotaDefaults(plan);
  return {
    maxEmailsPerMonth: d.maxEmailsPerMonth,
    maxSmsPerMonth: d.maxSmsPerMonth,
    maxWebhooksPerMonth: d.maxWebhooksPerMonth,
    maxApiRequestsPerDay: d.maxApiRequestsPerDay,
    maxAiInferencesPerMonth: d.maxAiInferencesPerMonth,
    maxMonitoringChecks: d.maxMonitoringChecks,
  };
}

describe("arguments", () => {
  it("needs --tenant and --plan, knows the plans and statuses, takes either case", () => {
    expect(parseSetPlanArgs(["--plan", "AGENCY"])).toMatchObject({ ok: false, error: expect.stringContaining("--tenant") });
    expect(parseSetPlanArgs(["--tenant", "x"])).toMatchObject({ ok: false, error: expect.stringContaining("--plan") });
    expect(parseSetPlanArgs(["--tenant", "x", "--plan", "GOLD"])).toMatchObject({ ok: false, error: "unknown plan GOLD" });
    expect(parseSetPlanArgs(["--tenant", "x", "--plan", "agency", "--status", "paid"])).toMatchObject({ ok: false, error: "unknown status PAID" });
    expect(parseSetPlanArgs(["--tenant", "x", "--plan", "--apply"])).toMatchObject({ ok: false, error: "--plan needs a value" });
    expect(parseSetPlanArgs(["--tenant", "x", "--plan", "agency", "--status", "active", "--force", "--apply"])).toEqual({
      ok: true,
      args: { slug: "x", plan: "AGENCY", status: "ACTIVE", force: true, apply: true },
    });
    expect(parseSetPlanArgs(["--tenant", "x", "--plan", "AGENCY"])).toMatchObject({ ok: true, args: { status: null, force: false, apply: false } });
  });
});

describe("tenant:set-plan", () => {
  it("dry-runs by default: prints the AGENCY quotas it would set and writes nothing", async () => {
    const before = structuredClone(state);
    const r = await run(["--tenant", "test-agency", "--plan", "AGENCY"]);
    expect(r).toMatchObject({ ok: true, applied: false });
    if (!r.ok) return;
    expect(r.before.quotas).toMatchObject({ maxAiInferencesPerMonth: 0 });
    expect(r.after.quotas).toMatchObject(expected("AGENCY"));
    expect(state).toEqual(before);
  });

  it("--apply recomputes test-agency's quotas with the webhook's function, keeps overageAllowed, and audits it", async () => {
    const r = await run(["--tenant", "test-agency", "--plan", "AGENCY", "--apply"]);
    expect(r).toMatchObject({ ok: true, applied: true });
    const quota = state.quotas.find((q) => q.tenantId === "t_agency")!;
    expect(quota).toMatchObject(expected("AGENCY"));
    expect(quota.overageAllowed).toBe(true);
    expect(state.tenants[0]).toMatchObject({ planType: "AGENCY", billingStatus: "ACTIVE" });
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      tenantId: "t_agency",
      action: "admin.tenant.set_plan",
      entity: "Tenant",
      details: { planFrom: "AGENCY", planTo: "AGENCY", statusFrom: "ACTIVE", statusTo: "ACTIVE", runBy: "root", forced: false },
    });
    const details = state.audits[0]!.details as { quotasBefore: Record<string, unknown>; quotasAfter: Record<string, unknown> };
    expect(details.quotasBefore.maxAiInferencesPerMonth).toBe(0);
    expect(details.quotasAfter).toMatchObject(expected("AGENCY"));
    if (r.ok) expect(Object.keys(r.after.quotas ?? {})).toEqual([...QUOTA_FIELDS]);
  });

  it("sets the plan and --status together, and runs the webhook's plan-change effects once", async () => {
    const onPlanChange = vi.fn(async () => ({ direction: "none" }));
    const reconcileMatrix = vi.fn(async () => ({ checked: 0 }));
    state.tenants[0]!.planType = "NOSY_BAT";
    state.tenants[0]!.billingStatus = "NONE";
    const r = await run(["--tenant", "test-agency", "--plan", "GROWTH", "--status", "ACTIVE", "--apply"], { onPlanChange, reconcileMatrix });
    expect(r).toMatchObject({ ok: true, applied: true, effects: { errors: [] } });
    expect(state.tenants[0]).toMatchObject({ planType: "GROWTH", billingStatus: "ACTIVE" });
    expect(state.quotas.find((q) => q.tenantId === "t_agency")).toMatchObject(expected("GROWTH"));
    expect(onPlanChange).toHaveBeenCalledWith("t_agency", "NOSY_BAT", "GROWTH");
    expect(reconcileMatrix).toHaveBeenCalledWith("t_agency", "GROWTH");
  });

  it("leaves the status alone when --status is not given", async () => {
    state.tenants[0]!.billingStatus = "TRIALING";
    await run(["--tenant", "test-agency", "--plan", "AGENCY", "--apply"]);
    expect(state.tenants[0]!.billingStatus).toBe("TRIALING");
  });

  it("refuses a tenant with a live Stripe subscription, writes nothing; --force goes ahead and says so", async () => {
    const refused = await run(["--tenant", "paying", "--plan", "AGENCY", "--apply"]);
    expect(refused).toMatchObject({ ok: false, activeSubscription: "sub_live" });
    expect(state.tenants[1]!.planType).toBe("STARTER");
    expect(state.audits).toHaveLength(0);

    const forced = await run(["--tenant", "paying", "--plan", "AGENCY", "--apply", "--force"]);
    expect(forced).toMatchObject({ ok: true, applied: true, forced: true, activeSubscription: "sub_live" });
    expect(state.audits[0]).toMatchObject({ details: { forced: true, activeSubscription: "sub_live" } });
  });

  it("does not count an ended subscription as live", async () => {
    const r = await run(["--tenant", "gone", "--plan", "GROWTH", "--apply"]);
    expect(r).toMatchObject({ ok: true, applied: true, forced: false });
    // No quota row before: setQuota creates one with the plan's numbers.
    expect(state.quotas.find((q) => q.tenantId === "t_gone")).toMatchObject(expected("GROWTH"));
  });

  it("is one transaction: a failed audit insert leaves plan, status and quotas as they were", async () => {
    state.tenants[0]!.planType = "NOSY_BAT";
    const before = structuredClone(state);
    failAudit = true;
    await expect(run(["--tenant", "test-agency", "--plan", "AGENCY", "--status", "ACTIVE", "--apply"])).rejects.toThrow("audit insert failed");
    expect(state).toEqual(before);
  });

  it("reports a failed plan-change effect without undoing the change", async () => {
    state.tenants[0]!.planType = "NOSY_BAT";
    const r = await run(["--tenant", "test-agency", "--plan", "AGENCY", "--apply"], {
      onPlanChange: async () => {
        throw new Error("redis down");
      },
    });
    expect(r).toMatchObject({ ok: true, applied: true, effects: { errors: ["onPlanChange: redis down"] } });
    expect(state.tenants[0]!.planType).toBe("AGENCY");
  });

  it("names an unknown slug", async () => {
    expect(await run(["--tenant", "nope", "--plan", "AGENCY"])).toEqual({ ok: false, error: 'no tenant with slug "nope"' });
  });
});
