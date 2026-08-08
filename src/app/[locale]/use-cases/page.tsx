// /[locale]/use-cases — "What do you want to achieve?"
//
// Goal-led entry page: a visitor who knows their problem but not our product
// names picks the outcome, and every card lands on a page that already exists.
//
// EVERY href IS A REAL ROUTE, and the test asserts it against the sitemap
// registry rather than a hand-kept list. A goal page whose cards 404 is worse
// than no goal page — it is the one screen a visitor reaches precisely because
// they do not yet know their way around.
//
// Cards deliberately do NOT link to /visibility/tools/*. Those are paid,
// authenticated dashboard routes: sending an anonymous visitor there bounces
// them off the plan gate. Goals whose product surface is dashboard-only point
// at /pricing or the homepage tool list instead.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { PublicNav } from "../PublicNav";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr" | "de-CH";
const baseOf = (locale: string): Base =>
  locale.startsWith("fr") ? "fr" : locale === "de-CH" ? "de-CH" : "en";

interface Card {
  /** Locale-less path; the locale is prefixed at render time. */
  href: string;
  title: string;
  body: string;
}

interface Copy {
  metaTitle: string;
  metaDescription: string;
  label: string;
  h1: string;
  sub: string;
  ctaTrial: string;
  goalsLabel: string;
  cards: Card[];
  sizeLabel: string;
  sizeH2: string;
  sizes: { title: string; body: string }[];
  closeH2: string;
  closeSub: string;
  ctaAudit: string;
}

/**
 * Card hrefs, named once so the copy tables cannot drift apart from each other.
 * `#tools` is the homepage's Classic SEO Tools section — the only public
 * surface that lists the SEO tools; the tools themselves are paid.
 */
const HREF = {
  aiVisibility: "/ai-visibility",
  audit: "/free-audit",
  monitoring: "/live-monitoring",
  feedback: "/customer-feedback",
  signals: "/act-on-signals",
  tools: "#tools",
  pricing: "/pricing",
} as const;

