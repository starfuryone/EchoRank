// /[locale]/prompt-guides/[slug] — one industry prompt setup guide.
//
// ONE ROUTE, TEN GUIDES, all rendered from src/lib/prompt-guides.ts: the ten
// sections, the six tables, the five graphics, the JSON-LD and the related /
// prev-next links. An unknown slug is a 404. Copy, copy-all and print are the
// only client components on the page.
//
// The body is English under all five locales (the /learn first-pass rule), so
// the canonical is the en URL; nav, footer and CTA chrome follow the locale.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/lib/seo/JsonLd";
import {
  FIX_BUILD,
  GUIDE_COPY,
  GUIDE_FAQ,
  GUIDE_SECTIONS,
  PROMPT_GUIDES,
  PROMPT_GUIDES_BASE,
  PROMPT_ROLES,
  ROLLOUT_PLAN,
  SCORECARD,
  guideBySlug,
  guideNeighbours,
  guidePath,
  relatedGuides,
  countsByUse,
  updatedLabel,
  type GuideSection,
} from "@/lib/prompt-guides";
import { PublicNav } from "../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { CopyButton, PrintButton, Toast } from "@/components/prompt-guides/CopyTools";
import { GuideIconPanel, MeasurementFunnel, RefinementDiagram, RolloutTimeline } from "@/components/prompt-guides/GuideFigures";
import { GuideMixBars } from "@/components/prompt-guides/PromptMix";
import { CHROME, SalesCta, baseOf } from "../_shared/chrome";
import { guideGraph } from "../_shared/graph";
import s from "../../home2.module.css";
import pg from "@/components/prompt-guides/prompt-guides.module.css";

