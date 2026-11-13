// Shared marketing footer — identical markup and classes to the homepage
// footer in HomeClient.tsx (s.footer / s.footin / s.footlinks), so it can
// replace the 17 inline per-page footers one page at a time without any
// visual change. Links are en/fr; other locales fold to en, same as the
// solutions copy model.

import Link from "next/link";
import s from "@/app/[locale]/home2.module.css";
import { CompanyLine } from "@/components/brand/CompanyLine";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { CookieSettingsLink } from "@/components/marketing/cookie-consent";
import { cookieLocale } from "@/lib/consent/cookie-consent";
import { COMPLAINT_LINK } from "@/lib/privacy/complaint-copy";
import { OtherServices } from "@/components/OtherServices";

const LINKS: Record<"en" | "fr", ReadonlyArray<readonly [string, string]>> = {
  en: [
    ["/pricing", "Pricing"],
    ["/free-audit", "Free AI Readiness Audit"],
    ["/ai-visibility-check", "Free AI visibility check"],
    ["/free-tools", "Free tools"],
    // Product: the crawler's public page. The footer is one flat row, so
    // "under Product" means beside the other product links, before Learn.
    ["/site-crawler", CRAWLER_BRAND.name],
    ["/learn", "Learn"],
    // The free AEO course, beside the hub it lives under.
    ["/learn/aeo", "AEO course"],
    ["/blog", "Blog"],
    ["/about", "About"],
    ["/legal/terms", "Terms"],
    ["/legal/privacy", "Privacy"],
  ],
  fr: [
    ["/pricing", "Tarifs"],
    ["/free-audit", "Audit de préparation IA gratuit"],
    ["/ai-visibility-check", "Vérification de visibilité IA gratuite"],
    ["/free-tools", "Outils gratuits"],
    ["/site-crawler", CRAWLER_BRAND.name],
    ["/learn", "Apprendre"],
    ["/learn/aeo", "Cours AEO"],
    ["/blog", "Blog"],
    ["/about", "À propos"],
    ["/legal/terms", "Conditions"],
    ["/legal/privacy", "Confidentialité"],
  ],
};

export function PublicFooter({ locale }: { locale: string }) {
  const base = locale.startsWith("fr") ? "fr" : "en";
  const L = (href: string) => `/${locale}${href}`;
  return (
    <footer className={s.footer}>
      <div className={`${s.container} ${s.footin}`}>
        <span>© 2026 ECHORANK / CHATLOGIC INSIGHTS LTD</span>
        <span className={s.footlinks}>
          {LINKS[base].map(([href, lbl]) => (
            <Link key={href} href={L(href)}>{lbl}</Link>
          ))}
          <Link href={L("/privacy/complaint")}>{COMPLAINT_LINK[cookieLocale(locale)]}</Link>
          <CookieSettingsLink locale={locale} />
        </span>
        <OtherServices locale={locale} />
        <CompanyLine />
      </div>
    </footer>
  );
}
