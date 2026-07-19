import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import home from "../home.module.css";
import lp from "./act-on-signals.module.css";
import BackButton from "../legal/back-button";
import { ActArt } from "../hero-art";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LpContent {
  meta: { title: string; description: string };
  hero: { label: string; h1a: string; h1b: string; sub: string; cta1: string; cta2: string };
  contains: { label: string; h2: string; items: { t: string; b: string }[] };
  loop: { label: string; h2: string; items: { t: string; b: string }[] };
  practice: { label: string; h2: string; items: { t: string; b: string }[] };
  plans: { label: string; note: string; cta: string };
  final: { h2: string; sub: string; cta1: string; cta2: string };
}

const C: Record<Locale, LpContent> = {
  en: {
    meta: {
      title: "From alert to action | EchoRank",
      description: "Alerts that arrive with the cause named and the dollar impact attached, plus responses already drafted, so fixing starts the moment you open the email.",
    },
    hero: {
      label: "/ ACT ON SIGNALS",
      h1a: "Alerts that arrive with the answer.",
      h1b: "Cause named. Cost attached.",
      sub: "Most alerts are just sirens. EchoRank's arrive with the trigger, the exact drivers behind it, the estimated revenue at stake, and a response already drafted in your voice, so acting takes minutes, not meetings.",
      cta1: "Get actionable alerts →",
      cta2: "Book a demo ↗",
    },
    contains: {
      label: "/ 01 — WHAT AN ALERT CONTAINS",
      h2: "Everything needed to act, in one email.",
      items: [
        { t: "The trigger", b: "A threshold crossed, a 7-day spike, or a new critical signal, stated plainly." },
        { t: "The cause", b: "The exact reviews, feedback and moves that pushed the score, named and linked." },
        { t: "The cost", b: "Estimated revenue at risk, so priority is a number, not a debate." },
        { t: "The next step", b: "A drafted response or a prioritized fix, ready for one-click approval." },
      ],
    },
    loop: {
      label: "/ 02 — FROM INBOX TO FIXED",
      h2: "The four-minute loop.",
      items: [
        { t: "01, The digest lands", b: "One email per event burst, never a flood." },
        { t: "02, One click in", b: "Straight to the driver on your dashboard." },
        { t: "03, Approve the draft", b: "The response is written; you make it yours and ship it." },
        { t: "04, Watch it prove out", b: "Deltas over the next days show the score answering your action." },
      ],
    },
    practice: {
      label: "/ 03 — PREVENTION IN PRACTICE",
      h2: "Built so you actually keep reading them.",
      items: [
        { t: "No alarm fatigue", b: "Edge-triggered and deduplicated: crossings fire once, not every hour you stay above the line." },
        { t: "Dollars first", b: "Revenue-at-risk ordering turns a to-do list into a fix-this-first list." },
        { t: "The proof loop", b: "7 and 30-day deltas show risk falling when you act, and climbing when you don't." },
        { t: "Your voice, your call", b: "Nothing publishes without your approval; drafts are a head start, not an autopilot." },
      ],
    },
    plans: {
      label: "/ 04 — PLANS",
      note: "Alerts, revenue-at-risk and drafted responses ship with GROWTH. Competitor momentum alerts ship with AGENCY. 14-day free trial.",
      cta: "See pricing →",
    },
    final: {
      h2: "Never learn about the damage last.",
      sub: "Connect your signals; the first alert finds you, not the other way around.",
      cta1: "Get actionable alerts →",
      cta2: "Book a demo ↗",
    },
  },

  "en-CA": null as unknown as LpContent,

  fr: {
    meta: {
      title: "De l'alerte à l'action | EchoRank",
      description: "Des alertes qui arrivent avec la cause nommée et l'impact en euros, plus des réponses déjà rédigées : corriger commence dès l'ouverture du courriel.",
    },
    hero: {
      label: "/ AGIR SUR LES SIGNAUX",
      h1a: "Des alertes qui arrivent avec la réponse.",
      h1b: "Cause nommée. Coût chiffré.",
      sub: "La plupart des alertes ne sont que des sirènes. Celles d'EchoRank arrivent avec le déclencheur, les facteurs exacts derrière, le chiffre d'affaires estimé en jeu, et une réponse déjà rédigée dans votre ton : agir prend des minutes, pas des réunions.",
      cta1: "Recevez des alertes actionnables →",
      cta2: "Réserver une démo ↗",
    },
    contains: {
      label: "/ 01 — CE QUE CONTIENT UNE ALERTE",
      h2: "Tout ce qu'il faut pour agir, dans un seul courriel.",
      items: [
        { t: "Le déclencheur", b: "Un seuil franchi, un pic sur 7 jours ou un nouveau signal critique, dit simplement." },
        { t: "La cause", b: "Les avis, retours et mouvements exacts qui ont poussé le score, nommés et liés." },
        { t: "Le coût", b: "Le chiffre d'affaires estimé à risque : la priorité devient un nombre, pas un débat." },
        { t: "La suite", b: "Une réponse rédigée ou un correctif priorisé, prêts à approuver en un clic." },
      ],
    },
    loop: {
      label: "/ 02 — DE LA BOÎTE MAIL AU CORRIGÉ",
      h2: "La boucle de quatre minutes.",
      items: [
        { t: "01, Le résumé arrive", b: "Un courriel par rafale d'événements, jamais un déluge." },
        { t: "02, Un clic pour entrer", b: "Directement sur le facteur en cause dans votre tableau de bord." },
        { t: "03, Approuvez le brouillon", b: "La réponse est écrite ; vous la faites vôtre et vous l'envoyez." },
        { t: "04, Regardez la preuve", b: "Les variations des jours suivants montrent le score répondre à votre action." },
      ],
    },
    practice: {
      label: "/ 03 — LA PRÉVENTION EN PRATIQUE",
      h2: "Conçu pour que vous continuiez vraiment à les lire.",
      items: [
        { t: "Pas de fatigue d'alarme", b: "Déclenchement au franchissement et déduplication : un seuil sonne une fois, pas chaque heure passée au-dessus." },
        { t: "Les euros d'abord", b: "Le tri par chiffre d'affaires à risque transforme une liste de tâches en liste de priorités." },
        { t: "La boucle de preuve", b: "Les variations à 7 et 30 jours montrent le risque baisser quand vous agissez, et remonter quand vous n'agissez pas." },
        { t: "Votre ton, votre décision", b: "Rien n'est publié sans votre approbation ; les brouillons sont une longueur d'avance, pas un pilote automatique." },
      ],
    },
    plans: {
      label: "/ 04 — FORFAITS",
      note: "Alertes, chiffre d'affaires à risque et réponses rédigées arrivent avec CROISSANCE. Les alertes d'élan concurrentiel arrivent avec AGENCE. Essai gratuit de 14 jours.",
      cta: "Voir les tarifs →",
    },
    final: {
      h2: "Ne soyez plus jamais le dernier informé.",
      sub: "Reliez vos signaux ; la première alerte vous trouve, pas l'inverse.",
      cta1: "Recevez des alertes actionnables →",
      cta2: "Réserver une démo ↗",
    },
  },

  "fr-CA": null as unknown as LpContent,

  "de-CH": {
    meta: {
      title: "Vom Alarm zur Aktion | EchoRank",
      description: "Alarme mit benannter Ursache und beziffertem Umsatzeffekt, plus fertig entworfene Antworten: Beheben beginnt beim Öffnen der E-Mail.",
    },
    hero: {
      label: "/ AUF SIGNALE HANDELN",
      h1a: "Alarme, die mit der Antwort ankommen.",
      h1b: "Ursache benannt. Kosten beziffert.",
      sub: "Die meisten Alarme sind nur Sirenen. Die von EchoRank kommen mit dem Auslöser, den exakten Treibern dahinter, dem geschätzten Umsatz auf dem Spiel und einer bereits entworfenen Antwort in Ihrem Ton: Handeln dauert Minuten, nicht Sitzungen.",
      cta1: "Handlungsfähige Alarme erhalten →",
      cta2: "Demo buchen ↗",
    },
    contains: {
      label: "/ 01 — WAS EIN ALARM ENTHÄLT",
      h2: "Alles zum Handeln, in einer E-Mail.",
      items: [
        { t: "Der Auslöser", b: "Eine überschrittene Schwelle, ein 7-Tage-Sprung oder ein neues kritisches Signal, klar benannt." },
        { t: "Die Ursache", b: "Die exakten Bewertungen, Rückmeldungen und Bewegungen hinter dem Score, benannt und verlinkt." },
        { t: "Die Kosten", b: "Geschätzter Umsatz im Risiko: Priorität wird eine Zahl, keine Debatte." },
        { t: "Der nächste Schritt", b: "Eine entworfene Antwort oder ein priorisierter Fix, bereit zur Freigabe mit einem Klick." },
      ],
    },
    loop: {
      label: "/ 02 — VOM POSTEINGANG ZUM BEHOBEN",
      h2: "Die Vier-Minuten-Schleife.",
      items: [
        { t: "01, Das Digest kommt an", b: "Eine E-Mail pro Ereignisschub, nie eine Flut." },
        { t: "02, Ein Klick hinein", b: "Direkt zum Treiber in Ihrem Dashboard." },
        { t: "03, Entwurf freigeben", b: "Die Antwort ist geschrieben; Sie machen sie zu Ihrer und senden sie." },
        { t: "04, Beweis beobachten", b: "Die Deltas der nächsten Tage zeigen, wie der Score auf Ihre Aktion antwortet." },
      ],
    },
    practice: {
      label: "/ 03 — VORBEUGUNG IN DER PRAXIS",
      h2: "So gebaut, dass Sie sie wirklich weiterlesen.",
      items: [
        { t: "Keine Alarmmüdigkeit", b: "Flankengetriggert und dedupliziert: Überschreitungen feuern einmal, nicht jede Stunde über der Linie." },
        { t: "Franken zuerst", b: "Die Reihung nach Umsatz im Risiko macht aus einer To-do-Liste eine Zuerst-beheben-Liste." },
        { t: "Die Beweisschleife", b: "7- und 30-Tage-Deltas zeigen sinkendes Risiko, wenn Sie handeln, und steigendes, wenn nicht." },
        { t: "Ihr Ton, Ihre Entscheidung", b: "Nichts wird ohne Ihre Freigabe veröffentlicht; Entwürfe sind ein Vorsprung, kein Autopilot." },
      ],
    },
    plans: {
      label: "/ 04 — PLÄNE",
      note: "Alarme, Umsatz im Risiko und Antwortentwürfe kommen mit WACHSTUM. Konkurrenz-Momentum-Alarme mit AGENTUR. 14 Tage kostenlos testen.",
      cta: "Preise ansehen →",
    },
    final: {
      h2: "Erfahren Sie vom Schaden nie mehr als Letzter.",
      sub: "Signale verbinden; der erste Alarm findet Sie, nicht umgekehrt.",
      cta1: "Handlungsfähige Alarme erhalten →",
      cta2: "Demo buchen ↗",
    },
  },
};

