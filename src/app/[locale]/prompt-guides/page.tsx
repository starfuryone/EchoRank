// /[locale]/prompt-guides — the industry prompt setup guides hub.
//
// Typed config + real React route, like Solutions; everything on the page is
// read from src/lib/prompt-guides.ts, including the three stats, the glance
// table, the prompt-mix chart and its numbers. Only the card filter is a
// client component.
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
  HUB_COPY,
  MEASUREMENT_PRINCIPLES,
  PROMPT_GUIDES,
  PROMPT_GUIDES_BASE,
  PROMPT_GUIDE_FRAMEWORKS,
  PROMPT_GUIDE_ICONS,
  PROMPT_MODES,
  PROMPT_USES,
  guidePath,
  countsByUse,
  totalPrompts,
  totalsByUse,
} from "@/lib/prompt-guides";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { GuideFilter } from "@/components/prompt-guides/GuideFilter";
import { HubHero, MethodFlow } from "@/components/prompt-guides/HubFigures";
import { PromptMixChart } from "@/components/prompt-guides/PromptMix";
import { UseSwatch } from "@/components/prompt-guides/svg";
import { CHROME, SalesCta, baseOf } from "./_shared/chrome";
import { hubGraph } from "./_shared/graph";
import s from "../home2.module.css";
import pg from "@/components/prompt-guides/prompt-guides.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: PROMPT_GUIDES_BASE,
    title: HUB_COPY.title,
    description: HUB_COPY.metaDescription(PROMPT_GUIDES.length),
    canonicalLocale: "en",
  });
}

