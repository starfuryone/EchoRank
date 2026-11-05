// Homepage /01 — "Two crawlers": the AI Visibility auditor and the site
// crawler side by side (SITE-CRAWLER-HOMEPAGE.md).
//
// A SERVER component passed into HomeClient as a slot, like ClassicSeoTools:
// the rule registry (and the hreflang code lists it carries) stays out of the
// homepage's client bundle, and every number here is derived at render —
// the rule count and family count from the registry, the URL cap from
// PLAN_CONFIGS. Rule areas named in the body are dropped when their family is
// not in the registry; the link to the crawler page keys on crawl.publicPage.

import Link from "next/link";
import { RULES } from "@/lib/crawl-rules";
import { flag } from "@/lib/flags";
import { HOME_TWO_CRAWLERS } from "@/lib/i18n/content";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { NosyBatLogo } from "@/components/brand/NosyBatLogo";
import s from "./home2.module.css";
import c from "./two-crawlers.module.css";

const baseOf = (locale: string): "en" | "fr" => (locale.startsWith("fr") ? "fr" : "en");

function joinList(items: string[], and: string): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`;
}

export function TwoCrawlers({ locale, sectionNumber }: { locale: string; sectionNumber: string }) {
  const base = baseOf(locale);
  const t = HOME_TWO_CRAWLERS[base];
  const L = (href: string) => `/${locale}${href}`;

  const families = new Set<string>(RULES.map((r) => r.family));
  const rules = ruleCountLabel();
  const cap = new Intl.NumberFormat(base === "fr" ? "fr-CA" : "en-US").format(PLAN_CONFIGS.AGENCY.crawlUrlCap);
  const checks = joinList(
    [...new Set(t.b.checks.filter((x) => families.has(x.family)).map((x) => x.text))],
    t.b.and,
  );
  const rulesBullet = families.size > 0 ? t.b.bulletRules(rules, families.size) : t.b.bulletRulesNoRegistry(rules);

  return (
    <section id="crawlers" className={s.section}>
      <div className={s.container}>
        <p className={s.label}><b>/ {sectionNumber}</b> — {t.eyebrow}</p>
        <h2 className={s.h2}>{t.h2}</h2>
        <p className={s.sub}>{t.lead}</p>

        <div className={c.grid}>
          <article className={c.card}>
            <div className={c.head}>
              <span className={c.eyebrow}>{t.a.eyebrow}</span>
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
            <p className={c.body}>{t.b.body(cap, rules, checks)}</p>
            <ul className={c.bullets}>
              {[rulesBullet, ...t.b.bullets].map((b) => <li key={b}>{b}</li>)}
            </ul>
            <div className={c.ctas}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/pricing")}>{t.b.cta}</Link>
              {flag("crawl.publicPage") && (
                <Link className={c.textLink} href={L("/site-crawler")}>{t.b.secondary}</Link>
              )}
            </div>
          </article>
        </div>

        <p className={c.closer}>{t.closer}</p>
      </div>
    </section>
  );
}
