/**
 * seed-templates.ts — EchoRank360 default templates seeder
 * Idempotent: matches on (tenantId, name); updates if exists, creates if not.
 * Run: npx tsx scripts/seed-templates.ts [tenantId]
 */

import { prisma } from "../src/lib/prisma";


const EMAIL_TEMPLATES: Array<{ name: string; subject: string; body: string; type: string }> = [
  {
    name: "Initial Review Request",
    type: "REVIEW_REQUEST",
    subject: "How was your experience with {{business_name}}?",
    body: `Hi {{customer_name}},

Thanks for choosing {{business_name}}. We'd love to hear how it went.

If you have 60 seconds, sharing a quick review on Google helps other people find us — and helps us know what we're doing right.

Leave a Google Review: {{google_review_link}}

If there's anything you'd like us to know directly, you can also send us a private note and we'll follow up personally:

Send private feedback: {{feedback_link}}

Thanks again,
The {{business_name}} Team

Unsubscribe: {{unsubscribe_link}}`,
  },
  {
    name: "Private Pulse Check",
    type: "PULSE_CHECK",
    subject: "Quick check-in from {{business_name}}",
    body: `Hi {{customer_name}},

Just checking in after your recent visit to {{location_name}}. Did everything go the way you expected?

If anything was off, reply to this email or use the link below — a real person reads every message and we'll make it right:

Tell us how we did: {{feedback_link}}

And if you're happy with your experience, you're always welcome to share it publicly:

Leave a Google Review: {{google_review_link}}

Thanks for your time,
{{business_name}}

Unsubscribe: {{unsubscribe_link}}`,
  },
  {
    name: "Friendly Reminder",
    type: "REMINDER",
    subject: "Still have 60 seconds for {{business_name}}?",
    body: `Hi {{customer_name}},

We reached out a few days ago and don't want to nag — this is the only reminder we'll send.

Reviews from real customers like you are the single biggest factor in how local businesses get found. If you can spare a minute, it genuinely makes a difference:

Leave a Google Review: {{google_review_link}}

Prefer to share something with us privately instead? That works too: {{feedback_link}}

Either way, thank you for your business.

{{business_name}}

Unsubscribe: {{unsubscribe_link}}`,
  },
  {
    name: "Thank You - Review Received",
    type: "THANK_YOU",
    subject: "Thank you, {{customer_name}}",
    body: `Hi {{customer_name}},

We saw your review — thank you for taking the time. Feedback like yours is read by the whole team and it genuinely matters to us.

If you ever need anything, just reply to this email and we'll take care of you.

With appreciation,
The {{business_name}} Team

Unsubscribe: {{unsubscribe_link}}`,
  },
  {
    name: "Service Recovery Follow-Up",
    type: "RECOVERY_FOLLOWUP",
    subject: "Following up on your feedback",
    body: `Hi {{customer_name}},

Thanks again for letting us know about your recent experience — and for giving us the chance to put it right.

We hope the resolution worked for you. If anything is still unresolved, reply to this email and it goes straight to the team.

If you feel we've earned it, you're welcome to share your experience publicly — but no pressure either way:

Leave a Google Review: {{google_review_link}}

Sincerely,
{{business_name}}

Unsubscribe: {{unsubscribe_link}}`,
  },
];

const SMS_TEMPLATES: Array<{ name: string; body: string; type: string }> = [
  {
    name: "Initial Review Request (SMS)",
    type: "REVIEW_REQUEST",
    body: "Hi {{customer_name}}, thanks for choosing {{business_name}}! Got 60 seconds? We'd love a quick Google review: {{google_review_link}} Reply STOP to opt out",
  },
  {
    name: "Reminder (SMS)",
    type: "REMINDER",
    body: "Hi {{customer_name}}, just a friendly nudge from {{business_name}} — a quick review helps us a lot: {{google_review_link}} This is our only reminder. Reply STOP to opt out",
  },
  {
    name: "Thank You (SMS)",
    type: "THANK_YOU",
    body: "{{customer_name}}, we saw your review — thank you! It means a lot to the whole {{business_name}} team. Reply STOP to opt out",
  },
];

async function seedTenant(tenantId: string) {
  let created = 0;
  let updated = 0;

  for (const t of EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { tenantId, name: t.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: { subject: t.subject, body: t.body, type: t.type, isDefault: true },
      });
      updated++;
    } else {
      await prisma.emailTemplate.create({ data: { tenantId, ...t, isDefault: true } });
      created++;
    }
  }

  for (const t of SMS_TEMPLATES) {
    const existing = await prisma.smsTemplate.findFirst({
      where: { tenantId, name: t.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.smsTemplate.update({
        where: { id: existing.id },
        data: { body: t.body, type: t.type, isDefault: true },
      });
      updated++;
    } else {
      await prisma.smsTemplate.create({ data: { tenantId, ...t, isDefault: true } });
      created++;
    }
  }

  return { created, updated };
}

async function main() {
  const onlyTenant = process.argv[2];

  const tenants = onlyTenant
    ? await prisma.tenant.findMany({ where: { id: onlyTenant }, select: { id: true, name: true } })
    : await prisma.tenant.findMany({ select: { id: true, name: true } });

  if (tenants.length === 0) {
    console.error(onlyTenant ? "No tenant found with id " + onlyTenant : "No tenants in database.");
    process.exit(1);
  }

  console.log("Seeding templates for " + tenants.length + " tenant(s)...");

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const tenant of tenants) {
    const { created, updated } = await seedTenant(tenant.id);
    totalCreated += created;
    totalUpdated += updated;
    console.log("  OK " + (tenant.name ?? tenant.id) + ": " + created + " created, " + updated + " updated");
  }

  console.log("Done. " + totalCreated + " created, " + totalUpdated + " updated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
