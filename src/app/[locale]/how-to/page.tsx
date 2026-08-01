import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import home from "../home.module.css";
import lp from "./how-to.module.css";
import BackButton from "../legal/back-button";
import { StepsArt } from "../hero-art";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LpContent {
  meta: { title: string; description: string };
  hero: { label: string; h1a: string; h1b: string; sub: string; cta1: string; cta2: string };
  connect: { label: string; h2: string; items: { t: string; b: string }[] };
  next: { label: string; h2: string; items: { t: string; b: string }[] };
  moves: { label: string; h2: string; items: { t: string; b: string }[] };
  plans: { label: string; note: string; cta: string };
  final: { h2: string; sub: string; cta1: string; cta2: string };
}

const C: Record<Locale, LpContent> = {
  en: {
    meta: {
      title: "How to get started | Echorank",
      description: "From zero to your first AI-visibility audit and risk baseline in under ten minutes: what to connect, what happens next, and the best first moves.",
    },
    hero: {
      label: "/ HOW TO",
      h1a: "From zero to your first risk score.",
      h1b: "In under ten minutes.",
      sub: "Three connections are all the platform needs. This page walks you through exactly what to link, what happens in your first 24 hours, and the moves that make the intelligence useful from day one.",
      cta1: "Start free trial →",
      cta2: "Book a demo ↗",
    },
    connect: {
      label: "/ 01 — THE THREE CONNECTIONS",
      h2: "Link these, and the engine has what it needs.",
      items: [
        { t: "Your Google Business Profile", b: "The anchor of your public reputation. Connecting it pulls your reviews in and lets scoring start immediately." },
        { t: "Your review sources", b: "Add every platform where customers talk about you. Imports via the browser extension or CSV bring history along." },
        { t: "Your website", b: "Enter your domain and the AI-visibility audit runs on the spot: score, grade, and every failing check in minutes." },
      ],
    },
    next: {
      label: "/ 02 — YOUR FIRST 24 HOURS",
      h2: "What happens while you do nothing.",
      items: [
        { t: "Audit lands in minutes", b: "Your 0 to 100 AI-visibility score with a prioritized fix roadmap." },
        { t: "Risk baseline computes", b: "Every connected signal folds into your first Reputation Risk Score." },
        { t: "The clock starts", b: "Risk recomputes hourly; deltas and history begin accruing from day one." },
        { t: "Tracking begins", b: "On eligible plans, your key prompts start running against the AI engines daily." },
      ],
    },
    moves: {
      label: "/ 03 — BEST FIRST MOVES",
      h2: "Ten more minutes that pay for themselves.",
      items: [
        { t: "Set your monthly revenue", b: "One field in the risk dashboard turns the score into dollars at risk per month." },
        { t: "Add alert emails", b: "Threshold crossings, spikes and critical signals reach the right inbox with the cause attached." },
        { t: "Track 2 or 3 competitors", b: "Daily snapshots start immediately; momentum alerts follow within the week." },
        { t: "Launch a feedback campaign", b: "Email, SMS or QR: fresh signals start flowing, and the engine takes the night shift." },
      ],
    },
    plans: {
      label: "/ 04 — PLANS",
      note: "Everything above ships within the 7-day free trial. The AI Visibility Auditor and Risk Score ship with GROWTH; daily answer tracking and competitor monitoring with AGENCY.",
      cta: "See pricing →",
    },
    final: {
      h2: "Ten minutes from now, you'll know your number.",
      sub: "Connect the three sources and let the first audit run.",
      cta1: "Start free trial →",
      cta2: "Book a demo ↗",
    },
  },

  "en-CA": null as unknown as LpContent,

  fr: {
    meta: {
      title: "Comment démarrer | Echorank",
      description: "De zéro à votre premier audit de visibilité IA et score de risque en moins de dix minutes : quoi relier, ce qui se passe ensuite, et les meilleurs premiers gestes.",
    },
    hero: {
      label: "/ COMMENT DÉMARRER",
      h1a: "De zéro à votre premier score de risque.",
      h1b: "En moins de dix minutes.",
      sub: "Trois connexions suffisent à la plateforme. Cette page vous montre exactement quoi relier, ce qui se passe dans vos premières 24 heures, et les gestes qui rendent l'intelligence utile dès le premier jour.",
      cta1: "Essai gratuit ↗",
      cta2: "Réserver une démo ↗",
    },
    connect: {
      label: "/ 01 — LES TROIS CONNEXIONS",
      h2: "Reliez ceci, et le moteur a ce qu'il lui faut.",
      items: [
        { t: "Votre fiche Google", b: "Le socle de votre réputation publique. La relier importe vos avis et lance le scoring immédiatement." },
        { t: "Vos sources d'avis", b: "Ajoutez chaque plateforme où l'on parle de vous. Les imports par extension de navigateur ou CSV ramènent l'historique." },
        { t: "Votre site web", b: "Entrez votre domaine et l'audit de visibilité IA s'exécute sur-le-champ : score, note et chaque contrôle en échec en quelques minutes." },
      ],
    },
    next: {
      label: "/ 02 — VOS PREMIÈRES 24 HEURES",
      h2: "Ce qui se passe pendant que vous ne faites rien.",
      items: [
        { t: "L'audit arrive en minutes", b: "Votre score de visibilité IA sur 100, avec une feuille de route priorisée." },
        { t: "Le score de base se calcule", b: "Chaque signal relié alimente votre premier Score de risque de réputation." },
        { t: "Le chrono démarre", b: "Le risque est recalculé chaque heure ; variations et historique s'accumulent dès le premier jour." },
        { t: "Le suivi commence", b: "Sur les forfaits éligibles, vos requêtes clés sont testées chaque jour sur les moteurs d'IA." },
      ],
    },
    moves: {
      label: "/ 03 — LES MEILLEURS PREMIERS GESTES",
      h2: "Dix minutes de plus qui se rentabilisent seules.",
      items: [
        { t: "Renseignez votre chiffre d'affaires mensuel", b: "Un seul champ dans le tableau de bord transforme le score en euros à risque par mois." },
        { t: "Ajoutez des courriels d'alerte", b: "Franchissements de seuil, pics et signaux critiques arrivent dans la bonne boîte, avec la cause." },
        { t: "Suivez 2 ou 3 concurrents", b: "Les instantanés quotidiens démarrent immédiatement ; les alertes d'élan suivent dans la semaine." },
        { t: "Lancez une campagne de retours", b: "E-mail, SMS ou QR : des signaux frais commencent à affluer, et le moteur prend le quart de nuit." },
      ],
    },
    plans: {
      label: "/ 04 — FORFAITS",
      note: "Tout ce qui précède est inclus dans l'essai gratuit de 7 jours. L'Audit de visibilité IA et le Score de risque arrivent avec CROISSANCE ; le suivi quotidien des réponses et la veille concurrentielle avec AGENCE.",
      cta: "Voir les tarifs →",
    },
    final: {
      h2: "Dans dix minutes, vous connaîtrez votre chiffre.",
      sub: "Reliez les trois sources et laissez le premier audit tourner.",
      cta1: "Essai gratuit ↗",
      cta2: "Réserver une démo ↗",
    },
  },

  "fr-CA": null as unknown as LpContent,

  "de-CH": {
    meta: {
      title: "So starten Sie | Echorank",
      description: "Von null zum ersten KI-Sichtbarkeits-Audit und Risiko-Basiswert in unter zehn Minuten: was zu verbinden ist, was danach passiert, und die besten ersten Schritte.",
    },
    hero: {
      label: "/ SO STARTEN SIE",
      h1a: "Von null zu Ihrem ersten Risiko-Score.",
      h1b: "In unter zehn Minuten.",
      sub: "Drei Verbindungen genügen der Plattform. Diese Seite zeigt genau, was zu verknüpfen ist, was in Ihren ersten 24 Stunden passiert, und die Schritte, die die Intelligenz vom ersten Tag an nützlich machen.",
      cta1: "Kostenlos testen →",
      cta2: "Demo buchen ↗",
    },
    connect: {
      label: "/ 01 — DIE DREI VERBINDUNGEN",
      h2: "Verknüpfen Sie diese, und der Motor hat, was er braucht.",
      items: [
        { t: "Ihr Google-Unternehmensprofil", b: "Der Anker Ihrer öffentlichen Reputation. Die Verbindung importiert Ihre Bewertungen und startet das Scoring sofort." },
        { t: "Ihre Bewertungsquellen", b: "Fügen Sie jede Plattform hinzu, auf der über Sie gesprochen wird. Importe per Browser-Erweiterung oder CSV bringen die Historie mit." },
        { t: "Ihre Website", b: "Domain eingeben, und der KI-Sichtbarkeits-Audit läuft sofort: Score, Note und jeder fehlgeschlagene Check in Minuten." },
      ],
    },
    next: {
      label: "/ 02 — IHRE ERSTEN 24 STUNDEN",
      h2: "Was passiert, während Sie nichts tun.",
      items: [
        { t: "Audit in Minuten", b: "Ihr KI-Sichtbarkeits-Score von 0 bis 100, mit priorisiertem Fahrplan." },
        { t: "Basiswert wird berechnet", b: "Jedes verbundene Signal fliesst in Ihren ersten Reputations-Risiko-Score." },
        { t: "Die Uhr läuft", b: "Das Risiko wird stündlich neu berechnet; Deltas und Verlauf wachsen ab Tag eins." },
        { t: "Tracking beginnt", b: "Auf berechtigten Plänen laufen Ihre Schlüsselfragen täglich gegen die KI-Engines." },
      ],
    },
    moves: {
      label: "/ 03 — DIE BESTEN ERSTEN SCHRITTE",
      h2: "Zehn weitere Minuten, die sich selbst bezahlen.",
      items: [
        { t: "Monatsumsatz hinterlegen", b: "Ein Feld im Dashboard verwandelt den Score in Franken im Risiko pro Monat." },
        { t: "Alarm-E-Mails hinzufügen", b: "Schwellenüberschreitungen, Sprünge und kritische Signale erreichen das richtige Postfach, mit Ursache." },
        { t: "2 bis 3 Konkurrenten verfolgen", b: "Tägliche Momentaufnahmen starten sofort; Momentum-Alarme folgen innerhalb der Woche." },
        { t: "Erste Feedback-Kampagne starten", b: "E-Mail, SMS oder QR: frische Signale beginnen zu fliessen, und der Motor übernimmt die Nachtschicht." },
      ],
    },
    plans: {
      label: "/ 04 — PLÄNE",
      note: "Alles oben ist in den 7 Tagen Gratis-Test enthalten. KI-Sichtbarkeits-Audit und Risiko-Score kommen mit WACHSTUM; tägliches Antwort-Tracking und Konkurrenz-Monitoring mit AGENTUR.",
      cta: "Preise ansehen →",
    },
    final: {
      h2: "In zehn Minuten kennen Sie Ihre Zahl.",
      sub: "Verbinden Sie die drei Quellen und lassen Sie den ersten Audit laufen.",
      cta1: "Kostenlos testen →",
      cta2: "Demo buchen ↗",
    },
  },
};

