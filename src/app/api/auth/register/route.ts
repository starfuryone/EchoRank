import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/tenant";
import { planQuotaDefaults } from "@/lib/plan-config";
import { planFromParam } from "@/lib/plan-routing";
import { validate, registerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import type { PlanType } from "@/generated/prisma";

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
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const limit = await rateLimit(`register-ip:${ip}`, 10, 3_600_000);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, email, password, businessName, plan } = validate(
      registerSchema,
      body,
    );
    const planType = resolveSignupPlan(plan);

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

    const passwordHash = await bcrypt.hash(password, 10);

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
