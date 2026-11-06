import "server-only";

// src/lib/privacy/export.ts — "download my data" (/settings/account → GET /api/account/export).
//
// Every user gets what is theirs: profile, memberships, their assistant
// conversations, notifications read, consent records. An OWNER or ADMIN also
// gets the workspace's own records: the workspace, its customers and their
// feedback, review requests, email/SMS logs, monitored reviews, campaigns and
// the audit log. Secrets are never included (password hash, OAuth and API
// tokens, encrypted refresh tokens, Stripe ids beyond the customer id).
//
// The per-customer compliance export (/api/compliance/export) is separate: it
// is what an owner uses to answer THEIR customer's access request.

import { prisma } from "@/lib/prisma";

const CAP = 50_000; // rows per table; a larger workspace gets the first CAP and a note

export async function buildAccountExport(userId: string, tenantId: string, role: string) {
  const [user, memberships, conversations, reads, consents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, createdAt: true, termsAcceptedAt: true },
    }),
    prisma.tenantMember.findMany({
      where: { userId },
      select: { role: true, createdAt: true, tenant: { select: { id: true, name: true } } },
    }),
    prisma.assistantConversation.findMany({ where: { userId }, include: { messages: true }, take: CAP }),
    prisma.notificationRead.findMany({ where: { userId }, take: CAP }),
    prisma.consentEvent.findMany({ where: { userId }, take: CAP }),
  ]);

  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    format: "echorank-account-export/1",
    user,
    memberships,
    assistantConversations: conversations,
    notificationsRead: reads,
    consentRecords: consents,
  };

  if (role === "OWNER" || role === "ADMIN") {
    const where = { tenantId };
    const [tenant, customers, feedback, reviewRequests, emailLogs, smsLogs, reviews, campaigns, auditLog] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true, name: true, slug: true, supportEmail: true, googleReviewLink: true, facebookReviewLink: true,
          trustpilotLink: true, defaultLanguage: true, timezone: true, planType: true, billingStatus: true,
          auditDomain: true, signupCountry: true, stripeCustomerId: true, createdAt: true,
        },
      }),
      prisma.customer.findMany({ where, take: CAP }),
      prisma.feedback.findMany({ where: { customer: { tenantId } }, take: CAP }),
      prisma.reviewRequest.findMany({ where: { feedback: { customer: { tenantId } } }, take: CAP }),
      prisma.emailLog.findMany({ where, take: CAP }),
      prisma.smsLog.findMany({ where, take: CAP }),
      prisma.externalReview.findMany({ where, take: CAP }),
      prisma.campaign.findMany({ where, take: CAP }),
      prisma.auditLog.findMany({ where, take: CAP, orderBy: { createdAt: "desc" } }),
    ]);
    out.workspace = { tenant, customers, feedback, reviewRequests, emailLogs, smsLogs, monitoredReviews: reviews, campaigns, auditLog };
    out.note = `Tables are capped at ${CAP} rows each in this export; ask privacy@echorank360.com for a full copy.`;
  }
  return out;
}