/** locale × guide — 5 × 10 = 50 static pages. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) => PROMPT_GUIDES.map((g) => ({ locale, slug: g.slug })));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const guide = guideBySlug(slug);
  if (!guide) return {};
  return buildMetadata({
    locale,
    path: guidePath(guide.slug),
    title: guide.title,
    description: guide.metaDescription,
    ogType: "article",
    canonicalLocale: "en",
  });
}

const H2 = (id: GuideSection["id"]) => GUIDE_SECTIONS.find((x) => x.id === id)!.h2;

export default async function PromptGuidePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const L = (p: string) => `/${locale}${p}`;
  const C = GUIDE_COPY;
  const chrome = CHROME[baseOf(locale)];
  const index = PROMPT_GUIDES.indexOf(guide);
  const { prev, next } = guideNeighbours(guide.slug);
  const n = guide.prompts.length;
  const allPrompts = guide.prompts.map((p) => p.text).join("\n");

  return (
    <div className={`${s.page} ${pg.root}`}>
      <PublicNav locale={locale} current="resources" />
      <JsonLd graph={guideGraph(guide, locale)} />

      <main>
        <header className={pg.hero}>
          <div className={pg.wrap}>
            <nav className={pg.crumbs} aria-label="Breadcrumb">
              <Link href={L("")}>{chrome.home}</Link>
              <span aria-hidden="true">/</span>
              <Link href={L(PROMPT_GUIDES_BASE)}>{chrome.hub}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{guide.name}</span>
            </nav>
            <div className={pg.guideHeroGrid}>
              <div>
                <p className={pg.eyebrow}>{guide.eyebrow}</p>
                <h1 className={s.h1}>{guide.title}</h1>
                <p className={pg.lead}>{guide.lead}</p>
                <div className={pg.chips}>
                  {C.chips(n).map((c, i) => (
                    <span key={c} className={i === 0 ? `${pg.chip} ${pg.chipHi}` : pg.chip}>{c}</span>
                  ))}
                  <span className={pg.chip} data-testid="updated-chip">{updatedLabel()}</span>
                  <PrintButton label={C.print} />
                </div>
                {chrome.notice && <p className={pg.notice}>{chrome.notice}</p>}
              </div>
              <GuideIconPanel id="pg-icon" guide={guide} index={index} count={PROMPT_GUIDES.length} />
            </div>
          </div>
        </header>

        <div className={`${pg.wrap} ${pg.layout}`}>
          <nav className={pg.toc} aria-label="On this page">
            <h2>{C.tocTitle}</h2>
            {GUIDE_SECTIONS.map((sec) => (
              <a key={sec.id} href={`#${sec.id}`}>{sec.toc}</a>
            ))}
          </nav>

          <article className={pg.article}>
            <section id="strategy" className={pg.articleSection}>
              <h2>{H2("strategy")}</h2>
              <p className={pg.p}>
                {C.strategy.focusPrefix} <strong>{guide.focusAreas}</strong>.
              </p>
              <div className={pg.twoCol}>
                <div className={pg.smallCard}>
                  <h3>{C.strategy.personaH}</h3>
                  <p>{guide.persona}</p>
                </div>
                <div className={pg.smallCard}>
                  <h3>{C.strategy.scenarioH}</h3>
                  <p>{guide.scenario}</p>
                </div>
              </div>
              <p className={pg.p} style={{ marginTop: 19 }}>{C.strategy.body}</p>
              <div className={pg.callout}>
                <b>{C.strategy.calloutTitle}</b>
                <p>{C.strategy.calloutBody}</p>
              </div>
            </section>

            <section id="topics" className={pg.articleSection}>
              <h2>{H2("topics")}</h2>
              <p className={pg.p}>
                {C.topics.introBefore(guide.sector)} <strong>{C.topics.introStrong}</strong>
                {C.topics.introAfter}
              </p>
              <GuideMixBars id="pg-mix" name={guide.name} counts={countsByUse(guide)} />
              <div className={pg.sectionTools}>
                <p>{C.topics.tools(n)}</p>
                <CopyButton
                  text={allPrompts}
                  label={C.topics.copyAll(n)}
                  okMessage={C.copied}
                  failMessage={C.copyFailed}
                />
              </div>
              <div className={pg.tableWrap}>
                <table className={`${pg.table} ${pg.wide}`} data-testid="prompt-table">
                  <thead>
                    <tr>
                      {C.topics.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.prompts.map((p) => (
                      <tr key={p.topic}>
                        <th scope="row">{p.topic}</th>
                        <td className={pg.promptCell}>{p.text}</td>
                        <td className={pg.useCell}>{p.use}</td>
                        <td>
                          <CopyButton
                            text={p.text}
                            label={C.topics.copy}
                            ariaLabel={`Copy ${p.topic} prompt`}
                            okMessage={C.copied}
                            failMessage={C.copyFailed}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="refinement" className={pg.articleSection}>
              <h2>{H2("refinement")}</h2>
              <p className={pg.p}>{C.refinement.intro}</p>
              <RefinementDiagram id="pg-refine" guide={guide} />
              <p className={pg.p} style={{ fontSize: 13.5 }}>{C.refinement.note}</p>
              <h3 className={pg.h3}>{C.refinement.h3}</h3>
              <p className={pg.p}>
                {C.refinement.varyBefore} <strong>{C.refinement.varyStrong}</strong> {C.refinement.varyAfter}
              </p>
            </section>

            <section id="categories" className={pg.articleSection}>
              <h2>{H2("categories")}</h2>
              <p className={pg.p}>{C.categories.intro}</p>
              <div className={pg.tableWrap}>
                <table className={pg.table}>
                  <thead>
                    <tr>
                      {C.categories.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROMPT_ROLES.map((r) => (
                      <tr key={r.role}>
                        <th scope="row">{r.role}</th>
                        <td>{r.howToWrite}</td>
                        <td>{r.whatToMeasure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={pg.p} style={{ marginTop: 16 }}>{C.categories.after}</p>
            </section>

            <section id="tags" className={pg.articleSection}>
              <h2>{H2("tags")}</h2>
              <p className={pg.p}>{C.tags.intro}</p>
              <div className={pg.tableWrap}>
                <table className={pg.table}>
                  <thead>
                    <tr>
                      {C.tags.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.tags.map((t) => (
                      <tr key={t.dimension}>
                        <th scope="row">{t.dimension}</th>
                        <td>
                          <div className={pg.tagCloud}>
                            {t.labels.map((label) => (
                              <span key={label} className={pg.tag}>{label}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={pg.p} style={{ marginTop: 17 }}>{C.tags.after}</p>
            </section>

            <section id="measurement" className={pg.articleSection}>
              <h2>{H2("measurement")}</h2>
              <p className={pg.p}>{C.measurement.intro}</p>
              <MeasurementFunnel id="pg-funnel" />
              <div className={pg.tableWrap}>
                <table className={pg.table}>
                  <thead>
                    <tr>
                      {C.measurement.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCORECARD.map((r) => (
                      <tr key={r.measure}>
                        <th scope="row">{r.measure}</th>
                        <td>{r.definition}</td>
                        <td>{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`${pg.callout} ${pg.calloutWarn}`}>
                <b>{C.measurement.safeguardTitle}</b>
                <p>{guide.safeguard}</p>
              </div>
              <h3 className={pg.h3}>{C.measurement.sotH3}</h3>
              <p className={pg.p}>{guide.sourceOfTruth}</p>
              <div className={pg.tableWrap}>
                <table className={pg.table} data-testid="source-table">
                  <thead>
                    <tr>
                      {C.measurement.sotHead.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.sourceRows.map((r) => (
                      <tr key={r.claim}>
                        <th scope="row">{r.claim}</th>
                        <td>{r.source}</td>
                        <td>{C.measurement.whatToLog}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={pg.p}>{C.measurement.sotTail}</p>
            </section>

            <section id="actions" className={pg.articleSection}>
              <h2>{H2("actions")}</h2>
              <p className={pg.p}>{C.actions.intro}</p>
              <ol className={pg.ol}>
                {guide.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
              <h3 className={pg.h3}>{C.actions.h3}</h3>
              <div className={pg.tableWrap}>
                <table className={pg.table} data-testid="fix-build-table">
                  <thead>
                    <tr>
                      {C.actions.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FIX_BUILD.map((r) => (
                      <tr key={r.issue}>
                        <th scope="row">{r.priority}</th>
                        <td>{r.issue}</td>
                        <td>{r.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="research" className={pg.articleSection}>
              <h2>{H2("research")}</h2>
              <p className={pg.p}>
                {C.research.introBefore} <em>{C.research.introEm}</em>
                {C.research.introAfter}
              </p>
              <div className={pg.tableWrap}>
                <table className={pg.table}>
                  <thead>
                    <tr>
                      {C.research.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.researchQuestions.map((q, i) => (
                      <tr key={q}>
                        <td className={pg.promptCell}>{q}</td>
                        <td>
                          <CopyButton
                            text={q}
                            label={C.topics.copy}
                            ariaLabel={`Copy research question ${i + 1}`}
                            okMessage={C.copied}
                            failMessage={C.copyFailed}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={pg.p} style={{ marginTop: 16 }}>{C.research.after}</p>
            </section>

            <section id="plan" className={pg.articleSection}>
              <h2>{H2("plan")}</h2>
              <RolloutTimeline id="pg-plan" />
              <div className={pg.tableWrap}>
                <table className={pg.table}>
                  <thead>
                    <tr>
                      {C.plan.head.map((h) => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLLOUT_PLAN.map((r) => (
                      <tr key={r.when}>
                        <th scope="row">{r.when}</th>
                        <td>{r.focus}</td>
                        <td>{r.deliverable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className={pg.h3}>{C.plan.cadenceH3}</h3>
              <p className={pg.p}>
                {guide.cadence} {C.plan.cadenceTail}
              </p>
            </section>

            <section id="faq" className={pg.articleSection}>
              <h2>{H2("faq")}</h2>
              <div className={s.faq}>
                {GUIDE_FAQ.map((it) => (
                  <div key={it.q} className={s.faqItem}>
                    <h3 className={s.faqQ}>{it.q}</h3>
                    <p className={s.faqA}>{it.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <SalesCta locale={locale} h2={C.cta.h2} body={C.cta.body} />

            <h3 className={pg.h3}>{C.related}</h3>
            <div className={pg.related}>
              {relatedGuides(guide.slug).map((r) => (
                <Link key={r.slug} href={L(guidePath(r.slug))} className={`${pg.chip} ${pg.chipLink}`}>
                  {r.name}
                </Link>
              ))}
            </div>
            <nav className={pg.prevnext} aria-label="Adjacent industry guides">
              {prev && (
                <Link href={L(guidePath(prev.slug))}>
                  <span>← {C.prev}</span>
                  {prev.name}
                </Link>
              )}
              {next && (
                <Link href={L(guidePath(next.slug))} className={pg.next}>
                  <span>{C.next} →</span>
                  {next.name}
                </Link>
              )}
            </nav>
          </article>
        </div>
      </main>

      <PublicFooter locale={locale} />
      <Toast />
    </div>
  );
}
