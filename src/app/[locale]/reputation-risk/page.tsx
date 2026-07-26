import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import BackButton from "../legal/back-button";
import home from "../home.module.css";
import { RiskArt } from "../hero-art";
import lp from "./reputation-risk.module.css";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LpContent {
  meta: { title: string; description: string };
  hero: { label: string; h1a: string; h1b: string; sub: string; cta1: string; cta2: string };
  killers: { label: string; h2: string; items: { t: string; b: string }[] };
  score: { label: string; h2: string; items: { t: string; b: string }[] };
  reduce: { label: string; h2: string; items: { t: string; b: string }[] };
  plans: { label: string; note: string; cta: string };
  final: { h2: string; sub: string; cta1: string; cta2: string };
}

const C: Record<Locale, LpContent> = {
  en: {
    meta: {
      title: "Reputation Risk Score. Echorank",
      description:
        "One explainable 0–100 Reputation Risk Score across reviews, feedback, AI visibility and competitors, with alerts and revenue-at-risk, so you prevent instead of react.",
    },
    hero: {
      label: "/ REPUTATION RISK",
      h1a: "Stop losing customers before you know they're leaving.",
      h1b: "Most damage happens in silence.",
      sub: "One unhappy customer. One unanswered review. One competitor gaining momentum. One AI answer that gets your business wrong. By the time sales decline, the damage is done. Echorank turns every signal into one explainable Reputation Risk Score, so you prevent instead of react.",
      cta1: "Get your Risk Score →",
      cta2: "Book a demo ↗",
    },
    killers: {
      label: "/ 01 — THE SILENT KILLERS",
      h2: "Reputation rarely collapses. It leaks.",
      items: [
        { t: "Customers who leave in silence", b: "Most unhappy customers never complain to you. They just stop coming back, and tell others why." },
        { t: "Unanswered reviews", b: "Every ignored review reads like a confession to the next prospect: nobody's watching." },
        { t: "Competitor momentum", b: "A rival quietly outpacing your review velocity is taking tomorrow's customers today." },
        { t: "AI answers that get you wrong", b: "Assistants misdescribe you or skip you entirely, and no one calls to tell you." },
        { t: "Signal droughts", b: "Weeks without fresh feedback isn't calm. It's a blind spot, and the score treats it as one." },
        { t: "Slow escalations", b: "A recurring complaint left unread is a crisis on a schedule." },
      ],
    },
    score: {
      label: "/ 02 — ONE SCORE",
      h2: "Every signal in. One number out. Fully explainable.",
      items: [
        { t: "All signals connected", b: "Public reviews, private feedback, AI visibility and competitor moves feed one spine, nothing lives in a silo." },
        { t: "Explainable by design", b: "Five weighted components, every driver named. A number you can defend in front of anyone, no black box." },
        { t: "Recomputed hourly", b: "The score follows reality, with 7- and 30-day deltas so trend beats anecdote." },
        { t: "Revenue attached", b: "Risk translated into estimated dollars exposed per month, the language decisions actually get made in." },
      ],
    },
    reduce: {
      label: "/ 03 — HOW IT CUTS RISK",
      h2: "From silent decay to early action.",
      items: [
        { t: "Edge-triggered alerts", b: "Score crossings, 7-day spikes, new critical signals, delivered with the cause attached, not just a siren." },
        { t: "Prioritized by dollars", b: "Revenue-at-risk turns \u201cwe should improve\u201d into \u201cfix this first.\u201d" },
        { t: "Drivers, not vibes", b: "The exact reviews, feedback and competitor moves pushing your score, act on them directly." },
        { t: "Proof it's working", b: "Deltas and 90-day history show risk falling as you act, and catch it the moment it climbs back." },
      ],
    },
    plans: {
      label: "/ 04 — PLANS",
      note: "The Reputation Risk Score, alerts and revenue-at-risk ship with GROWTH. Competitor momentum monitoring ships with AGENCY. 14-day free trial on both.",
      cta: "See pricing →",
    },
    final: {
      h2: "Know your risk before your customers decide for you.",
      sub: "Two minutes to connect your signals. The score does the rest.",
      cta1: "Get your Risk Score →",
      cta2: "Book a demo ↗",
    },
  },

  "en-CA": null as unknown as LpContent,

  fr: {
    meta: {
      title: "Score de risque de réputation. Echorank",
      description:
        "Un score de risque 0–100 explicable, couvrant avis, retours privés, visibilité IA et concurrents, avec alertes et chiffre d'affaires à risque, pour prévenir au lieu de réagir.",
    },
    hero: {
      label: "/ RISQUE DE RÉPUTATION",
      h1a: "Cessez de perdre des clients sans le savoir.",
      h1b: "L'essentiel des dégâts se fait en silence.",
      sub: "Un client mécontent. Un avis sans réponse. Un concurrent qui prend de l'élan. Une réponse d'IA qui se trompe sur votre entreprise. Quand les ventes baissent, le mal est déjà fait. Echorank transforme chaque signal en un Score de risque de réputation explicable, pour prévenir au lieu de réagir.",
      cta1: "Obtenez votre Score de risque →",
      cta2: "Réserver une démo ↗",
    },
    killers: {
      label: "/ 01 — LES TUEURS SILENCIEUX",
      h2: "Une réputation s'effondre rarement. Elle fuit.",
      items: [
        { t: "Les clients qui partent en silence", b: "La plupart des clients mécontents ne se plaignent jamais. Ils ne reviennent plus, et racontent pourquoi autour d'eux." },
        { t: "Les avis sans réponse", b: "Chaque avis ignoré dit au prospect suivant : personne ne veille ici." },
        { t: "L'élan des concurrents", b: "Un rival qui dépasse discrètement votre rythme d'avis prend dès aujourd'hui vos clients de demain." },
        { t: "Les réponses d'IA erronées", b: "Les assistants vous décrivent mal ou vous ignorent, et personne n'appelle pour vous prévenir." },
        { t: "Les périodes sans signal", b: "Des semaines sans retour client, ce n'est pas du calme. C'est un angle mort, et le score le traite comme tel." },
        { t: "Les escalades lentes", b: "Une plainte récurrente laissée sans lecture, c'est une crise programmée." },
      ],
    },
    score: {
      label: "/ 02 — UN SEUL SCORE",
      h2: "Tous les signaux entrent. Un chiffre sort. Entièrement explicable.",
      items: [
        { t: "Tous les signaux reliés", b: "Avis publics, retours privés, visibilité IA et mouvements concurrents alimentent une même colonne vertébrale, rien ne vit en silo." },
        { t: "Explicable par conception", b: "Cinq composantes pondérées, chaque facteur nommé. Un chiffre défendable devant n'importe qui, sans boîte noire." },
        { t: "Recalculé chaque heure", b: "Le score suit la réalité, avec des variations à 7 et 30 jours : la tendance prime sur l'anecdote." },
        { t: "Relié au chiffre d'affaires", b: "Le risque traduit en euros exposés par mois, la langue dans laquelle les décisions se prennent vraiment." },
      ],
    },
    reduce: {
      label: "/ 03 — COMMENT IL RÉDUIT LE RISQUE",
      h2: "De l'érosion silencieuse à l'action précoce.",
      items: [
        { t: "Alertes sur franchissement", b: "Seuils franchis, pics sur 7 jours, nouveaux signaux critiques, livrés avec la cause, pas seulement la sirène." },
        { t: "Priorisé en euros", b: "Le chiffre d'affaires à risque transforme « il faudrait s'améliorer » en « corrigez ceci d'abord »." },
        { t: "Des facteurs, pas des impressions", b: "Les avis, retours et mouvements concurrents exacts qui poussent votre score, agissez directement dessus." },
        { t: "La preuve que ça marche", b: "Les variations et l'historique sur 90 jours montrent le risque qui baisse quand vous agissez, et le rattrapent dès qu'il remonte." },
      ],
    },
    plans: {
      label: "/ 04 — FORFAITS",
      note: "Le Score de risque, les alertes et le chiffre d'affaires à risque sont inclus dès CROISSANCE. La veille concurrentielle arrive avec AGENCE. Essai gratuit de 14 jours sur les deux.",
      cta: "Voir les tarifs →",
    },
    final: {
      h2: "Connaissez votre risque avant que vos clients ne décident pour vous.",
      sub: "Deux minutes pour relier vos signaux. Le score fait le reste.",
      cta1: "Obtenez votre Score de risque →",
      cta2: "Réserver une démo ↗",
    },
  },

  "fr-CA": null as unknown as LpContent,

  "de-CH": {
    meta: {
      title: "Reputations-Risiko-Score. Echorank",
      description:
        "Ein erklärbarer 0–100-Risiko-Score über Bewertungen, Feedback, KI-Sichtbarkeit und Konkurrenz, mit Alarmen und Umsatz im Risiko, damit Sie vorbeugen statt reagieren.",
    },
    hero: {
      label: "/ REPUTATIONSRISIKO",
      h1a: "Verlieren Sie keine Kunden mehr, ohne es zu merken.",
      h1b: "Der grösste Schaden entsteht in der Stille.",
      sub: "Ein unzufriedener Kunde. Eine unbeantwortete Bewertung. Ein Konkurrent im Aufwind. Eine KI-Antwort, die Ihr Geschäft falsch darstellt. Wenn der Umsatz sinkt, ist der Schaden längst da. Echorank verwandelt jedes Signal in einen erklärbaren Reputations-Risiko-Score, damit Sie vorbeugen statt reagieren.",
      cta1: "Risiko-Score anfordern →",
      cta2: "Demo buchen ↗",
    },
    killers: {
      label: "/ 01 — DIE STILLEN KILLER",
      h2: "Reputation bricht selten ein. Sie sickert weg.",
      items: [
        { t: "Kunden, die still gehen", b: "Die meisten unzufriedenen Kunden beschweren sich nie. Sie kommen einfach nicht wieder, und erzählen anderen, warum." },
        { t: "Unbeantwortete Bewertungen", b: "Jede ignorierte Bewertung sagt dem nächsten Interessenten: Hier schaut niemand hin." },
        { t: "Konkurrenz im Aufwind", b: "Ein Mitbewerber, der Ihr Bewertungstempo leise überholt, holt sich heute die Kunden von morgen." },
        { t: "Falsche KI-Antworten", b: "Assistenten beschreiben Sie falsch oder übergehen Sie ganz, und niemand ruft an, um es Ihnen zu sagen." },
        { t: "Signal-Dürren", b: "Wochen ohne frisches Feedback sind keine Ruhe. Sie sind ein blinder Fleck, und der Score behandelt sie so." },
        { t: "Langsame Eskalationen", b: "Eine wiederkehrende Beschwerde, die niemand liest, ist eine Krise mit Termin." },
      ],
    },
    score: {
      label: "/ 02 — EIN SCORE",
      h2: "Alle Signale rein. Eine Zahl raus. Vollständig erklärbar.",
      items: [
        { t: "Alle Signale verbunden", b: "Öffentliche Bewertungen, privates Feedback, KI-Sichtbarkeit und Konkurrenzbewegungen speisen ein Rückgrat, nichts lebt im Silo." },
        { t: "Erklärbar per Design", b: "Fünf gewichtete Komponenten, jeder Treiber benannt. Eine Zahl, die Sie vor jedem verteidigen können, keine Blackbox." },
        { t: "Stündlich neu berechnet", b: "Der Score folgt der Realität, mit 7- und 30-Tage-Deltas: Trend schlägt Anekdote." },
        { t: "Mit Umsatz verknüpft", b: "Risiko übersetzt in geschätzte Franken pro Monat, die Sprache, in der Entscheidungen wirklich fallen." },
      ],
    },
    reduce: {
      label: "/ 03 — SO SENKT ER DAS RISIKO",
      h2: "Von stiller Erosion zu frühem Handeln.",
      items: [
        { t: "Alarme bei Schwellen", b: "Überschrittene Schwellen, 7-Tage-Sprünge, neue kritische Signale, geliefert mit Ursache, nicht nur mit Sirene." },
        { t: "Priorisiert in Franken", b: "Umsatz im Risiko macht aus «wir sollten besser werden» ein «das zuerst beheben»." },
        { t: "Treiber statt Bauchgefühl", b: "Die exakten Bewertungen, Rückmeldungen und Konkurrenzbewegungen hinter Ihrem Score, direkt darauf reagieren." },
        { t: "Beweis, dass es wirkt", b: "Deltas und 90-Tage-Verlauf zeigen sinkendes Risiko, wenn Sie handeln, und melden sofort, wenn es wieder steigt." },
      ],
    },
    plans: {
      label: "/ 04 — PLÄNE",
      note: "Risiko-Score, Alarme und Umsatz im Risiko sind ab WACHSTUM enthalten. Konkurrenz-Monitoring kommt mit AGENTUR. 14 Tage kostenlos testen.",
      cta: "Preise ansehen →",
    },
    final: {
      h2: "Kennen Sie Ihr Risiko, bevor Ihre Kunden für Sie entscheiden.",
      sub: "Zwei Minuten, um Ihre Signale zu verbinden. Den Rest erledigt der Score.",
      cta1: "Risiko-Score anfordern →",
      cta2: "Demo buchen ↗",
    },
  },
};

