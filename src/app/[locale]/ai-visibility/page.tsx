// app/[locale]/ai-visibility/page.tsx — the AI Visibility plan's landing page
// (ECHORANK-AI-VISIBILITY-PAGES.md Phase 1, 2026-11-10).
//
// The shared shell (PublicNav, PublicFooter, home2 styles), a sticky bar of
// the sections that exist on this page, then: hero → the problem → how it
// works (with the free keyword scan that suggests prompts) → what you get →
// the two free tools → pricing (the shared cards and the AI allowance table) →
// FAQ → closing CTA.
//
// EVERY NUMBER AND ENGINE NAME IS READ, NOT TYPED: prices and allowances from
// PLAN_CONFIGS, engines from the live-engine registry, features from
// feature-flags / plan-access, the keyword scan's limit from its route's own
// constant (src/lib/ai-visibility-landing/facts.ts). The words are in
// src/lib/ai-visibility-landing/copy.ts.
//
// NO SAMPLE SECTION YET. The brief asks for a real stored run; the only store
// is production Postgres, which this box's agent sessions never read. The
// section (and its sub-nav link) is added when a run is exported.
//
// The #audit id stays (on the free tools section): external links and older
// PDFs carry /ai-visibility#audit from when the free audit widget lived here.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { HOME_PRICING_CHROME, pricingNotes, toolCountLine } from "@/lib/i18n/content";
import { aiLabels } from "@/lib/i18n/ai-labels";
import { pricingTiers } from "@/lib/pricing-tiers";
import { pricingBase, usd } from "@/lib/pricing-page/format";
import { seoToolCounts } from "@/lib/seo-tools";
import { KEYWORD_SCAN_LIMIT_PER_DAY } from "@/lib/keyword-scan-limits";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { AV_BRAND } from "@/lib/ai-visibility/brand";
import { AV_COPY, cadenceLabel, keywordWidgetCopy } from "@/lib/ai-visibility-landing/copy";
import {
  AV_LADDER,
  AV_PLAN,
  AV_SRC,
  allowanceRows,
  avMonthlyPrice,
  avPlanHref,
  avShippedFeatures,
  planEngineNames,
  reviewsFromPlan,
  searchScoreWeights,
  starterAdds,
} from "@/lib/ai-visibility-landing/facts";
import { JsonLd, SITE_URL, buildMetadata, faqPage, normalizeLocale, organization, webSite } from "@/lib/seo";
import { AiVisibilityLogo } from "@/components/brand/AiVisibilityLogo";
import { KeywordWidget } from "@/components/KeywordWidget";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "../PublicNav";
import { PricingSection } from "../PricingSection";
import s from "../home2.module.css";
import v from "./landing.module.css";

const PATH = "/ai-visibility";

function intlLocale(locale: string): string {
  return locale === "de-CH" ? "de-CH" : locale.startsWith("fr") ? "fr-CA" : "en-US";
}

function listOf(locale: string, items: string[]): string {
  return new Intl.ListFormat(intlLocale(locale), { style: "long", type: "conjunction" }).format(items);
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = AV_COPY[pricingBase(locale)];
  return buildMetadata({
    locale,
    path: PATH,
    title: c.meta.title,
    description: c.meta.description(listOf(locale, planEngineNames(AV_PLAN))),
    ogImage: "/ai-visibility/og-ai-visibility.png",
  });
}

