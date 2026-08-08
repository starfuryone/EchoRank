// Public Resources index — every downloadable, guide and free tool in one
// place, for visitors and for internal linking.
//
// LOCALE MODEL: en/fr bases, exactly like the homepage. en-CA folds to en,
// fr-CA to fr, de-CH shows English. Writing a third catalog here would be
// unreachable code. The modal's chrome (buttons, aria, form labels) is a
// different matter and lives in CONTENT, which is a real five-locale catalog.
//
// METADATA IS SET PER LOCALE ON THIS PAGE via buildMetadata(), rather than
// inheriting the root layout's, so title/description/canonical are correct
// instead of duplicated.
//
// The page stays a server component. Only the grid is client, so the cards can
// open the modal — and every card is still a real <a href> underneath, which
// is what keeps the hrefs in the SSR HTML.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { PublicNav } from "../PublicNav";
import { ResourceGrid, type ResourceGroup } from "./ResourceGrid";
import type { Resource, ResourceKind } from "./ResourceModal";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

interface Item {
  label: string;
  desc: string;
  /** "PDF · 34 pages" — per-resource, so it is authored with the copy. */
  meta: string;
  href: string;
  kind: ResourceKind;
  /** Next route needing the locale prefix. Caddy pages and PDFs do not. */
  internal?: boolean;
}
interface Group {
  h: string;
  items: Item[];
}
interface Doc {
  title: string;
  intro: string;
  groups: Group[];
}

// TODO: /[locale]/ebooks (the email-gated funnel page) does not exist in this
// branch. The two complete guides are gated by the modal's own placeholder
// form meanwhile; point them at the funnel page when it merges.
const GUIDE_EN_PDF =
  "/whitepapers/From-Zero-Visibility-to-a-Trusted-Online-Reputation-The-Complete-Echorank-Guide.pdf";
const GUIDE_FR_PDF =
  "/whitepapers/De-l-invisibilite-a-une-reputation-en-ligne-de-confiance-Le-guide-complet-Echorank.pdf";
const WP_REPUTATION = "/whitepapers/Echorank_Reputation_Intelligence_Whitepaper.pdf";
const WP_SEO_TOOLS = "/whitepapers/echorank360-seo-tools-whitepaper.pdf";

