// src/lib/help-articles.ts
// The public help-centre ARTICLES: /[locale]/help/<slug>.
//
// ONE SOURCE, FOUR SURFACES. The full article, the homepage FAQ entry, the
// Knowledge Hub cross-link and the in-app Billing link all read this file. That
// is the whole point of it existing: "how do I cancel" is a question a customer
// asks in four different places, and four paraphrases of the answer is four
// chances for one of them to still describe last quarter's UI. If the billing
// flow changes, it changes here, once, and every surface moves with it.
//
// TYPED CONFIG, NOT MARKDOWN — same argument as src/lib/learn-content.ts: this
// repo has no markdown loader and no MDX pipeline, and neither is being added
// for this. The body reuses that file's LearnBlock vocabulary, so these pages
// render through the same ArticleShell/Blocks the Knowledge Hub does and cannot
// drift into a second article design.
//
// THE BODY IS LOCALIZED, and that is the one way these differ from Knowledge
// Hub articles, which ship English prose under every locale. A help article is
// operational — someone is stuck mid-task — so a French customer gets French
// steps, written by a human, and the page canonicals to itself rather than to
// the en URL. `HelpBase` is en/fr for the same reason every other body catalog
// in this repo is: fr* folds to fr, everything else (de-CH and en-CA included)
// to en, so a third catalog here would be unreachable code.

import type { LearnBlock, LearnFaqEntry, LearnLink } from "./learn-content";

/** Path after the locale segment. The in-app hub at exactly "/help" is a
 *  DIFFERENT, auth-gated dashboard route — see src/app/(dashboard)/help. */
export const HELP_ARTICLE_BASE = "/help";

/** Hub grouping. One value today; the type is what makes the second one cheap. */
export type HelpArticleCategory = "billing";

export type HelpBase = "en" | "fr";

/** fr* → fr; everything else, de-CH included, → en. */
export const helpBaseOf = (locale: string): HelpBase =>
  locale.startsWith("fr") ? "fr" : "en";

export interface HelpArticleCopy {
  /** Page <h1> and <title>. Carries the brand; see brandTitle(). */
  title: string;
  /** Meta description AND the on-page lede — one sentence, both jobs. */
  description: string;
  body: LearnBlock[];
  /**
   * The short-form Q&A every FAQ block reuses.
   *
   * The answer carries inline markup (`**bold**`, `[label](href)`), rendered by
   * inline() and stripped by plainText() before it reaches FAQPage JSON-LD.
   */
  faq: LearnFaqEntry;
  /**
   * The Knowledge Hub cross-link blurb, one authored string.
   *
   * Hrefs here are UNPREFIXED ("/help/cancel-subscription"). resolveHref() adds
   * the reader's locale, so a French reader gets /fr/help/… without this file
   * holding two copies of the same link.
   */
  blurb: string;
  // NO LINK LABEL HERE. The wording of an in-product link is dashboard CHROME
  // and lives in the DashLocale catalogs (BILLING_COPY in
  // src/lib/i18n/dashboard.ts), which have the third locale this file does not:
  // de-CH reads an English body but must not read an English link.
  related: LearnLink[];
}

export interface HelpArticle {
  slug: string;
  category: HelpArticleCategory;
  /** Hub display order within the category. */
  order: number;
  /** Minutes. Short by design: this is a task, not a read. */
  readingTime: number;
  copy: Record<HelpBase, HelpArticleCopy>;
}

/**
 * The four schematic step illustrations, shared by both locales.
 *
 * They are drawings of the UI with gold step badges, not locale-bound
 * screenshots, so one set serves every language and only the alt text is
 * translated. tests/help-articles.test.ts asserts the files exist and that the
 * price drawn into them still matches PLAN_CONFIGS — the illustration is the
 * one place in this feature that hard-codes a plan price, and it cannot read
 * the config, so the test is what turns a price change into a red build rather
 * than a stale picture.
 */
const STEP_IMG = {
  1: "/help/img/cancel-step1.svg",
  2: "/help/img/cancel-step2.svg",
  3: "/help/img/cancel-step3.svg",
  4: "/help/img/cancel-step4.svg",
} as const;

