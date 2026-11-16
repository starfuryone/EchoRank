// src/lib/admin/users.ts — the data behind /admin/users (staff only).
//
// Every user across every tenant, the subscriptions set to cancel, the
// data-deletion requests, and the staff cancel action. Callers have already
// checked PLATFORM_ADMIN_EMAILS (src/lib/platform-admin.ts); nothing here does.
//
// PLAIN DATA OUT. Every row is strings, numbers, booleans and ISO dates, so it
// crosses into the client table untouched (tests/rsc-client-props.test.ts).
//
// CANCEL REUSES cancelTenantSubscription (src/lib/billing/cancellation.ts),
// the only code that calls Stripe to cancel. A tenant with no Stripe
// subscription (a plan set by hand: tenant:set-plan, or SQL) has nothing at
// Stripe to cancel; its billingStatus is set to CANCELED here instead. Every
// staff cancel writes its own audit row (admin.tenant.cancel) with the staff
// email, the choice and the outcome, success or not, on top of the billing.*
// rows the module writes when it changes something.

import "server-only";
import type { BillingStatus, PlanType, Prisma, Role } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { cancelTenantSubscription, type CancelWhen } from "@/lib/billing/cancellation";
import type { CsvColumn } from "@/lib/csv-export";

export const ADMIN_USERS_PAGE_SIZE = 50;
export const ADMIN_USERS_CSV_CAP = 10_000;
export const PLAN_FILTERS: readonly PlanType[] = ["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
export const STATUS_FILTERS: readonly BillingStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "NONE"];

/** Stripe's live dashboard. Staff open the customer there; nothing is called. */
export const stripeCustomerUrl = (customerId: string) => `https://dashboard.stripe.com/customers/${encodeURIComponent(customerId)}`;

export interface AdminUserFilters {
  q: string | null;
  plan: PlanType | null;
  status: BillingStatus | null;
  page: number;
}

/** ?q=&plan=&status=&page= as filters; anything unknown is dropped. */
export function parseAdminUserFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): AdminUserFilters {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || null;
  };
  const plan = get("plan")?.toUpperCase() ?? null;
  const status = get("status")?.toUpperCase() ?? null;
  const page = Number.parseInt(get("page") ?? "1", 10);
  return {
    q: get("q")?.slice(0, 200) ?? null,
    plan: plan && (PLAN_FILTERS as readonly string[]).includes(plan) ? (plan as PlanType) : null,
    status: status && (STATUS_FILTERS as readonly string[]).includes(status) ? (status as BillingStatus) : null,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** One user in one tenant. A user in two tenants is two rows. */
export interface AdminUserRow {
  memberId: string;
  userId: string;
  name: string | null;
  email: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: Role;
  plan: PlanType;
  billingStatus: BillingStatus;
  /** The Subscription row's status; null when there is none. */
  subscriptionStatus: BillingStatus | null;
  cancelAtPeriodEnd: boolean;
  /** ISO. Trial end while trialing, otherwise the period end (renewal or access end). */
  periodEnd: string | null;
  /** A Stripe plan subscription exists: cancel goes through Stripe. */
  hasStripeSubscription: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  stripeCustomerId: string | null;
  stripeCustomerUrl: string | null;
}

function memberWhere(f: AdminUserFilters): Prisma.TenantMemberWhereInput {
  const and: Prisma.TenantMemberWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { user: { email: { contains: f.q, mode: "insensitive" } } },
        { user: { name: { contains: f.q, mode: "insensitive" } } },
        { tenant: { name: { contains: f.q, mode: "insensitive" } } },
        { tenant: { slug: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.plan) and.push({ tenant: { planType: f.plan } });
  if (f.status) and.push({ tenant: { billingStatus: f.status } });
  return and.length ? { AND: and } : {};
}

const MEMBER_SELECT = {
  id: true,
  role: true,
  user: { select: { id: true, name: true, email: true, createdAt: true } },
  tenant: {
    select: {
      id: true,
      name: true,
      slug: true,
      planType: true,
      billingStatus: true,
      stripeCustomerId: true,
      subscription: { select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, productKind: true, stripeSubscriptionId: true } },
    },
  },
} satisfies Prisma.TenantMemberSelect;

type MemberRecord = Prisma.TenantMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

async function lastLogins(userIds: string[]): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.loginEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, success: true },
    _max: { createdAt: true },
  });
  const out = new Map<string, Date>();
  for (const r of rows) if (r.userId && r._max.createdAt) out.set(r.userId, r._max.createdAt);
  return out;
}