const EN: Doc = {
  title: "Resources",
  intro:
    "Every Echorank guide, whitepaper and free tool in one place. No account needed for anything on this page.",
  groups: [
    {
      h: "Learn",
      items: [
        {
          label: "The Echorank Knowledge Hub",
          desc: "A free ten-chapter course, five deep-dive guides and a glossary — the complete guide, readable on the web.",
          meta: "Course · web pages",
          href: "/learn",
          kind: "guide",
          internal: true,
        },
        {
          label: "Echopedia — the glossary",
          desc: "Every term from the Echorank guides, defined in one place.",
          meta: "Glossary · web page",
          href: "/learn/echopedia",
          kind: "guide",
          internal: true,
        },
      ],
    },
    {
      h: "Free guides & ebooks",
      items: [
        {
          label: "The Complete Echorank Guide",
          desc: "The full playbook: setup, review campaigns, AI visibility and competitor intelligence.",
          meta: "PDF · 34 pages",
          href: GUIDE_EN_PDF,
          kind: "gated",
        },
        {
          label: "Le guide complet Echorank",
          desc: "The same playbook in French, written in French rather than translated.",
          meta: "PDF · 35 pages · French",
          href: GUIDE_FR_PDF,
          kind: "gated",
        },
        {
          label: "Reputation Intelligence whitepaper",
          desc: "How review signals, risk scoring and AI answers connect — the thinking behind the platform.",
          meta: "PDF · 40 pages",
          href: WP_REPUTATION,
          kind: "pdf",
        },
        {
          label: "The SEO tools, explained",
          desc: "What each tool in the classic SEO stack does, and when to reach for it.",
          meta: "PDF · 3 pages",
          href: WP_SEO_TOOLS,
          kind: "pdf",
        },
      ],
    },
    {
      h: "Extension & import help",
      items: [
        {
          label: "Install the browser extension",
          desc: "Download and install, one page, no account required.",
          meta: "Guide · web page",
          href: "/extension/download.html",
          kind: "guide",
        },
        {
          label: "Extension help, step by step",
          desc: "What each button does, and what to do when something looks wrong.",
          meta: "Guide · web page",
          href: "/extension/help.html",
          kind: "guide",
        },
        {
          label: "Import reviews from a CSV",
          desc: "Bring review history in from a spreadsheet or another platform's export.",
          meta: "Guide · web page",
          href: "/extension/howto-import-reviews.html",
          kind: "guide",
        },
        {
          label: "All the ways to get reviews in",
          desc: "Every import route compared, so you can pick the one that fits your history.",
          meta: "Guide · web page",
          href: "/extension/getting-reviews-in.html",
          kind: "guide",
        },
      ],
    },
    {
      h: "Product guide & FAQ",
      items: [
        {
          label: "Echorank user guide",
          desc: "Every feature in plain language, including the first-30-minutes checklist.",
          meta: "Guide · web page",
          href: "/guide",
          kind: "guide",
          internal: true,
        },
        {
          label: "What people ask before they start",
          desc: "The questions that come up most, answered on the homepage.",
          meta: "FAQ · web page",
          href: "/#faq",
          kind: "guide",
          internal: true,
        },
      ],
    },
    {
      h: "Free tools",
      items: [
        {
          label: "AI Visibility audit",
          desc: "Run a real audit with no account and no card — one per day, per address.",
          meta: "Free tool · no account",
          href: "/free-audit",
          kind: "guide",
          internal: true,
        },
      ],
    },
  ],
};

const FR: Doc = {
  title: "Ressources",
  intro:
    "Tous les guides, livres blancs et outils gratuits d'Echorank au même endroit. Aucun compte n'est requis pour quoi que ce soit sur cette page.",
  groups: [
    {
      h: "Apprendre",
      items: [
        {
          label: "Le centre de connaissances Echorank",
          desc: "Un cours gratuit en dix chapitres, cinq guides approfondis et un glossaire — le guide complet, lisible sur le web. Articles en anglais.",
          meta: "Cours · pages web",
          href: "/learn",
          kind: "guide",
          internal: true,
        },
        {
          label: "Echopedia — le glossaire",
          desc: "Tous les termes des guides Echorank, définis au même endroit.",
          meta: "Glossaire · page web · en anglais",
          href: "/learn/echopedia",
          kind: "guide",
          internal: true,
        },
      ],
    },
    {
      h: "Guides et livres numériques gratuits",
      items: [
        {
          label: "Le guide complet Echorank",
          desc: "Le manuel complet : configuration, campagnes d'avis, visibilité IA et veille concurrentielle.",
          meta: "PDF · 35 pages",
          href: GUIDE_FR_PDF,
          kind: "gated",
        },
        {
          label: "The Complete Echorank Guide",
          desc: "La version anglaise du même manuel.",
          meta: "PDF · 34 pages · en anglais",
          href: GUIDE_EN_PDF,
          kind: "gated",
        },
        {
          label: "Livre blanc Reputation Intelligence",
          desc: "Comment les signaux d'avis, le score de risque et les réponses des IA se rejoignent.",
          meta: "PDF · 40 pages · en anglais",
          href: WP_REPUTATION,
          kind: "pdf",
        },
        {
          label: "Les outils SEO, expliqués",
          desc: "Ce que fait chaque outil de la panoplie SEO classique, et quand l'utiliser.",
          meta: "PDF · 3 pages · en anglais",
          href: WP_SEO_TOOLS,
          kind: "pdf",
        },
      ],
    },
    {
      h: "Extension et aide à l'import",
      items: [
        {
          label: "Installer l'extension de navigateur",
          desc: "Téléchargement et installation, une seule page, sans compte.",
          meta: "Guide · page web",
          href: "/extension/download.html",
          kind: "guide",
        },
        {
          label: "Aide sur l'extension, étape par étape",
          desc: "Ce que fait chaque bouton, et quoi faire quand quelque chose cloche.",
          meta: "Guide · page web",
          href: "/extension/help.html",
          kind: "guide",
        },
        {
          label: "Importer des avis depuis un CSV",
          desc: "Reprenez votre historique d'avis depuis un tableur ou l'export d'une autre plateforme.",
          meta: "Guide · page web",
          href: "/extension/howto-import-reviews.html",
          kind: "guide",
        },
        {
          label: "Toutes les façons d'importer vos avis",
          desc: "Chaque méthode d'import comparée, pour choisir celle qui convient à votre historique.",
          meta: "Guide · page web",
          href: "/extension/getting-reviews-in.html",
          kind: "guide",
        },
      ],
    },
    {
      h: "Guide produit et FAQ",
      items: [
        {
          label: "Guide d'utilisation Echorank",
          desc: "Chaque fonctionnalité en langage clair, avec la liste des 30 premières minutes.",
          meta: "Guide · page web",
          href: "/guide",
          kind: "guide",
          internal: true,
        },
        {
          label: "Les questions fréquentes avant de commencer",
          desc: "Les questions qui reviennent le plus, répondues sur la page d'accueil.",
          meta: "FAQ · page web",
          href: "/#faq",
          kind: "guide",
          internal: true,
        },
      ],
    },
    {
      h: "Outils gratuits",
      items: [
        {
          label: "Audit de visibilité IA",
          desc: "Lancez un vrai audit sans compte et sans carte — un par jour et par adresse.",
          meta: "Outil gratuit · sans compte",
          href: "/free-audit",
          kind: "guide",
          internal: true,
        },
      ],
    },
  ],
};

