import { prisma } from "@/lib/prisma";
import { getOnboardingSnapshot } from "@/lib/onboarding";
import { SITE_URL } from "@/lib/seo/constants";
// planConfig(), not PLAN_CONFIGS[...]: the map is keyed by SellablePlanType and
// a tenant can still carry the retired AI_VISIBILITY tier, which the helper
// folds to STARTER.
import { planConfig } from "@/lib/plan-config";
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
  // ── THE d10 GATE, WHICH THE MOVE TO DAY SIX FINALLY MAKES TRUE ────────────
  //
  // This stage is sent only to a tenant actually mid-trial, because it is a
  // pre-conversion mail: it recaps what they built while deciding. A
  // never-subscribed tenant (BillingStatus.NONE) is `!== "TRIALING"` and is
  // correctly skipped — there is no conversion coming to recap for.
  //
  // AT TEN DAYS THIS GATE SKIPPED ALMOST EVERYONE IT WAS MEANT FOR. TRIAL_DAYS
  // is 7, so a tenant who checked out at signup had converted on day 7: Stripe
  // sent customer.subscription.updated with status=active, which maps to ACTIVE,
  // and by day 10 they were `!== "TRIALING"`. The only survivors were late
  // checkouts whose trial had not yet run out. The stage now fires on day six
  // (see ONBOARDING_DRIP_DELAYS), inside the trial, so the tenants this gate
  // admits are the ones it was always describing.
  //
  // The gate still earns its place at six days: a tenant who cancelled during
  // the trial, or whose card failed, is no longer TRIALING and should not be
  // told what is about to start.
  //
  // The `not_trialing` reason covers "never subscribed", "already converted" and
  // "lapsed" alike; it is a log string, and the distinction has no consequence
  // for the decision made here.
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
    // hasDoneCount guards the PAIR, per this module's own rule that every
    // numeric rides with a has* boolean. It is `totalCount > 0`, not
    // `doneCount > 0`: zero completed steps is a real and common state that the
    // template should still be able to render ("0 of 5"), whereas zero TOTAL
    // steps means the checklist produced nothing and "0 of 0" is not a sentence
    // worth sending.
    params.hasDoneCount = snapshot.steps.length > 0;
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

  // ── d10: A PRE-CONVERSION VALUE RECAP, NOT A DEADLINE ─────────────────────
  //
  // IT DELIBERATELY CARRIES NO DATE. This stage used to send hasTrialEnd and
  // trialEndDate, which made it a second "your trial ends on <date>" notice —
  // and there is already one that owns that job properly: the 24h trial-ending
  // notice, scheduled from the subscription's real trial_end
  // (src/lib/billing/trial-notice.ts). Two mails counting down to the same
  // moment is worse than one, and this one counted from the wrong clock: its
  // date came from currentPeriodEnd, which stops meaning "trial end" the moment
  // the trial converts.
  //
  // Dropping the date is what makes the two complementary rather than
  // duplicate, now that both land on day six of a seven-day trial:
  //
  //   trial notice -> the deadline. "Your card is charged tomorrow."
  //   d10          -> the value.    "Here is what you have built with it."
  //
  // So this block answers only "what have they got out of it so far", from the
  // same checklist the dashboard shows, plus the plan that is about to start.
  // Nothing here asserts WHEN anything happens — the moment a date appears in
  // this payload, the two mails are competing again.
  if (stage === "d10") {
    // See the d2 block for why this guards on totalCount rather than doneCount.
    // Without it the recap block in the Brevo template has nothing to test and
    // silently renders its fallback — which, for the mail whose entire purpose
    // is the recap, means sending the one sentence that omits it.
    params.hasDoneCount = snapshot.steps.length > 0;
    params.doneCount = snapshot.completedCount;
    params.totalCount = snapshot.steps.length;
    // Named, not dated: "your Growth plan" rather than "on 27 August". The
    // deadline belongs to the other mail.
    params.planName = planConfig(tenant.planType).name;
    params.billingUrl = `${SITE_URL}/billing`;
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
