// Subscription Agreement — the document the checkout consent gate keys off.
//
// Same shape as legal/terms: a typed Doc rendered through the shared legal
// chrome. Markdown was NOT introduced for it; the three existing legal pages are
// static TSX and a second rendering path for one document would be the harder
// thing to keep consistent.
//
// EN body only for this pass, per the brief. fr and de-CH get localized chrome
// plus the "currently in English" banner the other legal pages already use —
// an FR reader meeting an English body without notice is the worse outcome.
//
// §1.1's PRICE TABLE IS GENERATED FROM PLAN_CONFIGS, not typed out. A legal
// document that quotes a price the checkout does not charge is the one drift in
// here that actually matters, and this repo already guards the same numbers in
// the pricing grid and the JSON-LD offers. The yearly figure is annualPrice x 12
// because annualPrice is the per-month equivalent.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { buildMetadata } from "@/lib/seo";
import BackButton from "../back-button";
import lp from "../legal.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Doc = { title: string; updated: string; sections: { h: string; ps: string[] }[] };

/** One line per plan, from the config the checkout actually charges from. */
function planLines(): string[] {
  return PLAN_ORDER.map((plan) => {
    const c = PLAN_CONFIGS[plan];
    if (c.isCustomPricing) return `${c.name}: custom pricing — contact us.`;
    return `${c.name}: $${c.monthlyPrice}/month, or $${c.annualPrice * 12}/year ($${c.annualPrice}/month equivalent).`;
  });
}