/** Every step illustration this file references. Used by the drift test. */
export const HELP_STEP_IMAGES: readonly string[] = Object.values(STEP_IMG);

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "cancel-subscription",
    category: "billing",
    order: 1,
    readingTime: 2,
    copy: {
      en: {
        title: "How to cancel your Echorank subscription",
        description:
          "Canceling takes about a minute and is entirely self-serve — no email, no phone call, no retention hoops.",
        body: [
          {
            k: "p",
            t: "Canceling takes about a minute and is entirely self-serve — no email, no phone call, no retention hoops.",
          },
          { k: "h2", t: "Steps" },
          {
            k: "steps",
            items: [
              { t: "Sign in to your Echorank account." },
              {
                t: "In the left sidebar, go to **Billing**.",
                img: { src: STEP_IMG[1], alt: "Billing in the sidebar" },
              },
              {
                t: "Click **Manage subscription**. This opens your secure Stripe billing portal.",
                img: { src: STEP_IMG[2], alt: "Manage subscription button" },
              },
              {
                t: "In the portal, click your **active plan** (the row showing your plan name and next payment).",
                img: { src: STEP_IMG[3], alt: "Active plan row in the portal" },
              },
              {
                t: "Click **Cancel subscription** and confirm.",
                img: { src: STEP_IMG[4], alt: "Cancel subscription action" },
              },
            ],
          },
          { k: "h2", t: "What happens after you cancel" },
          {
            k: "ul",
            items: [
              "Your plan stays fully active until the end of the period you've already paid for (or until your trial's end date, if you cancel during a trial). You are not charged again.",
              "There are no cancellation fees.",
              "Your workspace data — audits, tracked prompts, reports, settings — is kept, so if you come back everything is where you left it.",
              "Any prepaid lookup credits remain on your account and become usable again if you reactivate a subscription.",
              "You can restart anytime from **Billing → Plans**; reactivating during the remaining paid period simply resumes your plan.",
            ],
          },
          { k: "h2", t: "Canceling during your free trial" },
          {
            k: "p",
            t: "Same steps. Cancel any time before the trial ends and you will not be charged at all.",
          },
          { k: "h2", t: "Need help?" },
          {
            k: "p",
            t: "If anything in the portal doesn't work, contact support and we'll cancel it for you — the self-serve path is a convenience, not a requirement.",
          },
        ],
        faq: {
          q: "How do I cancel my subscription?",
          a: "Sign in → **Billing** → **Manage subscription** → click your plan → **Cancel subscription**. Your plan stays active until the end of the period you've paid for, and you won't be charged again. No fees, no phone calls. If you cancel during your free trial, you're never charged. Full walkthrough: [How to cancel your Echorank subscription](/help/cancel-subscription).",
        },
        blurb:
          "**Canceling your subscription** — Cancellation is self-serve from Billing → Manage subscription and takes effect at the end of your paid period. See the step-by-step guide: [How to cancel](/help/cancel-subscription).",
        related: [
          { href: "/pricing", label: "Plans and pricing", internal: true },
          {
            href: "/legal/subscription-agreement",
            label: "Subscription Agreement",
            internal: true,
          },
        ],
      },

      fr: {
        title: "Comment annuler votre abonnement Echorank",
        description:
          "L'annulation prend environ une minute et se fait entièrement en libre-service — sans e-mail, sans appel, sans obstacles.",
        body: [
          {
            k: "p",
            t: "L'annulation prend environ une minute et se fait entièrement en libre-service — sans e-mail, sans appel, sans obstacles.",
          },
          { k: "h2", t: "Étapes" },
          {
            k: "steps",
            items: [
              { t: "Connectez-vous à votre compte Echorank." },
              {
                t: "Dans la barre latérale gauche, ouvrez **Facturation**.",
                img: { src: STEP_IMG[1], alt: "Facturation dans la barre latérale" },
              },
              {
                t: "Cliquez sur **Gérer l'abonnement**. Votre portail de facturation sécurisé Stripe s'ouvre.",
                img: { src: STEP_IMG[2], alt: "Le bouton Gérer l'abonnement" },
              },
              {
                t: "Dans le portail, cliquez sur votre **forfait actif** (la ligne indiquant le nom du forfait et le prochain paiement).",
                img: { src: STEP_IMG[3], alt: "La ligne du forfait actif dans le portail" },
              },
              {
                t: "Cliquez sur **Annuler l'abonnement** et confirmez.",
                img: { src: STEP_IMG[4], alt: "L'action Annuler l'abonnement" },
              },
            ],
          },
          { k: "h2", t: "Ce qui se passe après l'annulation" },
          {
            k: "ul",
            items: [
              "Votre forfait reste pleinement actif jusqu'à la fin de la période déjà payée (ou jusqu'à la fin de votre essai si vous annulez pendant celui-ci). Aucun nouveau prélèvement.",
              "Aucuns frais d'annulation.",
              "Vos données — audits, prompts suivis, rapports, réglages — sont conservées ; si vous revenez, tout est à sa place.",
              "Vos crédits de recherche prépayés restent sur votre compte et redeviennent utilisables si vous réactivez un abonnement.",
              "Vous pouvez reprendre à tout moment depuis **Facturation → Forfaits**.",
            ],
          },
          { k: "h2", t: "Annuler pendant l'essai gratuit" },
          {
            k: "p",
            t: "Mêmes étapes. Annulez à tout moment avant la fin de l'essai et vous ne serez jamais facturé.",
          },
          { k: "h2", t: "Besoin d'aide ?" },
          {
            k: "p",
            t: "Si quelque chose ne fonctionne pas dans le portail, contactez le support et nous annulerons pour vous — le libre-service est une commodité, pas une obligation.",
          },
        ],
        faq: {
          q: "Comment annuler mon abonnement ?",
          a: "Connexion → **Facturation** → **Gérer l'abonnement** → cliquez sur votre forfait → **Annuler l'abonnement**. Le forfait reste actif jusqu'à la fin de la période payée, sans nouveau prélèvement. Aucuns frais, aucun appel. En cas d'annulation pendant l'essai gratuit, vous n'êtes jamais facturé. Guide complet : [Comment annuler](/help/cancel-subscription).",
        },
        // No French blurb shipped with the canonical copy pack — written here
        // from the English one, in the article's own vocabulary
        // ("Facturation → Gérer l'abonnement"), not machine-translated.
        blurb:
          "**Annuler votre abonnement** — L'annulation se fait en libre-service depuis Facturation → Gérer l'abonnement et prend effet à la fin de votre période payée. Voir le guide étape par étape : [Comment annuler](/help/cancel-subscription).",
        related: [
          { href: "/pricing", label: "Forfaits et tarifs", internal: true },
          {
            href: "/legal/subscription-agreement",
            label: "Contrat d'abonnement",
            internal: true,
          },
        ],
      },
    },
  },
];

