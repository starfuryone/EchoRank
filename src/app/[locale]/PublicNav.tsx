"use client";

/**
 * The public top navigation, shared by every marketing page.
 *
 * Mega-menu: some top-row items are TRIGGERS that open a full-width panel of
 * grouped links; the rest are flat links. The right-hand side — locale toggle,
 * Login, auth-aware CTA — is unchanged.
 *
 * THE PANELS CARRY ONLY ROUTES THAT EXIST. Every href below is either a
 * registered marketing route (src/lib/seo/registry.ts) or a homepage anchor;
 * a nav is the one component where a dead link is guaranteed to be found by
 * someone, and tests assert the whole set against the registry.
 *
 * ACTIVE STATE COMES FROM A PROP, NOT usePathname(). Several existing suites
 * render this component through a page (HomeClient, /pricing, /use-cases)
 * without mocking next/navigation, and reaching for the router hook here would
 * break them at import time for a purely cosmetic highlight. Pages opt in by
 * passing `current`.
 *
 * Locale model matches the homepage: en/fr bases, en-CA folds to en, fr-CA to
 * fr, de-CH shows English.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SOLUTION_CATEGORIES, solutionBase } from "@/lib/solutions-taxonomy";
import s from "./home2.module.css";

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

export type NavGroupId = "product" | "solutions" | "resources";
/** Flat items can also be "current"; kept loose so pages can name either. */
export type NavCurrent = NavGroupId | "pricing" | "learn" | "resources-page" | "use-cases";

interface NavItem {
  /** Locale-less path, or a "#fragment" resolved against the locale root. */
  href: string;
  label: string;
  desc?: string;
}
interface NavColumn {
  title: string;
  items: NavItem[];
}
interface NavGroup {
  id: NavGroupId;
  label: string;
  columns: NavColumn[];
}

interface NavCopy {
  pricing: string;
  useCases: string;
  login: string;
  join: string;
  dashboard: string;
  menu: string;
  close: string;
  promoTitle: string;
  promoBody: string;
  promoCta: string;
  groups: NavGroup[];
}

/**
 * The Solutions panel is DERIVED from src/lib/solutions-taxonomy.ts — four
 * columns, one per category, so adding an item to the config puts it in the
 * menu with no edit here. Only the goal column keeps its one-line
 * descriptions: with all 25 items described the panel is taller than most
 * viewports, and a menu you have to scroll is a worse menu.
 */
function solutionsGroup(base: Base): NavGroup {
  return {
    id: "solutions",
    label: base === "fr" ? "Solutions" : "Solutions",
    columns: [
      ...SOLUTION_CATEGORIES.map((cat) => ({
        title: cat[base].label,
        items: cat.items.map((item) => ({
          href: `/solutions/${cat.slug}/${item.slug}`,
          label: item[base].label,
          ...(cat.slug === "goals" ? { desc: item[base].desc } : {}),
        })),
      })),
      // "Use cases" as its own category, not a flat top-level link.
      {
        title: base === "fr" ? "Cas d'usage" : "Use cases",
        items: [
          {
            href: "/use-cases",
            label: base === "fr" ? "Tous les cas d'usage" : "All use cases",
            desc:
              base === "fr"
                ? "Parcourir tous les cas d'usage"
                : "Browse every use case in one place",
          },
          {
            href: "/technical-geo",
            label: base === "fr" ? "GEO technique Echorank" : "Echorank Technical GEO",
            desc:
              base === "fr"
                ? "Corrigez ce qui vous exclut des réponses IA"
                : "Fix what keeps you out of AI answers",
          },
          { label: "AI Visibility Methodology", href: "/methodology" },
        ],
      },
    ],
  };
}

/**
 * Grouping. Product = what it does, Solutions = who it is for / what you want
 * to achieve, Resources = how to learn it. Pricing stays a flat link because a
 * panel with one destination is a worse button.
 */
