// src/lib/tenant-set-plan.ts — staff's manual plan change, the logic behind
// `npm run tenant:set-plan` (scripts/tenant-set-plan.ts).
//
// WHY IT EXISTS. A raw SQL `UPDATE tenants SET "planType" = …` leaves the
// tenant's quota row on the old plan's numbers (test-agency, 2026-11-16:
// NOSY_BAT → AGENCY with maxAiInferencesPerMonth still 0). This sets the plan,
// the billing status and the quotas the way the Stripe webhook does —
// quotaEnforcer.setQuota(id, quotaEnforcer.getDefaultQuotas(plan)), the call
// that logs "Tenant quotas updated" — in ONE transaction with an audit_logs row.
//
// SAFE BY DEFAULT.
//   - Dry run unless apply: it prints before and after and writes nothing.
//   - A tenant with a live Stripe subscription is refused unless force: Stripe
//     owns that tenant's plan, and the next customer.subscription.updated
//     would put it back. Read from our own rows; Stripe is never called.
//
// AFTER THE COMMIT, the two plan-change effects the webhook also runs:
// onPlanChange (crawl schedules, review-request sends) and the Matrix account
// reconcile. Each reports, neither undoes the change.

import "server-only";
import os from "node:os";
import type { BillingStatus, PlanType, Prisma, PrismaClient } from "@/generated/prisma";
import { quotaEnforcer } from "@/infrastructure/metering/quota";

