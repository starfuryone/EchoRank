import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import home from "../home.module.css";
import lp from "./live-monitoring.module.css";
import BackButton from "../legal/back-button";
import { MonitorArt } from "../hero-art";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LpContent {
  meta: { title: string; description: string };
  hero: { label: string; h1a: string; h1b: string; sub: string; cta1: string; cta2: string };
  watched: { label: string; h2: string; items: { t: string; b: string }[] };
  cadence: { label: string; h2: string; items: { t: string; b: string }[] };
  why: { label: string; h2: string; items: { t: string; b: string }[] };
  plans: { label: string; note: string; cta: string };
  final: { h2: string; sub: string; cta1: string; cta2: string };
}

const C: Record<Locale, LpContent> = {
  en: {
    meta: {
      title: "Always-on monitoring | EchoRank",
      description: "Risk recalculated hourly, AI answers tracked daily, competitor snapshots every morning, reviews synced as they land. One feed, watched around the clock.",
    },
    hero: {
      label: "/ LIVE MONITORING",
      h1a: "Watched around the clock.",
      h1b: "So you don't have to be.",
      sub: "Reputation moves whether you're looking or not. EchoRank keeps the watch running: risk recalculated hourly, AI answers checked daily, competitor snapshots every morning, and every new review scored the moment it lands, all in one feed.",
      cta1: "Put it on watch →",
      cta2: "Book a demo ↗",
    },
    watched: {
      label: "/ 01 — WHAT'S WATCHED",
      h2: "Every surface where reputation moves.",
      items: [
        { t: "Reviews as they land", b: "New reviews from every configured source sync in and get scored on arrival, sentiment and risk included." },
        { t: "AI answers, daily", b: "Your key prompts run against ChatGPT, Perplexity and Google AI every day: cited, misquoted or missing, with history." },
        { t: "Competitors, every morning", b: "Ratings and review counts snapshotted daily; momentum computed against your own pace." },
        { t: "Risk, every hour", b: "The Reputation Risk Score recomputes hourly, with 7 and 30-day deltas so trends surface early." },
        { t: "Private feedback, live", b: "Submitted feedback routes and folds into the score the same hour." },
        { t: "Silence itself", b: "Weeks without fresh signals get flagged as a blind spot, because no data is not the same as no risk." },
      ],
    },
    cadence: {
      label: "/ 02 — THE CADENCE",
      h2: "A rhythm, not a reminder.",
      items: [
        { t: "Hourly", b: "Risk score recomputed across every connected signal." },
        { t: "Daily", b: "AI answer tracking against the major engines." },
        { t: "Every morning", b: "Competitor snapshots and momentum checks." },
        { t: "Continuous", b: "Review and feedback sync as events happen." },
      ],
    },
    why: {
      label: "/ 03 — WHY CADENCE BEATS CHECKING",
      h2: "The system never forgets to look.",
      items: [
        { t: "Trend beats anecdote", b: "Hourly history turns single bad days into readable patterns." },
        { t: "Crossings caught same-hour", b: "Threshold breaks and spikes trigger alerts within the sweep that detects them." },
        { t: "History compounds", b: "Every snapshot becomes tomorrow's baseline; deltas get sharper with age." },
        { t: "Nothing depends on you", b: "The watch runs on your quietest week exactly as it does on your busiest." },
      ],
    },
    plans: {
      label: "/ 04 — PLANS",
      note: "Review monitoring and the hourly Risk Score ship with GROWTH. Daily AI answer tracking and competitor snapshots ship with AGENCY. 14-day free trial.",
      cta: "See pricing →",
    },
    final: {
      h2: "Let it take tonight's watch.",
      sub: "Connect your sources; the first sweep runs within the hour.",
      cta1: "Put it on watch →",
      cta2: "Book a demo ↗",
    },
  },

  "en-CA": null as unknown as LpContent,

  fr: {
    meta: {
      title: "Surveillance en continu | EchoRank",
      description: "Risque recalculé chaque heure, réponses IA suivies chaque jour, instantanés concurrents chaque matin, avis synchronisés dès leur arrivée. Un seul fil, surveillé jour et nuit.",
    },
    hero: {
      label: "/ SURVEILLANCE EN CONTINU",
      h1a: "Surveillé jour et nuit.",
      h1b: "Pour que vous n'ayez pas à l'être.",
      sub: "La réputation bouge, que vous regardiez ou non. EchoRank monte la garde : risque recalculé chaque heure, réponses IA vérifiées chaque jour, instantanés concurrents chaque matin, et chaque nouvel avis noté dès son arrivée, le tout dans un seul fil.",
      cta1: "Mettez-le en veille active →",
      cta2: "Réserver une démo ↗",
    },
    watched: {
      label: "/ 01 — CE QUI EST SURVEILLÉ",
      h2: "Chaque surface où la réputation bouge.",
      items: [
        { t: "Les avis dès leur arrivée", b: "Les nouveaux avis de chaque source configurée sont synchronisés et notés à réception, sentiment et risque compris." },
        { t: "Les réponses IA, chaque jour", b: "Vos requêtes clés sont testées quotidiennement sur ChatGPT, Perplexity et Google AI : cité, déformé ou absent, avec historique." },
        { t: "Les concurrents, chaque matin", b: "Notes et volumes d'avis capturés chaque jour ; l'élan est calculé face à votre propre rythme." },
        { t: "Le risque, chaque heure", b: "Le Score de risque de réputation est recalculé toutes les heures, avec variations à 7 et 30 jours pour voir les tendances tôt." },
        { t: "Les retours privés, en direct", b: "Chaque retour soumis est routé et intégré au score dans l'heure." },
        { t: "Le silence lui-même", b: "Des semaines sans signaux frais sont signalées comme un angle mort, car l'absence de données n'est pas l'absence de risque." },
      ],
    },
    cadence: {
      label: "/ 02 — LA CADENCE",
      h2: "Un rythme, pas un pense-bête.",
      items: [
        { t: "Chaque heure", b: "Score de risque recalculé sur tous les signaux reliés." },
        { t: "Chaque jour", b: "Suivi des réponses IA sur les grands moteurs." },
        { t: "Chaque matin", b: "Instantanés concurrents et calculs d'élan." },
        { t: "En continu", b: "Synchronisation des avis et retours au fil des événements." },
      ],
    },
    why: {
      label: "/ 03 — POURQUOI LA CADENCE BAT LA VÉRIFICATION",
      h2: "Le système n'oublie jamais de regarder.",
      items: [
        { t: "La tendance bat l'anecdote", b: "L'historique horaire transforme les mauvaises journées isolées en motifs lisibles." },
        { t: "Les franchissements pris dans l'heure", b: "Seuils franchis et pics déclenchent des alertes dès le balayage qui les détecte." },
        { t: "L'historique se capitalise", b: "Chaque instantané devient la base de demain ; les variations gagnent en précision avec le temps." },
        { t: "Rien ne dépend de vous", b: "La garde tourne pendant votre semaine la plus calme exactement comme pendant la plus chargée." },
      ],
    },
    plans: {
      label: "/ 04 — FORFAITS",
      note: "La surveillance des avis et le Score de risque horaire arrivent avec CROISSANCE. Le suivi quotidien des réponses IA et les instantanés concurrents arrivent avec AGENCE. Essai gratuit de 14 jours.",
      cta: "Voir les tarifs →",
    },
    final: {
      h2: "Laissez-lui le quart de nuit.",
      sub: "Reliez vos sources ; le premier balayage tourne dans l'heure.",
      cta1: "Mettez-le en veille active →",
      cta2: "Réserver une démo ↗",
    },
  },

  "fr-CA": null as unknown as LpContent,

  "de-CH": {
    meta: {
      title: "Laufende Überwachung | EchoRank",
      description: "Risiko stündlich neu berechnet, KI-Antworten täglich verfolgt, Konkurrenz-Momentaufnahmen jeden Morgen, Bewertungen bei Eingang synchronisiert. Ein Feed, rund um die Uhr bewacht.",
    },
    hero: {
      label: "/ LAUFENDE ÜBERWACHUNG",
      h1a: "Rund um die Uhr bewacht.",
      h1b: "Damit Sie es nicht sein müssen.",
      sub: "Reputation bewegt sich, ob Sie hinschauen oder nicht. EchoRank hält Wache: Risiko stündlich neu berechnet, KI-Antworten täglich geprüft, Konkurrenz-Momentaufnahmen jeden Morgen, und jede neue Bewertung bei Eingang bewertet, alles in einem Feed.",
      cta1: "Auf Wache stellen →",
      cta2: "Demo buchen ↗",
    },
    watched: {
      label: "/ 01 — WAS BEWACHT WIRD",
      h2: "Jede Fläche, auf der sich Reputation bewegt.",
      items: [
        { t: "Bewertungen bei Eingang", b: "Neue Bewertungen aus jeder Quelle werden synchronisiert und sofort bewertet, inklusive Stimmung und Risiko." },
        { t: "KI-Antworten, täglich", b: "Ihre Schlüsselfragen laufen täglich gegen ChatGPT, Perplexity und Google AI: zitiert, verzerrt oder fehlend, mit Verlauf." },
        { t: "Konkurrenten, jeden Morgen", b: "Bewertungen und Zahlen täglich festgehalten; Momentum gegen Ihr eigenes Tempo berechnet." },
        { t: "Risiko, jede Stunde", b: "Der Risiko-Score wird stündlich neu berechnet, mit 7- und 30-Tage-Deltas für frühe Trends." },
        { t: "Privates Feedback, live", b: "Eingereichtes Feedback wird geroutet und fliesst in derselben Stunde in den Score." },
        { t: "Die Stille selbst", b: "Wochen ohne frische Signale werden als blinder Fleck markiert, denn keine Daten heisst nicht kein Risiko." },
      ],
    },
    cadence: {
      label: "/ 02 — DER TAKT",
      h2: "Ein Rhythmus, keine Erinnerung.",
      items: [
        { t: "Stündlich", b: "Risiko-Score über alle verbundenen Signale neu berechnet." },
        { t: "Täglich", b: "KI-Antwort-Tracking gegen die grossen Engines." },
        { t: "Jeden Morgen", b: "Konkurrenz-Momentaufnahmen und Momentum-Checks." },
        { t: "Laufend", b: "Bewertungs- und Feedback-Sync, sobald etwas passiert." },
      ],
    },
    why: {
      label: "/ 03 — WARUM TAKT SCHLÄGT NACHSCHAUEN",
      h2: "Das System vergisst nie hinzusehen.",
      items: [
        { t: "Trend schlägt Anekdote", b: "Stündlicher Verlauf macht aus einzelnen schlechten Tagen lesbare Muster." },
        { t: "Überschreitungen in der Stunde", b: "Schwellenbrüche und Sprünge lösen Alarme im selben Durchlauf aus." },
        { t: "Verlauf verzinst sich", b: "Jede Momentaufnahme wird die Basis von morgen; Deltas werden mit der Zeit schärfer." },
        { t: "Nichts hängt an Ihnen", b: "Die Wache läuft in Ihrer ruhigsten Woche genauso wie in der vollsten." },
      ],
    },
    plans: {
      label: "/ 04 — PLÄNE",
      note: "Bewertungs-Überwachung und der stündliche Risiko-Score kommen mit WACHSTUM. Tägliches KI-Antwort-Tracking und Konkurrenz-Momentaufnahmen mit AGENTUR. 14 Tage kostenlos testen.",
      cta: "Preise ansehen →",
    },
    final: {
      h2: "Übergeben Sie ihm die Nachtwache.",
      sub: "Quellen verbinden; der erste Durchlauf startet innerhalb einer Stunde.",
      cta1: "Auf Wache stellen →",
      cta2: "Demo buchen ↗",
    },
  },
};