function toRow(m: MemberRecord, logins: Map<string, Date>): AdminUserRow {
  const sub = m.tenant.subscription;
  const plan = sub?.productKind === "PLAN" ? sub : null;
  const customer = m.tenant.stripeCustomerId;
  return {
    memberId: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    tenantId: m.tenant.id,
    tenantName: m.tenant.name,
    tenantSlug: m.tenant.slug,
    role: m.role,
    plan: m.tenant.planType,
    billingStatus: m.tenant.billingStatus,
    subscriptionStatus: plan?.status ?? null,
    cancelAtPeriodEnd: plan?.cancelAtPeriodEnd ?? false,
    periodEnd: plan?.currentPeriodEnd?.toISOString() ?? null,
    hasStripeSubscription: Boolean(plan?.stripeSubscriptionId),
    createdAt: m.user.createdAt.toISOString(),
    lastLoginAt: logins.get(m.user.id)?.toISOString() ?? null,
    stripeCustomerId: customer,
    stripeCustomerUrl: customer ? stripeCustomerUrl(customer) : null,
  };
}

/** One page of users, newest first. */
export async function listAdminUsers(f: AdminUserFilters): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const where = memberWhere(f);
  const [total, members] = await Promise.all([
    prisma.tenantMember.count({ where }),
    prisma.tenantMember.findMany({
      where,
      select: MEMBER_SELECT,
      orderBy: [{ user: { createdAt: "desc" } }, { id: "asc" }],
      skip: (f.page - 1) * ADMIN_USERS_PAGE_SIZE,
      take: ADMIN_USERS_PAGE_SIZE,
    }),
  ]);
  const logins = await lastLogins([...new Set(members.map((m) => m.user.id))]);
  return { rows: members.map((m) => toRow(m, logins)), total, page: f.page, pageSize: ADMIN_USERS_PAGE_SIZE };
}

/** Every matching row up to the cap, for the CSV. `truncated` when there were more. */
export async function exportAdminUsers(f: AdminUserFilters): Promise<{ rows: AdminUserRow[]; truncated: boolean }> {
  const members = await prisma.tenantMember.findMany({
    where: memberWhere(f),
    select: MEMBER_SELECT,
    orderBy: [{ user: { createdAt: "desc" } }, { id: "asc" }],
    take: ADMIN_USERS_CSV_CAP + 1,
  });
  const truncated = members.length > ADMIN_USERS_CSV_CAP;
  const kept = members.slice(0, ADMIN_USERS_CSV_CAP);
  const logins = await lastLogins([...new Set(kept.map((m) => m.user.id))]);
  return { rows: kept.map((m) => toRow(m, logins)), truncated };
}

export const ADMIN_USER_CSV_COLUMNS: readonly CsvColumn<AdminUserRow>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Email", value: (r) => r.email },
  { header: "Tenant", value: (r) => r.tenantName },
  { header: "Tenant slug", value: (r) => r.tenantSlug },
  { header: "Tenant ID", value: (r) => r.tenantId },
  { header: "Role", value: (r) => r.role },
  { header: "Plan", value: (r) => r.plan },
  { header: "Billing status", value: (r) => r.billingStatus },
  { header: "Subscription status", value: (r) => r.subscriptionStatus },
  { header: "Cancel at period end", value: (r) => r.cancelAtPeriodEnd },
  { header: "Trial end / period end", value: (r) => r.periodEnd },
  { header: "Created", value: (r) => r.createdAt },
  { header: "Last login", value: (r) => r.lastLoginAt },
  { header: "Stripe customer", value: (r) => r.stripeCustomerId },
  { header: "Stripe dashboard", value: (r) => r.stripeCustomerUrl },
];

// ── Cancel requests ─────────────────────────────────────────────────────────

export interface CancelRequestRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: PlanType;
  status: BillingStatus;
  /** ISO. The cancel's audit row; null when it was made outside the app (portal, Stripe dashboard). */
  requestedAt: string | null;
  /** ISO. When access ends. */
  accessEndsAt: string | null;
  stripeCustomerUrl: string | null;
}

