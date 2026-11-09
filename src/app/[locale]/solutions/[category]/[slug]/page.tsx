// /[locale]/solutions/[category]/[slug] — the 25 Solutions landing pages.
//
// ONE ROUTE, NOT 25 FILES. Every page renders from src/lib/solutions-taxonomy.ts,
// so adding an item is a config edit that produces a page, a nav link, a
// category card and a sitemap entry at once. Twenty-five near-identical page
// files is the shape that drifts: one of them keeps an old CTA and nobody
// notices for a year.
//
// Same visual language as /use-cases — home2 module classes, the /01 /02
// section-label pattern, Binance tokens.
//
// Metadata comes from buildMetadata, which already emits the canonical and the
// full five-locale hreflang set, so nothing is hand-rolled here.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { JsonLd, SITE_URL, buildMetadata, faqPage } from "@/lib/seo";
import {
  FEATURES,
  SOLUTION_CATEGORIES,
  categoryBySlug,
  itemBySlug,
  solutionBase,
  leadsWithAiVisibility,
} from "@/lib/solutions-taxonomy";
import { longformFor } from "@/lib/solutions-longform";
import { detailFor } from "@/lib/solutions-detail";
import { PublicNav } from "../../../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { AvEmblem } from "@/components/brand/AiVisibilityLogo";
import s from "../../../home2.module.css";

