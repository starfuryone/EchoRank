import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import {
  getOnboardingSnapshot,
  markOnboardingStep,
  mergeOnboardingJson,
  normalizeDomain,
} from "@/lib/onboarding";

export async function GET() {
  try {
    const membership = await requireTenant();
    const snapshot = await getOnboardingSnapshot(
      membership.tenantId,
      membership.userId,
    );
    if (!snapshot.tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { tenant, steps, completedCount, hidden } = snapshot;
    const dismissed = Boolean(tenant.onboardingDismissedAt);
    const intent =
      tenant.onboardingIntent === "business" || tenant.onboardingIntent === "agency"
        ? tenant.onboardingIntent
        : null;

    return NextResponse.json({
      steps,
      completedCount,
      totalCount: steps.length,
      allComplete: completedCount === steps.length,
      welcomeSeen: Boolean(tenant.welcomeSeenAt),
      dismissed,
      intent,
      domain: tenant.auditDomain,
      hidden,
      needsProfile: intent === null && !dismissed && !hidden,
      firstAudit: {
        pending: Boolean(tenant.auditDomain) && !steps[0]?.done,
        score: tenant.onboarding.firstAuditScore ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error loading onboarding state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const body = await request.json();
    const action = body?.action;

    if (action === "welcome_seen") {
      await prisma.tenant.update({ where: { id: tenantId }, data: { welcomeSeenAt: new Date() } });
    } else if (action === "dismiss") {
      await prisma.tenant.update({ where: { id: tenantId }, data: { onboardingDismissedAt: new Date() } });
    } else if (action === "profile") {
      const intent = body?.intent;
      if (intent !== "business" && intent !== "agency") {
        return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
      }
      const domain =
        typeof body?.domain === "string" ? normalizeDomain(body.domain) : null;
      const current = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { auditDomain: true },
      });
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          onboardingIntent: intent,
          welcomeSeenAt: new Date(),
          // The domain carried over from the landing audit wins; the modal
          // only fills the gap.
          ...(domain && !current?.auditDomain ? { auditDomain: domain } : {}),
        },
      });
      await mergeOnboardingJson(tenantId, {
        profileCompletedAt: new Date().toISOString(),
      });
    } else if (action === "step_complete") {
      const step = body?.step;
      if (step !== "pdf_downloaded" && step !== "roadmap_viewed") {
        return NextResponse.json({ error: "Unknown step" }, { status: 400 });
      }
      await markOnboardingStep(tenantId, step);
    } else if (action === "first_audit_done") {
      const score = Number(body?.score);
      await mergeOnboardingJson(tenantId, {
        firstAuditAt: new Date().toISOString(),
        ...(Number.isFinite(score) ? { firstAuditScore: score } : {}),
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating onboarding state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