const COPY: Record<Base, Copy> = {
  en: {
    metaTitle: "Use cases",
    metaDescription:
      "Pick your goal — AI visibility, reputation monitoring, reviews, search visibility or content — and see the Echorank360 tools that get you there.",
    label: "USE CASES",
    h1: "What do you want to achieve?",
    sub: "Pick your goal — Echorank360 gives you the tools to get there.",
    ctaTrial: "Start 7-day trial ↗",
    goalsLabel: "BY GOAL",
    cards: [
      {
        href: HREF.aiVisibility,
        title: "Get recommended by AI",
        // Engine names kept general on purpose — see the header note in the
        // commit; naming an engine we do not yet query would be a new claim.
        body: "See how ChatGPT, Google AI and other assistants talk about your business — and improve how often you are mentioned.",
      },
      {
        href: HREF.monitoring,
        title: "Monitor your online reputation",
        body: "Track reviews, ratings and sentiment across platforms from one dashboard, before problems become public.",
      },
      {
        href: HREF.tools,
        title: "Grow your search visibility",
        body: "Research keywords, watch your rankings, and find the gaps competitors have not filled.",
      },
      {
        href: HREF.feedback,
        title: "Get more customer reviews",
        body: "Send review requests by email and SMS and turn happy customers into public proof.",
      },
      {
        href: HREF.signals,
        title: "Respond to every review",
        body: "Reply fast and on-brand with AI-assisted responses, even at volume.",
      },
      {
        href: HREF.audit,
        title: "Know where you stand",
        // Reworded: the free audit scores AI visibility, not reputation
        // generally, and there is no separate "reputation baseline" product.
        body: "Run a free AI visibility audit and get a scored snapshot of your online presence in minutes.",
      },
      {
        href: HREF.pricing,
        title: "Create marketing content faster",
        body: "Generate briefs, posts and campaigns in your brand voice with the Marketing Studio.",
      },
      {
        href: HREF.pricing,
        title: "Manage every location and client",
        body: "Track multiple locations or client brands from one account, with white-label reporting on Agency.",
      },
    ],
    sizeLabel: "BY BUSINESS SIZE",
    sizeH2: "Where are you starting from?",
    sizes: [
      {
        title: "Small business",
        body: "One location, one owner wearing every hat. Start with the audit and review requests, and add tools as you grow.",
      },
      {
        title: "Growing team",
        body: "Several locations and someone who owns marketing. Add SMS, advanced analytics and AI risk scoring.",
      },
      {
        title: "Agency & multi-location",
        body: "Many brands, many locations, client reporting. White-label dashboards, custom domain and full API access.",
      },
    ],
    closeH2: "Not sure where to start?",
    closeSub: "Run the free AI visibility audit. No account needed, and it takes about a minute.",
    ctaAudit: "Run my free audit ↗",
  },

  fr: {
    metaTitle: "Cas d'usage",
    metaDescription:
      "Choisissez votre objectif — visibilité IA, surveillance de la réputation, avis, référencement ou contenu — et découvrez les outils Echorank360 pour y parvenir.",
    label: "CAS D'USAGE",
    h1: "Que voulez-vous accomplir ?",
    sub: "Choisissez votre objectif — Echorank360 vous donne les outils pour l'atteindre.",
    ctaTrial: "Essai gratuit de 7 jours ↗",
    goalsLabel: "PAR OBJECTIF",
    cards: [
      {
        href: HREF.aiVisibility,
        title: "Être recommandé par l'IA",
        body: "Découvrez comment ChatGPT, Google AI et les autres assistants parlent de votre entreprise — et améliorez la fréquence à laquelle vous êtes cité.",
      },
      {
        href: HREF.monitoring,
        title: "Surveiller votre réputation en ligne",
        body: "Suivez les avis, les notes et le sentiment sur toutes les plateformes depuis un seul tableau de bord, avant que les problèmes ne deviennent publics.",
      },
      {
        href: HREF.tools,
        title: "Développer votre visibilité dans la recherche",
        body: "Recherchez des mots-clés, surveillez vos positions et repérez les créneaux que vos concurrents n'ont pas comblés.",
      },
      {
        href: HREF.feedback,
        title: "Obtenir plus d'avis clients",
        body: "Envoyez des demandes d'avis par courriel et SMS et transformez vos clients satisfaits en preuve publique.",
      },
      {
        href: HREF.signals,
        title: "Répondre à tous les avis",
        body: "Répondez rapidement et dans votre ton grâce aux réponses assistées par IA, même en volume.",
      },
      {
        href: HREF.audit,
        title: "Savoir où vous en êtes",
        body: "Lancez un audit de visibilité IA gratuit et obtenez un aperçu chiffré de votre présence en ligne en quelques minutes.",
      },
      {
        href: HREF.pricing,
        title: "Créer du contenu marketing plus vite",
        body: "Générez des briefs, des publications et des campagnes dans votre voix de marque avec le Marketing Studio.",
      },
      {
        href: HREF.pricing,
        title: "Gérer chaque établissement et chaque client",
        body: "Suivez plusieurs établissements ou marques clientes depuis un seul compte, avec des rapports en marque blanche sur Agency.",
      },
    ],
    sizeLabel: "PAR TAILLE D'ENTREPRISE",
    sizeH2: "D'où partez-vous ?",
    sizes: [
      {
        title: "Petite entreprise",
        body: "Un établissement, un dirigeant qui porte toutes les casquettes. Commencez par l'audit et les demandes d'avis, puis ajoutez des outils.",
      },
      {
        title: "Équipe en croissance",
        body: "Plusieurs établissements et une personne responsable du marketing. Ajoutez le SMS, les analyses avancées et le scoring de risque par IA.",
      },
      {
        title: "Agence et multi-établissements",
        body: "Plusieurs marques, plusieurs établissements, des rapports clients. Tableaux de bord en marque blanche, domaine personnalisé et accès API complet.",
      },
    ],
    closeH2: "Vous ne savez pas par où commencer ?",
    closeSub: "Lancez l'audit de visibilité IA gratuit. Sans compte, en une minute environ.",
    ctaAudit: "Lancer mon audit gratuit ↗",
  },

  "de-CH": {
    metaTitle: "Anwendungsfälle",
    metaDescription:
      "Wählen Sie Ihr Ziel — KI-Sichtbarkeit, Reputationsüberwachung, Bewertungen, Suchsichtbarkeit oder Inhalte — und sehen Sie die passenden Echorank360-Werkzeuge.",
    label: "ANWENDUNGSFÄLLE",
    h1: "Was möchten Sie erreichen?",
    sub: "Wählen Sie Ihr Ziel — Echorank360 gibt Ihnen die Werkzeuge dafür.",
    ctaTrial: "7 Tage kostenlos testen ↗",
    goalsLabel: "NACH ZIEL",
    cards: [
      {
        href: HREF.aiVisibility,
        title: "Von KI empfohlen werden",
        body: "Sehen Sie, wie ChatGPT, Google AI und andere Assistenten über Ihr Unternehmen sprechen — und wie oft Sie genannt werden.",
      },
      {
        href: HREF.monitoring,
        title: "Ihre Online-Reputation überwachen",
        body: "Verfolgen Sie Bewertungen, Sterne und Stimmung über alle Plattformen hinweg in einem Dashboard, bevor Probleme öffentlich werden.",
      },
      {
        href: HREF.tools,
        title: "Ihre Suchsichtbarkeit ausbauen",
        body: "Recherchieren Sie Keywords, beobachten Sie Ihre Platzierungen und finden Sie Lücken, die Mitbewerber offen gelassen haben.",
      },
      {
        href: HREF.feedback,
        title: "Mehr Kundenbewertungen erhalten",
        body: "Versenden Sie Bewertungsanfragen per E-Mail und SMS und machen Sie zufriedene Kunden zu öffentlichem Beleg.",
      },
      {
        href: HREF.signals,
        title: "Auf jede Bewertung antworten",
        body: "Antworten Sie schnell und markengerecht mit KI-gestützten Antworten, auch bei grossem Volumen.",
      },
      {
        href: HREF.audit,
        title: "Wissen, wo Sie stehen",
        body: "Starten Sie ein kostenloses KI-Sichtbarkeits-Audit und erhalten Sie in wenigen Minuten eine bewertete Momentaufnahme.",
      },
      {
        href: HREF.pricing,
        title: "Marketinginhalte schneller erstellen",
        body: "Erstellen Sie Briefings, Beiträge und Kampagnen in Ihrer Markenstimme mit dem Marketing Studio.",
      },
      {
        href: HREF.pricing,
        title: "Alle Standorte und Kunden verwalten",
        body: "Verwalten Sie mehrere Standorte oder Kundenmarken aus einem Konto, mit White-Label-Reporting im Agency-Tarif.",
      },
    ],
    sizeLabel: "NACH UNTERNEHMENSGRÖSSE",
    sizeH2: "Wo starten Sie?",
    sizes: [
      {
        title: "Kleinunternehmen",
        body: "Ein Standort, eine Person für alles. Beginnen Sie mit dem Audit und Bewertungsanfragen und ergänzen Sie später weitere Werkzeuge.",
      },
      {
        title: "Wachsendes Team",
        body: "Mehrere Standorte und eine Person für Marketing. Ergänzen Sie SMS, erweiterte Analysen und KI-Risikobewertung.",
      },
      {
        title: "Agentur und Multi-Standort",
        body: "Viele Marken, viele Standorte, Kundenreporting. White-Label-Dashboards, eigene Domain und voller API-Zugang.",
      },
    ],
    closeH2: "Unsicher, wo Sie anfangen sollen?",
    closeSub: "Starten Sie das kostenlose KI-Sichtbarkeits-Audit. Ohne Konto, in etwa einer Minute.",
    ctaAudit: "Kostenloses Audit starten ↗",
  },
};