const NAV: Record<Base, NavCopy> = {
  en: {
    pricing: "Pricing",
    useCases: "Use cases",
    login: "Login",
    join: "Join Now",
    dashboard: "Dashboard",
    menu: "Menu",
    close: "Close",
    promoTitle: "Free AI visibility audit",
    promoBody: "See what AI assistants say about your business. No account needed.",
    promoCta: "Run the audit ↗",
    groups: [
      {
        id: "product",
        label: "Product",
        columns: [
          {
            title: "AI visibility",
            items: [
              { href: "/ai-visibility", label: "AI Visibility", desc: "Track how assistants answer about you." },
              { href: "/live-monitoring", label: "Live monitoring", desc: "Always-on checks and alerts." },
              { href: "/watcher", label: "AI Search Watcher", desc: "One brand, watched weekly. $9/mo." },
            ],
          },
          {
            title: "Reputation",
            items: [
              { href: "/reputation-engine", label: "Reputation Engine", desc: "Automate requests and replies." },
              { href: "/reputation-risk", label: "Reputation risk", desc: "A score for what could go wrong." },
              { href: "/customer-feedback", label: "Customer feedback", desc: "Collect and read the signal." },
              { href: "/act-on-signals", label: "Act on signals", desc: "From alert to action." },
            ],
          },
          {
            title: "SEO & tools",
            items: [
              { href: "#tools", label: "All SEO tools", desc: "The full classic-SEO toolkit." },
              { href: "/free-tools", label: "Free tools", desc: "No account, no card." },
            ],
          },
        ],
      },
      "SOLUTIONS_GROUP_PLACEHOLDER" as unknown as NavGroup,
      {
        id: "resources",
        label: "Resources",
        columns: [
          {
            title: "Learn",
            items: [
              { href: "/learn", label: "Knowledge hub", desc: "Course, guides and Echopedia." },
              { href: "/glossary", label: "Echorank Glossary", desc: "Search, ranking and AI visibility terms." },
              { href: "/keyword-research", label: "Keyword research guide", desc: "Find, analyze and use keywords." },
              { href: "/guide", label: "The complete guide", desc: "Reputation intelligence, end to end." },
              { href: "/guide-visibilite-ia", label: "AI visibility guide", desc: "In French." },
            ],
          },
          {
            title: "Guides",
            items: [
              { href: "/guides/getting-started", label: "Getting started" },
              { href: "/guides/audit-your-website", label: "Audit your website" },
              { href: "/guides/keyword-research", label: "Keyword research" },
              { href: "/guides/track-rankings", label: "Track rankings" },
            ],
          },
          {
            title: "More",
            items: [
              { href: "/resources", label: "Resources", desc: "Whitepapers and downloads." },
              { href: "/about", label: "About Echorank" },
            ],
          },
        ],
      },
    ],
  },

  fr: {
    pricing: "Tarifs",
    useCases: "Cas d'usage",
    login: "Connexion",
    join: "S'inscrire",
    dashboard: "Tableau de bord",
    menu: "Menu",
    close: "Fermer",
    promoTitle: "Audit de visibilité IA gratuit",
    promoBody: "Découvrez ce que les assistants IA disent de votre entreprise. Sans compte.",
    promoCta: "Lancer l'audit ↗",
    groups: [
      {
        id: "product",
        label: "Produit",
        columns: [
          {
            title: "Visibilité IA",
            items: [
              { href: "/ai-visibility", label: "Visibilité IA", desc: "Suivez ce que les assistants répondent." },
              { href: "/live-monitoring", label: "Surveillance continue", desc: "Contrôles et alertes en continu." },
              { href: "/watcher", label: "AI Search Watcher", desc: "Une marque, surveillée chaque semaine. $9/mois." },
            ],
          },
          {
            title: "Réputation",
            items: [
              { href: "/reputation-engine", label: "Moteur de réputation", desc: "Automatisez demandes et réponses." },
              { href: "/reputation-risk", label: "Risque de réputation", desc: "Un score de ce qui peut déraper." },
              { href: "/customer-feedback", label: "Avis clients", desc: "Collectez et lisez le signal." },
              { href: "/act-on-signals", label: "Agir sur les signaux", desc: "De l'alerte à l'action." },
            ],
          },
          {
            title: "SEO et outils",
            items: [
              { href: "#tools", label: "Tous les outils SEO", desc: "La boîte à outils SEO complète." },
              { href: "/free-tools", label: "Outils gratuits", desc: "Sans compte, sans carte." },
            ],
          },
        ],
      },
      "SOLUTIONS_GROUP_PLACEHOLDER" as unknown as NavGroup,
      {
        id: "resources",
        label: "Ressources",
        columns: [
          {
            title: "Apprendre",
            items: [
              { href: "/learn", label: "Centre de connaissances", desc: "Cours, guides et Echopedia." },
              { href: "/glossary", label: "Glossaire Echorank", desc: "Termes de recherche, ranking et visibilité IA." },
              { href: "/keyword-research", label: "Guide recherche de mots-clés", desc: "Trouver, analyser et utiliser les mots-clés." },
              { href: "/guide", label: "Le guide complet", desc: "La réputation, de bout en bout." },
              { href: "/guide-visibilite-ia", label: "Guide visibilité IA", desc: "En français." },
            ],
          },
          {
            title: "Guides",
            items: [
              { href: "/guides/getting-started", label: "Bien démarrer" },
              { href: "/guides/audit-your-website", label: "Auditer votre site" },
              { href: "/guides/keyword-research", label: "Recherche de mots-clés" },
              { href: "/guides/track-rankings", label: "Suivre les positions" },
            ],
          },
          {
            title: "Plus",
            items: [
              { href: "/resources", label: "Ressources", desc: "Livres blancs et téléchargements." },
              { href: "/about", label: "À propos d'Echorank" },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * The single-panel invariant, as a pure function.
 *
 * Extracted so it can be tested without a DOM: this repo's vitest runs in the
 * node environment with no jsdom and no @testing-library/react, and adding
 * either to a box that serves production from the working tree is a bigger
 * risk than the coverage is worth. The state machine is the part that can be
 * wrong; the wiring is three onClick handlers.
 */
export function nextOpenPanel(
  current: NavGroupId | null,
  clicked: NavGroupId,
): NavGroupId | null {
  // Clicking the open trigger closes it; clicking any other REPLACES it, which
  // is what keeps exactly one panel open rather than accumulating them.
  return current === clicked ? null : clicked;
}

/** Every href the menu can render, for the route test. */
/** The catalog with the derived Solutions group substituted in. */
function navFor(base: Base): NavCopy {
  return {
    ...NAV[base],
    groups: NAV[base].groups.map((g) =>
      (g as unknown as string) === "SOLUTIONS_GROUP_PLACEHOLDER" ? solutionsGroup(base) : g,
    ),
  };
}

export function navHrefs(): string[] {
  return navFor("en").groups.flatMap((g) => g.columns.flatMap((c) => c.items.map((i) => i.href)));
}

/**
 * Signup/dashboard switch.
 *
 * Signed OUT this points at /pricing, not /register: every marketing CTA now
 * routes through the pricing page, and this button is a marketing CTA like any
 * other. Signed IN it points at /dashboard, which is an in-app link and stays.
 */
function AuthCta({ labels, pricingHref }: { labels: NavCopy; pricingHref: string }) {
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
  /** Marks the active group or flat link. */
  current?: NavCurrent;
}) {
  const b = baseOf(locale);
  const t = navFor(b);
  const L = (p: string) => (p.startsWith("#") ? `/${locale}${p}` : `/${locale}${p}`);

  /** Exactly one panel at a time — this is a single value, not a set. */
  // Learn and Resources are pages INSIDE the Resources group now, so a page
  // that names itself "learn" highlights that trigger rather than a flat link
  // that no longer exists.
  const activeGroup: NavGroupId | null =
    current === "learn" || current === "resources-page" || current === "resources"
      ? "resources"
      : current === "use-cases"
        ? "solutions"
        : current === "product" || current === "solutions"
        ? current
        : null;

  const [open, setOpen] = useState<NavGroupId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<NavGroupId | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef(new Map<NavGroupId, HTMLButtonElement>());

  const closeAndRefocus = useCallback((id: NavGroupId | null) => {
    setOpen(null);
    if (id) triggerRefs.current.get(id)?.focus();
  }, []);

  // Esc closes whichever is open; outside click closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mobileOpen) setMobileOpen(false);
      else if (open) closeAndRefocus(open);
    };
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, mobileOpen, closeAndRefocus]);

  // Body scroll lock for the mobile sheet only — the desktop panel overlays
  // without taking the page out from under the reader.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  /** Arrow keys walk the open panel's links; Esc hands focus back. */
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: NavGroupId) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeAndRefocus(id);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = Array.from(
      e.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );
    if (links.length === 0) return;
    e.preventDefault();
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      e.key === "ArrowDown"
        ? links[(at + 1 + links.length) % links.length]
        : links[(at - 1 + links.length) % links.length];
    next?.focus();
  };

  /**
   * ALWAYS RENDERED, hidden with the `hidden` attribute when closed.
   *
   * Conditionally mounting the panel would keep every link in it out of the
   * server-rendered HTML, so a crawler would see a nav of three buttons and
   * nothing else — on a site whose sitemap, hreflang and JSON-LD all exist to
   * get these pages indexed. `hidden` keeps the markup crawlable while taking
   * the links out of the tab order and the a11y tree.
   */
  const panel = (g: NavGroup) => (
    <div
      className={s.megaPanel}
      role="region"
      aria-label={g.label}
      hidden={open !== g.id}
      onKeyDown={(e) => onPanelKeyDown(e, g.id)}
    >
      <div className={`${s.container} ${s.megaInner}`}>
        {g.columns.map((col) => (
          <div key={col.title} className={s.megaCol}>
            <p className={s.megaColTitle}>{col.title}</p>
            {col.items.map((item) => (
              <Link key={item.href + item.label} href={L(item.href)} className={s.megaLink}>
                <span className={s.megaLinkLabel}>{item.label}</span>
                {item.desc && <span className={s.megaLinkDesc}>{item.desc}</span>}
              </Link>
            ))}
          </div>
        ))}
        {/* Promo: the existing free-audit funnel, no invented route. */}
        <Link href={L("/free-audit")} className={s.megaPromo}>
          <span className={s.megaColTitle}>{t.promoTitle}</span>
          <span className={s.megaLinkDesc}>{t.promoBody}</span>
          <span className={s.megaPromoCta}>{t.promoCta}</span>
        </Link>
      </div>
    </div>
  );

  return (
    <nav
      className={s.nav}
      ref={rootRef}
      // Focus leaving the header closes the panel. relatedTarget null means
      // focus went to the document (a click on chrome), which should not close
      // a panel the pointer is still inside.
      onBlur={(e) => {
        if (!e.relatedTarget) return;
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(null);
      }}
    >
      <div className={`${s.container} ${s.navin}`}>
        <Link className={s.brand} href={L("/")}>
          <span className={s.diamond} aria-hidden />
          ECHORANK
        </Link>

        <div className={s.navlinks}>
          {t.groups.map((g) => (
            <div
              key={g.id}
              className={s.megaWrap}


            >
              <button
                type="button"
                ref={(el) => {
                  if (el) triggerRefs.current.set(g.id, el);
                }}
                className={`${s.megaTrigger} ${activeGroup === g.id ? s.toggleOn : ""}`}
                aria-haspopup="true"
                aria-expanded={open === g.id}
                aria-current={activeGroup === g.id ? "page" : undefined}
                onClick={() => setOpen((cur) => nextOpenPanel(cur, g.id))}
              >
                {g.label}
                <span className={open === g.id ? s.chevOpen : s.chev} aria-hidden>
                  ▾
                </span>
              </button>
              {panel(g)}
            </div>
          ))}

          {/* Flat link: a panel with one destination is a worse button. */}
          <Link
            href={L("/pricing")}
            className={current === "pricing" ? s.toggleOn : undefined}
            aria-current={current === "pricing" ? "page" : undefined}
          >
            {t.pricing}
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
          <button
            type="button"
            className={s.burger}
            aria-label={t.menu}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={s.sheet} role="dialog" aria-modal="true" aria-label={t.menu}>
          <div className={s.sheetHead}>
            <span className={s.brand}>ECHORANK</span>
            <button
              type="button"
              className={s.legalClose}
              aria-label={t.close}
              onClick={() => setMobileOpen(false)}
            >
              ×
            </button>
          </div>
          <div className={s.sheetBody}>
            {t.groups.map((g) => (
              <div key={g.id}>
                <button
                  type="button"
                  className={s.sheetSection}
                  aria-expanded={expanded === g.id}
                  onClick={() => setExpanded((cur) => (cur === g.id ? null : g.id))}
                >
                  {g.label}
                  <span className={expanded === g.id ? s.chevOpen : s.chev} aria-hidden>
                    ▾
                  </span>
                </button>
                {expanded === g.id &&
                  g.columns.flatMap((c) => c.items).map((item) => (
                    <Link
                      key={item.href + item.label}
                      href={L(item.href)}
                      className={s.sheetLink}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
            ))}
            <Link href={L("/pricing")} className={s.sheetSection} onClick={() => setMobileOpen(false)}>
              {t.pricing}
            </Link>
            <Link href="/login" className={s.sheetSection} onClick={() => setMobileOpen(false)}>
              {t.login}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
