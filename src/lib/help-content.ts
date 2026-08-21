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
import { helpArticlePath, helpArticlesByCategory } from "./help-articles";

export const HELP_HUB = "/help";

export type HelpGroupId =
  | "getting_started"
  // Account and subscription articles. Second, not last: "how do I cancel" is
  // the other reason someone opens Help, and burying it under ten chapters and
  // five guides is how a support ticket gets written instead.
  | "billing"
  | "course"
  | "guides"
  | "reference";

/**
 * How a card behaves when clicked.
 *
 * "chapter" / "guide" / "glossary" — a public Knowledge Hub page, opened in a
 *   new tab so the reader does not lose their place in the dashboard.
 * "article" — a public help article (src/lib/help-articles.ts). Same new-tab
 *   rule; unlike the Knowledge Hub kinds its body is localized, so the card
 *   shows the reader's own language.
 * "video" — the ONE exception: the extension install opens in place, in a
 *   modal, because sending someone to a new tab to watch a two-minute video
 *   they are following along with is the wrong trade.
 * "app" — an existing dashboard route, same tab.
 * "external" — a Caddy-served page or the PDF, new tab.
 */
export type HelpCardKind =
  | "chapter"
  | "guide"
  | "glossary"
  | "article"
  | "video"
  | "app"
  | "external";

export interface HelpCard {
  /** Stable key. Doubles as the i18n key for cards that carry their own copy. */
  id: string;
  kind: HelpCardKind;
  /** Knowledge Hub slug, for the kinds that derive their copy from it. */
  slug?: string;
  /** Target for "app" and "external" cards. Locale-prefixed only for "app". */
  href?: string;
  /**
   * Icon override. The hub otherwise reads it off `kind`: "external" gets the
   * outbound-arrow glyph, everything else the book. That rule assumes every
   * "external" card is a utility page (the Caddy-served extension pages, the
   * PDF) — so a card that is genuinely something to READ, but whose copy this
   * config owns because it is not a Knowledge Hub article, needs to say so.
   */
  icon?: "book" | "external";
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
      // The public setup walkthrough for AI Search tracking. "external" because
      // it is a standalone HTML landing page, not a Knowledge Hub article — so
      // its copy lives in HELP_COPY — but it reads like a guide, hence the book
      // icon. The href is hard-coded /en: the page ships an en-only body.
      {
        id: "setup_ai_search",
        kind: "external",
        href: "/en/setup-ai-search-tracking",
        icon: "book",
      },
    ],
  },
  {
    id: "billing",
    // Derived, like the course and guides groups below: an article added to
    // help-articles.ts appears here without this file being touched.
    cards: helpArticlesByCategory("billing").map((a) => ({
      id: a.slug,
      kind: "article" as const,
      slug: a.slug,
    })),
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

/**
 * Dashboard route → the public HELP ARTICLE that page links to inline.
 *
 * Separate from pageHelp above, which deep-links the per-page Help BUTTON at a
 * Knowledge Hub page. This is the smaller, in-context link — the Billing page's
 * "How cancellation works", sitting next to the button it describes.
 */
export const pageHelpArticle: Record<string, string> = {
  "/billing": "cancel-subscription",
};

/** The article a given dashboard route should point at, if any. */
export function helpArticleFor(route: string): string | undefined {
  return pageHelp[route];
}

/** The help-article slug a dashboard route links inline, if any. */
export function helpArticleSlugFor(route: string): string | undefined {
  return pageHelpArticle[route];
}

/** Every help-article path the hub or an inline link references. Drift test. */
export function helpArticlePaths(): string[] {
  const fromCards = HELP_GROUPS.flatMap((g) =>
    g.cards.filter((c) => c.kind === "article").map((c) => helpArticlePath(c.slug!)),
  );
  const fromRoutes = Object.values(pageHelpArticle).map((slug) => helpArticlePath(slug));
  return [...new Set([...fromCards, ...fromRoutes])];
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
