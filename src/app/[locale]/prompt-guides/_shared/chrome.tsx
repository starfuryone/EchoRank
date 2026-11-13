// Locale chrome for the prompt guides: breadcrumb labels, the English-only
// notice and the sales CTA block. The guide BODY is English everywhere; these
// few lines follow the visitor's locale, folded en/fr like the rest of
// marketing (de-CH and en-CA take en, fr-CA takes fr).
//
// CTAs: the primary sales CTA goes to /pricing and the free one to
// /free-audit — never /register — and every sales CTA block carries the
// catalog's "Cancel anytime" line (HOME_PRICING_CHROME, all five locales).

import Link from "next/link";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { isSupportedLocale } from "@/lib/i18n/config";
import s from "../../home2.module.css";
import pg from "@/components/prompt-guides/prompt-guides.module.css";

type Base = "en" | "fr";
export const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

export const CHROME = {
  en: {
    home: "Home",
    hub: "Prompt setup guides",
    notice: null,
    pricing: "See plans & pricing ↗",
    audit: "Run my free audit ↗",
  },
  fr: {
    home: "Accueil",
    hub: "Guides de prompts par secteur",
    notice: "Ce guide n'est pour l'instant disponible qu'en anglais. Le reste du site est en français.",
    pricing: "Voir les forfaits et tarifs ↗",
    audit: "Lancer mon audit gratuit ↗",
  },
} as const;

export function cancelAnytime(locale: string): string {
  return HOME_PRICING_CHROME[isSupportedLocale(locale) ? locale : "en"].cancelAnytime;
}

export function SalesCta({ locale, h2, body }: { locale: string; h2: string; body: string }) {
  const t = CHROME[baseOf(locale)];
  return (
    <aside className={pg.cta} data-testid="prompt-guides-cta">
      <div>
        <h2>{h2}</h2>
        <p>{body}</p>
      </div>
      <div className={pg.ctaActions}>
        <div className={pg.ctaRow}>
          <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${locale}/pricing`}>
            {t.pricing}
          </Link>
          <Link className={`${s.btn} ${s.btnGhost}`} href={`/${locale}/free-audit`}>
            {t.audit}
          </Link>
        </div>
        <p className={pg.cancel} data-testid="cancel-anytime">
          <svg className={pg.cancelIcon} width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {cancelAnytime(locale)}
        </p>
      </div>
    </aside>
  );
}