/** Exported so the route test can assert every href against the registry. */
export function useCaseHrefs(): string[] {
  return COPY.en.cards.map((c) => c.href);
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = COPY[baseOf(locale)];
  return buildMetadata({
    locale,
    path: "/use-cases",
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const l = locale as Locale;
  const c = COPY[baseOf(l)];
  // "#tools" is an anchor on the homepage, so it needs the locale root in
  // front of it; the rest are locale-prefixed paths.
  const link = (href: string) => (href.startsWith("#") ? `/${l}${href}` : `/${l}${href}`);

  return (
    <div className={s.page}>
      <PublicNav locale={l} current="use-cases" />

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 01</b> — {c.label}</p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.sub}</p>
          <div className={s.ctarow} style={{ marginTop: 24 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${l}/pricing`}>
              {c.ctaTrial}
            </Link>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {c.goalsLabel}</p>
          <div className={s.ucGrid}>
            {c.cards.map((card) => (
              <Link key={card.title} href={link(card.href)} className={s.ucCard}>
                <span className={s.ucTitle}>{card.title}</span>
                <span className={s.ucBody}>{card.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 03</b> — {c.sizeLabel}</p>
          <h2 className={s.h2}>{c.sizeH2}</h2>
          <div className={s.ucSizes}>
            {c.sizes.map((size) => (
              <Link key={size.title} href={`/${l}/pricing`} className={s.ucSize}>
                <span className={s.ucTitle}>{size.title}</span>
                <span className={s.ucBody}>{size.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.closeH2}</h2>
          <p className={s.sub}>{c.closeSub}</p>
          <div className={s.ctarow} style={{ marginTop: 22 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${l}${HREF.audit}`}>
              {c.ctaAudit}
            </Link>
            <Link className={`${s.btn} ${s.btnGhost}`} href={`/${l}/pricing`}>
              {c.ctaTrial}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
