// /[locale]/site-crawler — the crawler's public page (SITE-CRAWLER-PUBLIC-PAGE.md).
//
// A PAGE COMPONENT, not a String.raw landing payload: the capability list, the
// feature table and the FAQ are GATED (src/lib/site-crawler/marketing-copy.ts),
// and a static HTML string cannot read the registry or the flags. Same visual
// language as /solutions — home2 classes, the /01 /02 labels, Binance tokens.
//
// Gates are evaluated here, server-side at render: a rule family counts when it
// is in the registry, a flag when it is on in src/lib/flags.ts. A closed gate
// renders nothing. Phase 4 ships features by flipping flags, not by editing
// this file.
//
// Every number is read: the rule count from the registry (rule-count.ts), caps
// and plan names from PLAN_CONFIGS, prices through PricingSection.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import {
  JsonLd,
  ORGANIZATION_ID,
  PLANS,
  PRICE_CURRENCY,
  SITE_URL,
  SOFTWARE_ID,
  baseGraph,
  breadcrumbList,
  buildMetadata,
  faqPage,
  softwareApplication,
} from "@/lib/seo";
import { RULES } from "@/lib/crawl-rules";
import { FLAGS, flag } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { HOME_PRICING_CHROME, PRICING_NOTES, toolCountLine } from "@/lib/i18n/content";
import { pricingTiers } from "@/lib/pricing-tiers";
import { seoToolCounts } from "@/lib/seo-tools";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import {
  CRAWL_CLOSER,
  CRAWL_INTRO,
  CRAWL_PLANS,
  FREE_COLUMN,
  FREE_TRY_STRIP,
  capabilityBody,
  featureCells,
  visibleCapabilities,
  visibleFaq,
  visibleFeatureRows,
  type CopyBase,
  type GateContext,
} from "@/lib/site-crawler/marketing-copy";
import { FREE_TOOLS_BASE } from "@/lib/free-tools";
import { PublicNav } from "../PublicNav";
import { PricingSection } from "../PricingSection";
import { PublicFooter } from "@/components/PublicFooter";
import { CrawlerCta } from "./CrawlerCta";
import { CRAWLER_GUIDES_HREF } from "@/lib/crawler-guides-link";
import s from "../home2.module.css";
import c from "./site-crawler.module.css";

const FREE_CRAWLER_PATH = `${FREE_TOOLS_BASE}/site-crawler`;

const PATH = "/site-crawler";
const NB = CRAWLER_BRAND.name;

const baseOf = (locale: string): CopyBase => (locale.startsWith("fr") ? "fr" : "en");

const PLANS_BY_ID = {
  STARTER: PLAN_CONFIGS.STARTER,
  GROWTH: PLAN_CONFIGS.GROWTH,
  AGENCY: PLAN_CONFIGS.AGENCY,
} as const;

const num = (n: number, base: CopyBase) => new Intl.NumberFormat(base === "fr" ? "fr-CA" : "en-US").format(n);