const EN: Doc = {
  title: "Subscription Agreement",
  updated: "Last updated: August 7, 2026",
  sections: [
    { h: "Overview", ps: [
      "This Subscription Agreement (\"Agreement\") governs your subscription to Echorank360 (\"Service\"), operated by ChatLogic Insights LTD (\"we,\" \"us,\" \"our\"). By starting a free trial or subscribing, you agree to the terms below in addition to our Terms of Use. A subscription (with an active trial or paid status) is required to access the dashboard, reputation tools, AI visibility monitoring, SEO tools, and all other platform features.",
    ]},
    { h: "1. Plans and Pricing", ps: [
      "1.1 Available Plans. Echorank360 offers the following subscription tiers:",
      ...planLines(),
      "Prices are in US Dollars and may be updated with 30 days' notice. Current pricing is always displayed at echorank360.com/en/pricing.",
      "1.2 Plan Limits. Each plan includes usage limits — such as the number of locations, team seats, monthly feedback requests, SEO lookups, and AI generation tokens — as described on the pricing page. Exceeding a limit may require upgrading to a higher tier. Limits reset at the start of each billing month unless otherwise stated.",
      "1.3 Billing Intervals. Subscriptions are billed either monthly (recurring every calendar month) or yearly (recurring every 12 months). Your billing interval is selected at checkout and may be changed as described in Section 5.",
    ]},
    { h: "2. Eligibility", ps: [
      "You must be at least 18 years old to use the Service. Echorank360 is not available to persons located in the United Kingdom. By creating an account or starting a trial you represent that you are not a UK national, UK resident, or accessing the Service from within the UK.",
    ]},
    { h: "3. Free Trial", ps: [
      "3.1 Trial Terms. New subscriptions begin with a 7-day free trial. A valid payment method is required to start the trial. You will not be charged during the trial period.",
      "3.2 Conversion to Paid. Unless you cancel before the trial ends, your payment method is automatically charged for your selected plan and billing interval on the day the trial expires, and your paid subscription begins. We send a reminder email to the address on your account before the trial ends.",
      "3.3 Cancelling During the Trial. You may cancel at any time during the trial through the Stripe Customer Portal (see Section 7). Cancellation during the trial takes effect immediately and no charge is made.",
      "3.4 One Trial per Customer. The free trial is available once per customer and per organisation. We may decline or revoke trials created to circumvent this limit.",
    ]},
    { h: "4. Payment and Billing", ps: [
      "4.1 Payment Processing. All payments are processed securely through Stripe. Echorank360 does not store credit card numbers. By subscribing, you authorise Stripe to charge your payment method on a recurring basis according to your selected billing interval.",
      "4.2 Billing Cycle. Your billing cycle begins on the date your trial converts to a paid subscription (or the date of purchase if no trial applies). Subsequent charges occur on the same day each month (for monthly plans) or the same date each year (for yearly plans). If a charge fails, your subscription status becomes \"past due\" and access may be suspended after a 3-day grace period.",
      "4.3 Taxes. Prices are exclusive of applicable taxes unless otherwise stated. Stripe may collect taxes as required by your jurisdiction.",
    ]},
    { h: "5. Plan Changes", ps: [
      "Summary: Upgrades and switches to yearly billing take effect immediately. Downgrades and switches to monthly billing take effect at the end of your current billing period. You keep full access to your current plan until any scheduled change takes effect.",
      "5.1 Upgrades (Immediate). An upgrade is a change from a lower-tier plan to a higher-tier plan (e.g., Starter to Growth). Upgrades take effect immediately. You gain instant access to the features of your new plan. Prorated charges are applied for the remainder of your current billing period — you are credited for the unused portion of your previous plan and charged for the remaining time at the new plan's rate.",
      "5.2 Downgrades (Scheduled at Period End). A downgrade is a change from a higher-tier plan to a lower-tier plan (e.g., Growth to Starter). Downgrades are scheduled to take effect at the end of your current billing period. You retain full access to all features of your current plan until the scheduled change date. On that date, your subscription automatically transitions to the new plan at the new rate. If your usage exceeds the limits of the lower plan, some data or features may become read-only or inaccessible after the change.",
      "5.3 Billing Interval Changes — Same Tier. Monthly to Yearly (Immediate): switching from monthly to yearly billing on the same plan takes effect immediately. Prorated charges are applied — you receive a credit for the unused portion of your current monthly period and are charged the yearly rate. Yearly to Monthly (Scheduled at Period End): switching from yearly to monthly billing on the same plan is scheduled to take effect at the end of your current yearly billing period. You retain access for the full year you have already paid for. Monthly billing begins at the next renewal.",
      "5.4 Combined Changes. A plan change may involve both a tier change and a billing interval change simultaneously (e.g., Starter Monthly to Growth Yearly). The rules follow the dominant direction: if the change includes an upgrade or a switch to yearly billing, it is immediate with proration; if the change is a downgrade or a switch to monthly billing, it is scheduled at period end.",
      "5.5 Proration. When an immediate plan change involves proration, Stripe calculates the unused time remaining on your current plan and credits that amount against the charge for your new plan. The net difference is either charged immediately or applied to your next invoice. Prorated amounts are calculated to the day.",
      "5.6 Pending Changes. When a plan change is scheduled (not immediate), your account displays the pending change. You may cancel or modify a pending change before it takes effect by selecting a different plan. Selecting an immediate change (e.g., an upgrade) while a downgrade is pending will cancel the pending downgrade and apply the upgrade immediately.",
      "5.7 Plan Changes During the Trial. If you change plans during your free trial, the trial continues on the new plan and the new plan's rate applies when the trial converts to paid.",
    ]},
    { h: "6. Confirmation and Notifications", ps: [
      "Every billing event — including trial start, trial conversion, upgrades, downgrades, interval switches, and cancellations — generates a confirmation delivered by email to the address on your account. Confirmations include the transaction date, the plan and billing interval, the effective date (immediate or scheduled), and, for prorated changes, the charge amount. Stripe also issues receipts and invoices for all payments.",
    ]},
    { h: "7. Cancellation", ps: [
      "7.1 How to Cancel. You may cancel your subscription at any time through the Manage Subscription / Billing section of your dashboard, which opens the Stripe Customer Portal. You may also contact support@echorank360.com.",
      "7.2 Effect of Cancellation. During the free trial, cancellation takes effect immediately and no charge is made. After the trial, cancellation takes effect at the end of your current billing period. You retain full access to all features of your current plan until that date. After the billing period ends, your account reverts to an inactive state and dashboard access is suspended.",
      "7.3 Data After Cancellation. Following cancellation, you may request an export of your data by contacting support before your access ends. We may delete account data after a reasonable retention period, in accordance with our Privacy Policy.",
      "7.4 No Refunds. No refunds are issued for partial billing periods, except where required by applicable law. If you upgrade and then cancel within the same billing period, the prorated charge for the upgrade is not refunded.",
    ]},
    { h: "8. Consent", ps: [
      "8.1 Checkout Consent. Before starting a trial or completing any purchase or plan change, you must explicitly consent to this Subscription Agreement, the Terms of Use, the Privacy Policy, and the Cookie Policy. Your consent is recorded with a timestamp, consent version, and the specific documents you agreed to.",
      "8.2 Consent Records. We maintain a log of all consent events for compliance purposes. Consent records include the user ID, consent version, document IDs, timestamp, and the plan associated with the transaction.",
    ]},
    { h: "9. Third-Party Data and AI Outputs", ps: [
      "The Service aggregates data from third-party platforms (including search engines, review platforms, and AI model providers) and generates analysis using artificial intelligence. Third-party data availability is outside our control, and AI-generated scores, rankings, and recommendations are informational estimates, not guarantees of business outcomes. Interruptions or changes in third-party data sources do not entitle you to refunds or billing credits.",
    ]},
    { h: "10. Service Level", ps: [
      "Echorank360 aims to provide continuous service availability but does not guarantee specific uptime. Planned maintenance is performed during low-usage hours when possible. Service interruptions do not entitle you to refunds or billing credits.",
    ]},
    { h: "11. Dispute Resolution", ps: [
      "If you believe a charge is incorrect, contact support@echorank360.com with the email address on your account and the relevant invoice or receipt. We will review the transaction and respond within 5 business days. Chargebacks filed without first contacting us may result in account suspension.",
    ]},
    { h: "12. Governing Law", ps: [
      "This Agreement is governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.",
    ]},
    { h: "13. Contact", ps: [
      "ChatLogic Insights LTD — support@echorank360.com",
    ]},
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/legal/subscription-agreement",
    title: EN.title,
    description: EN.sections[0]?.ps[0],
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = EN;
  const nav = CONTENT[locale as Locale].nav;
  const foot = CONTENT[locale as Locale].footer;
  const backLabel = locale.startsWith("fr") ? "← Retour" : locale === "de-CH" ? "← Zurück" : "← Back";
  const englishOnly = locale.startsWith("fr")
    ? "Cette page est actuellement disponible en anglais. Pour toute question : support@echorank360.com."
    : locale === "de-CH"
      ? "Diese Seite ist derzeit auf Englisch verfügbar. Bei Fragen: support@echorank360.com."
      : null;

  return (
    <div className={lp.page}>
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          {/* /pricing, not /register: marketing CTAs route through pricing now. */}
          <Link href={`/${locale}/pricing`}>{nav.cta}</Link>
        </div>
        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        {englishOnly && <p className={lp.banner}>{englishOnly}</p>}
        <h1 className={lp.h1}>{d.title}</h1>
        <p className={lp.updated}>{d.updated}</p>
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className={lp.h2}>{s.h}</h2>
            {s.ps.map((p, i) => (<p key={i} className={lp.p}>{p}</p>))}
          </section>
        ))}
        <div className={lp.backRowBottom}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        <footer className={lp.footer}>
          <span>{foot.copyright}</span>
          <span>
            {foot.links.map((l) => (
              <Link key={l.label} href={`/${locale}${l.href}`}>{l.label}</Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
