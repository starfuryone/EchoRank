// src/lib/billing/cancel-email.ts — the confirmation sent when a subscription is
// cancelled from /billing/cancel.
//
// THE SAME FACTS AS THE CONFIRMATION PAGE, from the same values: whether a
// charge was ever coming (trial or paid), the date access ends, and that one
// click on Billing resumes it before then. Nothing here is typed by hand: the
// date is the subscription's own period end, in the tenant's timezone.
//
// Rendering only — no Prisma, no mailer — so a test can render every locale
// without opening a connection. The sender lives in cancellation.ts.

import { formatTrialEnd, type EmailLocale, type RenderedEmail } from "./trial-ending-email";

export interface CancelEmailInput {
  /** Display name, e.g. "Starter". */
  planName: string;
  /** Cancelled during the free trial: no charge was ever made. */
  trial: boolean;
  /** When access ends: the subscription's own period (or trial) end. */
  accessUntil: Date;
  /** IANA zone from the tenant. An unusable value falls back to UTC. */
  timezone: string;
  /** Absolute URL of /billing — where Resume is. */
  billingUrl: string;
  locale: EmailLocale;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyFor(locale: EmailLocale, plan: string, date: string, trial: boolean) {
  if (locale === "fr") {
    return {
      subject: `Votre abonnement ${plan} est annulé`,
      greeting: "Bonjour,",
      lead: `Votre abonnement ${plan} a été annulé.`,
      charge: trial ? "Vous ne serez pas facturé." : "Vous ne serez plus facturé.",
      access: `Vous gardez un accès complet jusqu'au ${date}.`,
      resume: `Vous pouvez reprendre en un clic à tout moment avant le ${date}, depuis Facturation.`,
      cta: "Ouvrir Facturation",
      signoff: "L'équipe Echorank",
      footer: "Ce message concerne votre abonnement et est envoyé à l'adresse du propriétaire du compte.",
    };
  }
  return {
    subject: `Your ${plan} subscription is cancelled`,
    greeting: "Hi,",
    lead: `Your ${plan} subscription has been cancelled.`,
    charge: trial ? "You won't be charged." : "You won't be charged again.",
    access: `You keep full access until ${date}.`,
    resume: `You can resume with one click any time before ${date}, from Billing.`,
    cta: "Open Billing",
    signoff: "The Echorank team",
    footer: "This message is about your subscription and goes to the account owner's address.",
  };
}

export function renderCancelEmail(input: CancelEmailInput): RenderedEmail {
  const date = formatTrialEnd(input.accessUntil, input.timezone, input.locale);
  const c = copyFor(input.locale, input.planName, date, input.trial);

  const text = [
    c.greeting,
    "",
    c.lead,
    "",
    `- ${c.charge}`,
    `- ${c.access}`,
    `- ${c.resume}`,
    "",
    `${c.cta}: ${input.billingUrl}`,
    "",
    c.signoff,
    "",
    c.footer,
  ].join("\n");

  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:560px">`,
    `<p>${escapeHtml(c.greeting)}</p>`,
    `<p>${escapeHtml(c.lead)}</p>`,
    `<ul>`,
    `<li>${escapeHtml(c.charge)}</li>`,
    `<li>${escapeHtml(c.access)}</li>`,
    `<li>${escapeHtml(c.resume)}</li>`,
    `</ul>`,
    `<p><a href="${escapeHtml(input.billingUrl)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none">${escapeHtml(c.cta)}</a></p>`,
    `<p>${escapeHtml(c.signoff)}</p>`,
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">`,
    `<p style="font-size:12px;color:#6b7280">${escapeHtml(c.footer)}</p>`,
    `</div>`,
  ].join("");

  return { subject: c.subject, html, text };
}