// Page chrome. The capability, feature and FAQ copy is NOT here — it lives in
// marketing-copy.ts so the guide renders the same words.
const COPY = {
  en: {
    metaTitle: `${NB} — site crawler by Echorank`,
    h1: "The site crawler that shows its evidence.",
    lead: (rules: string) =>
      `${NB} crawls every page of a site the way a search engine does, checks each one against ${rules} rules, and puts the proof next to every finding. Hosted, scheduled, shared with your team — nothing to install.`,
    seePlans: "See plans",
    open: `Open ${NB}`,
    compare: "How it compares to a desktop crawler",
    guides: "Guides",
    reportsLabel: "WHAT IT REPORTS",
    reportsH2: `What ${NB} crawls and reports`,
    featuresLabel: "FEATURES",
    featuresH2: "Every feature, by plan",
    feature: "Feature",
    included: "Included",
    hostedLabel: "HOSTED",
    hostedH2: "Hosted, not installed",
    pricingLabel: "PRICING",
    pricingH2: "Included in every paid plan",
    faqLabel: "FAQ",
    faqH2: "Questions",
  },
  fr: {
    metaTitle: `${NB} — robot d'exploration par Echorank`,
    h1: "Le robot d'exploration qui montre ses preuves.",
    lead: (rules: string) =>
      `${NB} explore chaque page d'un site comme le fait un moteur de recherche, la vérifie selon ${rules} règles et place la preuve à côté de chaque constat. Hébergé, planifié, partagé avec votre équipe — rien à installer.`,
    seePlans: "Voir les forfaits",
    open: `Ouvrir ${NB}`,
    compare: "Comparé à un robot à installer",
    guides: "Guides",
    reportsLabel: "CE QU'IL SIGNALE",
    reportsH2: `Ce que ${NB} explore et signale`,
    featuresLabel: "FONCTIONS",
    featuresH2: "Chaque fonction, par forfait",
    feature: "Fonction",
    included: "Inclus",
    hostedLabel: "HÉBERGÉ",
    hostedH2: "Hébergé, pas installé",
    pricingLabel: "TARIFS",
    pricingH2: "Inclus dans chaque forfait payant",
    faqLabel: "FAQ",
    faqH2: "Questions",
  },
} as const;

/**
 * The four "Hosted, not installed" cards. Led by the seat rule: PlanConfig has
 * no seat cap (team invites are unlimited), so the copy says "your whole
 * team". If a seat cap is ever added to PlanConfig this card must read it, in
 * the same commit — tests/site-crawler-public-page.test.tsx fails until it does.
 */