const DOCS: Record<Base, Doc> = { en: EN, fr: FR };

const META: Record<Base, { title: string; description: string }> = {
  en: {
    title: "Resources — guides, whitepapers and free tools | Echorank",
    description:
      "Every Echorank guide, whitepaper, extension help page and free tool in one place. No account required.",
  },
  fr: {
    title: "Ressources — guides, livres blancs et outils gratuits | Echorank",
    description:
      "Tous les guides, livres blancs, pages d'aide de l'extension et outils gratuits d'Echorank. Aucun compte requis.",
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const m = META[baseOf(locale)];
  return buildMetadata({
    locale: locale as Locale,
    path: "/resources",
    title: m.title,
    description: m.description,
  });
}

export default async function ResourcesPage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const doc = DOCS[baseOf(locale)];
  const foot = CONTENT[locale as Locale].footer;
  const modal = CONTENT[locale as Locale].resourceModal;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;

  // Resolve hrefs server-side so the grid receives final URLs and the SSR
  // markup carries exactly what a crawler should follow.
  const groups: ResourceGroup[] = doc.groups.map((g) => ({
    h: g.h,
    items: g.items.map<Resource>((it) => ({
      label: it.label,
      desc: it.desc,
      meta: it.meta,
      kind: it.kind,
      // "/#faq" must become "/fr#faq", not "/fr/#faq" — the latter is a
      // different path and takes a 308.
      href: it.internal
        ? it.href.startsWith("/#")
          ? `/${locale}${it.href.slice(1)}`
          : L(it.href)
        : it.href,
    })),
  }));

  return (
    <div className={s.page}>
      <PublicNav locale={locale} current="resources" />

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}>
            <b>/ 01</b> — {doc.title.toUpperCase()}
          </p>
          <h1 className={s.h2}>{doc.title}</h1>
          <p className={s.sub}>{doc.intro}</p>

          <ResourceGrid groups={groups} locale={locale} labels={modal} />
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.footin}>
            <span>{foot.copyright}</span>
            <span>
              {foot.links.map((l) => (
                <Link key={l.label} href={L(l.href)} style={{ marginLeft: 14 }}>
                  {l.label}
                </Link>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