C["en-CA"] = C.en;
C["fr-CA"] = {
  ...C.fr,
  score: {
    ...C.fr.score,
    items: C.fr.score.items.map((it) =>
      it.t === "Relié au chiffre d'affaires"
        ? { t: "Relié aux revenus", b: "Le risque traduit en dollars exposés par mois, la langue dans laquelle les décisions se prennent vraiment." }
        : it,
    ),
  },
  reduce: {
    ...C.fr.reduce,
    items: C.fr.reduce.items.map((it) =>
      it.t === "Priorisé en euros"
        ? { t: "Priorisé en dollars", b: "Les revenus à risque transforment « il faudrait s'améliorer » en « corrigez ceci d'abord »." }
        : it,
    ),
  },
  plans: {
    ...C.fr.plans,
    note: "Le Score de risque, les alertes et les revenus à risque sont inclus dès CROISSANCE. La veille concurrentielle arrive avec AGENCE. Essai gratuit de 14 jours sur les deux forfaits.",
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
    path: "/reputation-risk",
    title: meta.title,
    description: meta.description,
  });
}

export default async function ReputationRiskPage({
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
        {/* navbar */}
        <header className={lp.navbar}>
          <Link href={`/${locale}`} className={lp.logoLink} aria-label="Echorank360 — home">
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
                  href={`/${l}/reputation-risk`}
                  className={`${lp.switchItem} ${l === locale ? lp.switchActive : ""}`}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </span>
            <Link href="/register" className={`${lp.btn} ${lp.btnPrimary}`}>
              {nav.cta}
            </Link>
          </div>
        </header>

        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnGrey} />
        </div>

        {/* hero */}
        <section className={`${home.section} ${lp.heroGrid}`}>
          <div className={lp.heroCopy}>
          <div className={home.label}>{c.hero.label}</div>
          <h1 className={home.h1}>
            {c.hero.h1a}
            <span className={home.muted}>{c.hero.h1b}</span>
          </h1>
          <p className={home.subhead}>{c.hero.sub}</p>
          <div className={`${lp.btnRow} ${lp.ctas}`}>
            <Link href="/register" className={`${lp.btn} ${lp.btnPrimary}`}>
              {c.hero.cta1}
            </Link>
            <Link href="/register" className={`${lp.btn} ${lp.btnGhost}`}>
              {c.hero.cta2}
            </Link>
          </div>
          </div>
          <div className={lp.heroArt} aria-hidden="true">
            <RiskArt />
          </div>
        </section>

        {/* silent killers */}
        <section className={home.section}>
          <div className={home.label}>{c.killers.label}</div>
          <h2 className={home.h2}>{c.killers.h2}</h2>
          <div className={lp.grid3}>
            {c.killers.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* one score */}
        <section className={home.section}>
          <div className={home.label}>{c.score.label}</div>
          <h2 className={home.h2}>{c.score.h2}</h2>
          <div className={lp.grid4}>
            {c.score.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* how it cuts risk */}
        <section className={home.section}>
          <div className={home.label}>{c.reduce.label}</div>
          <h2 className={home.h2}>{c.reduce.h2}</h2>
          <div className={lp.grid4}>
            {c.reduce.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* plans note */}
        <section className={home.section}>
          <div className={home.label}>{c.plans.label}</div>
          <p className={lp.plansNote}>{c.plans.note}</p>
          <Link href={`/${locale}#pricing`} className={`${lp.btn} ${lp.btnGhost}`}>
            {c.plans.cta}
          </Link>
        </section>

        {/* final CTA */}
        <section className={`${home.section} ${lp.finalBand}`}>
          <h2 className={home.h2}>{c.final.h2}</h2>
          <p className={home.subhead}>{c.final.sub}</p>
          <div className={`${lp.btnRow} ${lp.ctas}`}>
            <Link href="/register" className={`${lp.btn} ${lp.btnPrimary}`}>
              {c.final.cta1}
            </Link>
            <Link href="/register" className={`${lp.btn} ${lp.btnGhost}`}>
              {c.final.cta2}
            </Link>
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
