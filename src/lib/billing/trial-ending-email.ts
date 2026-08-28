// src/lib/billing/trial-ending-email.ts
//
// The 24-hour trial-ending notice, as a pure render.
//
// WHY THIS IS ITS OWN MODULE AND NOT PART OF trial-notice.ts. Two reasons, both
// practical. It has no dependency on Prisma, Redis or the queue, so the operator
// smoke script (npm run email:test-trial) can render a real message without
// touching a database or opening a Redis connection. And a pure function of its
// inputs is testable by mutation: change the price, the subject changes — which
// is the only way to prove a number came from the plan config rather than from a
// literal somebody typed once.
//
// ── THE PRICE IS NEVER WRITTEN DOWN HERE ────────────────────────────────────
// Every amount comes from PLAN_CONFIGS at send time. This is the money path: the
// card is charged automatically when the trial converts, so an amount in this
// email that disagrees with the amount on the card is not a copy bug, it is a
// customer who was told the wrong thing before being charged. tests assert the
// rendered figure equals the config's, so a price change cannot leave a stale
// number behind in a template.
//
// ── WHAT THE COPY MUST SAY, AND WHY ─────────────────────────────────────────
// The trial terms are: TRIAL_DAYS free, card on file, charged automatically at
// trial end, cancellable any time before then from the billing page. A notice
// that omits the automatic charge is not a notice. All four facts are in both
// locales, in both parts.
//
// THE LENGTH IS TRIAL_DAYS, NOT "7". Same rule as the price: plan-config.ts
// calls itself THE source for that number, and a "7-day free trial" typed into
// a template is the copy that keeps saying seven after someone changes it.

import { planConfig, TRIAL_DAYS } from "@/lib/plan-config";
import { SITE_URL } from "@/lib/seo/constants";
import type { PlanType } from "@/generated/prisma";
import type { BillingInterval } from "@/lib/stripe/prices";

/**
 * Where "cancel before then" points — the in-app billing page, which opens the
 * Stripe portal. Not locale-prefixed: /billing is a dashboard route, and
 * resolveHref() deliberately leaves in-app paths alone.
 *
 * It lives in this module rather than beside the sender so that rendering has no
 * dependency on Prisma or the queue — that is what lets the smoke script import
 * one file and open no connections.
 */
export const BILLING_URL = `${SITE_URL}/billing`;

/** Body languages. Mirrors onboarding-email.ts: fr* → fr, everything else → en. */
export type EmailLocale = "en" | "fr";

/**
 * Fold a stored tenant language onto a body language.
 *
 * `Tenant.defaultLanguage` is the only locale the app stores for a tenant, and
 * `User` has no locale column at all — so this is the source, and "fr-CA" folds
 * to "fr" the same way it does everywhere else in the app.
 */
export function emailLocaleOf(defaultLanguage: string | null | undefined): EmailLocale {
  return defaultLanguage?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export interface TrialEndingCopyInput {
  /** The tenant's plan, as stored. Legacy AI_VISIBILITY is folded by planConfig(). */
  planType: PlanType;
  /** From the price catalog. null when the catalog cannot say. */
  interval: BillingInterval | null;
  /** When the trial converts to a charge. */
  trialEndsAt: Date;
  /** IANA zone from the tenant. An unusable value falls back to UTC. */
  timezone: string;
  /** Absolute URL of the billing page — the cancel path. */
  billingUrl: string;
  locale: EmailLocale;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * The recurring charge, as prose, straight from the plan config.
 *
 * `annualPrice` in PLAN_CONFIGS is the PER-MONTH equivalent when billed
 * annually, so a yearly charge is twelve of them — the same arithmetic the
 * pricing grid and the subscription agreement do.
 *
 * Returns null when there is no amount to state: ENTERPRISE is contract-priced,
 * and an unknown interval means the catalog could not tell us whether the card
 * is about to be charged one month or twelve. Saying nothing is correct in both
 * cases; guessing is not.
 */
export function trialChargeLabel(
  planType: PlanType,
  interval: BillingInterval | null,
  locale: EmailLocale,
): string | null {
  const config = planConfig(planType);
  if (config.isCustomPricing || !interval) return null;

  const raw = interval === "year" ? config.annualPrice * 12 : config.monthlyPrice;
  // Grouped, because an annual charge runs to four digits and "$4788" is a
  // number a reader has to count. The pricing catalog groups too ("$1,379 CAD",
  // "1 379 $ CAD") — French uses a narrow no-break space, which is what the
  // fr-CA formatter emits.
  const amount = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA").format(raw);
  // House currency formatting, copied from the pricing catalog's own strings
  // (src/lib/i18n/content.ts): "$69 CAD/mo" in English, "69 $ CAD/mois" in
  // French. Billing is USD-only (src/lib/stripe/prices.ts), and the code is
  // spelled out rather than left as a bare "$" — this email precedes a charge,
  // and a reader in Montreal or Geneva should not have to guess which dollar.
  if (locale === "fr") {
    return `${amount} $ US/${interval === "year" ? "an" : "mois"}`;
  }
  return `$${amount} USD/${interval === "year" ? "year" : "month"}`;
}

/** The tier's display name, from the config rather than from the enum. */
export function planDisplayName(planType: PlanType): string {
  return planConfig(planType).name;
}

/**
 * The trial-end date, in the tenant's own timezone.
 *
 * A charge lands on a calendar day, and which day that is depends on where the
 * customer is. An unusable zone (a typo, a value from an old import) throws
 * inside Intl, so it falls back to UTC rather than failing the send — a date in
 * the wrong zone is a smaller error than no email before a charge.
 */
export function formatTrialEnd(date: Date, timezone: string, locale: EmailLocale): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  };
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  try {
    return new Intl.DateTimeFormat(tag, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(tag, { ...options, timeZone: "UTC" }).format(date);
  }
}

/** Values interpolated into HTML are escaped; a plan name is data, not markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Copy {
  subject: string;
  greeting: string;
  /** The lead sentence: when it ends, and that the card is charged. */
  lead: string;
  /** The charge line, when there is an amount to state. */
  charge: string;
  /** The charge line when there is not. */
  chargeUnknown: string;
  cancelLead: string;
  cancelCta: string;
  keepGoing: string;
  signoff: string;
  footer: string;
}

