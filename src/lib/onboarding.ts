import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { hasPaidPlan } from "@/lib/paid-plan";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { healthOf } from "@/lib/site-crawler/site-health";
import { effectiveCaps, tenantOverrides } from "@/lib/site-crawler/tenant-caps";
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
  | "crawl_site"
  | "download_pdf"
  | "review_link"
  | "add_prompts"
  | "explore_roadmap"
  | "connect_source"
  | "second_audit"
  | "add_client"
  | "invite_teammate";

/**
 * The crawler step's state (crawl_site only), for the card's three faces:
 * start (or See plans), "Crawling…" with the live count, and the done line.
 */
export interface OnboardingCrawl {
  /** The tenant may start a crawl: a paid plan or a real trial (hasPaidPlan, the
   * same gate /crawler uses) on a tier whose URL cap is above 0. False → See plans. */
  canCrawl: boolean;
  /** The rule count as marketing prints it (ruleCountLabel: "340+"), never typed. */
  rules: string;
  /** The latest COMPLETED crawl; present = the step is done. */
  latest: { id: string; pages: number; health: number | null } | null;
  /** A crawl in flight (QUEUED / RUNNING), polled by the card for its count. */
  running: { id: string; pages: number; cap: number } | null;
}

export interface OnboardingStep {
  key: OnboardingStepKey;
  href: string;
  done: boolean;
  /** crawl_site only. */
  crawl?: OnboardingCrawl;
}

/** /crawler with the tenant's domain in the URL field (?url=), or bare. */
export function crawlerStartHref(domain: string | null | undefined): string {
  const d = normalizeDomain(domain);
  return d ? `/crawler?url=${encodeURIComponent(d)}` : "/crawler";
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
 * The six onboarding steps, tailored by plan capabilities and stated intent.
 * The crawler step sits right after the AI Visibility audit, so the two
 * engines read together; it shows on every plan, and a tier that cannot crawl
 * is sent to /pricing instead of /crawler.
 * Substitutions are feature-driven: a tier without `ai_visibility` gets the
 * review-link step instead of the PDF one, and one without `answer_tracking`
 * gets the roadmap step instead of prompts. Every current tier carries both,
 * so the substitutions are dormant — they stay because packaging changes.
 */
export function buildOnboardingSteps(input: {
  plan: PlanType;
  intent: OnboardingIntent | null;
  json: OnboardingJson;
  counts: OnboardingCounts;
  crawl: OnboardingCrawl;
  /** Tenant.auditDomain: pre-fills the crawler's URL field. */
  domain: string | null;
}): OnboardingStep[] {
  const { plan, intent, json, counts, crawl, domain } = input;
  const steps: OnboardingStep[] = [];

  steps.push({ key: "first_audit", href: "/visibility", done: counts.audits > 0 });

  steps.push({
    key: "crawl_site",
    href: crawl.latest
      ? `/crawler/${crawl.latest.id}`
      : crawl.running
        ? `/crawler/${crawl.running.id}`
        : crawl.canCrawl
          ? crawlerStartHref(domain)
          : "/pricing",
    done: crawl.latest !== null,
    crawl,
  });

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

  // Every tier reaches /monitoring and /imports now that no tier is confined
  // to a route subset, so the second-audit substitution is gone.
  steps.push({
    key: "connect_source",
    href: "/monitoring",
    done: counts.monitoringSources > 0 || counts.importJobs > 0,
  });

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
    latestCrawl,
    runningCrawl,
    paid,
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
    prisma.crawlJob.findFirst({
      where: { tenantId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, pagesCrawled: true, summary: true },
    }),
    prisma.crawlJob.findFirst({
      where: { tenantId, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, pagesCrawled: true, urlCap: true },
    }),
    hasPaidPlan(tenantId),
  ]);

  if (!tenant) {
    return { tenant: null, steps: [], completedCount: 0, hidden: true };
  }

  const json = (tenant.onboarding ?? {}) as OnboardingJson;
  const intent =
    tenant.onboardingIntent === "business" || tenant.onboardingIntent === "agency"
      ? tenant.onboardingIntent
      : null;

  // The crawler's own two gates: paid (or a real trial), and a tier URL cap
  // above 0 after staff overrides. Only read when the first one passes.
  const canCrawl =
    paid && effectiveCaps(tenant.planType, await tenantOverrides(tenantId)).urlCap > 0;

  const steps = buildOnboardingSteps({
    plan: tenant.planType,
    intent,
    json,
    domain: tenant.auditDomain,
    crawl: {
      canCrawl,
      rules: ruleCountLabel(),
      latest: latestCrawl
        ? { id: latestCrawl.id, pages: latestCrawl.pagesCrawled, health: healthOf(latestCrawl.summary) }
        : null,
      running: runningCrawl
        ? { id: runningCrawl.id, pages: runningCrawl.pagesCrawled, cap: runningCrawl.urlCap }
        : null,
    },
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
