// Shared marketing footer — identical markup and classes to the homepage
// footer in HomeClient.tsx (s.footer / s.footin / s.footlinks), so it can
// replace the 17 inline per-page footers one page at a time without any
// visual change. Links are en/fr; other locales fold to en, same as the
// solutions copy model.

import Link from "next/link";
import s from "@/app/[locale]/home2.module.css";

const LINKS: Record<"en" | "fr", ReadonlyArray<readonly [string, string]>> = {
  en: [
    ["/pricing", "Pricing"],
    ["/free-tools", "Free tools"],
    ["/learn", "Learn"],
    ["/blog", "Blog"],
    ["/about", "About"],
    ["/legal/terms", "Terms"],
    ["/legal/privacy", "Privacy"],
  ],
  fr: [
    ["/pricing", "Tarifs"],
    ["/free-tools", "Outils gratuits"],
    ["/learn", "Apprendre"],
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
        </span>
      </div>
    </footer>
  );
}
