// src/lib/funnel/store.ts
//
// Every read and write for funnel configs and captured leads.
//
// ── Two access patterns, and only one of them is tenant-scoped ──────────────
// Everything the dashboard calls takes a tenantId and uses findFirst({ where:
// { id, tenantId } }) — never findUnique({ where: { id } }) — per CLAUDE.md.
// An agency asking for a funnel it does not own gets null, not a 403 built on
// top of a successful read.
//
// funnelByKey() is the exception and is the ONLY function here without a
// tenantId, because the public embed has no session to derive one from. The key
// is what resolves the tenant, so the scoping is not weaker, it is inverted:
// every row this returns belongs to the tenant the key names, and the caller
// takes its tenantId FROM this result rather than from anything the request
// said. A request cannot name a tenant it does not have a key for.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { generateFunnelKey } from "@/lib/funnel/keys";
import type { FunnelBrandingInput } from "@/lib/funnel/branding";
import type { FunnelAuditSummary } from "@/lib/funnel/audit";

/** Bounded so the leads table and its export cannot ask for the whole column. */
export const LEADS_PAGE_SIZE = 50;
/** Ceiling on one CSV. A truncated export announces itself — see csv-export.ts. */
export const LEADS_EXPORT_CAP = 5000;

const MAX_LABEL_LENGTH = 80;

/** What the dashboard list renders. `key` is public, so it is safe to return. */
const FUNNEL_SELECT = {
  id: true,
  label: true,
  key: true,
  allowedOrigins: true,
  branding: true,
  notifyEmail: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateFunnelInput {
  tenantId: string;
  label: string;
  allowedOrigins: string[];
  branding: FunnelBrandingInput;
  notifyEmail: string | null;
}

export async function createFunnel(input: CreateFunnelInput) {
  return prisma.funnelConfig.create({
    data: {
      tenantId: input.tenantId,
      label: input.label.trim().slice(0, MAX_LABEL_LENGTH) || "Audit funnel",
      key: generateFunnelKey(),
      allowedOrigins: input.allowedOrigins,
      branding: input.branding as object,
      notifyEmail: input.notifyEmail,
    },
    select: FUNNEL_SELECT,
  });
}

/**
 * This tenant's funnels, newest first, each with its lead count.
 *
 * The count comes from Prisma's _count rather than a second query per row:
 * the per-funnel counter is the number the page leads with, and N+1 queries
 * behind a counter is how a list page gets slow without anyone noticing.
 */
export async function listFunnels(tenantId: string) {
  const rows = await prisma.funnelConfig.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { ...FUNNEL_SELECT, _count: { select: { leads: true } } },
  });
  return rows.map(({ _count, ...funnel }) => ({ ...funnel, leadCount: _count.leads }));
}

/** One funnel, or null if it is not this tenant's. */
export async function getFunnel(tenantId: string, id: string) {
  return prisma.funnelConfig.findFirst({
    where: { id, tenantId },
    select: FUNNEL_SELECT,
  });
}

export interface UpdateFunnelInput {
  label?: string;
  allowedOrigins?: string[];
  branding?: FunnelBrandingInput;
  notifyEmail?: string | null;
  active?: boolean;
}

/**
 * Patch a funnel. Returns null when it is not this tenant's.
 *
 * The ownership read happens FIRST and the update is then keyed on the id it
 * returned. updateMany({ where: { id, tenantId } }) would also be safe, but it
 * cannot return the updated row, and a PATCH that answers with the new state is
 * what keeps the client from re-fetching to find out what it just did.
 *
 * `key` is deliberately absent from UpdateFunnelInput. Rotating it would break
 * every live <script> tag pointing at it, and doing that silently through a
 * general-purpose patch is not something an agency should be able to do by
 * sending an extra field. Rotation, if it is ever wanted, is its own verb.
 */