export const PLAN_TYPES: readonly PlanType[] = ["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
export const BILLING_STATUSES: readonly BillingStatus[] = ["ACTIVE", "PAST_DUE", "CANCELED", "TRIALING", "NONE"];
/** Statuses in which a Stripe subscription still bills or grants access. */
const LIVE: readonly BillingStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

export const QUOTA_FIELDS = [
  "maxEmailsPerMonth",
  "maxSmsPerMonth",
  "maxWebhooksPerMonth",
  "maxApiRequestsPerDay",
  "maxAiInferencesPerMonth",
  "maxMonitoringChecks",
  "overageAllowed",
] as const;
type QuotaField = (typeof QUOTA_FIELDS)[number];
export type QuotaSnapshot = Record<QuotaField, number | boolean> | null;

export interface SetPlanArgs {
  slug: string;
  plan: PlanType;
  /** Omitted: the billing status is left as it is. */
  status: BillingStatus | null;
  force: boolean;
  apply: boolean;
}

export const USAGE =
  "npm run tenant:set-plan -- --tenant <slug> --plan <PLAN> [--status <STATUS>] [--force] [--apply]\n" +
  `  PLAN:   ${PLAN_TYPES.join(" | ")}\n` +
  `  STATUS: ${BILLING_STATUSES.join(" | ")} (omitted: unchanged)\n` +
  "  --force  allow a tenant with a live Stripe subscription\n" +
  "  --apply  write; without it this is a dry run";

/** argv after `--`, as SetPlanArgs, or what is wrong with it. */
export function parseSetPlanArgs(argv: readonly string[]): { ok: true; args: SetPlanArgs } | { ok: false; error: string } {
  let slug: string | null = null;
  let plan: string | null = null;
  let status: string | null = null;
  let force = false;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    try {
      if (a === "--tenant") slug = value();
      else if (a === "--plan") plan = value().toUpperCase();
      else if (a === "--status") status = value().toUpperCase();
      else if (a === "--force") force = true;
      else if (a === "--apply") apply = true;
      else return { ok: false, error: `unknown argument ${a}` };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
  if (!slug) return { ok: false, error: "--tenant <slug> is required" };
  if (!plan) return { ok: false, error: "--plan <PLAN> is required" };
  if (!(PLAN_TYPES as readonly string[]).includes(plan)) return { ok: false, error: `unknown plan ${plan}` };
  if (status !== null && !(BILLING_STATUSES as readonly string[]).includes(status)) return { ok: false, error: `unknown status ${status}` };
  return { ok: true, args: { slug, plan: plan as PlanType, status: status as BillingStatus | null, force, apply } };
}

type Db = Pick<PrismaClient, "tenant" | "subscription" | "tenantQuota" | "$transaction">;

export interface SetPlanDeps {
  db: Db;
  onPlanChange?: (tenantId: string, from: PlanType, to: PlanType) => Promise<unknown>;
  reconcileMatrix?: (tenantId: string, plan: PlanType) => Promise<unknown>;
  /** Who ran it, for the audit row. */
  runBy?: string;
}

export interface Side {
  planType: PlanType;
  billingStatus: BillingStatus;
  quotas: QuotaSnapshot;
}

export type SetPlanResult =
  | { ok: false; error: string; activeSubscription?: string }
  | {
      ok: true;
      applied: boolean;
      tenant: { id: string; slug: string; name: string };
      before: Side;
      after: Side;
      forced: boolean;
      activeSubscription: string | null;
      effects: { planChange?: unknown; matrix?: unknown; errors: string[] };
    };

function snapshot(row: Record<string, unknown> | null): QuotaSnapshot {
  if (!row) return null;
  const out = {} as Record<QuotaField, number | boolean>;
  for (const f of QUOTA_FIELDS) out[f] = row[f] as number | boolean;
  return out;
}

/** What setQuota's upsert will leave: only the fields it is given move. */
function projected(before: QuotaSnapshot, plan: PlanType): QuotaSnapshot {
  const d = quotaEnforcer.getDefaultQuotas(plan);
  return {
    maxEmailsPerMonth: d.maxEmailsPerMonth ?? before?.maxEmailsPerMonth ?? 300,
    maxSmsPerMonth: d.maxSmsPerMonth ?? before?.maxSmsPerMonth ?? 0,
    maxWebhooksPerMonth: d.maxWebhooksPerMonth ?? before?.maxWebhooksPerMonth ?? 1000,
    maxApiRequestsPerDay: d.maxApiRequestsPerDay ?? before?.maxApiRequestsPerDay ?? 10000,
    maxAiInferencesPerMonth: d.maxAiInferencesPerMonth ?? before?.maxAiInferencesPerMonth ?? 100,
    maxMonitoringChecks: d.maxMonitoringChecks ?? before?.maxMonitoringChecks ?? 0,
    overageAllowed: before?.overageAllowed ?? false,
  };
}

export async function setTenantPlan(args: SetPlanArgs, deps: SetPlanDeps): Promise<SetPlanResult> {
  const { db } = deps;
  const tenant = await db.tenant.findUnique({
    where: { slug: args.slug },
    select: { id: true, slug: true, name: true, planType: true, billingStatus: true, stripeSubscriptionId: true },
  });
  if (!tenant) return { ok: false, error: `no tenant with slug "${args.slug}"` };

  const [sub, quota] = await Promise.all([
    db.subscription.findUnique({ where: { tenantId: tenant.id }, select: { status: true, stripeSubscriptionId: true } }),
    db.tenantQuota.findUnique({ where: { tenantId: tenant.id } }),
  ]);

  const activeSubscription =
    sub?.stripeSubscriptionId && LIVE.includes(sub.status)
      ? sub.stripeSubscriptionId
      : tenant.stripeSubscriptionId && LIVE.includes(tenant.billingStatus)
        ? tenant.stripeSubscriptionId
        : null;
  if (activeSubscription && !args.force) {
    return {
      ok: false,
      activeSubscription,
      error:
        `tenant "${tenant.slug}" has a live Stripe subscription (${activeSubscription}). Stripe owns its plan: ` +
        "change it there, or pass --force (the next subscription webhook may undo this).",
    };
  }

  const before: Side = { planType: tenant.planType, billingStatus: tenant.billingStatus, quotas: snapshot(quota as Record<string, unknown> | null) };
  const nextStatus = args.status ?? tenant.billingStatus;
  const base = { tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name }, before, forced: !!activeSubscription, activeSubscription };

  if (!args.apply) {
    return {
      ok: true,
      applied: false,
      ...base,
      after: { planType: args.plan, billingStatus: nextStatus, quotas: projected(before.quotas, args.plan) },
      effects: { errors: [] },
    };
  }

  const defaults = quotaEnforcer.getDefaultQuotas(args.plan);
  const afterQuota = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.tenant.update({ where: { id: tenant.id }, data: { planType: args.plan, billingStatus: nextStatus } });
    await quotaEnforcer.setQuota(tenant.id, defaults, tx);
    const row = await tx.tenantQuota.findUnique({ where: { tenantId: tenant.id } });
    const after = snapshot(row as Record<string, unknown> | null);
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: "admin.tenant.set_plan",
        entity: "Tenant",
        entityId: tenant.id,
        details: {
          via: "scripts/tenant-set-plan.ts",
          runBy: deps.runBy ?? os.userInfo().username,
          planFrom: tenant.planType,
          planTo: args.plan,
          statusFrom: tenant.billingStatus,
          statusTo: nextStatus,
          quotasBefore: before.quotas,
          quotasAfter: after,
          forced: !!activeSubscription,
          activeSubscription,
        } as Prisma.InputJsonValue,
      },
    });
    return after;
  });

  const effects: { planChange?: unknown; matrix?: unknown; errors: string[] } = { errors: [] };
  if (tenant.planType !== args.plan && deps.onPlanChange) {
    try {
      effects.planChange = await deps.onPlanChange(tenant.id, tenant.planType, args.plan);
    } catch (err) {
      effects.errors.push(`onPlanChange: ${(err as Error).message}`);
    }
  }
  if (deps.reconcileMatrix) {
    try {
      effects.matrix = await deps.reconcileMatrix(tenant.id, args.plan);
    } catch (err) {
      effects.errors.push(`matrix reconcile: ${(err as Error).message}`);
    }
  }

  return {
    ok: true,
    applied: true,
    ...base,
    after: { planType: args.plan, billingStatus: nextStatus, quotas: afterQuota },
    effects,
  };
}