export default async function PromptGuidesHub({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const L = (p: string) => `/${locale}${p}`;
  const H = HUB_COPY;
  const chrome = CHROME[baseOf(locale)];
  const totals = totalsByUse();
  const mixRows = PROMPT_GUIDES.map((g) => ({ name: g.name, counts: countsByUse(g) }));
  const stats = [PROMPT_GUIDES.length, totalPrompts(), PROMPT_GUIDE_FRAMEWORKS];

  return (
    <div className={`${s.page} ${pg.root}`}>
      <PublicNav locale={locale} current="resources" />
      <JsonLd graph={hubGraph(locale)} />

      <main>
        <section className={pg.hero}>
          <div className={`${pg.wrap} ${pg.heroGrid}`}>
            <div>
              <p className={pg.eyebrow}>{H.eyebrow}</p>
              <h1 className={s.h1}>
                {H.h1} <em className={pg.h1em}>{H.h1Em}</em>
              </h1>
              <p className={pg.lead}>{H.lead}</p>
              <div className={s.ctarow} style={{ marginTop: 24 }}>
                <a className={`${s.btn} ${s.btnPrimary}`} href="#industries">
                  {H.browse(PROMPT_GUIDES.length)}
                </a>
                <a className={`${s.btn} ${s.btnGhost}`} href="#method">
                  {H.seeMethod}
                </a>
              </div>
              <p className={pg.eyeline}>{H.eyeline}</p>
              {chrome.notice && <p className={pg.notice}>{chrome.notice}</p>}
            </div>
            <HubHero id="pg-hero" />
          </div>
          <div className={pg.wrap}>
            <div className={pg.stats} data-testid="hub-stats">
              {stats.map((n, i) => (
                <div key={H.stats[i]} className={pg.stat}>
                  <b>{n}</b>
                  <span>{H.stats[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className={pg.section}>
          <div className={pg.wrap}>
            <p className={s.label}><b>/ 01</b> — {H.industries.label}</p>
            <h2 className={s.h2}>{H.industries.h2}</h2>
            <p className={pg.p}>{H.industries.body}</p>
            <GuideFilter
              cards={PROMPT_GUIDES.map((g) => ({
                slug: g.slug,
                href: L(guidePath(g.slug)),
                name: g.name,
                description: g.cardDescription,
                eyebrow: g.eyebrow,
                icon: PROMPT_GUIDE_ICONS[g.icon],
              }))}
              copy={{
                filterLabel: H.industries.filterLabel,
                placeholder: H.industries.placeholder,
                empty: H.industries.empty,
                read: H.industries.read,
                one: H.industries.countOne,
                many: H.industries.countMany,
              }}
            />
          </div>
        </section>

        <section id="at-a-glance" className={pg.section}>
          <div className={pg.wrap}>
            <p className={s.label}><b>/ 02</b> — {H.glance.label}</p>
            <h2 className={s.h2}>{H.glance.h2}</h2>
            <p className={pg.p}>{H.glance.body}</p>
            <div className={pg.tableWrap}>
              <table className={`${pg.table} ${pg.wide}`} data-testid="glance-table">
                <thead>
                  <tr>
                    {H.glance.head.map((h) => (
                      <th key={h} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROMPT_GUIDES.map((g) => (
                    <tr key={g.slug}>
                      <th scope="row">
                        <Link href={L(guidePath(g.slug))}>{g.name}</Link>
                      </th>
                      <td>{g.persona}</td>
                      <td>{g.focusAreas}</td>
                      <td>{g.safeguardShort}</td>
                      <td>{g.cadenceShort}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="prompt-mix" className={pg.section}>
          <div className={pg.wrap}>
            <p className={s.label}><b>/ 03</b> — {H.mix.label}</p>
            <h2 className={s.h2}>{H.mix.h2}</h2>
            <p className={pg.p}>{H.mix.body}</p>
            <PromptMixChart id="pg-mix" rows={mixRows} />
            <div className={pg.tableWrap}>
              <table className={`${pg.table} ${pg.wide}`} data-testid="mix-table">
                <thead>
                  <tr>
                    <th scope="col">{H.mix.industry}</th>
                    {PROMPT_USES.map((u, i) => (
                      <th key={u} scope="col" className={pg.num}>
                        <span className={pg.headSwatch}>
                          <UseSwatch use={u} prefix={`pg-mixh-${i}`} />
                          {u}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className={pg.num}>{H.mix.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {mixRows.map((r, gi) => (
                    <tr key={r.name}>
                      <th scope="row">
                        <Link href={L(guidePath(PROMPT_GUIDES[gi].slug))}>{r.name}</Link>
                      </th>
                      {PROMPT_USES.map((u) => (
                        <td key={u} className={pg.num}>{r.counts[u]}</td>
                      ))}
                      <td className={pg.num}>{PROMPT_GUIDES[gi].prompts.length}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr data-testid="mix-totals">
                    <th scope="row">{H.mix.totals}</th>
                    {PROMPT_USES.map((u) => (
                      <td key={u} className={pg.num}>{totals[u]}</td>
                    ))}
                    <td className={pg.num}>{totalPrompts()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        <section id="method" className={pg.section}>
          <div className={pg.wrap}>
            <p className={s.label}><b>/ 04</b> — {H.method.label}</p>
            <h2 className={s.h2}>{H.method.h2}</h2>
            <p className={pg.p}>{H.method.body}</p>
            {/* Every step's text is drawn in the figure and repeated in its <desc>. */}
            <MethodFlow id="pg-method" />
          </div>
        </section>

        <section id="modes" className={pg.section}>
          <div className={pg.wrap}>
            <p className={s.label}><b>/ 05</b> — {H.modes.label}</p>
            <h2 className={s.h2}>{H.modes.h2}</h2>
            <div className={pg.modes}>
              {PROMPT_MODES.map((m) => (
                <div key={m.num} className={pg.mode}>
                  <b>{m.num}</b>
                  <h3>{m.title}</h3>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
            <div className={pg.callout}>
              <b>{H.modes.factCheckTitle}</b>
              <p>{H.modes.factCheckBody}</p>
            </div>
          </div>
        </section>

        <section id="principles" className={pg.section}>
          <div className={pg.wrap}>
            <p className={s.label}><b>/ 06</b> — {H.principles.label}</p>
            <h2 className={s.h2}>{H.principles.h2}</h2>
            <div className={pg.tableWrap}>
              <table className={pg.table}>
                <thead>
                  <tr>
                    {H.principles.head.map((h) => (
                      <th key={h} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEASUREMENT_PRINCIPLES.map((r) => (
                    <tr key={r.signal}>
                      <th scope="row">{r.signal}</th>
                      <td>{r.question}</td>
                      <td>{r.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className={pg.wrap}>
          <SalesCta locale={locale} h2={H.cta.h2} body={H.cta.body} />
        </div>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