export async function updateFunnel(tenantId: string, id: string, input: UpdateFunnelInput) {
  const existing = await prisma.funnelConfig.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.funnelConfig.update({
    where: { id: existing.id },
    data: {
      ...(input.label !== undefined
        ? { label: input.label.trim().slice(0, MAX_LABEL_LENGTH) || "Audit funnel" }
        : {}),
      ...(input.allowedOrigins !== undefined ? { allowedOrigins: input.allowedOrigins } : {}),
      ...(input.branding !== undefined ? { branding: input.branding as object } : {}),
      ...(input.notifyEmail !== undefined ? { notifyEmail: input.notifyEmail } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    select: FUNNEL_SELECT,
  });
}

/** Delete a funnel and, by cascade, its leads. False when not this tenant's. */
export async function deleteFunnel(tenantId: string, id: string): Promise<boolean> {
  const existing = await prisma.funnelConfig.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.funnelConfig.delete({ where: { id: existing.id } });
  return true;
}

// ─── The public path ────────────────────────────────────────────────────────

export interface FunnelContext {
  id: string;
  tenantId: string;
  allowedOrigins: string[];
  branding: unknown;
  notifyEmail: string | null;
  active: boolean;
  label: string;
  plan: PlanType;
  /** Tenant billing must be live for a funnel to run. See the route. */
  billingActive: boolean;
  /**
   * The OWNING TENANT's language, which is what the embedded widget renders in.
   *
   * The agency picks the language its own visitors read — it is the only party
   * in the exchange that knows. The visitor's Accept-Language is deliberately
   * not consulted; see the header of EMBED_AUDIT_COPY in i18n/dashboard.ts.
   */
  defaultLanguage: string;
}

/**
 * Resolve an embed key to everything the public audit route needs, in one query.
 *
 * The tenant's plan and billing status ride along because the quota check and
 * the gate both need them, and a funnel whose owner has churned must stop
 * running — otherwise a cancelled agency's widget keeps spending our sidecar
 * time on their prospects indefinitely.
 *
 * Returns null for an unknown key. The caller must not distinguish that from a
 * disallowed origin in what it tells the caller — see the route.
 */
export async function funnelByKey(key: string): Promise<FunnelContext | null> {
  const row = await prisma.funnelConfig.findUnique({
    where: { key },
    select: {
      id: true,
      tenantId: true,
      label: true,
      allowedOrigins: true,
      branding: true,
      notifyEmail: true,
      active: true,
      tenant: {
        select: { planType: true, billingStatus: true, defaultLanguage: true },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    label: row.label,
    allowedOrigins: row.allowedOrigins,
    branding: row.branding,
    notifyEmail: row.notifyEmail,
    active: row.active,
    plan: row.tenant.planType,
    billingActive:
      row.tenant.billingStatus === "ACTIVE" || row.tenant.billingStatus === "TRIALING",
    defaultLanguage: row.tenant.defaultLanguage,
  };
}

export interface RecordLeadInput {
  tenantId: string;
  funnelId: string;
  email: string;
  domain: string;
  /** Null when the audit failed after the email was captured. */
  summary: FunnelAuditSummary | null;
  ip: string | null;
}

/**
 * Write one captured lead.
 *
 * THROWS. Unlike the notification below it, this is not best-effort: the lead
 * is the entire product of the request, and a submission that returns a score
 * without having stored the email would silently lose the thing the agency is
 * paying for. The route lets the failure surface.
 */
export async function recordLead(input: RecordLeadInput) {
  return prisma.funnelLead.create({
    data: {
      tenantId: input.tenantId,
      funnelId: input.funnelId,
      email: input.email,
      domain: input.domain,
      score: input.summary?.score ?? null,
      summary: (input.summary as object | null) ?? undefined,
      ip: input.ip,
    },
    select: { id: true, createdAt: true },
  });
}

const LEAD_SELECT = {
  id: true,
  email: true,
  domain: true,
  score: true,
  createdAt: true,
} as const;

/**
 * One page of a funnel's leads, newest first.
 *
 * Cursor-paginated on id rather than offset: the table grows at the head while
 * somebody is reading it, and OFFSET would show them a row twice or skip one
 * every time a lead arrives mid-scroll.
 */
export async function listLeads(
  tenantId: string,
  funnelId: string,
  cursor?: string,
  limit = LEADS_PAGE_SIZE,
) {
  const owned = await prisma.funnelConfig.findFirst({
    where: { id: funnelId, tenantId },
    select: { id: true },
  });
  if (!owned) return null;

  const take = Math.min(Math.max(1, limit), LEADS_PAGE_SIZE);
  const rows = await prisma.funnelLead.findMany({
    where: { funnelId, tenantId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: LEAD_SELECT,
  });

  const items = rows.slice(0, take);
  return {
    items,
    nextCursor: rows.length > take ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/** Everything one funnel captured, capped. Feeds the CSV export. */
export async function leadsForExport(tenantId: string, funnelId: string) {
  const owned = await prisma.funnelConfig.findFirst({
    where: { id: funnelId, tenantId },
    select: { id: true, label: true },
  });
  if (!owned) return null;

  const rows = await prisma.funnelLead.findMany({
    where: { funnelId, tenantId },
    orderBy: { createdAt: "desc" },
    // One over the cap, so the caller can tell "exactly at the cap" from
    // "truncated" and say so in the file rather than cutting silently.
    take: LEADS_EXPORT_CAP + 1,
    select: LEAD_SELECT,
  });

  return {
    label: owned.label,
    rows: rows.slice(0, LEADS_EXPORT_CAP),
    truncated: rows.length > LEADS_EXPORT_CAP,
  };
}
