import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/tenant";
import { validate, registerSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, businessName } = validate(
      registerSchema,
      body,
    );

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
        },
      });

      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER",
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

      return { userId: user.id, tenantId: tenant.id };
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
