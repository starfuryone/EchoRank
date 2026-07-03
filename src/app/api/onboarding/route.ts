import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const [tenant, customers, feedback, reviewLinks, members] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { welcomeSeenAt: true, onboardingDismissedAt: true },
      }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.feedback.count({ where: { tenantId } }),
      prisma.reviewLink.count({ where: { tenantId } }),
      prisma.tenantMember.count({ where: { tenantId } }),
    ]);

    const steps = [
      { key: "customer", label: "Add your first customer", href: "/customers", done: customers > 0, optional: false },
      { key: "feedback", label: "Send a feedback request", href: "/feedback", done: feedback > 0, optional: false },
      { key: "reviewLink", label: "Set up a review link", href: "/review-links", done: reviewLinks > 0, optional: false },
      { key: "visibility", label: "Run your AI Visibility audit", href: "/visibility", done: false, optional: false },
      { key: "team", label: "Invite a teammate", href: "/team", done: members > 1, optional: true },
    ];

    const required = steps.filter((s) => !s.optional);
    const completedCount = required.filter((s) => s.done).length;

    return NextResponse.json({
      steps,
      completedCount,
      totalCount: required.length,
      allComplete: completedCount === required.length,
      welcomeSeen: Boolean(tenant?.welcomeSeenAt),
      dismissed: Boolean(tenant?.onboardingDismissedAt),
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