export function helpArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

/** The article's copy in the reader's language, folded to a real catalog. */
export function helpArticleCopy(article: HelpArticle, locale: string): HelpArticleCopy {
  return article.copy[helpBaseOf(locale)];
}

/** Path after the locale segment: "/help/cancel-subscription". */
export function helpArticlePath(slug: string): string {
  return `${HELP_ARTICLE_BASE}/${slug}`;
}

/** Absolute in-app href for a reader in `locale`. */
export function helpArticleHref(locale: string, slug: string): string {
  return `/${locale}${helpArticlePath(slug)}`;
}

/**
 * Every help-article path, after the locale segment.
 *
 * The sitemap registry reads this, so a new article is indexed by adding it to
 * HELP_ARTICLES and nowhere else. Registering here also puts the path in
 * KNOWN_MARKETING_PATHS, which is what 308s the locale-less
 * "/help/cancel-subscription" onto "/en/help/cancel-subscription" instead of
 * letting the proxy's auth gate send it to /login.
 */
export function helpArticleRoutes(): string[] {
  return HELP_ARTICLES.map((a) => helpArticlePath(a.slug));
}

/** Articles in a category, in config order. */
export function helpArticlesByCategory(category: HelpArticleCategory): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === category).sort((a, b) => a.order - b.order);
}
