// src/lib/help-content.ts
// The in-app Help hub's config: /help inside the dashboard.
//
// THIN BY DESIGN. Every article title, description and reading time comes from
// src/lib/learn-content.ts — the same file the public Knowledge Hub renders. A
// card here names a slug; it never restates the copy. If a string exists in two
// places one of them is already wrong, and the one that rots is always the copy
// nobody remembers is a copy.
//
// Only the hub-only entries (the dashboard checklist card, the Caddy-served
// extension pages, the PDF) carry their own labels, and those live in the
// DashLocale catalogs — HELP_COPY in src/lib/i18n/dashboard.ts — not here.

import {
  ECHOPEDIA_SLUG,
  LEARN_BASE,
  LEARN_CHAPTERS,
  LEARN_GUIDES,
  LEARN_PDF,
  guideBySlug,
} from "./learn-content";

export const HELP_HUB = "/help";

export type HelpGroupId = "getting_started" | "course" | "guides" | "reference";

/**
 * How a card behaves when clicked.
 *
 * "chapter" / "guide" / "glossary" — a public Knowledge Hub page, opened in a
 *   new tab so the reader does not lose their place in the dashboard.
 * "video" — the ONE exception: the extension install opens in place, in a
 *   modal, because sending someone to a new tab to watch a two-minute video
 *   they are following along with is the wrong trade.
 * "app" — an existing dashboard route, same tab.
 * "external" — a Caddy-served page or the PDF, new tab.
 */
export type HelpCardKind = "chapter" | "guide" | "glossary" | "video" | "app" | "external";

export interface HelpCard {
  /** Stable key. Doubles as the i18n key for cards that carry their own copy. */
  id: string;
  kind: HelpCardKind;
  /** Knowledge Hub slug, for the kinds that derive their copy from it. */
  slug?: string;
  /** Target for "app" and "external" cards. Locale-prefixed only for "app". */
  href?: string;
}

export interface HelpGroup {
  id: HelpGroupId;
  cards: HelpCard[];
}

/** The extension install walkthrough — the same video, from the same config. */
export const HELP_VIDEO = guideBySlug("install-browser-extension")?.video;

export const HELP_GROUPS: HelpGroup[] = [
  {
    id: "getting_started",
    cards: [
      // The onboarding checklist already lives on /dashboard; this card points
      // at it rather than restating it.
      { id: "first_steps", kind: "app", href: "/dashboard" },
      { id: "install_extension", kind: "video", slug: "install-browser-extension" },
      { id: "import_history", kind: "chapter", slug: "import-your-review-history" },
    ],
  },
  {
    id: "course",
    cards: LEARN_CHAPTERS.map((c) => ({ id: c.slug, kind: "chapter" as const, slug: c.slug })),
  },
  {
    id: "guides",
    cards: LEARN_GUIDES.map((g) => ({ id: g.slug, kind: "guide" as const, slug: g.slug })),
  },
  {
    id: "reference",
    cards: [
      { id: "echopedia", kind: "glossary", slug: ECHOPEDIA_SLUG },
      { id: "pdf", kind: "external", href: LEARN_PDF },
      // Caddy-served, outside this app. Kept because they cover the extension
      // in more operational detail than the course chapter does.
      { id: "ext_download", kind: "external", href: "/extension/download.html" },
      { id: "ext_help", kind: "external", href: "/extension/help.html" },
      { id: "ext_import", kind: "external", href: "/extension/howto-import-reviews.html" },
      { id: "ext_reviews_in", kind: "external", href: "/extension/getting-reviews-in.html" },
    ],
  },
];

/**
 * Dashboard route → the Knowledge Hub page that page's Help button deep-links
 * to. Only routes with an OBVIOUS match are listed: a help link that lands on
 * a loosely related article is worse than no link, because it teaches people
 * the button does not work.
 *
 * Values are paths after the locale segment, asserted against learnRoutes() in
 * tests/help-content.test.ts — so renaming a chapter breaks the build's tests
 * rather than silently 404ing a help button.
 */
export const pageHelp: Record<string, string> = {
  "/campaigns": `${LEARN_BASE}/guides/review-request-templates`,
  "/imports": `${LEARN_BASE}/guides/csv-review-import`,
  "/visibility": `${LEARN_BASE}/track-and-improve-ai-visibility`,
  "/extension": `${LEARN_BASE}/guides/install-browser-extension`,
  "/visibility/tools/ai-lens": `${LEARN_BASE}/guides/ai-lens-content-gap`,
};

/**
 * Absolute path to a Knowledge Hub page for an in-dashboard link.
 *
 * The hub is public and locale-prefixed; the dashboard's three DashLocales
 * (en / fr / de-CH) are all valid marketing locale segments, so the visitor's
 * dashboard language carries over without a mapping table.
 */
export function learnHref(locale: string, path: string): string {
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The article a given dashboard route should point at, if any. */
export function helpArticleFor(route: string): string | undefined {
  return pageHelp[route];
}

/** Every learn path the hub or a deep link references. Used by the drift test. */
export function helpLearnPaths(): string[] {
  const fromCards = HELP_GROUPS.flatMap((g) =>
    g.cards.flatMap((c) => {
      if (c.kind === "chapter") return [`${LEARN_BASE}/${c.slug}`];
      if (c.kind === "guide") return [`${LEARN_BASE}/guides/${c.slug}`];
      if (c.kind === "glossary") return [`${LEARN_BASE}/${c.slug}`];
      if (c.kind === "video") return [`${LEARN_BASE}/guides/${c.slug}`];
      return [];
    }),
  );
  return [...new Set([...fromCards, ...Object.values(pageHelp)])];
}
