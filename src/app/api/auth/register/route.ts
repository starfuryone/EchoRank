import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getClientIp } from "@/lib/client-ip";
import { slugify } from "@/lib/tenant";
import { planQuotaDefaults } from "@/lib/plan-config";
import { planFromParam } from "@/lib/plan-routing";
import { validate, registerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeDomain } from "@/lib/onboarding";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import { addJob } from "@/infrastructure/queue/registry";
import type { OnboardingEmailStage } from "@/infrastructure/queue/jobs/schemas";
import type { PlanType } from "@/generated/prisma";

/** Onboarding drip schedule: stage → delay from signup. */
const ONBOARDING_DRIP_DELAYS: Record<OnboardingEmailStage, number> = {
  // D0 waits a few hours so the first audit exists when the recap renders.
  d0: 3 * 60 * 60 * 1000,
  d2: 2 * 24 * 60 * 60 * 1000,
  d5: 5 * 24 * 60 * 60 * 1000,
  d10: 10 * 24 * 60 * 60 * 1000,
};

/**
 * Plans a user may put themselves on at signup. Deliberately excludes the
 * reputation tiers: honoring ?plan=agency here would hand out a $349 plan to
 * anyone who edits the URL. Those keep landing on STARTER's trial, exactly as
 * before this parameter existed; upgrades go through /billing.
 */
const SELF_SERVE_PLANS: readonly PlanType[] = ["AI_VISIBILITY"];

function resolveSignupPlan(planParam: string | undefined): PlanType {
  const requested = planFromParam(planParam);
  return requested && SELF_SERVE_PLANS.includes(requested)
    ? requested
    : "STARTER";
}

export async function POST(request: Request) {
  try {
    // Throttle account/tenant creation per IP to prevent spam signups.
    const ip = getClientIp(request.headers);
    const limit = await rateLimit(`register-ip:${ip}`, 10, 3_600_000);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, email, password, businessName, plan, brand } = validate(
      registerSchema,
      body,
    );
    const planType = resolveSignupPlan(plan);
    const auditDomain = normalizeDomain(brand);
    // Emails are localized en/fr only; the dashboard collapses fr-CA → fr too.
    const requestLocale = await resolveRequestLocale();
    const defaultLanguage = requestLocale.startsWith("fr") ? "fr" : "en";

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const slug = slugify(businessName);

    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "A business with this name already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: businessName.trim(),
          slug,
          planType,
          auditDomain,
          defaultLanguage,
        },
      });

      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // Provision quota limits so the tenant is metered from day one, matching
      // whichever plan the signup resolved to.
      await tx.tenantQuota.create({
        data: {
          tenantId: tenant.id,
          ...planQuotaDefaults(planType),
        },
      });

      await tx.emailTemplate.createMany({
        data: [
          {
            tenantId: tenant.id,
            name: "Default Feedback Request",
            subject: "We'd love your feedback, {{customerName}}!",
            body: "Hi {{customerName}},\n\nThank you for choosing {{businessName}}. We'd love to hear about your experience.\n\nPlease take a moment to share your feedback:\n{{feedbackLink}}\n\nThank you!\n{{businessName}}",
            type: "feedback_request",
            isDefault: true,
          },
          {
            tenantId: tenant.id,
            name: "Default Review Request",
            subject: "Thank you for your feedback! Would you leave us a review?",
            body: "Hi {{customerName}},\n\nThank you for your wonderful feedback! We're glad you had a great experience.\n\nWould you mind sharing your experience on {{reviewPlatform}}?\n{{reviewLink}}\n\nThank you so much!\n{{businessName}}",
            type: "review_request",
            isDefault: true,
          },
        ],
      });

      // planType is echoed back so the client redirects on the plan the server
      // actually granted, not the one the URL asked for.
      return { userId: user.id, tenantId: tenant.id, planType };
    });

    // Onboarding drip: delayed jobs re-check tenant state (consent, progress)
    // before sending. Fixed jobIds make re-enqueues idempotent. Enqueue failure
    // must never fail the signup itself.
    try {
      await Promise.all(
        (Object.keys(ONBOARDING_DRIP_DELAYS) as OnboardingEmailStage[]).map(
          (stage) =>
            addJob(
              "onboarding-email",
              "drip",
              { tenantId: result.tenantId, correlationId: result.tenantId, stage },
              {
                jobId: `onboarding-${result.tenantId}-${stage}`,
                delay: ONBOARDING_DRIP_DELAYS[stage],
              },
            ),
        ),
      );
    } catch (err) {
      console.error("Failed to enqueue onboarding drip:", err);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof (error as Record<string, unknown>).statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: (error as Record<string, unknown>).statusCode as number },
      );
    }
    // The pre-checks above are racy; the DB unique constraints on user.email and
    // tenant.slug are the source of truth. Translate a constraint hit (P2002)
    // into a friendly 409 instead of a generic 500.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const target = String(
        (error as { meta?: { target?: unknown } }).meta?.target ?? "",
      );
      const message = target.includes("email")
        ? "An account with this email already exists"
        : "A business with this name already exists";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