C["en-CA"] = C.en;
C["fr-CA"] = {
  ...C.fr,
  moves: {
    ...C.fr.moves,
    items: C.fr.moves.items.map((it) =>
      it.t === "Renseignez votre chiffre d'affaires mensuel"
        ? { t: "Renseignez vos revenus mensuels", b: "Un seul champ dans le tableau de bord transforme le score en dollars à risque par mois." }
        : it.t === "Ajoutez des courriels d'alerte"
          ? it
          : it.t === "Lancez une campagne de retours"
            ? { t: "Lancez une campagne de rétroaction", b: "Courriel, texto ou code QR : des signaux frais commencent à affluer, et le moteur prend le quart de nuit." }
            : it,
    ),
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const { meta } = C[locale];
  return buildMetadata({
    locale,
    path: "/how-to",
    title: meta.title,
    description: meta.description,
  });
}

export default async function HowToPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = C[locale];
  const nav = CONTENT[locale].nav;
  const foot = CONTENT[locale].footer;
  const backLabel = locale.startsWith("fr") ? "← Retour" : locale === "de-CH" ? "← Zurück" : "← Back";

  return (
    <div className={lp.page}>
      <div className={home.container}>
        <header className={lp.navbar}>
          <Link href={`/${locale}`} className={lp.logoLink} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          <nav className={lp.navLinks} aria-label="Main">
            <Link href={`/${locale}`} className={lp.navLink}>{nav.product}</Link>
            <Link href={`/${locale}#pricing`} className={lp.navLink}>{nav.pricing}</Link>
            <Link href={`/${locale}#field`} className={lp.navLink}>{nav.customers}</Link>
            <Link href="/login" className={lp.navLink}>{nav.login}</Link>
          </nav>
          <div className={lp.navRight}>
            <span className={lp.switcher}>
              {nav.switcher.map((l) => (
                <Link
                  key={l}
                  href={`/${l}/how-to`}
                  className={`${lp.switchItem} ${l === locale ? lp.switchActive : ""}`}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </span>
            <Link href="/register" className={`${lp.btn} ${lp.btnPrimary}`}>{nav.cta}</Link>
          </div>
        </header>

        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnGrey} />
        </div>

        <section className={`${home.section} ${lp.heroGrid}`}>
          <div className={lp.heroCopy}>
          <div className={home.label}>{c.hero.label}</div>
          <h1 className={home.h1}>
            {c.hero.h1a}
            <span className={home.muted}>{c.hero.h1b}</span>
          </h1>
          <p className={home.subhead}>{c.hero.sub}</p>
          <div className={`${lp.btnRow} ${lp.ctas}`}>
            <Link href="/register" className={`${lp.btn} ${lp.btnPrimary}`}>{c.hero.cta1}</Link>
            <Link href="/register" className={`${lp.btn} ${lp.btnGhost}`}>{c.hero.cta2}</Link>
          </div>
          </div>
          <div className={lp.heroArt} aria-hidden="true">
            <StepsArt />
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.connect.label}</div>
          <h2 className={home.h2}>{c.connect.h2}</h2>
          <div className={lp.grid3}>
            {c.connect.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.next.label}</div>
          <h2 className={home.h2}>{c.next.h2}</h2>
          <div className={lp.grid4}>
            {c.next.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.moves.label}</div>
          <h2 className={home.h2}>{c.moves.h2}</h2>
          <div className={lp.grid4}>
            {c.moves.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.plans.label}</div>
          <p className={lp.plansNote}>{c.plans.note}</p>
          <Link href={`/${locale}#pricing`} className={`${lp.btn} ${lp.btnGhost}`}>{c.plans.cta}</Link>
        </section>

        <section className={`${home.section} ${lp.finalBand}`}>
          <h2 className={home.h2}>{c.final.h2}</h2>
          <p className={home.subhead}>{c.final.sub}</p>
          <div className={`${lp.btnRow} ${lp.ctas}`}>
            <Link href="/register" className={`${lp.btn} ${lp.btnPrimary}`}>{c.final.cta1}</Link>
            <Link href="/register" className={`${lp.btn} ${lp.btnGhost}`}>{c.final.cta2}</Link>
          </div>
        </section>

        <div className={lp.backRowBottom}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnGrey} />
        </div>

        <footer className={lp.footer}>
          <span>{foot.copyright}</span>
          <span>
            {foot.links.map((l) => (
              <Link key={l.label} href={`/${locale}${l.href}`}>{l.label}</Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
// EOF-howto-lp
