// Server-rendered pieces of the course pages: body blocks, callouts, tables,
// the tool card, the sales CTA and the locale chrome. The BODY is English in
// every locale (the /learn first-pass rule); the chrome here follows the
// visitor's locale, folded en/fr like the rest of marketing.
//
// CTAs: sales → /{locale}/pricing with "Cancel anytime" (the catalog's line,
// all five locales); free → /{locale}/free-audit. Never /register.

import Link from "next/link";
import type { AeoBlock, AeoCalloutTone, AeoToolCard } from "@/lib/aeo-course";
import { AEO_COPY, aeoHeadingId } from "@/lib/aeo-course";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { isSupportedLocale } from "@/lib/i18n/config";
import { AEO_GRAPHICS } from "./graphics";
import home from "@/app/[locale]/home2.module.css";
import css from "./aeo.module.css";

type Base = "en" | "fr";
export const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

export const AEO_CHROME = {
  en: {
    home: "Home",
    learn: "Knowledge Hub",
    notice: null,
    pricing: "See plans & pricing ↗",
    audit: "Run my free audit ↗",
    worksheet: "Open your AEO plan worksheet",
  },
  fr: {
    home: "Accueil",
    learn: "Centre de connaissances",
    notice: "Ce cours n'est pour l'instant disponible qu'en anglais. Le reste du site est en français.",
    pricing: "Voir les forfaits et tarifs ↗",
    audit: "Lancer mon audit gratuit ↗",
    worksheet: "Ouvrir la fiche de votre plan AEO",
  },
} as const;

export function cancelAnytime(locale: string): string {
  return HOME_PRICING_CHROME[isSupportedLocale(locale) ? locale : "en"].cancelAnytime;
}

const TONE_CLASS: Record<AeoCalloutTone, string> = {
  fact: css.callFact,
  recommendation: "",
  unproven: css.callUnproven,
  example: css.callExample,
};

function ToneIcon({ tone }: { tone: AeoCalloutTone }) {
  const d = {
    fact: "M3 8.5l3.2 3.2L13 4.8",
    recommendation: "M8 2l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.4 4.3 13.5l.8-4.2L2 6.4l4.2-.5z",
    unproven: "M6 6a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.6M8 12v.01",
    example: "M3 3h10v10H3zM5.5 6.5h5M5.5 9.5h3",
  }[tone];
  return (
    <svg className={css.toneIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

export function LessonBlocks({ body, locale }: { body: readonly AeoBlock[]; locale: string }) {
  return (
    <div className={css.body}>
      {body.map((b, i) => {
        switch (b.k) {
          case "p":
            return (
              <p key={i} className={css.p}>
                {b.t}
              </p>
            );
          case "h2":
            return (
              <h2 key={i} id={aeoHeadingId(b.t)}>
                {b.t}
              </h2>
            );
          case "h3":
            return <h3 key={i}>{b.t}</h3>;
          case "list": {
            const items = b.items.map((it) => <li key={it}>{it}</li>);
            return b.ordered ? (
              <ol key={i} className={css.list}>
                {items}
              </ol>
            ) : (
              <ul key={i} className={css.list}>
                {items}
              </ul>
            );
          }
          case "table":
            return (
              <div key={i} className={css.tableWrap}>
                <table className={`${css.table} ${b.head.length > 3 ? css.wideTable : ""}`}>
                  <caption>{b.caption}</caption>
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col">
                          {h || <span className={css.srOnly}>Item</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r) => (
                      <tr key={r[0]}>
                        <th scope="row">{r[0]}</th>
                        {r.slice(1).map((c, j) => (
                          <td key={j}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "callout":
            return (
              <aside key={i} className={`${css.callout} ${TONE_CLASS[b.tone]}`} data-tone={b.tone}>
                <b>
                  <ToneIcon tone={b.tone} />
                  {b.tone === "example" ? b.title : AEO_COPY.calloutLabel[b.tone]}
                </b>
                {b.tone !== "example" && b.title !== AEO_COPY.calloutLabel[b.tone] && b.title !== "Established" && (
                  <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{b.title}</p>
                )}
                <p>{b.t}</p>
                {b.link && <Link href={`/${locale}${b.link.href}`}>{b.link.label} →</Link>}
              </aside>
            );
          case "graphic": {
            const G = AEO_GRAPHICS[b.id];
            return <G key={i} />;
          }
        }
      })}
    </div>
  );
}

export function ToolCard({ tool, locale }: { tool: AeoToolCard; locale: string }) {
  const href = tool.kind === "external" ? tool.href : `/${locale}${tool.href}`;
  return (
    <aside className={css.tool} data-testid="aeo-tool-card" data-tool={tool.kind === "seo" ? tool.tool : tool.href}>
      <span>{AEO_COPY.toolEyebrow}</span>
      <h3>{tool.name}</h3>
      <p>{tool.body}</p>
      {tool.kind === "external" ? (
        <a className={css.ghost} href={href} rel="noopener">
          {tool.cta} ↗
        </a>
      ) : (
        <Link className={css.ghost} href={href}>
          {tool.cta} →
        </Link>
      )}
    </aside>
  );
}

export function SalesCta({ locale }: { locale: string }) {
  const t = AEO_CHROME[baseOf(locale)];
  return (
    <aside className={css.cta} data-testid="aeo-cta">
      <div>
        <h2>{AEO_COPY.cta.h2}</h2>
        <p>{AEO_COPY.cta.body}</p>
      </div>
      <div className={css.ctaActions}>
        <div className={css.ctaRow}>
          <Link className={`${home.btn} ${home.btnPrimary}`} href={`/${locale}/pricing`}>
            {t.pricing}
          </Link>
          <Link className={`${home.btn} ${home.btnGhost}`} href={`/${locale}/free-audit`}>
            {t.audit}
          </Link>
        </div>
        <p className={css.cancel} data-testid="cancel-anytime">
          <svg className={css.cancelIcon} width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {cancelAnytime(locale)}
        </p>
      </div>
    </aside>
  );
}
