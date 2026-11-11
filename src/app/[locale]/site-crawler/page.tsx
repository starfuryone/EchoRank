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
import { videoObject } from "@/lib/seo/jsonld";
import { NB_INTRO_ANCHOR, NB_INTRO_VIDEO } from "@/lib/site-crawler/intro-video";
import { HomeVideo } from "../HomeVideo";
import { RULES } from "@/lib/crawl-rules";
import { FLAGS, flag } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { HOME_PRICING_CHROME, HOME_TOOLS, pricingNotes, toolCountLine } from "@/lib/i18n/content";
import { pricingTiers } from "@/lib/pricing-tiers";
import { seoToolCounts } from "@/lib/seo-tools";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { familyIsPublic, ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { buildNosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { launchedPlans } from "@/lib/stripe/catalog";
import type { LaunchedPlans } from "@/lib/plan-launch";
import { pitchCopy } from "@/lib/site-crawler/pitch-copy";
import {
  CRAWL_CLOSER,
  CRAWL_PLANS,
  CRAWLER_BYLINE,
  FREE_COLUMN,
  FREE_TRY_STRIP,
  capabilityBody,
  featureCells,
  visibleCapabilities,
  visibleFaq,
  faqPlainText,
  visibleFeatureRows,
  type CopyBase,
  type GateContext,
} from "@/lib/site-crawler/marketing-copy";
import { nosybatPlanTable } from "@/lib/site-crawler/nosybat-plan-table";
import { salesContactHref } from "@/lib/sales/inquiry-options";
import { FREE_TOOLS_BASE } from "@/lib/free-tools";
import { PublicNav } from "../PublicNav";
import { PricingSection } from "../PricingSection";
import { PublicFooter } from "@/components/PublicFooter";
import { CrawlerCta } from "./CrawlerCta";
import { NosyBatLogo } from "@/components/brand/NosyBatLogo";
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
    seePlans: "See plans",
    open: `Open ${NB}`,
    videoLabel: `Meet ${NB}`,
    videoH2: "Two minutes, every feature.",
    videoAria: `${NB}: the intro video`,
    videoDesc: `A tour of ${NB}, the site crawler inside Echorank: what it checks, the proof behind every finding, exports and scheduling, and the free 100-page crawl.`,
    videoPrefer: "Prefer reading? The full feature list is just below.",
    compare: "How it compares to a desktop crawler",
    guides: "Guides",
    reportsLabel: "WHAT IT REPORTS",
    reportsH2: `What ${NB} crawls and reports`,
    featuresLabel: "FEATURES",
    featuresH2: "By plan",
    limit: "Limit",
    enterpriseNote: (name: string) => `${name}: custom limits.`,
    enterpriseLink: "Talk to us",
    allFeatures: "Every feature, with its limit per crawl",
    feature: "Feature",
    included: "Included",
    hostedLabel: "HOSTED",
    hostedH2: "Hosted, not installed",
    pricingLabel: "PRICING",
    pricingH2: "Included in every plan from Starter",
    faqLabel: "FAQ",
    faqH2: "Questions",
  },
  fr: {
    seePlans: "Voir les forfaits",
    open: `Ouvrir ${NB}`,
    videoLabel: `Découvrez ${NB}`,
    videoH2: "Deux minutes, toutes les fonctionnalités.",
    videoAria: `${NB} : la vidéo de présentation`,
    videoDesc: `Une visite de ${NB}, le robot d'exploration d'Echorank : ce qu'il vérifie, la preuve derrière chaque constat, les exports et la planification, et l'exploration gratuite de 100 pages.`,
    videoPrefer: "Vous préférez lire ? La liste complète des fonctionnalités est juste en dessous.",
    compare: "Comparé à un robot à installer",
    guides: "Guides",
    reportsLabel: "CE QU'IL SIGNALE",
    reportsH2: `Ce que ${NB} explore et signale`,
    featuresLabel: "FONCTIONS",
    featuresH2: "Par forfait",
    limit: "Limite",
    enterpriseNote: (name: string) => `${name} : limites sur mesure.`,
    enterpriseLink: "Parlons-en",
    allFeatures: "Chaque fonction, avec sa limite par exploration",
    feature: "Fonction",
    included: "Inclus",
    hostedLabel: "HÉBERGÉ",
    hostedH2: "Hébergé, pas installé",
    pricingLabel: "TARIFS",
    pricingH2: "Inclus dans chaque forfait à partir de Starter",
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

/**
 * The page's facts, from the registry as it is at render (a test stubs it),
 * the plan config and the free crawl's limits: nosybat-facts.ts.
 */
const pageFacts = (launched?: LaunchedPlans) => buildNosybatFacts({ rules: RULES.filter((r) => familyIsPublic(r.family)), launched });

// Regenerated every five minutes: the crawler-only plan's card (first) and
// column appear once its stripe_prices rows exist (src/lib/stripe/catalog.ts),
// without a rebuild. Cloudflare's copy still needs the purge after the seed.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  // The title is the H1 and the description the sub-line, from the pitch copy.
  const p = pitchCopy(pageFacts(await launchedPlans()), baseOf(locale));
  const title = p.h1.replace(/\.$/, "");
  const meta = buildMetadata({ locale, path: PATH, title, description: p.sub, ogImage: "/nosy-bat/og.png" });
  // Absolute: brandTitle would append "| Echorank360" to a title that is already a sentence.
  return {
    ...meta,
    title: { absolute: title },
    openGraph: { ...meta.openGraph, title },
    twitter: { ...meta.twitter, title },
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
  const faq = visibleFaq({ ...ctx, plans: PLANS_BY_ID, ruleCount: ruleCountLabel() }, base);
  // The catalog-gated plans on sale: the crawler-only plan joins the table,
  // the cards (first) and the offers once its Stripe prices exist.
  const launched = await launchedPlans();
  const facts = pageFacts(launched);
  const pitch = pitchCopy(facts, base);
  // The by-plan table (nosybat-plan-table.ts): the same rows /pricing shows.
  const planCols = facts.crawlPlans;
  const planRows = nosybatPlanTable(facts, base);
  const lead = pitch.sub;
  const freeHref = link(FREE_CRAWLER_PATH);
  const plansHref = (src: string) => `${link("/pricing")}?src=${src}`;
  // The hero's and the closing band's two buttons: the free crawl, then the plans.
  const buttons = (src: string) => (
    <>
      {pitch.freeButton && (
        <a className={`${s.btn} ${s.btnPrimary}`} href={freeHref} data-testid={`${src}-free`}>
          {pitch.freeButton}
        </a>
      )}
      <a className={`${s.btn}${pitch.freeButton ? "" : ` ${s.btnPrimary}`}`} href={plansHref(src)} data-testid={`${src}-plans`}>
        {pitch.plansButton}
      </a>
    </>
  );

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
    image: `${SITE_URL}${CRAWLER_BRAND.markPng}`,
    isPartOf: { "@id": SOFTWARE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    // From PLAN_CONFIGS via PLANS — the same prices the cards below render.
    offers: [
      // The crawler-only plan's offer while it is on sale, then the ladder's.
      ...(launched.has("NOSY_BAT") ? [{ name: PLAN_CONFIGS.NOSY_BAT.name, price: String(PLAN_CONFIGS.NOSY_BAT.monthlyPrice) }] : []),
      ...PLANS,
    ].map((p) => ({ "@type": "Offer", name: p.name, price: p.price, priceCurrency: PRICE_CURRENCY, category: "subscription" })),
  };

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="solutions" />
      <JsonLd
        graph={[
          ...baseGraph(l),
          softwareApplication(l),
          crawlerNode,
          // The whole answer, bullets included, as the page shows it.
          faqPage(faq.map((f) => ({ q: f.q, a: faqPlainText(f) })), url),
          videoObject({
            name: t.videoAria,
            description: t.videoDesc,
            thumbnailUrl: NB_INTRO_VIDEO.poster,
            contentUrl: NB_INTRO_VIDEO.src,
            uploadDate: NB_INTRO_VIDEO.uploadDate,
            durationSeconds: NB_INTRO_VIDEO.durationSeconds,
            pageUrl: url,
            inLanguage: base,
          }),
          breadcrumbList([
            { name: "Echorank360", url: `${SITE_URL}/${l}` },
            { name: NB, url },
          ]),
        ]}
      />

      {/* /01 — hero */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={c.lockup} data-testid="hero-lockup">
            <NosyBatLogo height={72} alt={CRAWLER_BRAND.name} tone="accent" themed />
            <p className={c.byline}>{CRAWLER_BYLINE[base]}</p>
          </div>
          <h1 className={s.h1}>{pitch.h1}</h1>
          <p className={s.sub}>{lead}</p>
          <div className={s.ctarow} style={{ marginTop: 24 }}>
            {buttons("site-crawler-hero")}
            <a className={c.textLink} href="#hosted">{t.compare}</a>
            {/* One link, not a strip of cards: the four guides are listed on
                the guides index (#nosy-bat), and only there. */}
            <a className={c.textLink} href={link(CRAWLER_GUIDES_HREF)} data-testid="crawler-guides-link">{t.guides}</a>
          </div>
        </div>
      </section>

      {/* The pitch: six short blocks straight under the hero (pitch-copy.ts).
          Unnumbered, so the sections below keep their numbers. */}
      <section id="why" className={s.section} data-testid="nb-pitch">
        <div className={s.container}>
          <div className={c.pitchGrid}>
            {pitch.blocks.map((blk) => (
              <div key={blk.id} className={s.ucCard} data-block={blk.id}>
                <h2 className={c.pitchTitle}>{blk.heading}</h2>
                <p className={c.pitchBody}>{blk.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The intro video: after the hero, before the capabilities. Unnumbered,
          like the "Try it free" strip, so the sections below keep their numbers. */}
      <section id={NB_INTRO_ANCHOR} className={s.section} data-testid="nb-intro-video">
        <div className={s.container}>
          <p className={s.label}><b>{t.videoLabel}</b></p>
          <h2 className={s.h2}>{t.videoH2}</h2>
          <div className={c.videoCard}>
            <HomeVideo
              wrapClassName={c.videoWrap}
              className={c.video}
              src={NB_INTRO_VIDEO.src}
              poster={NB_INTRO_VIDEO.poster}
              ariaLabel={t.videoAria}
              labels={HOME_TOOLS[l].player}
              tracks={NB_INTRO_VIDEO.tracks}
            />
          </div>
          <p className={c.videoPrefer}>{t.videoPrefer}</p>
          <div className={s.ctarow} style={{ marginTop: 14, justifyContent: "center" }}>
            <CrawlerCta pricingHref={link("/pricing")} plansLabel={t.seePlans} openLabel={t.open} />
          </div>
        </div>
      </section>

      {/* /02 — capabilities */}
      <section id="reports" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {t.reportsLabel}</p>
          <h2 className={s.h2}>{t.reportsH2}</h2>
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
          {/* The by-plan table (nosybat-plan-table.ts): the same rows /pricing shows. */}
          <div className={c.tableWrap}>
            <table className={c.table} data-testid="plan-table">
              <thead>
                <tr>
                  <th scope="col">{t.limit}</th>
                  {freeOn && <th scope="col">{FREE_COLUMN.head[base]}</th>}
                  {planCols.map((p) => (
                    <th key={p.id} scope="col">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planRows.map((r, i) => (
                  <tr key={r.id} data-row={r.id}>
                    <th scope="row" style={{ textTransform: "none", fontFamily: "inherit", fontSize: 14, letterSpacing: 0, color: "var(--text)" }}>
                      {r.label}
                    </th>
                    {/* The free crawler (crawl.free): one fixed offer, one cell down the column. */}
                    {freeOn && i === 0 && (
                      <td rowSpan={planRows.length} data-testid="free-column">
                        {FREE_COLUMN.summary[base]}
                        <br />
                        <a className={c.textLink} href={link(FREE_CRAWLER_PATH)}>
                          {FREE_COLUMN.link[base]}
                        </a>
                      </td>
                    )}
                    {r.all !== undefined ? (
                      <td colSpan={planCols.length}>{r.all}</td>
                    ) : (
                      planCols.map((p) => <td key={p.id}>{r.cell!(p)}</td>)
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={c.tableNote} data-testid="enterprise-limits">
            {t.enterpriseNote(facts.plans.ENTERPRISE.name)}{" "}
            <a className={c.textLink} href={salesContactHref(l, "site-crawler-table")}>{t.enterpriseLink}</a>
          </p>
          {/* Every feature with its per-crawl limit, folded: the table above is the comparison. */}
          <details className={c.allFeatures} data-testid="all-features">
            <summary>{t.allFeatures}</summary>
            <div className={c.tableWrap}>
              <table className={c.table}>
                <thead>
                  <tr>
                    <th scope="col">{t.feature}</th>
                    {CRAWL_PLANS.map((p) => (
                      <th key={p} scope="col">{PLAN_CONFIGS[p].name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const cells = featureCells(r, PLANS_BY_ID, base);
                    return (
                      <tr key={r.id}>
                        <th scope="row" style={{ textTransform: "none", fontFamily: "inherit", fontSize: 14, letterSpacing: 0, color: "var(--text)" }}>
                          {r.label[base]}
                        </th>
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
          </details>
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
            salesSrc="site-crawler-pricing"
            locale={l}
            // Starter, Growth and Agency only: the AI Visibility plan has no crawler.
            // The crawl plans: the crawler-only plan first once it is on sale,
            // then Starter, Growth and Agency (the AI-only plan has no crawler).
            pricing={pricingTiers(l, facts.crawlPlans.map((p) => p.id), { launched })}
            priceChrome={HOME_PRICING_CHROME[l]}
            toolCountLine={toolCountLine(l, seoToolCounts())}
            tax={pricingNotes(l).tax}
            currency={pricingNotes(l).currency}
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
                {it.list && (
                  <ul className={s.faqA} style={{ paddingLeft: 20, marginTop: 10 }}>
                    {it.list.map((item) => (
                      <li key={item.lead} style={{ marginBottom: 8 }}>
                        <strong>{item.lead}</strong> {item.text}
                        {item.sub && (
                          <ul style={{ paddingLeft: 20, margin: "4px 0" }}>
                            {item.sub.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        )}
                        {item.after && <> {item.after}</>}
                      </li>
                    ))}
                  </ul>
                )}
                {it.after && (
                  <p className={s.faqA} style={{ marginTop: 10 }}>
                    <strong>{it.after.lead}</strong> {it.after.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing band: the free crawl and the plans, the same two buttons as the hero. */}
      <section id="start" className={s.section} data-testid="nb-closing">
        <div className={s.container}>
          <p className={c.closingLine}>{pitch.closing}</p>
          <div className={s.ctarow} style={{ marginTop: 18 }}>
            {buttons("site-crawler-closing")}
          </div>
        </div>
      </section>

      <PublicFooter locale={l} />
    </div>
  );
}
