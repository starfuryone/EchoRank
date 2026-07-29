import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import type { PlanType, Prisma } from "@/generated/prisma";

/** Checklist shows until all steps are done, capped at 6 months of tenant age. */
export const ONBOARDING_WINDOW_DAYS = 180;

export type OnboardingIntent = "business" | "agency";

/** Timestamps for actions that have no backing table of their own. */
export interface OnboardingJson {
  pdfDownloadedAt?: string;
  roadmapViewedAt?: string;
  firstAuditScore?: number;
  firstAuditAt?: string;
  profileCompletedAt?: string;
}

export type OnboardingStepKey =
  | "first_audit"
  | "download_pdf"
  | "review_link"
  | "add_prompts"
  | "explore_roadmap"
  | "connect_source"
  | "second_audit"
  | "add_client"
  | "invite_teammate";

export interface OnboardingStep {
  key: OnboardingStepKey;
  href: string;
  done: boolean;
}

export interface OnboardingCounts {
  audits: number;
  reviewLinks: number;
  prompts: number;
  monitoringSources: number;
  importJobs: number;
  tenantMembers: number;
  /** Memberships the OWNER user holds across all tenants (agency client detection). */
  userMemberships: number;
}

/** Strip protocol/path/port from user input and keep a bare lowercase host. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // protocol
  value = value.split(/[/?#]/)[0]; // path, query, fragment
  value = value.split("@").pop() ?? value; // userinfo
  value = value.split(":")[0]; // port
  value = value.replace(/^www\./, "");
  if (!value || value.length > 253) return null;
  return value;
}

/**
 * The five onboarding steps, tailored by plan capabilities and stated intent.
 * Substitutions: STARTER cannot reach the PDF report (feature-gated), so it
 * gets the review-link step; the AI_VISIBILITY plan cannot reach /monitoring
 * or /imports (path-confined), so it gets a second-audit step instead.
 */
export function buildOnboardingSteps(input: {
  plan: PlanType;
  intent: OnboardingIntent | null;
  json: OnboardingJson;
  counts: OnboardingCounts;
}): OnboardingStep[] {
  const { plan, intent, json, counts } = input;
  const steps: OnboardingStep[] = [];

  steps.push({ key: "first_audit", href: "/visibility", done: counts.audits > 0 });

  if (hasFeature(plan, "ai_visibility")) {
    steps.push({
      key: "download_pdf",
      href: "/visibility",
      done: Boolean(json.pdfDownloadedAt),
    });
  } else {
    steps.push({
      key: "review_link",
      href: "/review-links",
      done: counts.reviewLinks > 0,
    });
  }

  if (hasFeature(plan, "answer_tracking")) {
    steps.push({
      key: "add_prompts",
      href: "/visibility/tools/custom-prompts",
      done: counts.prompts >= 3,
    });
  } else {
    steps.push({
      key: "explore_roadmap",
      href: "/visibility#fixes",
      done: Boolean(json.roadmapViewedAt),
    });
  }

  if (plan === "AI_VISIBILITY") {
    steps.push({ key: "second_audit", href: "/visibility", done: counts.audits >= 2 });
  } else {
    steps.push({
      key: "connect_source",
      href: "/monitoring",
      done: counts.monitoringSources > 0 || counts.importJobs > 0,
    });
  }

  if (intent === "agency") {
    steps.push({
      key: "add_client",
      href: "#add-client",
      done: counts.userMemberships > 1,
    });
  } else {
    steps.push({ key: "invite_teammate", href: "/team", done: counts.tenantMembers > 1 });
  }

  return steps;
}

export interface OnboardingSnapshot {
  tenant: {
    id: string;
    createdAt: Date;
    planType: PlanType;
    onboardingIntent: string | null;
    auditDomain: string | null;
    welcomeSeenAt: Date | null;
    onboardingDismissedAt: Date | null;
    onboarding: OnboardingJson;
    marketingConsent: boolean;
    defaultLanguage: string;
    name: string;
    billingStatus: string;
  } | null;
  steps: OnboardingStep[];
  completedCount: number;
  hidden: boolean;
}

/**
 * Loads the full checklist state for a tenant. `ownerUserId` scopes the
 * agency "memberships across tenants" count; pass the OWNER's user id.
 */
export async function getOnboardingSnapshot(
  tenantId: string,
  ownerUserId: string,
): Promise<OnboardingSnapshot> {
  const [
    tenant,
    audits,
    reviewLinks,
    prompts,
    monitoringSources,
    importJobs,
    tenantMembers,
    userMemberships,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        createdAt: true,
        planType: true,
        onboardingIntent: true,
        auditDomain: true,
        welcomeSeenAt: true,
        onboardingDismissedAt: true,
        onboarding: true,
        marketingConsent: true,
        defaultLanguage: true,
        name: true,
        billingStatus: true,
      },
    }),
    prisma.visibilityAudit.count({ where: { tenantId } }),
    prisma.reviewLink.count({ where: { tenantId } }),
    prisma.trackedPrompt.count({ where: { tenantId } }),
    prisma.monitoringSource.count({ where: { tenantId } }),
    prisma.importJob.count({ where: { tenantId } }),
    prisma.tenantMember.count({ where: { tenantId } }),
    prisma.tenantMember.count({ where: { userId: ownerUserId } }),
  ]);

  if (!tenant) {
    return { tenant: null, steps: [], completedCount: 0, hidden: true };
  }

  const json = (tenant.onboarding ?? {}) as OnboardingJson;
  const intent =
    tenant.onboardingIntent === "business" || tenant.onboardingIntent === "agency"
      ? tenant.onboardingIntent
      : null;

  const steps = buildOnboardingSteps({
    plan: tenant.planType,
    intent,
    json,
    counts: {
      audits,
      reviewLinks,
      prompts,
      monitoringSources,
      importJobs,
      tenantMembers,
      userMemberships,
    },
  });

  const allDone = steps.every((s) => s.done);
  const ageMs = Date.now() - tenant.createdAt.getTime();
  const tooOld = ageMs > ONBOARDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // Tenants that were already auditing before this feature shipped have no
  // onboarding JSON — never resurface the checklist for them.
  const preExisting = tenant.onboarding == null && audits > 0;
  const hidden = allDone || tooOld || preExisting;

  return {
    tenant: { ...tenant, onboarding: json },
    steps,
    completedCount: steps.filter((s) => s.done).length,
    hidden,
  };
}

/**
 * Merges a patch into the tenant's onboarding JSON. Best-effort: callers on
 * hot paths (PDF streaming) attach `.catch()` — a failed marker must never
 * break the request it rides on.
 */
export async function mergeOnboardingJson(
  tenantId: string,
  patch: Partial<OnboardingJson>,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { onboarding: true },
  });
  if (!tenant) return;
  const current = (tenant.onboarding ?? {}) as OnboardingJson;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { onboarding: { ...current, ...patch } as Prisma.InputJsonValue },
  });
}

/** Records a step that has no backing table (PDF download, roadmap view). */
export async function markOnboardingStep(
  tenantId: string,
  step: "pdf_downloaded" | "roadmap_viewed",
): Promise<void> {
  const field = step === "pdf_downloaded" ? "pdfDownloadedAt" : "roadmapViewedAt";
  await mergeOnboardingJson(tenantId, { [field]: new Date().toISOString() });
}
