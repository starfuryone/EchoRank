// /[locale]/pricing — the standalone pricing page (ECHORANK-PRICING.md).
//
// THE FUNNEL'S ONE EXIT, AND NOW ITS ONLY ENTRANCE. Every marketing CTA on the
// site points here, and nothing on the site links into /register any more —
// bare /register redirects BACK to this page. That is the checkout-first
// design: a card is entered at Stripe before an account exists, and the account
// is what the webhook builds out of the completed session. There is therefore
// no "create an account, choose a plan later" state to offer.
//
// NO NUMBERS LIVE HERE. Top to bottom:
//   1. hero — the yearly saving is yearlySavingPct() over PLAN_CONFIGS;
//   2–3. toggle + plan cards — PricingSection over pricingTiers(), the same
//      call the homepage and /site-crawler make;
//   4. "Free vs paid" — comparisonTable(): PLAN_CONFIGS, the feature matrix,
//      the tool registry and the free tools' own limit constants;
//   5. sample output — SKIPPED (see the report in ECHORANK-PRICING work): the
//      only real sample, the 2026-08-01 audit PDF of echorank360.com, prints
//      the banned camel-case brand and predates the current site;
//   6. value estimator — SKIPPED: no measured time-saved figure exists to
//      ground conservative defaults in;
//   7. "Straight answers" — pricingFaq(), and the FAQPage JSON-LD from the
//      same array, every question included;
//   8. closing band → the cards (#pricing).
// The Offer JSON-LD comes from the same config through softwareApplication().
//
// Locales: real copy in en, fr and de-CH; en-CA / fr-CA fold to en / fr.

import type { Metadata } from "next";
import { PublicNav } from "../PublicNav";
import { PricingSection } from "../PricingSection";
import { PublicFooter } from "@/components/PublicFooter";
import { pricingTiers, yearlySavingPct } from "@/lib/pricing-tiers";
import { HOME_PRICING_CHROME, pricingNotes, toolCountLine } from "@/lib/i18n/content";
import { seoToolCounts } from "@/lib/seo-tools";
import { TRIAL_DAYS } from "@/lib/plan-config";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, SITE_URL, baseGraph, breadcrumbList, faqPage, softwareApplication } from "@/lib/seo";
import { FREE_TOOLS, freeToolVisible } from "@/lib/free-tools";
import { pricingBase } from "@/lib/pricing-page/format";
import { PRICING_PAGE_COPY, fill, planCountWord } from "@/lib/pricing-page/copy";
import { cardPlans } from "@/lib/pricing-page/headlines";
import { comparisonTable } from "@/lib/pricing-page/compare";
import { pricingFaq } from "@/lib/pricing-page/faq";
import { launchedPlans } from "@/lib/stripe/catalog";
import { inline, plainText } from "../learn/_shared/inline";
import { CompareTable } from "./CompareTable";
import s from "../home2.module.css";
import p from "./pricing.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// Regenerated every five minutes: the crawler-only plan's card appears once
// its stripe_prices rows exist (src/lib/stripe/catalog.ts), without a
// rebuild. Cloudflare's copy still needs the purge after the seed.
export const revalidate = 300;

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = PRICING_PAGE_COPY[pricingBase(locale)];
  return buildMetadata({
    locale,
    path: "/pricing",
    title: c.metaTitle,
    description: fill(c.metaDescription, { days: TRIAL_DAYS }),
  });
}

function freeCrawlerOn(): boolean {
  const t = FREE_TOOLS.find((f) => f.id === "site_crawler");
  return !!t && freeToolVisible(t);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = (isSupportedLocale(locale) ? locale : "en") as Locale;
  const base = pricingBase(l);
  const c = PRICING_PAGE_COPY[base];
  const pct = yearlySavingPct();
  const notes = pricingNotes(l);
  // The catalog-gated plans on sale (none until the crawler-only plan's
  // Stripe prices are seeded; a failed read is none).
  const launched = await launchedPlans();
  const faq = pricingFaq(l, { savePct: pct ?? 0, freeCrawler: freeCrawlerOn(), launched });
  const pageUrl = `${SITE_URL}/${l}/pricing`;

  return (
    <div className={s.page}>
      <PublicNav locale={l} />
      {/* Offers come from PLAN_CONFIGS via softwareApplication(), the same
          source the visible cards read. The FAQPage is built from the same
          array the FAQ section renders — every question, as plain text. */}
      <JsonLd
        graph={[
          ...baseGraph(l),
          softwareApplication(l),
          breadcrumbList([
            { name: "Echorank360", url: `${SITE_URL}/${l}` },
            { name: c.metaTitle, url: pageUrl },
          ]),
          faqPage(
            faq.map((it) => ({ q: plainText(it.q), a: plainText(it.a) })),
            pageUrl,
          ),
        ]}
      />

      {/* 1–3: hero, toggle, cards. One section so #pricing lands on the hero
          with the cards directly under it. */}
      <section id="pricing" className={s.section}>
        <div className={s.container}>
          <PricingSection
            salesSrc="pricing-enterprise"
            // /pricing only: AI Visibility, the crawler-only plan once on sale, Starter,
            // Growth, Agency, and Enterprise as a band under them.
            enterpriseBand
            locale={l}
            pricing={pricingTiers(l, undefined, { launched })}
            priceChrome={HOME_PRICING_CHROME[l]}
            toolCountLine={toolCountLine(l, seoToolCounts())}
            tax={notes.tax}
            currency={notes.currency}
            // The "N tools" line points at the homepage's #tools section —
            // this page has none, and a bare "#tools" here would be a dead
            // anchor that silently scrolls nowhere.
            toolsHref={`/${l}#tools`}
            compareHref="#compare"
            header={
              <>
                <p className={s.label}>
                  <b>/ 01</b> — {c.label}
                </p>
                <h1 className={s.h2}>{fill(c.h1, { plans: planCountWord(cardPlans(launched).length, base) })}</h1>
                {pct !== null && <p className={s.sub} data-testid="pricing-sub">{fill(c.sub, { pct })}</p>}
              </>
            }
          />
          {/* THE PLAN-LESS "Create account" BUTTON IS GONE, deliberately.
              Checkout-first: an account is what a completed checkout produces.
              tests/pricing-route.test.ts asserts the absence. */}
        </div>
      </section>

      {/* 4: Free vs paid. */}
      <section id="compare" className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 02</b> — {c.compareLabel}
          </p>
          <h2 className={s.h2}>{c.compareH2}</h2>
          <p className={s.sub}>{c.compareSub}</p>
          <CompareTable table={comparisonTable(l, launched)} copy={c} />
        </div>
      </section>

      {/* 7: Straight answers. Answers always visible, as on the homepage. */}
      <section id="faq" className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 03</b> — {c.faqLabel}
          </p>
          <h2 className={s.h2}>{c.faqH2}</h2>
          <div className={s.faq}>
            {faq.map((it) => (
              <div className={s.faqItem} key={it.id} data-faq={it.id}>
                <h3 className={s.faqQ}>{it.q}</h3>
                <p className={s.faqA}>{inline(it.a, l, it.id)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8: closing band. Marketing CTAs lead to the plan cards. */}
      <section className={s.section}>
        <div className={`${s.container} ${p.closing}`}>
          <h2 className={s.h2}>{c.closingH2}</h2>
          <p className={s.sub}>{c.closingBody}</p>
          <div className={s.ctarow} style={{ marginTop: 20 }}>
            <a className={`${s.btn} ${s.btnPrimary}`} href="#pricing">
              {c.closingCta}
            </a>
          </div>
        </div>
      </section>
      <PublicFooter locale={l} />
    </div>
  );
}
