import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@echorank.io" },
    update: {},
    create: {
      email: "demo@echorank.io",
      name: "Demo User",
      passwordHash,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme-plumbing" },
    update: {},
    create: {
      name: "Acme Plumbing",
      slug: "acme-plumbing",
      supportEmail: "support@acmeplumbing.com",
      googleReviewLink: "https://g.page/r/acme-plumbing/review",
      planType: "GROWTH",
      monthlyRequestLimit: 2000,
      billingStatus: "ACTIVE",
    },
  });

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  await prisma.reviewLink.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        platform: "google",
        url: "https://g.page/r/acme-plumbing/review",
        label: "Google Reviews",
        isDefault: true,
      },
      {
        tenantId: tenant.id,
        platform: "facebook",
        url: "https://facebook.com/acmeplumbing/reviews",
        label: "Facebook Reviews",
      },
    ],
  });

  await prisma.emailTemplate.createMany({
    skipDuplicates: true,
    data: [
      {
        tenantId: tenant.id,
        name: "Feedback Request",
        subject: "How was your experience with {{business_name}}?",
        body: "Hi {{customer_name}},\n\nThank you for choosing {{business_name}}. We'd love to hear about your experience.\n\nPlease take 30 seconds to share your feedback:\n{{feedback_link}}\n\nYour honest feedback helps us improve.\n\nBest regards,\n{{business_name}}",
        type: "feedback_request",
        isDefault: true,
      },
      {
        tenantId: tenant.id,
        name: "Review Request",
        subject: "Glad you had a great experience!",
        body: "Hi {{customer_name}},\n\nThank you for your positive feedback! We're so glad you had a great experience with {{business_name}}.\n\nWould you mind sharing your honest review? It helps others find us:\n{{review_link}}\n\nThank you for your support!\n\nBest regards,\n{{business_name}}",
        type: "review_request",
        isDefault: true,
      },
      {
        tenantId: tenant.id,
        name: "Recovery Follow-up",
        subject: "We want to make it right",
        body: "Hi {{customer_name}},\n\nThank you for sharing your feedback with {{business_name}}. We're sorry your experience didn't meet expectations.\n\nWe take your concerns seriously and would like to make things right. A team member will be reaching out to you shortly.\n\nIf you'd like to reach us directly, please reply to this email or contact us at {{support_email}}.\n\nSincerely,\n{{business_name}}",
        type: "recovery",
        isDefault: true,
      },
    ],
  });

  const customers = await Promise.all(
    [
      { name: "Sarah Johnson", email: "sarah@example.com", phone: "+15551234567", location: "Downtown" },
      { name: "Mike Chen", email: "mike@example.com", phone: "+15552345678", location: "Downtown" },
      { name: "Emily Rodriguez", email: "emily@example.com", phone: "+15553456789", location: "Westside" },
      { name: "James Wilson", email: "james@example.com", phone: "+15554567890", location: "Eastside" },
      { name: "Lisa Park", email: "lisa@example.com", phone: "+15555678901", location: "Westside" },
    ].map((c) =>
      prisma.customer.create({
        data: { tenantId: tenant.id, ...c },
      })
    )
  );

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "May Customer Feedback",
      description: "Monthly feedback campaign for May 2026",
      channel: "EMAIL",
      status: "ACTIVE",
      startedAt: new Date(),
      totalSent: 5,
      totalResponses: 3,
    },
  });

  const feedbackData = [
    { customer: customers[0], rating: 5, comment: "Excellent service! Very professional and on time.", status: "SUBMITTED" as const },
    { customer: customers[1], rating: 4, comment: "Good work, would use again.", status: "SUBMITTED" as const },
    { customer: customers[2], rating: 2, comment: "Technician was late and the issue wasn't fully resolved.", status: "SUBMITTED" as const },
    { customer: customers[3], rating: 5, comment: "Best plumbing service I've ever used!", status: "SUBMITTED" as const },
    { customer: customers[4], rating: null, comment: null, status: "PENDING" as const },
  ];

  for (const fd of feedbackData) {
    const feedback = await prisma.feedback.create({
      data: {
        tenantId: tenant.id,
        customerId: fd.customer.id,
        campaignId: campaign.id,
        rating: fd.rating,
        comment: fd.comment,
        status: fd.status,
        token: randomBytes(32).toString("base64url"),
        submittedAt: fd.status === "SUBMITTED" ? new Date() : null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    if (fd.rating && fd.rating >= 4) {
      await prisma.reviewRequest.create({
        data: {
          feedbackId: feedback.id,
          platform: "google",
          url: "https://g.page/r/acme-plumbing/review",
        },
      });
      await prisma.customer.update({
        where: { id: fd.customer.id },
        data: { status: "SATISFIED" },
      });
    } else if (fd.rating && fd.rating <= 3) {
      await prisma.recoveryTicket.create({
        data: {
          tenantId: tenant.id,
          customerId: fd.customer.id,
          feedbackId: feedback.id,
          priority: fd.rating === 1 ? "URGENT" : fd.rating === 2 ? "HIGH" : "MEDIUM",
        },
      });
      await prisma.customer.update({
        where: { id: fd.customer.id },
        data: { status: "NEEDS_FOLLOWUP" },
      });
    }
  }

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planType: "GROWTH",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Seed data created successfully!");
  console.log("Login with: demo@echorank.io / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
