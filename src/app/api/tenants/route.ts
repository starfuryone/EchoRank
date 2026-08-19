import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole, slugify } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { planQuotaDefaults } from "@/lib/plan-config";

export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        brandPrimaryColor: true,
        brandSecondaryColor: true,
        supportEmail: true,
        googleReviewLink: true,
        facebookReviewLink: true,
        trustpilotLink: true,
        defaultLanguage: true,
        timezone: true,
        planType: true,
        billingStatus: true,
        whitelabel: true,
        customDomain: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ tenant, role: membership.role });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST — create an additional (client) workspace owned by the current user.
 * Used by the agency onboarding flow; the new tenant inherits the plan of the
 * tenant it is created from, so agency seats stay on the agency's tier.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireRole(["OWNER", "ADMIN"]);

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "A workspace name is required" },
        { status: 400 }
      );
    }

    // Auto-uniquify the slug: client names collide often ("Main Street Dental"),
    // and unlike signup there is no user-facing form to bounce back to.
    const base = slugify(name);
    let slug = base;
    for (let n = 2; n <= 20; n++) {
      const exists = await prisma.tenant.findUnique({ where: { slug } });
      if (!exists) break;
      slug = `${base}-${n}`;
    }

    const planType = membership.tenant.planType;
    // INHERITED ALONGSIDE planType, and for the same reason.
    //
    // Tenant.billingStatus now defaults to NONE ("registered, never
    // subscribed"), and a NONE tenant is redirected to /pricing by the billing
    // gate. Taking that default here would mean an ACTIVE agency creating a
    // client workspace and finding it immediately bounced to a page selling it
    // a plan it is already paying for. The workspace is not a new customer —
    // it is a seat on the parent's existing subscription, which is exactly the
    // argument planType has always made.
    const billingStatus = membership.tenant.billingStatus;

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name,
          slug,
          planType,
          billingStatus,
          defaultLanguage: membership.tenant.defaultLanguage,
        },
      });
      await tx.tenantMember.create({
        data: { tenantId: created.id, userId: membership.userId, role: "OWNER" },
      });
      await tx.tenantQuota.create({
        data: { tenantId: created.id, ...planQuotaDefaults(planType) },
      });
      return created;
    });

    await createAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: { name, slug, planType },
    });

    return NextResponse.json(
      { tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message === "Insufficient permissions"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A workspace with this name already exists" },
        { status: 409 }
      );
    }
    console.error("Error creating tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const membership = await requireRole(["OWNER", "ADMIN"]);
    const tenantId = membership.tenantId;

    const body = await request.json();
    const {
      name,
      logo,
      brandPrimaryColor,
      brandSecondaryColor,
      supportEmail,
      googleReviewLink,
      facebookReviewLink,
      trustpilotLink,
      defaultLanguage,
      timezone,
      whitelabel,
      customDomain,
    } = body;

    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    if (
      supportEmail !== undefined &&
      supportEmail !== null &&
      typeof supportEmail === "string" &&
      supportEmail.length > 0 &&
      !supportEmail.includes("@")
    ) {
      return NextResponse.json(
        { error: "Invalid support email address" },
        { status: 400 }
      );
    }

    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (
      brandPrimaryColor !== undefined &&
      typeof brandPrimaryColor === "string" &&
      !colorRegex.test(brandPrimaryColor)
    ) {
      return NextResponse.json(
        { error: "Invalid primary color. Must be a valid hex color (e.g., #2563eb)" },
        { status: 400 }
      );
    }

    if (
      brandSecondaryColor !== undefined &&
      typeof brandSecondaryColor === "string" &&
      !colorRegex.test(brandSecondaryColor)
    ) {
      return NextResponse.json(
        { error: "Invalid secondary color. Must be a valid hex color (e.g., #1e40af)" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (logo !== undefined) updateData.logo = logo || null;
    if (brandPrimaryColor !== undefined)
      updateData.brandPrimaryColor = brandPrimaryColor;
    if (brandSecondaryColor !== undefined)
      updateData.brandSecondaryColor = brandSecondaryColor;
    if (supportEmail !== undefined)
      updateData.supportEmail = supportEmail?.trim() || null;
    if (googleReviewLink !== undefined)
      updateData.googleReviewLink = googleReviewLink?.trim() || null;
    if (facebookReviewLink !== undefined)
      updateData.facebookReviewLink = facebookReviewLink?.trim() || null;
    if (trustpilotLink !== undefined)
      updateData.trustpilotLink = trustpilotLink?.trim() || null;
    if (defaultLanguage !== undefined)
      updateData.defaultLanguage = defaultLanguage;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (whitelabel !== undefined) updateData.whitelabel = whitelabel;
    if (customDomain !== undefined)
      updateData.customDomain = customDomain?.trim() || null;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: updateData,
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message === "Insufficient permissions"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
