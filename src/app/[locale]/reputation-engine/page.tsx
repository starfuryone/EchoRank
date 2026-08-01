import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import BackButton from "../legal/back-button";
import home from "../home.module.css";
import { EngineArt } from "../hero-art";
import lp from "./reputation-engine.module.css";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LpContent {
  meta: { title: string; description: string };
  hero: { label: string; h1a: string; h1b: string; sub: string; cta1: string; cta2: string };
  machine: { label: string; h2: string; items: { t: string; b: string }[] };
  compliance: { label: string; h2: string; items: { t: string; b: string }[] };
  payoff: { label: string; h2: string; items: { t: string; b: string }[] };
  plans: { label: string; note: string; cta: string };
  final: { h2: string; sub: string; cta1: string; cta2: string };
}

const C: Record<Locale, LpContent> = {
  en: {
    meta: {
      title: "Reputation Engine, Automation | Echorank",
      description:
        "Compliant SMS, email and QR feedback campaigns, multi-platform monitoring, white-label tools and workflows that keep fresh customer signals flowing.",
    },
    hero: {
      label: "/ REPUTATION ENGINE",
      h1a: "A reputation that works while you sleep.",
      h1b: "Not luck. A system.",
      sub: "Great reputations are built by consistent feedback, continuous monitoring and quick action, not by hoping. Echorank automates the heavy lifting so fresh customer signals keep flowing in, get read, and turn into visible responses, without another hour of your week.",
      cta1: "Start the engine →",
      cta2: "Book a demo ↗",
    },
    machine: {
      label: "/ 01 — THE MACHINE",
      h2: "Every part of the loop, automated.",
      items: [
        { t: "Feedback campaigns", b: "SMS, email and QR campaigns that ask every customer at the right moment, on autopilot." },
        { t: "Private feedback routing", b: "Unhappy customers get a direct line first; issues route to the right person before they go public." },
        { t: "Multi-platform monitoring", b: "New reviews from every configured source land in one place, scored on arrival." },
        { t: "AI-drafted responses", b: "Professional replies in your voice, waiting for one-click approval." },
        { t: "White-label for agencies", b: "Run it for your clients under your own brand, multi-tenant from day one." },
        { t: "Signals into intelligence", b: "Everything the engine collects feeds your Risk Score and alerts; the machine and the brain share one spine." },
      ],
    },
    compliance: {
      label: "/ 02 — COMPLIANT BY DESIGN",
      h2: "Automation that respects the rules.",
      items: [
        { t: "Consent-first outreach", b: "Built for CASL, TCPA and GDPR realities: your lists, your consents, honoured opt-outs." },
        { t: "No review gating", b: "Every customer gets asked the same way, in line with platform policies and consumer-protection rules." },
        { t: "Your voice, your approval", b: "Drafts are suggestions; nothing publishes without you." },
      ],
    },
    payoff: {
      label: "/ 03 — THE PAYOFF",
      h2: "What a running engine compounds into.",
      items: [
        { t: "More trust", b: "A steady stream of fresh, answered reviews." },
        { t: "More visibility", b: "Fresh signals are what search and AI systems feed on." },
        { t: "More referrals", b: "Customers who feel heard talk." },
        { t: "Chosen first", b: "Prospects decide before they ever contact you; the engine works on exactly that moment." },
      ],
    },
    plans: {
      label: "/ 04 — PLANS",
      note: "Campaigns, private feedback routing, monitoring and AI response drafting ship with every plan, starting at STARTER. White-label and multi-client tools ship with AGENCY. 7-day free trial.",
      cta: "See pricing →",
    },
    final: {
      h2: "Set it running today.",
      sub: "Connect your sources, launch your first campaign, and let the engine take the night shift.",
      cta1: "Start the engine →",
      cta2: "Book a demo ↗",
    },
  },

  "en-CA": null as unknown as LpContent,

  fr: {
    meta: {
      title: "Moteur de réputation, automatisation | Echorank",
      description:
        "Campagnes de retours conformes par SMS, e-mail et QR, surveillance multi-plateformes, marque blanche et flux qui alimentent en continu des signaux clients frais.",
    },
    hero: {
      label: "/ MOTEUR DE RÉPUTATION",
      h1a: "Une réputation qui travaille pendant que vous dormez.",
      h1b: "Pas de la chance. Un système.",
      sub: "Les grandes réputations se construisent par des retours réguliers, une surveillance continue et des actions rapides, pas en espérant. Echorank automatise le gros du travail : des signaux clients frais arrivent en continu, sont lus, et deviennent des réponses visibles, sans une heure de plus dans votre semaine.",
      cta1: "Démarrer le moteur →",
      cta2: "Réserver une démo ↗",
    },
    machine: {
      label: "/ 01 — LA MACHINE",
      h2: "Chaque maillon de la boucle, automatisé.",
      items: [
        { t: "Campagnes de retours", b: "Des campagnes SMS, e-mail et QR qui sollicitent chaque client au bon moment, en pilote automatique." },
        { t: "Routage des retours privés", b: "Les clients mécontents disposent d'abord d'une ligne directe ; les problèmes arrivent à la bonne personne avant de devenir publics." },
        { t: "Surveillance multi-plateformes", b: "Les nouveaux avis de chaque source configurée arrivent au même endroit, notés dès réception." },
        { t: "Réponses rédigées par IA", b: "Des réponses professionnelles dans votre ton, prêtes à approuver en un clic." },
        { t: "Marque blanche pour agences", b: "Exploitez-le pour vos clients sous votre propre marque, multi-comptes dès le premier jour." },
        { t: "Des signaux vers l'intelligence", b: "Tout ce que le moteur collecte alimente votre Score de risque et vos alertes ; la machine et le cerveau partagent la même colonne vertébrale." },
      ],
    },
    compliance: {
      label: "/ 02 — CONFORME PAR CONCEPTION",
      h2: "Une automatisation qui respecte les règles.",
      items: [
        { t: "Consentement d'abord", b: "Pensé pour les réalités LCAP, TCPA et RGPD : vos listes, vos consentements, des désabonnements respectés." },
        { t: "Pas de filtrage d'avis", b: "Chaque client est sollicité de la même façon, dans le respect des politiques des plateformes et des règles de protection du consommateur." },
        { t: "Votre ton, votre validation", b: "Les brouillons sont des suggestions ; rien n'est publié sans vous." },
      ],
    },
    payoff: {
      label: "/ 03 — LE GAIN",
      h2: "Ce qu'un moteur en marche fait fructifier.",
      items: [
        { t: "Plus de confiance", b: "Un flux régulier d'avis frais et répondus." },
        { t: "Plus de visibilité", b: "Les signaux frais sont ce dont se nourrissent les moteurs de recherche et les IA." },
        { t: "Plus de recommandations", b: "Les clients qui se sentent écoutés en parlent." },
        { t: "Choisi en premier", b: "Les prospects décident avant même de vous contacter ; le moteur travaille exactement ce moment-là." },
      ],
    },
    plans: {
      label: "/ 04 — FORFAITS",
      note: "Campagnes, routage des retours privés, surveillance et réponses rédigées par IA sont inclus dans tous les forfaits, dès STARTER. La marque blanche et le multi-clients arrivent avec AGENCE. Essai gratuit de 7 jours.",
      cta: "Voir les tarifs →",
    },
    final: {
      h2: "Mettez-le en marche aujourd'hui.",
      sub: "Reliez vos sources, lancez votre première campagne, et laissez le moteur prendre le quart de nuit.",
      cta1: "Démarrer le moteur →",
      cta2: "Réserver une démo ↗",
    },
  },

  "fr-CA": null as unknown as LpContent,

  "de-CH": {
    meta: {
      title: "Reputations-Motor, Automatisierung | Echorank",
      description:
        "Konforme Feedback-Kampagnen per SMS, E-Mail und QR, Multi-Plattform-Überwachung, White-Label-Werkzeuge und Abläufe, die laufend frische Kundensignale liefern.",
    },
    hero: {
      label: "/ REPUTATIONS-MOTOR",
      h1a: "Eine Reputation, die arbeitet, während Sie schlafen.",
      h1b: "Kein Glück. Ein System.",
      sub: "Starke Reputationen entstehen durch regelmässiges Feedback, laufende Überwachung und schnelles Handeln, nicht durch Hoffen. Echorank automatisiert die Schwerarbeit: frische Kundensignale fliessen laufend ein, werden gelesen und werden zu sichtbaren Antworten, ohne eine zusätzliche Stunde Ihrer Woche.",
      cta1: "Motor starten →",
      cta2: "Demo buchen ↗",
    },
    machine: {
      label: "/ 01 — DIE MASCHINE",
      h2: "Jedes Glied der Schleife, automatisiert.",
      items: [
        { t: "Feedback-Kampagnen", b: "SMS-, E-Mail- und QR-Kampagnen, die jeden Kunden im richtigen Moment fragen, im Autopilot." },
        { t: "Privates Feedback-Routing", b: "Unzufriedene Kunden erhalten zuerst einen direkten Draht; Probleme erreichen die richtige Person, bevor sie öffentlich werden." },
        { t: "Multi-Plattform-Überwachung", b: "Neue Bewertungen aus jeder konfigurierten Quelle landen an einem Ort, bei Eingang bewertet." },
        { t: "KI-Antwortentwürfe", b: "Professionelle Antworten in Ihrem Ton, bereit zur Freigabe mit einem Klick." },
        { t: "White-Label für Agenturen", b: "Betreiben Sie es für Ihre Kunden unter Ihrer eigenen Marke, mandantenfähig ab Tag eins." },
        { t: "Signale in die Intelligenz", b: "Alles, was der Motor sammelt, speist Ihren Risiko-Score und Ihre Alarme; Maschine und Gehirn teilen ein Rückgrat." },
      ],
    },
    compliance: {
      label: "/ 02 — KONFORM PER DESIGN",
      h2: "Automatisierung, die die Regeln respektiert.",
      items: [
        { t: "Einwilligung zuerst", b: "Gebaut für CASL-, TCPA- und DSGVO-Realitäten: Ihre Listen, Ihre Einwilligungen, respektierte Abmeldungen." },
        { t: "Kein Bewertungs-Gating", b: "Jeder Kunde wird gleich gefragt, im Einklang mit Plattformrichtlinien und Konsumentenschutz." },
        { t: "Ihr Ton, Ihre Freigabe", b: "Entwürfe sind Vorschläge; nichts wird ohne Sie veröffentlicht." },
      ],
    },
    payoff: {
      label: "/ 03 — DER GEWINN",
      h2: "Was ein laufender Motor aufzinst.",
      items: [
        { t: "Mehr Vertrauen", b: "Ein steter Strom frischer, beantworteter Bewertungen." },
        { t: "Mehr Sichtbarkeit", b: "Frische Signale sind das, wovon Such- und KI-Systeme leben." },
        { t: "Mehr Weiterempfehlungen", b: "Kunden, die sich gehört fühlen, reden." },
        { t: "Zuerst gewählt", b: "Interessenten entscheiden, bevor sie Sie je kontaktieren; genau an diesem Moment arbeitet der Motor." },
      ],
    },
    plans: {
      label: "/ 04 — PLÄNE",
      note: "Kampagnen, privates Feedback-Routing, Überwachung und KI-Antwortentwürfe sind in jedem Plan enthalten, ab STARTER. White-Label und Mandantenfähigkeit kommen mit AGENTUR. 7 Tage kostenlos testen.",
      cta: "Preise ansehen →",
    },
    final: {
      h2: "Bringen Sie ihn heute zum Laufen.",
      sub: "Quellen verbinden, erste Kampagne starten, und der Motor übernimmt die Nachtschicht.",
      cta1: "Motor starten →",
      cta2: "Demo buchen ↗",
    },
  },
};

