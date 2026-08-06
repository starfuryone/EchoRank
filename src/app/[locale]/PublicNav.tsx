"use client";

/**
 * The public top navigation, shared by every dark/gold marketing page.
 *
 * Extracted from HomeClient, where it was inline and therefore homepage-only.
 * Two things changed in the move and both matter:
 *
 * 1. THE SECTION LINKS ARE NOW ABSOLUTE. They were bare "#how", "#pricing"
 *    fragments, which only resolve on the homepage — on /resources they would
 *    have scrolled nowhere. They are `/{locale}#how` now, so the nav behaves
 *    the same from any page.
 * 2. The right-hand CTA is auth-aware (see AuthCta below).
 *
 * Locale model matches the homepage: en/fr bases, en-CA folds to en, fr-CA to
 * fr, de-CH shows English. The EN/FR toggle mirrors what the homepage had.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import s from "./home2.module.css";

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

const NAV = {
  en: {
    how: "How it works",
    platform: "Platform",
    sim: "Simulator",
    roi: "ROI",
    pricing: "Pricing",
    learn: "Learn",
    resources: "Resources",
    login: "Login",
    join: "Join Now",
    dashboard: "Dashboard",
  },
  fr: {
    how: "Fonctionnement",
    platform: "Plateforme",
    sim: "Simulateur",
    roi: "ROI",
    pricing: "Tarifs",
    learn: "Apprendre",
    resources: "Ressources",
    login: "Connexion",
    join: "S'inscrire",
    dashboard: "Tableau de bord",
  },
} as const;

/**
 * Signup/dashboard switch.
 *
 * Renders "Join Now" on the server and for crawlers, then asks
 * /api/auth/session on mount and swaps to "Dashboard" if there is a user. The
 * page itself stays fully static and public: no auth() call, no redirect, no
 * gate, and the HTML is identical for a logged-out visitor and a bot.
 *
 * Signed OUT this points at /pricing, not /register: every marketing CTA now
 * routes through the pricing page, and this button is a marketing CTA like any
 * other. Signed IN it points at /dashboard, which is an in-app link and stays.
 */
function AuthCta({ labels, pricingHref }: { labels: (typeof NAV)[Base]; pricingHref: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && data.user) setSignedIn(true);
      })
      .catch(() => {
        // A failed session probe just means the logged-out CTA stays. Never
        // block or hide the button over it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return signedIn ? (
    <Link className={s.navcta} href="/dashboard">
      {labels.dashboard}
    </Link>
  ) : (
    <Link className={s.navcta} href={pricingHref}>
      {labels.join}
    </Link>
  );
}

export function PublicNav({
  locale,
  current,
}: {
  locale: string;
  /** Marks the active page so its nav item can be styled like the others. */
  current?: "resources" | "learn";
}) {
  const b = baseOf(locale);
  const t = NAV[b];
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;
  /**
   * Homepage section anchors. Built without the slash before the fragment:
   * "/fr/#how" is a different path from "/fr" and Next answers it with a 308
   * redirect, so every nav click would have cost a round trip. <Link> quietly
   * normalises this; a plain <a> does not, and these are plain <a> on purpose
   * so they scroll rather than soft-navigate when already on the homepage.
   */
  const anchor = (frag: string) => `/${locale}#${frag}`;

  return (
    <nav className={s.nav}>
      <div className={`${s.container} ${s.navin}`}>
        <Link className={s.brand} href={L("/")}>
          <span className={s.diamond} aria-hidden />
          ECHORANK
        </Link>
        <div className={s.navlinks}>
          <a href={anchor("how")}>{t.how}</a>
          <a href={anchor("platform")}>{t.platform}</a>
          <a href={anchor("simulator")}>{t.sim}</a>
          <a href={anchor("roi")}>{t.roi}</a>
          {/* A real page now, not a homepage anchor. */}
          <Link href={L("/pricing")}>{t.pricing}</Link>
          <Link
            href={L("/learn")}
            className={current === "learn" ? s.toggleOn : undefined}
            aria-current={current === "learn" ? "page" : undefined}
          >
            {t.learn}
          </Link>
          <Link
            href={L("/resources")}
            className={current === "resources" ? s.toggleOn : undefined}
            aria-current={current === "resources" ? "page" : undefined}
          >
            {t.resources}
          </Link>
          <Link href="/login">{t.login}</Link>
        </div>
        <div className={s.navright}>
          <span className={s.toggle}>
            <Link href="/en" className={b === "en" ? s.toggleOn : undefined}>
              EN
            </Link>
            <span>/</span>
            <Link href="/fr" className={b === "fr" ? s.toggleOn : undefined}>
              FR
            </Link>
          </span>
          <AuthCta labels={t} pricingHref={L("/pricing")} />
        </div>
      </div>
    </nav>
  );
}