function copyFor(
  locale: EmailLocale,
  parts: { plan: string; date: string; charge: string | null },
): Copy {
  const { plan, date, charge } = parts;
  if (locale === "fr") {
    return {
      subject: `Votre essai Echorank se termine le ${date}`,
      greeting: "Bonjour,",
      lead: `Votre essai gratuit de ${TRIAL_DAYS} jours se termine le ${date}. La carte enregistrée sera débitée automatiquement à ce moment-là et votre abonnement ${plan} commencera.`,
      charge: `Montant : ${charge}, pour le forfait ${plan}.`,
      chargeUnknown: `Le montant correspond à votre forfait ${plan}. Vous le retrouverez sur votre page de facturation.`,
      cancelLead:
        "Vous ne souhaitez pas continuer ? Annulez avant cette date depuis votre page de facturation — aucun débit ne sera effectué.",
      cancelCta: "Gérer ou annuler mon abonnement",
      keepGoing: "Rien à faire si vous souhaitez continuer : tout reste en place.",
      signoff: "L'équipe Echorank",
      footer:
        "Ce message concerne votre abonnement et est envoyé à l'adresse du propriétaire du compte.",
    };
  }
  return {
    subject: `Your Echorank trial ends on ${date}`,
    greeting: "Hi,",
    lead: `Your ${TRIAL_DAYS}-day free trial ends on ${date}. The card on file is charged automatically at that point and your ${plan} subscription begins.`,
    charge: `The charge will be ${charge}, for the ${plan} plan.`,
    chargeUnknown: `The amount is the one for your ${plan} plan — you can see it on your billing page.`,
    cancelLead:
      "Not planning to continue? Cancel before then from your billing page and nothing is charged.",
    cancelCta: "Manage or cancel your subscription",
    keepGoing: "If you are staying, there is nothing to do — everything carries on as it is.",
    signoff: "The Echorank team",
    footer: "This message is about your subscription and goes to the account owner's address.",
  };
}

/**
 * Render both parts of the notice.
 *
 * Plain text is not an afterthought: it is what a text-only client shows, what a
 * screen reader gets when HTML is stripped, and what several spam filters weigh.
 * The two parts carry the same four facts.
 */
export function renderTrialEndingEmail(input: TrialEndingCopyInput): RenderedEmail {
  const plan = planDisplayName(input.planType);
  const date = formatTrialEnd(input.trialEndsAt, input.timezone, input.locale);
  const charge = trialChargeLabel(input.planType, input.interval, input.locale);
  const c = copyFor(input.locale, { plan, date, charge });
  const chargeLine = charge ? c.charge : c.chargeUnknown;

  const text = [
    c.greeting,
    "",
    c.lead,
    chargeLine,
    "",
    c.cancelLead,
    `${c.cancelCta}: ${input.billingUrl}`,
    "",
    c.keepGoing,
    "",
    c.signoff,
    "",
    c.footer,
  ].join("\n");

  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:560px">`,
    `<p>${escapeHtml(c.greeting)}</p>`,
    `<p>${escapeHtml(c.lead)}</p>`,
    `<p><strong>${escapeHtml(chargeLine)}</strong></p>`,
    `<p>${escapeHtml(c.cancelLead)}</p>`,
    `<p><a href="${escapeHtml(input.billingUrl)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none">${escapeHtml(c.cancelCta)}</a></p>`,
    `<p>${escapeHtml(c.keepGoing)}</p>`,
    `<p>${escapeHtml(c.signoff)}</p>`,
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">`,
    `<p style="font-size:12px;color:#6b7280">${escapeHtml(c.footer)}</p>`,
    `</div>`,
  ].join("");

  return { subject: c.subject, html, text };
}
