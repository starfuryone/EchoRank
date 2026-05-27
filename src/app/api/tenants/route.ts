import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";

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