C["en-CA"] = C.en;
C["fr-CA"] = {
  ...C.fr,
  machine: {
    ...C.fr.machine,
    items: C.fr.machine.items.map((it) =>
      it.t === "Campagnes de retours"
        ? { t: "Campagnes de rétroaction", b: "Des campagnes par texto, courriel et code QR qui sollicitent chaque client au bon moment, en pilote automatique." }
        : it,
    ),
  },
  plans: {
    ...C.fr.plans,
    note: "Campagnes, routage de la rétroaction privée, surveillance et réponses rédigées par IA sont inclus dans tous les forfaits, dès STARTER. La marque blanche et le multi-clients arrivent avec AGENCE. Essai gratuit de 7 jours.",
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
    path: "/reputation-engine",
    title: meta.title,
    description: meta.description,
  });
}

export default async function ReputationEnginePage({
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
                  href={`/${l}/reputation-engine`}
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
            <EngineArt />
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.machine.label}</div>
          <h2 className={home.h2}>{c.machine.h2}</h2>
          <div className={lp.grid3}>
            {c.machine.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.compliance.label}</div>
          <h2 className={home.h2}>{c.compliance.h2}</h2>
          <div className={lp.grid3}>
            {c.compliance.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={home.section}>
          <div className={home.label}>{c.payoff.label}</div>
          <h2 className={home.h2}>{c.payoff.h2}</h2>
          <div className={lp.grid4}>
            {c.payoff.items.map((it) => (
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
// EOF-engine-lp