/** Subscriptions set to cancel at period end, ending soonest first. */
export async function listCancelRequests(): Promise<CancelRequestRow[]> {
  const subs = await prisma.subscription.findMany({
    where: { cancelAtPeriodEnd: true, productKind: "PLAN", status: { not: "CANCELED" } },
    select: {
      tenantId: true,
      planType: true,
      status: true,
      currentPeriodEnd: true,
      tenant: { select: { name: true, slug: true, stripeCustomerId: true } },
    },
    orderBy: { currentPeriodEnd: "asc" },
    take: 500,
  });
  const audits = subs.length
    ? await prisma.auditLog.findMany({
        where: { tenantId: { in: subs.map((s) => s.tenantId) }, action: "billing.subscription.cancel" },
        select: { tenantId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const requested = new Map<string, Date>();
  for (const a of audits) if (!requested.has(a.tenantId)) requested.set(a.tenantId, a.createdAt);
  return subs.map((s) => ({
    tenantId: s.tenantId,
    tenantName: s.tenant.name,
    tenantSlug: s.tenant.slug,
    plan: s.planType,
    status: s.status,
    requestedAt: requested.get(s.tenantId)?.toISOString() ?? null,
    accessEndsAt: s.currentPeriodEnd?.toISOString() ?? null,
    stripeCustomerUrl: s.tenant.stripeCustomerId ? stripeCustomerUrl(s.tenant.stripeCustomerId) : null,
  }));
}

// ── Data-deletion requests (read-only) ──────────────────────────────────────

export interface DeletionRequestRow {
  id: string;
  scope: string;
  status: string;
  tenantId: string | null;
  tenantName: string | null;
  userId: string | null;
  requestedAt: string;
  runAfter: string;
  completedAt: string | null;
  cancelledAt: string | null;
  error: string | null;
}

/** The newest 200, FAILED ones first. */
export async function listDeletionRequests(): Promise<DeletionRequestRow[]> {
  const rows = await prisma.dataDeletionRequest.findMany({
    select: { id: true, scope: true, status: true, tenantId: true, userId: true, requestedAt: true, runAfter: true, completedAt: true, cancelledAt: true, error: true },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });
  const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter((x): x is string => !!x))];
  const tenants = tenantIds.length ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  return rows
    .map((r) => ({
      id: r.id,
      scope: r.scope,
      status: r.status,
      tenantId: r.tenantId,
      tenantName: r.tenantId ? (names.get(r.tenantId) ?? null) : null,
      userId: r.userId,
      requestedAt: r.requestedAt.toISOString(),
      runAfter: r.runAfter.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      error: r.error,
    }))
    .sort((a, b) => Number(b.status === "FAILED") - Number(a.status === "FAILED"));
}

// ── The staff cancel ────────────────────────────────────────────────────────

export interface AdminActor {
  email: string;
  userId: string | null;
  ipAddress?: string | null;
}

/** The tenant's billing as the table shows it, read back after the action. */
export interface TenantBillingState {
  tenantId: string;
  billingStatus: BillingStatus;
  subscriptionStatus: BillingStatus | null;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  hasStripeSubscription: boolean;
}

export type AdminCancelResult =
  | { ok: true; path: "stripe" | "manual"; changed: boolean; tenant: TenantBillingState }
  | { ok: false; status: 403 | 404 | 409 | 502; error: string; reason: string; tenant: TenantBillingState | null };

async function billingState(tenantId: string): Promise<TenantBillingState | null> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      billingStatus: true,
      subscription: { select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, productKind: true, stripeSubscriptionId: true } },
    },
  });
  if (!t) return null;
  const plan = t.subscription?.productKind === "PLAN" ? t.subscription : null;
  return {
    tenantId: t.id,
    billingStatus: t.billingStatus,
    subscriptionStatus: plan?.status ?? null,
    cancelAtPeriodEnd: plan?.cancelAtPeriodEnd ?? false,
    periodEnd: plan?.currentPeriodEnd?.toISOString() ?? null,
    hasStripeSubscription: Boolean(plan?.stripeSubscriptionId),
  };
}

export function parseCancelWhen(v: unknown): CancelWhen | null {
  return v === "period_end" || v === "now" ? v : null;
}

/**
 * Staff cancel of one tenant. With a Stripe subscription: through
 * cancelTenantSubscription, at period end or now, no refund either way.
 * Without one: billingStatus = CANCELED. Always one admin.tenant.cancel audit row.
 */
export async function adminCancelTenant(tenantId: string, when: CancelWhen, admin: AdminActor): Promise<AdminCancelResult> {
  const before = await billingState(tenantId);
  if (!before) return { ok: false, status: 404, reason: "no_tenant", error: "No such tenant.", tenant: null };

  const audit = (details: Record<string, unknown>) =>
    createAuditLog({
      tenantId,
      userId: admin.userId ?? undefined,
      action: "admin.tenant.cancel",
      entity: "Tenant",
      entityId: tenantId,
      details: { adminEmail: admin.email, choice: when, before, ...details },
      ipAddress: admin.ipAddress ?? undefined,
    });

  const result = await cancelTenantSubscription(tenantId, {
    when,
    actor: { kind: "platform_admin", userId: admin.userId ?? "", email: admin.email, ipAddress: admin.ipAddress },
  });

  if (result.ok) {
    const tenant = (await billingState(tenantId))!;
    await audit({ path: "stripe", outcome: result.changed ? "changed" : "unchanged", stripe: result.state, after: tenant });
    return { ok: true, path: "stripe", changed: result.changed, tenant };
  }

  // Nothing at Stripe: a plan given by hand. The DB is the only record.
  if (result.reason === "no_subscription") {
    if (before.billingStatus === "CANCELED" || before.billingStatus === "NONE") {
      await audit({ path: "manual", outcome: "refused", reason: "nothing_to_cancel" });
      return { ok: false, status: 409, reason: "nothing_to_cancel", error: `Nothing to cancel: billing status is ${before.billingStatus}.`, tenant: before };
    }
    await prisma.tenant.update({ where: { id: tenantId }, data: { billingStatus: "CANCELED" } });
    const tenant = (await billingState(tenantId))!;
    await audit({ path: "manual", outcome: "changed", stripe: null, after: tenant });
    return { ok: true, path: "manual", changed: true, tenant };
  }

  await audit({ path: "stripe", outcome: "failed", reason: result.reason, error: result.error });
  return { ok: false, status: result.status === 403 ? 403 : result.status, reason: result.reason, error: result.error, tenant: await billingState(tenantId) };
}
