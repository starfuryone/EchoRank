import { prisma } from "@/lib/prisma";
import { getOnboardingSnapshot } from "@/lib/onboarding";
import { SITE_URL } from "@/lib/seo/constants";
import { logger } from "@/infrastructure/observability/logger";
import type { OnboardingEmailStage } from "@/infrastructure/queue/jobs/schemas";

/**
 * Onboarding drip sender. Emails are Brevo transactional templates referenced
 * by ID from env (single-language in Brevo, so one ID per stage per locale):
 *   BREVO_ONBOARDING_{D0|D2|D5|D10}_{EN|FR}_ID
 * All dynamic values are passed as template params; numeric params always ride
 * with a has* boolean so templates can fall back instead of inventing numbers.
 */

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

type EmailLocale = "en" | "fr";

export type OnboardingSendOutcome =
  | { status: "sent" }
  | { status: "dry_run"; payload: Record<string, unknown> }
  | { status: "skipped"; reason: string };

interface AuditCheck {
  category?: string;
  points?: number;
  max?: number;
  status?: string;
  recommendation?: string;
}

/** Short next-action labels for the D2 nudge, localized here since Brevo
 * templates can't translate arbitrary step keys. */
const STEP_LABELS: Record<EmailLocale, Record<string, string>> = {
  en: {
    first_audit: "Run your first AI Visibility audit",
    download_pdf: "Download your PDF report",
    review_link: "Set up a review link",
    add_prompts: "Add 3 tracked prompts",
    explore_roadmap: "Explore your fix roadmap",
    connect_source: "Connect a review source",
    second_audit: "Run a follow-up audit",
    add_client: "Add your first client workspace",
    invite_teammate: "Invite a teammate",
  },
  fr: {
    first_audit: "Lancez votre première analyse de visibilité IA",
    download_pdf: "Téléchargez votre rapport PDF",
    review_link: "Configurez un lien d'avis",
    add_prompts: "Ajoutez 3 requêtes suivies",
    explore_roadmap: "Explorez votre plan de correctifs",
    connect_source: "Connectez une source d'avis",
    second_audit: "Lancez une analyse de suivi",
    add_client: "Ajoutez votre premier espace client",
    invite_teammate: "Invitez un membre de l'équipe",
  },
};

function templateIdFor(stage: OnboardingEmailStage, locale: EmailLocale): number | null {
  const key = `BREVO_ONBOARDING_${stage.toUpperCase()}_${locale.toUpperCase()}_ID`;
  const raw = process.env[key];
  const id = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

/** Weakest scored check with a recommendation = the #1 fix to surface. */
function topFix(checks: AuditCheck[]): { title: string; action: string } | null {
  const scored = checks.filter(
    (c) => typeof c.points === "number" && typeof c.max === "number" && c.max! > 0,
  );
  scored.sort((a, b) => a.points! / a.max! - b.points! / b.max!);
  const weakest = scored.find((c) => c.recommendation && c.points! < c.max!);
  if (!weakest) return null;
  return { title: weakest.category ?? "Fix", action: weakest.recommendation! };
}

export async function sendOnboardingEmail(
  tenantId: string,
  stage: OnboardingEmailStage,
): Promise<OnboardingSendOutcome> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      members: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      subscription: { select: { currentPeriodEnd: true } },
    },
  });

  if (!tenant) return { status: "skipped", reason: "tenant_deleted" };
  if (!tenant.marketingConsent) return { status: "skipped", reason: "unsubscribed" };

  const owner = tenant.members[0]?.user;
  if (!owner?.email) return { status: "skipped", reason: "no_owner_email" };

  const locale: EmailLocale = tenant.defaultLanguage?.startsWith("fr") ? "fr" : "en";

  // Re-check state at send time — the checklist may have moved since signup.
  const snapshot = await getOnboardingSnapshot(tenantId, owner.id);
  if (stage === "d2" && snapshot.completedCount >= 2) {
    return { status: "skipped", reason: "already_active" };
  }
  if (stage === "d10" && tenant.billingStatus !== "TRIALING") {
    return { status: "skipped", reason: "not_trialing" };
  }

  const latestAudit = await prisma.visibilityAudit.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { score: true, grade: true, checks: true },
  });
  const fix = latestAudit ? topFix((latestAudit.checks ?? []) as AuditCheck[]) : null;

  const params: Record<string, unknown> = {
    firstName: (owner.name ?? "").split(" ")[0] || owner.email.split("@")[0],
    brand: tenant.name,
    hasScore: Boolean(latestAudit),
    score: latestAudit?.score ?? null,
    grade: latestAudit?.grade ?? null,
    topFixTitle: fix?.title ?? null,
    topFixAction: fix?.action ?? null,
    visibilityUrl: `${SITE_URL}/visibility`,
    dashboardUrl: `${SITE_URL}/dashboard`,
  };

  if (stage === "d2") {
    const next = snapshot.steps.find((s) => !s.done);
    params.doneCount = snapshot.completedCount;
    params.totalCount = snapshot.steps.length;
    params.nextStepLabel = next ? STEP_LABELS[locale][next.key] ?? next.key : null;
    params.nextStepUrl = next?.href?.startsWith("/")
      ? `${SITE_URL}${next.href}`
      : `${SITE_URL}/dashboard`;
  }

  if (stage === "d5") {
    const runs = await prisma.promptRun.findMany({
      where: {
        tenantId,
        error: null,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { competitors: true },
    });
    const names = new Set<string>();
    for (const run of runs) {
      for (const c of (run.competitors ?? []) as { name?: string; mentioned?: boolean }[]) {
        if (c?.name && c.mentioned) names.add(c.name);
        if (names.size >= 3) break;
      }
      if (names.size >= 3) break;
    }
    const isGrowthPlus = ["GROWTH", "AGENCY", "ENTERPRISE"].includes(tenant.planType);
    params.hasCompetitors = names.size > 0;
    params.competitorNames = Array.from(names).join(", ");
    params.isGrowthPlus = isGrowthPlus;
    params.ctaUrl = isGrowthPlus
      ? `${SITE_URL}/intelligence/competitors`
      : `${SITE_URL}/billing`;
  }

  if (stage === "d10") {
    const trialEnd = tenant.subscription?.currentPeriodEnd ?? null;
    params.hasTrialEnd = Boolean(trialEnd);
    params.trialEndDate = trialEnd
      ? trialEnd.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  }

  const templateId = templateIdFor(stage, locale);
  const apiKey = process.env.BREVO_API_KEY;
  const payload = {
    templateId,
    to: [{ email: owner.email, name: owner.name ?? undefined }],
    params,
  };

  const dryRun =
    process.env.ONBOARDING_EMAIL_DRY_RUN === "1" ||
    process.env.NODE_ENV !== "production";
  if (dryRun) {
    logger.info(
      { tenantId, stage, locale, payload, queue: "onboarding-email" },
      "DRY RUN: onboarding email logged instead of sent",
    );
    return { status: "dry_run", payload };
  }

  if (!apiKey) {
    logger.warn(
      { tenantId, stage, queue: "onboarding-email" },
      "BREVO_API_KEY not set — onboarding email skipped",
    );
    return { status: "skipped", reason: "no_api_key" };
  }
  if (!templateId) {
    logger.warn(
      { tenantId, stage, locale, queue: "onboarding-email" },
      "Brevo template ID env missing — onboarding email skipped",
    );
    return { status: "skipped", reason: "no_template_id" };
  }

  const res = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Throwing lets BullMQ retry with backoff.
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  return { status: "sent" };
}