C["en-CA"] = C.en;
C["fr-CA"] = {
  ...C.fr,
  watched: {
    ...C.fr.watched,
    items: C.fr.watched.items.map((it) =>
      it.t === "Les retours privés, en direct"
        ? { t: "La rétroaction privée, en direct", b: "Chaque rétroaction soumise est routée et intégrée au score dans l'heure." }
        : it,
    ),
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const { meta } = C[locale];
  return { title: meta.title, description: meta.description };
}

export default async function LiveMonitoringPage({ params }: { params: Promise<{ locale: string }> }) {
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
          <Link href={`/${locale}`} className={lp.logoLink} aria-label="EchoRank 360, home">
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
                <Link key={l} href={`/${l}/live-monitoring`}
                  className={`${lp.switchItem} ${l === locale ? lp.switchActive : ""}`}>
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
            <MonitorArt />
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.watched.label}</div>
          <h2 className={home.h2}>{c.watched.h2}</h2>
          <div className={lp.grid3}>
            {c.watched.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.cadence.label}</div>
          <h2 className={home.h2}>{c.cadence.h2}</h2>
          <div className={lp.grid4}>
            {c.cadence.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.why.label}</div>
          <h2 className={home.h2}>{c.why.h2}</h2>
          <div className={lp.grid4}>
            {c.why.items.map((it) => (
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
// EOF-monitoring-lp
