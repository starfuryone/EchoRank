// Homepage /01 — "Two crawlers": the AI Visibility auditor and the site
// crawler side by side (SITE-CRAWLER-HOMEPAGE.md).
//
// A SERVER component passed into HomeClient as a slot, like ClassicSeoTools:
// the rule registry (and the hreflang code lists it carries) stays out of the
// homepage's client bundle, and every number here is derived at render from
// nosybatFacts (the registry, PLAN_CONFIGS). Card B's body and bullets are the
// crawler's pillars (nosybat-pillars.ts): a check area is named only while one
// of its families is in the registry, a pillar only while its feature is live;
// the link to the crawler page keys on crawl.publicPage.

import Link from "next/link";
import { RULES } from "@/lib/crawl-rules";
import { flag } from "@/lib/flags";
import { HOME_TWO_CRAWLERS } from "@/lib/i18n/content";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { familyIsPublic } from "@/lib/site-crawler/rule-count";
import { buildNosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { nosybatPillars } from "@/lib/site-crawler/nosybat-pillars";
import { NosyBatLogo } from "@/components/brand/NosyBatLogo";
import { NB_INTRO_ANCHOR } from "@/lib/site-crawler/intro-video";
import { AiVisibilityLogo } from "@/components/brand/AiVisibilityLogo";
import s from "./home2.module.css";
import c from "./two-crawlers.module.css";

const baseOf = (locale: string): "en" | "fr" => (locale.startsWith("fr") ? "fr" : "en");

export function TwoCrawlers({ locale, sectionNumber }: { locale: string; sectionNumber: string }) {
  const base = baseOf(locale);
  const t = HOME_TWO_CRAWLERS[base];
  const L = (href: string) => `/${locale}${href}`;

  // Card B is the crawler's pitch: the first pillar as the body, the others as
  // bullets, every number from nosybatFacts (the registry as it is at render).
  const pillars = nosybatPillars(buildNosybatFacts({ rules: RULES.filter((r) => familyIsPublic(r.family)) }), base);
  const lead = pillars.find((p) => p.id === "checks");
  const bullets = pillars.filter((p) => p !== lead).map((p) => p.short);

  return (
    <section id="crawlers" className={s.section}>
      <div className={s.container}>
        <p className={s.label}><b>/ {sectionNumber}</b> — {t.eyebrow}</p>
        <h2 className={s.h2}>{t.h2}</h2>
        <p className={s.sub}>{t.lead}</p>

        <div className={c.grid}>
          <article className={c.card}>
            <div className={c.head}>
              {/* The AI Visibility logo, top-left, at the crawler logo's height in card B. */}
              <AiVisibilityLogo height={36} surface="themed" testId="two-crawlers-av-logo" />
            </div>
            <h3 className={c.title}>{t.a.title}</h3>
            <p className={c.body}>{t.a.body}</p>
            <ul className={c.bullets}>
              {t.a.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
            <div className={c.ctas}>
              {/* The one standing exception to "every CTA goes to /pricing". */}
              <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/free-audit")}>{t.a.cta}</Link>
              <Link className={c.textLink} href={L("/pricing")}>{t.a.secondary}</Link>
            </div>
          </article>

          <article className={c.card}>
            <div className={c.head}>
              <NosyBatLogo height={36} alt={CRAWLER_BRAND.name} tone="dark" themed testId="two-crawlers-logo" />
              <span className={c.byline}>{t.b.byline}</span>
            </div>
            <h3 className={c.title}>{t.b.title}</h3>
            {lead && <p className={c.body} data-pillar="checks">{lead.body}</p>}
            <ul className={c.bullets}>
              {bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
            <div className={c.ctas}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/pricing")}>{t.b.cta}</Link>
              {flag("crawl.publicPage") && (
                <>
                  <Link className={c.textLink} href={L("/site-crawler")}>{t.b.secondary}</Link>
                  <Link className={c.textLink} href={L(`/site-crawler#${NB_INTRO_ANCHOR}`)} data-testid="two-crawlers-watch">{t.b.watch}</Link>
                </>
              )}
            </div>
          </article>
        </div>

        <p className={c.closer}>{t.closer}</p>
      </div>
    </section>
  );
}