/** locale x category x slug — 5 x 25 = 125 static pages. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    SOLUTION_CATEGORIES.flatMap((c) =>
      c.items.map((i) => ({ locale, category: c.slug, slug: i.slug })),
    ),
  );
}

type Params = Promise<{ locale: string; category: string; slug: string }>;

const COPY = {
  en: { ctaTrial: "Start 7-day trial ↗", helps: "HOW ECHORANK HELPS", closeH2: "Not sure where to start?", closeSub: "Run the free AI visibility audit. No account needed, and it takes about a minute.", ctaAudit: "Run my free audit ↗", faqH2: "Questions" },
  fr: { ctaTrial: "Essai gratuit de 7 jours ↗", helps: "COMMENT ECHORANK VOUS AIDE", closeH2: "Vous ne savez pas par où commencer ?", closeSub: "Lancez l'audit de visibilité IA gratuit. Sans compte, en une minute environ.", ctaAudit: "Lancer mon audit gratuit ↗", faqH2: "Questions" },
} as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const item = itemBySlug(category, slug);
  if (!item) return {};
  const base = solutionBase(locale);
  const c = item[base];
  // A detail entry may carry its own title and description; the OG image stays
  // buildMetadata's shared card, as on every other solutions page.
  const meta = detailFor(item.slug, base)?.meta;
  return buildMetadata({
    locale,
    path: `/solutions/${category}/${slug}`,
    title: meta?.title ?? c.h1,
    description: meta?.description ?? c.desc,
  });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, category, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const cat = categoryBySlug(category);
  const item = itemBySlug(category, slug);
  // An unknown category, an unknown slug, or a real slug under the WRONG
  // category all 404 — itemBySlug only looks inside the category given.
  if (!cat || !item) notFound();

  const l = locale as Locale;
  const base = solutionBase(l);
  const c = item[base];
  const t = COPY[base];
  const link = (href: string) => `/${l}${href}`;
  // Optional. Items without it render exactly as they did before — the whole
  // block is skipped rather than emitting an empty section.
  const longform = longformFor(item.slug, base);
  const detail = detailFor(item.slug, base);
  const pricingHref = link(detail?.cta ? `/pricing?src=${detail.cta.src}` : "/pricing");
  // /03 onward: long-form, then detail prose, then the cards, then the FAQ.
  const cardsNo = (longform?.sections.length ?? 0) + 3 + (detail?.prose?.length ?? 0);
  const num = (n: number) => String(n).padStart(2, "0");
  // Explicit width/height only when the config gives them; height:auto keeps
  // the ratio while CSS scales the width.
  const dims = (img: { width?: number; height?: number }) =>
    img.width && img.height ? { width: img.width, height: img.height } : {};

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="solutions" />
      {detail?.faq && detail.faq.length > 0 && (
        // The same array the FAQ section below renders.
        <JsonLd graph={[faqPage(detail.faq, `${SITE_URL}/${l}/solutions/${cat.slug}/${item.slug}`)]} />
      )}

      <section className={s.section}>
        <div className={s.container}>
          {leadsWithAiVisibility(item) ? (
            <div className={s.labelIcon} data-testid="solution-av-emblem">
              <AvEmblem size={32} />
              <p className={s.label}>
                <b>/ 01</b> — <Link href={link(`/solutions/${cat.slug}`)}>{cat[base].label}</Link>
              </p>
            </div>
          ) : (
            <p className={s.label}>
              <b>/ 01</b> — <Link href={link(`/solutions/${cat.slug}`)}>{cat[base].label}</Link>
            </p>
          )}
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.intro}</p>
          <div className={s.ctarow} style={{ marginTop: 24 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={pricingHref}>{t.ctaTrial}</Link>
            {detail?.cta?.heroAudit && (
              <Link className={`${s.btn} ${s.btnGhost}`} href={link("/free-audit")}>{t.ctaAudit}</Link>
            )}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {t.helps}</p>
          <div className={s.ucGrid}>
            {c.features.map((f) => (
              <Link key={f.href} href={link(f.href)} className={s.ucCard}>
                <span className={s.ucTitle}>{FEATURES[f.href][base]}</span>
                <span className={s.ucBody}>{f.why}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Section numbering continues from the cards: /03, /04, … */}
      {longform?.sections.map((sec, i) => (
        <section key={sec.h2} className={s.section}>
          <div className={s.container}>
            <p className={s.label}><b>/ {String(i + 3).padStart(2, "0")}</b></p>
            <h2 className={s.h2}>{sec.h2}</h2>
            {sec.paras.map((para, j) => (
              <p key={j} className={s.sub} style={{ maxWidth: 760, marginTop: j === 0 ? 10 : 14 }}>
                {para}
              </p>
            ))}
          </div>
        </section>
      ))}

      {/* solutions-detail v2: optional per-item prose + cards + graphics, config-driven */}
      {detail?.prose?.map((sec, i) => (
        <section key={sec.h2} className={s.section}>
          <div className={s.container}>
            <p className={s.label}>
              <b>/ {String((longform?.sections.length ?? 0) + 3 + i).padStart(2, "0")}</b>
            </p>
            <h2 className={s.h2}>{sec.h2}</h2>
            {sec.image?.position === "right" ? (
              <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 420px", maxWidth: 760 }}>
                  {sec.paras.map((para, j) => (
                    <p key={j} className={s.sub} style={{ marginTop: j === 0 ? 10 : 14 }}>
                      {para}
                    </p>
                  ))}
                </div>
                <img
                  src={sec.image.src}
                  alt={sec.image.alt}
                  loading="lazy"
                  {...dims(sec.image)}
                  style={{ width: "100%", height: "auto", maxWidth: sec.image.maxWidth ?? 380, borderRadius: 14, marginTop: 10, border: "1px solid rgba(255,255,255,.08)" }}
                />
              </div>
            ) : (
              <>
                {sec.paras.map((para, j) => (
                  <p key={j} className={s.sub} style={{ maxWidth: 760, marginTop: j === 0 ? 10 : 14 }}>
                    {para}
                  </p>
                ))}
                {sec.image && (
                  <img
                    src={sec.image.src}
                    alt={sec.image.alt}
                    loading="lazy"
                    {...dims(sec.image)}
                    style={{ width: "100%", height: "auto", maxWidth: sec.image.maxWidth ?? "100%", borderRadius: 14, marginTop: 24, border: "1px solid rgba(255,255,255,.08)" }}
                  />
                )}
              </>
            )}
          </div>
        </section>
      ))}
      {detail && (
        <section className={s.section}>
          <div className={s.container}>
            <p className={s.label}>
              <b>/ {num(cardsNo)}</b> — {detail.eyebrow}
            </p>
            <h2 className={s.h2}>{detail.h2}</h2>
            <div className={s.ucGrid}>
              {detail.cards.map((card) => (
                <div key={card.title} className={s.ucCard}>
                  <span className={s.ucTitle}>{card.title}</span>
                  <span className={s.ucBody}>{card.body}</span>
                </div>
              ))}
            </div>
            {detail.image && (
              <img
                src={detail.image.src}
                alt={detail.image.alt}
                loading="lazy"
                {...dims(detail.image)}
                style={{ width: "100%", height: "auto", borderRadius: 14, marginTop: 28, border: "1px solid rgba(255,255,255,.08)" }}
              />
            )}
            {detail.related && (
              <p className={s.sub} style={{ marginTop: 22 }} data-testid="solution-related">
                <Link href={link(detail.related.href)}>{detail.related.text}</Link>
              </p>
            )}
          </div>
        </section>
      )}

      {detail?.faq && detail.faq.length > 0 && (
        <section id="faq" className={s.section}>
          <div className={s.container}>
            <p className={s.label}><b>/ {num(cardsNo + 1)}</b> — FAQ</p>
            <h2 className={s.h2}>{t.faqH2}</h2>
            <div className={s.faq}>
              {detail.faq.map((it) => (
                <div className={s.faqItem} key={it.q}>
                  <h3 className={s.faqQ}>{it.q}</h3>
                  <p className={s.faqA}>{it.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t.closeH2}</h2>
          <p className={s.sub}>{t.closeSub}</p>
          <div className={s.ctarow} style={{ marginTop: 22 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={link("/free-audit")}>{t.ctaAudit}</Link>
            <Link className={`${s.btn} ${s.btnGhost}`} href={pricingHref}>{t.ctaTrial}</Link>
          </div>
        </div>
      </section>

      <PublicFooter locale={l} />
    </div>
  );
}
