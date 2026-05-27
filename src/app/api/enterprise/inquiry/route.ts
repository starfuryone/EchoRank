import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, locations, message } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!company || typeof company !== "string" || company.trim().length === 0) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const locationCount = locations ? Number(locations) : undefined;

    // Store the inquiry in the audit log system.
    // In production, this would also send to a CRM (HubSpot, Salesforce)
    // and trigger an internal notification email.
    await prisma.auditLog.create({
      data: {
        tenantId: "system",
        action: "ENTERPRISE_INQUIRY",
        entity: "EnterpriseInquiry",
        details: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company: company.trim(),
          locations: locationCount,
          message: message?.trim() || null,
          submittedAt: new Date().toISOString(),
          source: "landing_page",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your interest. Our enterprise team will contact you within 24 hours.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