C["en-CA"] = C.en;
C["fr-CA"] = {
  ...C.fr,
  contains: {
    ...C.fr.contains,
    items: C.fr.contains.items.map((it) =>
      it.t === "Le coût"
        ? { t: "Le coût", b: "Les revenus estimés à risque : la priorité devient un nombre, pas un débat." }
        : it,
    ),
  },
  practice: {
    ...C.fr.practice,
    items: C.fr.practice.items.map((it) =>
      it.t === "Les euros d'abord"
        ? { t: "Les dollars d'abord", b: "Le tri par revenus à risque transforme une liste de tâches en liste de priorités." }
        : it,
    ),
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const { meta } = C[locale];
  return buildMetadata({
    locale,
    path: "/act-on-signals",
    title: meta.title,
    description: meta.description,
  });
}

export default async function ActOnSignalsPage({ params }: { params: Promise<{ locale: string }> }) {
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
                <Link key={l} href={`/${l}/act-on-signals`}
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
            <ActArt />
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.contains.label}</div>
          <h2 className={home.h2}>{c.contains.h2}</h2>
          <div className={lp.grid4}>
            {c.contains.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.loop.label}</div>
          <h2 className={home.h2}>{c.loop.h2}</h2>
          <div className={lp.grid4}>
            {c.loop.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.practice.label}</div>
          <h2 className={home.h2}>{c.practice.h2}</h2>
          <div className={lp.grid4}>
            {c.practice.items.map((it) => (
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
// EOF-act-lp
