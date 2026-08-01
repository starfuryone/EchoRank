// Public Resources index — every downloadable, guide and free tool in one
// place, for visitors and for internal linking.
//
// LOCALE MODEL: en/fr bases, exactly like the homepage. en-CA folds to en,
// fr-CA to fr, de-CH shows English. Writing a third catalog here would be
// unreachable code.
//
// METADATA IS SET PER LOCALE ON THIS PAGE via buildMetadata(), rather than
// inheriting the root layout's, so title/description/canonical are correct
// instead of duplicated.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import { PublicNav } from "../PublicNav";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

interface Item {
  label: string;
  desc: string;
  href: string;
  /** Served by Caddy or a static asset — not a Next route, so no <Link>. */
  external?: boolean;
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
// branch. The two complete guides link straight to their PDFs meanwhile —
// swap both hrefs to `/${locale}/ebooks` when that page merges.
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
      h: "Free guides & ebooks",
      items: [
        {
          label: "The Complete Echorank Guide (EN, 34 p.)",
          desc: "The full playbook: setup, review campaigns, AI visibility and competitor intelligence.",
          href: GUIDE_EN_PDF,
          external: true,
        },
        {
          label: "Le guide complet Echorank (FR, 35 p.)",
          desc: "The same playbook in French, written in French rather than translated.",
          href: GUIDE_FR_PDF,
          external: true,
        },
        {
          label: "Reputation Intelligence whitepaper (PDF)",
          desc: "How review signals, risk scoring and AI answers connect — the thinking behind the platform.",
          href: WP_REPUTATION,
          external: true,
        },
        {
          label: "The SEO tools, explained (PDF)",
          desc: "What each tool in the classic SEO stack does, and when to reach for it.",
          href: WP_SEO_TOOLS,
          external: true,
        },
      ],
    },
    {
      h: "Extension & import help",
      items: [
        {
          label: "Install the browser extension",
          desc: "Download and install, one page, no account required.",
          href: "/extension/download.html",
          external: true,
        },
        {
          label: "Extension help, step by step",
          desc: "What each button does, and what to do when something looks wrong.",
          href: "/extension/help.html",
          external: true,
        },
        {
          label: "Import reviews from a CSV",
          desc: "Bring review history in from a spreadsheet or another platform's export.",
          href: "/extension/howto-import-reviews.html",
          external: true,
        },
        {
          label: "All the ways to get reviews in",
          desc: "Every import route compared, so you can pick the one that fits your history.",
          href: "/extension/getting-reviews-in.html",
          external: true,
        },
      ],
    },
    {
      h: "Product guide & FAQ",
      items: [
        {
          label: "Echorank user guide",
          desc: "Every feature in plain language, including the first-30-minutes checklist.",
          href: "/guide",
        },
        {
          label: "What people ask before they start",
          desc: "The questions that come up most, answered on the homepage.",
          href: "/#faq",
        },
      ],
    },
    {
      h: "Free tools",
      items: [
        {
          label: "AI Visibility audit",
          desc: "Run a real audit with no account and no card — one per day, per address.",
          href: "/ai-visibility#audit",
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
      h: "Guides et livres numériques gratuits",
      items: [
        {
          label: "Le guide complet Echorank (FR, 35 p.)",
          desc: "Le manuel complet : configuration, campagnes d'avis, visibilité IA et veille concurrentielle.",
          href: GUIDE_FR_PDF,
          external: true,
        },
        {
          label: "The Complete Echorank Guide (EN, 34 p.)",
          desc: "La version anglaise du même manuel.",
          href: GUIDE_EN_PDF,
          external: true,
        },
        {
          label: "Livre blanc Reputation Intelligence (PDF, en anglais)",
          desc: "Comment les signaux d'avis, le score de risque et les réponses des IA se rejoignent.",
          href: WP_REPUTATION,
          external: true,
        },
        {
          label: "Les outils SEO, expliqués (PDF, en anglais)",
          desc: "Ce que fait chaque outil de la panoplie SEO classique, et quand l'utiliser.",
          href: WP_SEO_TOOLS,
          external: true,
        },
      ],
    },
    {
      h: "Extension et aide à l'import",
      items: [
        {
          label: "Installer l'extension de navigateur",
          desc: "Téléchargement et installation, une seule page, sans compte.",
          href: "/extension/download.html",
          external: true,
        },
        {
          label: "Aide sur l'extension, étape par étape",
          desc: "Ce que fait chaque bouton, et quoi faire quand quelque chose cloche.",
          href: "/extension/help.html",
          external: true,
        },
        {
          label: "Importer des avis depuis un CSV",
          desc: "Reprenez votre historique d'avis depuis un tableur ou l'export d'une autre plateforme.",
          href: "/extension/howto-import-reviews.html",
          external: true,
        },
        {
          label: "Toutes les façons d'importer vos avis",
          desc: "Chaque méthode d'import comparée, pour choisir celle qui convient à votre historique.",
          href: "/extension/getting-reviews-in.html",
          external: true,
        },
      ],
    },
    {
      h: "Guide produit et FAQ",
      items: [
        {
          label: "Guide d'utilisation Echorank",
          desc: "Chaque fonctionnalité en langage clair, avec la liste des 30 premières minutes.",
          href: "/guide",
        },
        {
          label: "Les questions fréquentes avant de commencer",
          desc: "Les questions qui reviennent le plus, répondues sur la page d'accueil.",
          href: "/#faq",
        },
      ],
    },
    {
      h: "Outils gratuits",
      items: [
        {
          label: "Audit de visibilité IA",
          desc: "Lancez un vrai audit sans compte et sans carte — un par jour et par adresse.",
          href: "/ai-visibility#audit",
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
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;

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

          {doc.groups.map((g) => (
            <div className={s.toolsGroup} key={g.h}>
              <h2 className={s.toolsGroupName}>{g.h}</h2>
              <div className={s.toolsGrid}>
                {g.items.map((it) => (
                  <div className={s.toolCard} key={it.href + it.label}>
                    {/* External here means "not a Next route" — the extension
                        pages are static HTML served by Caddy and the PDFs are
                        assets, so <Link> prefetching would be wrong for both. */}
                    {it.external ? (
                      <a className={s.toolName} href={it.href}>
                        {it.label}
                      </a>
                    ) : (
                      <Link className={s.toolName} href={L(it.href)}>
                        {it.label}
                      </Link>
                    )}
                    <p className={s.toolDesc}>{it.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