export default async function AIVisibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const l = normalizeLocale(locale);
  const base = pricingBase(locale);
  const c = AV_COPY[base];
  const pageUrl = `${SITE_URL}/${l}${PATH}`;

  const plan = PLAN_CONFIGS[AV_PLAN];
  const price = usd(avMonthlyPrice(), base);
  const avEngines = planEngineNames(AV_PLAN);
  const rows = allowanceRows();
  const primaryHref = avPlanHref(l, AV_SRC.hero);
  const primaryLabel = c.hero.primary(price);
  const features = avShippedFeatures();
  const weights = searchScoreWeights();
  const adds = starterAdds().map((a) => c.pricing.areas[a]);
  const reviewsFrom = reviewsFromPlan();
  const faq = c.faq({
    rows,
    reviewsFrom: reviewsFrom ? PLAN_CONFIGS[reviewsFrom].name : null,
    list: (items) => listOf(locale, items),
  });
  // The example's alert names an engine the AI Visibility plan really asks.
  const alertEngine = avEngines[avEngines.length - 1] ?? null;
  const sub = c.subnav;

  return (
    <div className={s.page}>
      {/* FAQPage from the same array rendered below; the Offer from the plan config. */}
      <JsonLd
        graph={[
          organization(l),
          webSite(l),
          faqPage(faq, pageUrl),
          {
            "@type": "Product",
            "@id": `${pageUrl}#product`,
            name: AV_BRAND.name,
            description: c.meta.description(listOf(locale, avEngines)),
            url: pageUrl,
            brand: { "@id": `${SITE_URL}/#organization` },
            offers: {
              "@type": "Offer",
              name: plan.name,
              price: String(plan.monthlyPrice),
              priceCurrency: "USD",
              category: "subscription",
              url: `${SITE_URL}${primaryHref}`,
              availability: "https://schema.org/InStock",
            },
          },
        ]}
      />
      <PublicNav locale={locale} />

      <nav className={v.subnav} aria-label={sub.aria} data-testid="av-subnav">
        <div className={`${s.container} ${v.subnavIn}`}>
          <a href="#how">{sub.how}</a>
          <a href="#what">{sub.what}</a>
          <a href="#audit">{sub.tools}</a>
          <a href="#pricing">{sub.pricing}</a>
          <a href="#faq">{sub.faq}</a>
        </div>
      </nav>

      <section className={s.hero}>
        <div className={`${s.container} ${s.herogrid}`}>
          <div>
            <AiVisibilityLogo height={72} surface="themed" className={v.heroLogo} testId="av-hero-logo" />
            <h1 className={s.h1}>
              {c.hero.h1a}
              <span className={s.goldtext}>{c.hero.h1b}</span>
            </h1>
            <p className={s.heroSub}>{c.hero.sub}</p>
            {/* AI disclosure, text only (src/lib/i18n/ai-labels.ts). */}
            <p className={s.poweredByAi} data-testid="powered-by-ai">{aiLabels(locale).poweredByAi}</p>
            <div className={s.ctarow}>
              <a className={`${s.btn} ${s.btnPrimary}`} href={primaryHref} data-testid="av-cta-primary">
                {primaryLabel}
              </a>
              <a className={`${s.btn} ${s.btnGhost}`} href={`/${l}/ai-visibility-check`} data-testid="av-cta-check">
                {c.hero.secondary}
              </a>
            </div>
            {avEngines.length > 0 && (
              <p className={v.engines} data-testid="av-engines">
                {c.hero.engines(plan.name, listOf(locale, avEngines))}
              </p>
            )}
          </div>

          <div className={v.example} aria-label={c.mock.aria} data-testid="av-example">
            <span className={v.exampleTag}>{c.mock.label}</span>
            <p className={v.exampleQ}>“{c.mock.q}”</p>
            <p className={v.exampleLine}>{c.mock.l1}</p>
            <p className={v.exampleLine}>1. LedgerKit — {c.mock.l2desc}</p>
            <p className={`${v.exampleLine} ${v.exampleYou}`}>
              2. <strong>{c.mock.youBrand}</strong> — {c.mock.youDesc}
              <span className={v.examplePos}>{c.mock.pos}</span>
            </p>
            <p className={v.exampleLine}>3. Countable — {c.mock.l4desc}</p>
            <div className={v.exampleFoot}>
              {alertEngine && <span className={v.exampleChip}>{c.mock.alert(alertEngine)}</span>}
              <span className={v.exampleChip}>{c.mock.scoreChip(74)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.problem.h2}</h2>
          <p className={s.sub}>{c.problem.p}</p>
        </div>
      </section>

      <section id="how" className={`${s.section} ${v.anchor}`}>
        <div className={s.container}>
          <p className={s.label}>{c.how.label}</p>
          <h2 className={s.h2}>{c.how.h2}</h2>
          <div className={v.grid3}>
            <div className={v.box}>
              <h3>{c.how.steps[0].h3}</h3>
              <p>{c.how.steps[0].p(KEYWORD_SCAN_LIMIT_PER_DAY)}</p>
            </div>
            <div className={v.box}>
              <h3>{c.how.steps[1].h3}</h3>
              <p>{c.how.steps[1].p(cadenceLabel(base, plan.aiCheckup.frequency), plan.aiCheckup.repetitions)}</p>
            </div>
            <div className={v.box}>
              <h3>{c.how.steps[2].h3}</h3>
              <p>{c.how.steps[2].p}</p>
            </div>
          </div>
          <div className={v.kw} id="keywords">
            <h3 className={s.faqQ}>{c.how.kwH3}</h3>
            <KeywordWidget c={keywordWidgetCopy(base, KEYWORD_SCAN_LIMIT_PER_DAY)} ctaHref={avPlanHref(l, AV_SRC.pricing)} />
          </div>
        </div>
      </section>

      <section id="what" className={`${s.section} ${v.anchor}`}>
        <div className={s.container}>
          <p className={s.label}>{c.what.label}</p>
          <h2 className={s.h2}>{c.what.h2}</h2>
          <div className={v.grid3} data-testid="av-features">
            {features.map((id) => (
              <div className={v.box} key={id} data-feature={id}>
                <h3>{c.what.items[id].h3}</h3>
                <p>{c.what.items[id].p}</p>
              </div>
            ))}
            <div className={v.box} data-feature="score">
              <h3>{c.what.score.h3}</h3>
              <p>{c.what.score.p(weights)}</p>
              <a className={v.boxLink} href={`/${l}/methodology`}>
                {c.what.score.link}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="audit" className={`${s.section} ${v.anchor}`}>
        <div className={s.container}>
          <p className={s.label}>{c.tools.label}</p>
          <h2 className={s.h2}>{c.tools.h2}</h2>
          <div className={v.grid3}>
            <div className={`${v.box} ${v.tool}`}>
              <h3>{c.tools.check.name}</h3>
              <p>{c.tools.check.line}</p>
              <a className={v.boxLink} href={`/${l}/ai-visibility-check`}>
                {c.tools.check.cta}
              </a>
            </div>
            <div className={`${v.box} ${v.tool}`}>
              <h3>{c.tools.audit.name}</h3>
              <p>{c.tools.audit.line}</p>
              <a className={v.boxLink} href={`/${l}/free-audit`}>
                {c.tools.audit.cta}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className={`${s.section} ${v.anchor}`}>
        <div className={s.container}>
          <PricingSection
            salesSrc={AV_SRC.pricing}
            locale={l}
            pricing={pricingTiers(l, AV_LADDER)}
            priceChrome={HOME_PRICING_CHROME[l]}
            toolCountLine={toolCountLine(l, seoToolCounts())}
            tax={pricingNotes(l).tax}
            currency={pricingNotes(l).currency}
            toolsHref={`/${l}#tools`}
            header={
              <>
                <p className={s.label}>{c.pricing.label}</p>
                <h2 className={s.h2}>{c.pricing.h2}</h2>
              </>
            }
          />
          <div className={v.tableWrap}>
            <table className={v.table} data-testid="av-allowances">
              <caption>{c.pricing.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{c.pricing.cols.plan}</th>
                  <th scope="col">{c.pricing.cols.prompts}</th>
                  <th scope="col">{c.pricing.cols.engines}</th>
                  <th scope="col">{c.pricing.cols.cadence}</th>
                  <th scope="col">{c.pricing.cols.reps}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.plan} data-plan={r.plan}>
                    <td data-label={c.pricing.cols.plan}>
                      <strong>{r.name}</strong>
                    </td>
                    <td data-label={c.pricing.cols.prompts}>{r.prompts}</td>
                    <td data-label={c.pricing.cols.engines}>{listOf(locale, r.engines)}</td>
                    <td data-label={c.pricing.cols.cadence}>{cadenceLabel(base, r.frequency)}</td>
                    <td data-label={c.pricing.cols.reps}>{c.pricing.reps(r.repetitions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {adds.length > 0 && (
              <p className={v.starterAdds} data-testid="av-starter-adds">
                {c.pricing.starterAdds(PLAN_CONFIGS.STARTER.name, listOf(locale, adds))}
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="faq" className={`${s.section} ${v.anchor}`}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.faqH2}</h2>
          <div className={s.faq}>
            {faq.map((it) => (
              <div className={s.faqItem} key={it.q}>
                <h3 className={s.faqQ}>{it.q}</h3>
                <p className={s.faqA}>{it.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.section} ${v.closing}`}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.final.h2}</h2>
          <div className={`${s.ctarow} ${v.ctaCenter}`}>
            <a className={`${s.btn} ${s.btnPrimary}`} href={primaryHref} data-testid="av-cta-final">
              {primaryLabel}
            </a>
          </div>
        </div>
      </section>

      <PublicFooter locale={locale} />
    </div>
  );
}