function hostedCards(base: CopyBase) {
  const agency = PLAN_CONFIGS.AGENCY;
  const reports = flag("crawl.reports");
  const cards =
    base === "fr"
      ? [
          { id: "team", title: "Un forfait, toute votre équipe", body: "Les places sont par espace de travail, pas par utilisateur : toute votre équipe partage les mêmes explorations. Les robots à installer se vendent avec une licence par utilisateur ou par poste." },
          { id: "servers", title: "Tourne sur nos serveurs", body: `Aucune limite de mémoire sur votre portable, rien à laisser ouvert la nuit. Jusqu'à ${num(agency.crawlUrlCap, base)} URL par exploration avec ${agency.name}.` },
          ...(flag("crawl.schedule") ? [{ id: "schedule", title: "Selon un horaire", body: "Des explorations quotidiennes, hebdomadaires ou mensuelles qui tournent sans vous." }] : []),
          { id: "exports", title: "Tout s'exporte", body: reports ? "Du CSV sur chaque tableau, Google Sheets et un rapport PDF pour chaque exploration." : "Du CSV sur chaque tableau." },
        ]
      : [
          { id: "team", title: "One plan, your whole team", body: "Seats are per workspace, not per user: everyone on your plan works from the same crawls. Desktop crawlers sell a licence per user, or per machine." },
          { id: "servers", title: "Runs on our servers", body: `No RAM limit on your laptop, nothing to leave running overnight. Up to ${num(agency.crawlUrlCap, base)} URLs per crawl on ${agency.name}.` },
          ...(flag("crawl.schedule") ? [{ id: "schedule", title: "On a schedule", body: "Daily, weekly or monthly crawls that run without you." }] : []),
          { id: "exports", title: "Everything exports", body: reports ? "CSV on every table, plus Google Sheets and a PDF report for every crawl." : "CSV on every table." },
        ];
  return cards;
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = COPY[baseOf(locale)];
  const description = t.lead(ruleCountLabel());
  const meta = buildMetadata({ locale, path: PATH, title: t.metaTitle, description, ogImage: "/nosy-bat/og.png" });
  // The title already ends in "by Echorank"; brandTitle would strip that tail
  // and append "| Echorank360", leaving "… crawler by | Echorank360".
  return {
    ...meta,
    title: { absolute: t.metaTitle },
    openGraph: { ...meta.openGraph, title: t.metaTitle },
    twitter: { ...meta.twitter, title: t.metaTitle },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const l = locale as Locale;
  const base = baseOf(l);
  const t = COPY[base];
  const link = (href: string) => `/${l}${href}`;
  // The free public crawler's entry points (Try it free strip, the Free column).
  const freeOn = flag("crawl.free");
  const url = `${SITE_URL}/${l}${PATH}`;

  const ctx: GateContext = { families: new Set(RULES.map((r) => r.family)), flags: FLAGS };
  const capabilities = visibleCapabilities(ctx);
  const rows = visibleFeatureRows(ctx);
  const faq = visibleFaq({ ...ctx, plans: PLANS_BY_ID }, base);
  const lead = t.lead(ruleCountLabel());

  const crawlerNode = {
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: CRAWLER_BRAND.nameTm,
    alternateName: NB,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Site crawler",
    operatingSystem: "Web",
    url,
    description: lead,
    image: `${SITE_URL}${CRAWLER_BRAND.markOnDark}`,
    isPartOf: { "@id": SOFTWARE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    // From PLAN_CONFIGS via PLANS — the same prices the cards below render.
    offers: PLANS.map((p) => ({ "@type": "Offer", name: p.name, price: p.price, priceCurrency: PRICE_CURRENCY, category: "subscription" })),
  };

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="solutions" />
      <JsonLd
        graph={[
          ...baseGraph(l),
          softwareApplication(l),
          crawlerNode,
          faqPage(faq, url),
          breadcrumbList([
            { name: "Echorank360", url: `${SITE_URL}/${l}` },
            { name: NB, url },
          ]),
        ]}
      />

      {/* /01 — hero */}
      <section className={s.section}>
        <div className={s.container}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG lockup */}
          <img className={`${c.lockup} ${c.lockupDark}`} src={CRAWLER_BRAND.logoOnDark} alt={`${CRAWLER_BRAND.nameTm} — ${CRAWLER_BRAND.byline}`} width={230} height={72} />
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG lockup */}
          <img className={`${c.lockup} ${c.lockupLight}`} src={CRAWLER_BRAND.logoOnLight} alt="" aria-hidden="true" width={230} height={72} />
          <h1 className={s.h1}>{t.h1}</h1>
          <p className={s.sub}>{lead}</p>
          <div className={s.ctarow} style={{ marginTop: 24 }}>
            <CrawlerCta pricingHref={link("/pricing")} plansLabel={t.seePlans} openLabel={t.open} />
            <a className={c.textLink} href="#hosted">{t.compare}</a>
            {/* One link, not a strip of cards: the four guides are listed on
                the guides index (#nosy-bat), and only there. */}
            <a className={c.textLink} href={link(CRAWLER_GUIDES_HREF)} data-testid="crawler-guides-link">{t.guides}</a>
          </div>
        </div>
      </section>

      {/* /02 — capabilities */}
      <section id="reports" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {t.reportsLabel}</p>
          <h2 className={s.h2}>{t.reportsH2}</h2>
          <p className={s.sub} style={{ maxWidth: 760 }}>{CRAWL_INTRO[base]}</p>
          <ul className={c.capList}>
            {capabilities.map((cap) => (
              <li key={cap.id} className={c.capItem}>
                <h3 id={cap.id} className={c.capTitle}>{cap.title[base]}</h3> — {capabilityBody(cap, base)}
              </li>
            ))}
          </ul>
          <p className={c.closer}>{CRAWL_CLOSER[base]}</p>
        </div>
      </section>

      {/* /03 — feature table */}
      <section id="features" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 03</b> — {t.featuresLabel}</p>
          <h2 className={s.h2}>{t.featuresH2}</h2>
          <div className={c.tableWrap}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th scope="col">{t.feature}</th>
                  {freeOn && <th scope="col">{FREE_COLUMN.head[base]}</th>}
                  {CRAWL_PLANS.map((p) => (
                    <th key={p} scope="col">{PLAN_CONFIGS[p].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cells = featureCells(r, PLANS_BY_ID, base);
                  return (
                    <tr key={r.id}>
                      <th scope="row" style={{ textTransform: "none", fontFamily: "inherit", fontSize: 14, letterSpacing: 0, color: "var(--text)" }}>
                        {r.label[base]}
                      </th>
                      {/* The free crawler (crawl.free): one fixed offer, one cell down the column. */}
                      {freeOn && i === 0 && (
                        <td rowSpan={rows.length} data-testid="free-column">
                          {FREE_COLUMN.summary[base]}
                          <br />
                          <a className={c.textLink} href={link(FREE_CRAWLER_PATH)}>
                            {FREE_COLUMN.link[base]}
                          </a>
                        </td>
                      )}
                      {CRAWL_PLANS.map((p) => (
                        <td key={p}>
                          {cells[p] === true ? (
                            <span className={c.tick} role="img" aria-label={t.included}>✓</span>
                          ) : (
                            cells[p]
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* /04 — hosted */}
      <section id="hosted" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 04</b> — {t.hostedLabel}</p>
          <h2 className={s.h2}>{t.hostedH2}</h2>
          <div className={c.hostedGrid}>
            {hostedCards(base).map((card) => (
              <div key={card.id} className={s.ucCard}>
                <span className={s.ucTitle}>{card.title}</span>
                <span className={s.ucBody}>{card.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Try it free (crawl.free): the free public crawler, above the pricing strip. */}
      {freeOn && (
        <section id="try-free" className={s.section} data-testid="try-free-strip">
          <div className={s.container}>
            <p className={s.label}><b>{FREE_TRY_STRIP.label[base]}</b></p>
            <h2 className={s.h2}>{FREE_TRY_STRIP.h2[base]}</h2>
            <p className={s.sub}>{FREE_TRY_STRIP.body[base]}</p>
            <div className={s.ctarow} style={{ marginTop: 20 }}>
              <a className={`${s.btn} ${s.btnPrimary}`} href={link(FREE_CRAWLER_PATH)}>
                {FREE_TRY_STRIP.button[base]}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* /05 — pricing strip: the shared cards, no new pricing copy */}
      <section id="pricing" className={s.section}>
        <div className={s.container}>
          <PricingSection
            locale={l}
            pricing={pricingTiers(l)}
            priceChrome={HOME_PRICING_CHROME[l]}
            toolCountLine={toolCountLine(l, seoToolCounts())}
            tax={PRICING_NOTES[base].tax}
            currency={PRICING_NOTES[base].currency}
            toolsHref={`/${l}#tools`}
            header={
              <>
                <p className={s.label}><b>/ 05</b> — {t.pricingLabel}</p>
                <h2 className={s.h2}>{t.pricingH2}</h2>
              </>
            }
          />
        </div>
      </section>

      {/* /06 — FAQ. Answers always visible: the FAQPage JSON-LD above is built
          from the same array, so markup and page cannot disagree. */}
      <section id="faq" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 06</b> — {t.faqLabel}</p>
          <h2 className={s.h2}>{t.faqH2}</h2>
          <div className={s.faq}>
            {faq.map((it) => (
              <div className={s.faqItem} key={it.q}>
                <h3 className={s.faqQ}>{it.q}</h3>
                <p className={s.faqA}>{it.a}</p>
              </div>
            ))}
          </div>
          <div className={s.ctarow} style={{ marginTop: 28 }}>
            <CrawlerCta pricingHref={link("/pricing")} plansLabel={t.seePlans} openLabel={t.open} />
          </div>
        </div>
      </section>

      <PublicFooter locale={l} />
    </div>
  );
}
