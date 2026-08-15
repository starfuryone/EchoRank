// /[locale]/credits — prepaid prospect lookups for the Opportunity Scanner.
//
// ── THIS PAGE IS THE DELIBERATE EXCEPTION TO THE CTA RULE ───────────────────
// Every marketing CTA on this site routes to /pricing. The buy buttons here do
// not, and must not be "fixed" by a future CTA sweep: they ARE the checkout.
// A credit pack is a one-time purchase with no tier and no trial, so sending a
// buyer to /pricing would land them on a page that sells subscriptions and says
// nothing about lookups. /pricing links HERE instead, as one line under the
// Agency card — packs are an add-on, not a fourth plan.
//
// ── EVERY PRICE IS RESOLVED FROM STRIPE, NOT TYPED ──────────────────────────
// src/lib/credit-packs.ts holds the three pack SIZES and nothing else; the
// amounts come from the live catalogue through pricedPacks(). The /watcher page
// makes the same argument for deriving its numbers from WATCHER_PRICES_CENTS —
// an earlier draft of that page advertised a product that did not exist,
// because copy written by hand drifts silently and nothing fails when it does.
// A pack Stripe cannot price is DROPPED from this page rather than shown at a
// guess.
//
// ── CONSENT ─────────────────────────────────────────────────────────────────
// No ConsentGate. This is a one-time payment rather than a subscription or a
// plan change, so §8.1's checkout-consent flow does not wrap it; the buy
// buttons carry a terms/privacy line instead. See the route handler at
// /api/billing/credits/checkout for the full note, including the reading of
// §8.1 that this decision rests on.

import type { Metadata } from "next";
import { PublicNav } from "../PublicNav";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, SITE_URL, baseGraph, breadcrumbList } from "@/lib/seo";
import { getCurrentTenant } from "@/lib/tenant";
import { pricedPacks } from "@/lib/credits/pricing";
import { CreditsPurchase } from "./CreditsPurchase";
import { COPY, baseOf } from "./copy";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = COPY[baseOf(locale)];
  return buildMetadata({
    locale,
    path: "/credits",
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = (isSupportedLocale(locale) ? locale : "en") as Locale;
  const c = COPY[baseOf(l)];

  // Both resolved server-side. The plan decides whether the "you will have
  // nowhere to spend these" notice shows, and a signed-out visitor gets no
  // notice at all — they have no plan to be wrong about, and the buy button
  // sends them to sign in first.
  const [packs, membership] = await Promise.all([
    pricedPacks(),
    getCurrentTenant().catch(() => null),
  ]);

  const signedIn = membership !== null;
  const planCanSpend = membership?.tenant.planType === "AGENCY" ||
    membership?.tenant.planType === "ENTERPRISE";

  return (
    <div className={s.page}>
      <PublicNav locale={l} />
      {/* No Offer node. /pricing emits the plan catalogue's offers; adding
          hand-written ones here would be a second source for prices this page
          already resolves from Stripe — the drift tests/seo-jsonld.test.ts
          exists to catch. */}
      <JsonLd
        graph={[
          ...baseGraph(l),
          breadcrumbList([
            { name: "Echorank360", url: `${SITE_URL}/${l}` },
            { name: c.metaTitle, url: `${SITE_URL}/${l}/credits` },
          ]),
        ]}
      />

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {c.label}
          </p>
          <h1 className={s.h2}>{c.h1}</h1>
          <p className={s.sub}>{c.sub}</p>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 02</b>
          </p>
          <h2 className={s.h2}>{c.whatTitle}</h2>
          <p className={s.sub} style={{ maxWidth: 760, marginTop: 10 }}>
            {c.whatBody}
          </p>
        </div>
      </section>

      <CreditsPurchase
        locale={l}
        packs={packs}
        signedIn={signedIn}
        showPlanNotice={signedIn && !planCanSpend}
        copy={{
          perLookup: c.perLookup,
          lookups: c.lookups,
          buy: c.buy,
          mostPopular: c.mostPopular,
          unavailable: c.unavailable,
          terms: c.terms,
          planNoticeTitle: c.planNoticeTitle,
          planNoticeBody: c.planNoticeBody,
        }}
      />

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 04</b>
          </p>
          <h2 className={s.h2}>{c.faqTitle}</h2>
          <div className={s.ucGrid} style={{ marginTop: 24 }}>
            {c.faq.map((item) => (
              <div key={item.q} className={s.ucCard}>
                <span className={s.ucTitle}>{item.q}</span>
                <span className={s.ucBody}>{item.a}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
