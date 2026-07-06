import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import BackButton from "../legal/back-button";
import home from "../home.module.css";
import { VisibilityArt } from "../hero-art";
import lp from "./ai-visibility.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LpContent {
  meta: { title: string; description: string };
  hero: { label: string; h1a: string; h1b: string; sub: string; cta1: string; cta2: string };
  audit: { label: string; h2: string; items: { t: string; b: string }[] };
  how: { label: string; h2: string; steps: { n: string; t: string; b: string }[] };
  get: { label: string; h2: string; items: { t: string; b: string }[] };
  plans: { label: string; note: string; cta: string };
  final: { h2: string; sub: string; cta1: string; cta2: string };
}

const C: Record<Locale, LpContent> = {
  en: {
    meta: {
      title: "AI Visibility Audit. EchoRank360",
      description:
        "Find out whether ChatGPT, Perplexity and Google AI recommend your business, and get a step-by-step roadmap into AI-generated answers.",
    },
    hero: {
      label: "/ AI VISIBILITY",
      h1a: "Does AI recommend your business?",
      h1b: "Most owners have no idea.",
      sub: "ChatGPT, Perplexity and Google AI are answering your customers' questions right now. EchoRank360 audits every factor that decides whether AI can see, trust, and cite you, then tracks what the engines actually say, every day.",
      cta1: "Run your AI visibility audit →",
      cta2: "Book a demo ↗",
    },
    audit: {
      label: "/ 01 — WHAT THE AUDIT COVERS",
      h2: "Every factor between you and an AI recommendation.",
      items: [
        { t: "AI crawler access", b: "Whether the bots behind ChatGPT, Perplexity and Google AI can reach your site at all, robots rules, blocks, and misconfigurations that silently erase you." },
        { t: "Machine readability", b: "Structure, metadata and entity signals that let an AI understand who you are, what you do, and where you operate." },
        { t: "Trust signals", b: "The reputation surface AI draws on when deciding whether you're safe to recommend, reviews, consistency, freshness." },
        { t: "Answer presence", b: "Your prompts run against the engines daily: are you cited, misrepresented, or absent when customers ask?" },
        { t: "Competitor benchmark", b: "Your 0–100 score side-by-side with the competitors AI mentions instead of you." },
        { t: "Regression watch", b: "Score drops and bot-access flips trigger alerts, you know the moment you disappear." },
      ],
    },
    how: {
      label: "/ 02 — HOW IT WORKS",
      h2: "Audit. Fix. Track.",
      steps: [
        { n: "01", t: "Audit", b: "Enter your domain. Minutes later: your 0–100 AI visibility score, grade, and every failing check." },
        { n: "02", t: "Fix", b: "A prioritized, step-by-step roadmap, exactly what to change and why it moves the score." },
        { n: "03", t: "Track", b: "Daily answer tracking and scheduled re-audits show when AI starts recommending you, and alert you if it stops." },
      ],
    },
    get: {
      label: "/ 03 — WHAT YOU GET",
      h2: "Not a report. A system.",
      items: [
        { t: "0–100 score + grade", b: "One number executives understand, backed by every underlying check." },
        { t: "Fix roadmap", b: "Concrete remediation steps, ordered by impact." },
        { t: "Daily answer tracking", b: "Your key prompts run against the AI engines every day, with history." },
        { t: "Alerts", b: "Regressions, bot flips, and disappearances land in your inbox, with the cause." },
      ],
    },
    plans: {
      label: "/ 04 — PLANS",
      note: "The AI Visibility Auditor and fix roadmap ship with GROWTH. Daily answer tracking and competitor benchmarking ship with AGENCY. 14-day free trial on both.",
      cta: "See pricing →",
    },
    final: {
      h2: "Find out what AI says about you, today.",
      sub: "Two minutes to start. The audit does the rest.",
      cta1: "Run your AI visibility audit →",
      cta2: "Book a demo ↗",
    },
  },

  "en-CA": null as unknown as LpContent, // filled below (mirrors en)

  fr: {
    meta: {
      title: "Audit de visibilité IA. EchoRank360",
      description:
        "Découvrez si ChatGPT, Perplexity et Google AI recommandent votre entreprise, avec une feuille de route pas à pas vers les réponses générées par l'IA.",
    },
    hero: {
      label: "/ VISIBILITÉ IA",
      h1a: "L'IA recommande-t-elle votre entreprise ?",
      h1b: "La plupart des dirigeants n'en savent rien.",
      sub: "ChatGPT, Perplexity et Google AI répondent en ce moment même aux questions de vos clients. EchoRank360 audite chaque facteur qui détermine si l'IA peut vous voir, vous faire confiance et vous citer, puis suit chaque jour ce que les moteurs disent réellement.",
      cta1: "Lancez votre audit de visibilité IA →",
      cta2: "Réserver une démo ↗",
    },
    audit: {
      label: "/ 01 — CE QUE L'AUDIT COUVRE",
      h2: "Chaque facteur entre vous et une recommandation de l'IA.",
      items: [
        { t: "Accès des robots IA", b: "Les robots derrière ChatGPT, Perplexity et Google AI peuvent-ils seulement atteindre votre site ? Règles robots, blocages et erreurs de configuration qui vous effacent en silence." },
        { t: "Lisibilité machine", b: "Structure, métadonnées et signaux d'entité qui permettent à une IA de comprendre qui vous êtes, ce que vous faites et où vous opérez." },
        { t: "Signaux de confiance", b: "La surface de réputation sur laquelle l'IA s'appuie pour décider si elle peut vous recommander, avis, cohérence, fraîcheur." },
        { t: "Présence dans les réponses", b: "Vos requêtes clés sont testées chaque jour sur les moteurs : êtes-vous cité, déformé ou absent quand vos clients demandent ?" },
        { t: "Comparaison concurrentielle", b: "Votre score 0–100 face aux concurrents que l'IA mentionne à votre place." },
        { t: "Veille des régressions", b: "Chute de score ou accès robot coupé : une alerte part, vous savez à l'instant où vous disparaissez." },
      ],
    },
    how: {
      label: "/ 02 — COMMENT ÇA MARCHE",
      h2: "Auditer. Corriger. Suivre.",
      steps: [
        { n: "01", t: "Auditez", b: "Entrez votre domaine. Quelques minutes plus tard : votre score de visibilité IA sur 100, votre note et chaque contrôle en échec." },
        { n: "02", t: "Corrigez", b: "Une feuille de route priorisée, pas à pas, exactement quoi changer et pourquoi cela fait bouger le score." },
        { n: "03", t: "Suivez", b: "Suivi quotidien des réponses et ré-audits programmés : vous voyez quand l'IA commence à vous recommander, et êtes alerté si elle s'arrête." },
      ],
    },
    get: {
      label: "/ 03 — CE QUE VOUS OBTENEZ",
      h2: "Pas un rapport. Un système.",
      items: [
        { t: "Score 0–100 + note", b: "Un chiffre que tout dirigeant comprend, appuyé par chaque contrôle sous-jacent." },
        { t: "Feuille de route", b: "Des corrections concrètes, classées par impact." },
        { t: "Suivi quotidien des réponses", b: "Vos requêtes clés testées chaque jour sur les moteurs IA, avec historique." },
        { t: "Alertes", b: "Régressions, robots bloqués, disparitions : tout arrive dans votre boîte mail, avec la cause." },
      ],
    },
    plans: {
      label: "/ 04 — FORFAITS",
      note: "L'Audit de visibilité IA et la feuille de route sont inclus dès CROISSANCE. Le suivi quotidien des réponses et la comparaison concurrentielle arrivent avec AGENCE. Essai gratuit de 14 jours sur les deux.",
      cta: "Voir les tarifs →",
    },
    final: {
      h2: "Découvrez ce que l'IA dit de vous, aujourd'hui.",
      sub: "Deux minutes pour démarrer. L'audit fait le reste.",
      cta1: "Lancez votre audit de visibilité IA →",
      cta2: "Réserver une démo ↗",
    },
  },

  "fr-CA": null as unknown as LpContent, // filled below

  "de-CH": {
    meta: {
      title: "KI-Sichtbarkeits-Audit. EchoRank360",
      description:
        "Finden Sie heraus, ob ChatGPT, Perplexity und Google AI Ihr Unternehmen empfehlen, mit einem Schritt-für-Schritt-Fahrplan in die KI-Antworten.",
    },
    hero: {
      label: "/ KI-SICHTBARKEIT",
      h1a: "Empfiehlt die KI Ihr Unternehmen?",
      h1b: "Die meisten Inhaber wissen es nicht.",
      sub: "ChatGPT, Perplexity und Google AI beantworten in diesem Moment die Fragen Ihrer Kunden. EchoRank360 prüft jeden Faktor, der entscheidet, ob die KI Sie sehen, Ihnen vertrauen und Sie zitieren kann, und verfolgt täglich, was die Engines tatsächlich sagen.",
      cta1: "KI-Sichtbarkeits-Audit starten →",
      cta2: "Demo buchen ↗",
    },
    audit: {
      label: "/ 01 — WAS DER AUDIT PRÜFT",
      h2: "Jeder Faktor zwischen Ihnen und einer KI-Empfehlung.",
      items: [
        { t: "Zugriff der KI-Crawler", b: "Erreichen die Bots hinter ChatGPT, Perplexity und Google AI Ihre Website überhaupt? Robots-Regeln, Blockaden und Fehlkonfigurationen, die Sie lautlos löschen." },
        { t: "Maschinenlesbarkeit", b: "Struktur, Metadaten und Entity-Signale, mit denen eine KI versteht, wer Sie sind, was Sie tun und wo Sie tätig sind." },
        { t: "Vertrauenssignale", b: "Die Reputationsbasis, auf die sich die KI stützt, bevor sie Sie empfiehlt. Bewertungen, Konsistenz, Aktualität." },
        { t: "Präsenz in den Antworten", b: "Ihre Schlüsselfragen laufen täglich gegen die Engines: Werden Sie zitiert, falsch dargestellt, oder fehlen Sie?" },
        { t: "Konkurrenzvergleich", b: "Ihr 0–100-Score neben den Mitbewerbern, die die KI stattdessen nennt." },
        { t: "Regressions-Wache", b: "Score-Einbrüche und gekippte Bot-Zugriffe lösen Alarme aus. Sie wissen sofort, wenn Sie verschwinden." },
      ],
    },
    how: {
      label: "/ 02 — SO FUNKTIONIERT ES",
      h2: "Prüfen. Beheben. Verfolgen.",
      steps: [
        { n: "01", t: "Prüfen", b: "Domain eingeben. Minuten später: Ihr KI-Sichtbarkeits-Score von 0–100, die Note und jeder fehlgeschlagene Check." },
        { n: "02", t: "Beheben", b: "Ein priorisierter Schritt-für-Schritt-Fahrplan, genau was zu ändern ist und warum es den Score bewegt." },
        { n: "03", t: "Verfolgen", b: "Tägliches Antwort-Tracking und geplante Re-Audits zeigen, wann die KI Sie zu empfehlen beginnt, und melden, wenn sie aufhört." },
      ],
    },
    get: {
      label: "/ 03 — WAS SIE ERHALTEN",
      h2: "Kein Bericht. Ein System.",
      items: [
        { t: "0–100-Score + Note", b: "Eine Zahl, die jede Geschäftsleitung versteht, gestützt auf jeden einzelnen Check." },
        { t: "Massnahmen-Fahrplan", b: "Konkrete Korrekturen, geordnet nach Wirkung." },
        { t: "Tägliches Antwort-Tracking", b: "Ihre Schlüsselfragen laufen jeden Tag gegen die KI-Engines, mit Verlauf." },
        { t: "Alarme", b: "Regressionen, gekippte Bots, Verschwinden, alles landet im Posteingang, mit Ursache." },
      ],
    },
    plans: {
      label: "/ 04 — PLÄNE",
      note: "Der KI-Sichtbarkeits-Audit samt Fahrplan ist ab WACHSTUM enthalten. Tägliches Antwort-Tracking und Konkurrenzvergleich kommen mit AGENTUR. 14 Tage kostenlos testen.",
      cta: "Preise ansehen →",
    },
    final: {
      h2: "Finden Sie heraus, was die KI über Sie sagt, heute.",
      sub: "Zwei Minuten zum Start. Den Rest erledigt der Audit.",
      cta1: "KI-Sichtbarkeits-Audit starten →",
      cta2: "Demo buchen ↗",
    },
  },
};

C["en-CA"] = C.en;
C["fr-CA"] = {
  ...C.fr,
  hero: {
    ...C.fr.hero,
    sub: "ChatGPT, Perplexity et Google AI répondent en ce moment même aux questions de vos clients. EchoRank360 audite chaque facteur qui détermine si l'IA peut vous voir, vous faire confiance et vous citer, puis suit chaque jour ce que les moteurs disent vraiment.",
  },
  get: {
    ...C.fr.get,
    items: C.fr.get.items.map((it) =>
      it.t === "Alertes"
        ? { t: "Alertes", b: "Régressions, robots bloqués, disparitions : tout arrive dans votre boîte courriel, avec la cause." }
        : it,
    ),
  },
  plans: {
    ...C.fr.plans,
    note: "L'Audit de visibilité IA et la feuille de route sont inclus dès CROISSANCE. Le suivi quotidien des réponses et la comparaison concurrentielle arrivent avec AGENCE. Essai gratuit de 14 jours sur les deux forfaits.",
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
  return { title: meta.title, description: meta.description };
}

export default async function AiVisibilityPage({
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
          <Link href={`/${locale}`} className={lp.logoLink} aria-label="EchoRank 360 — home">
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
                  href={`/${l}/ai-visibility`}
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
            <VisibilityArt />
          </div>
        </section>

        {/* audit coverage */}
        <section className={home.section}>
          <div className={home.label}>{c.audit.label}</div>
          <h2 className={home.h2}>{c.audit.h2}</h2>
          <div className={lp.grid3}>
            {c.audit.items.map((it) => (
              <div key={it.t} className={lp.card}>
                <h3 className={lp.cardTitle}>{it.t}</h3>
                <p className={lp.cardBody}>{it.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* how */}
        <section className={home.section}>
          <div className={home.label}>{c.how.label}</div>
          <h2 className={home.h2}>{c.how.h2}</h2>
          <div className={lp.grid3}>
            {c.how.steps.map((st) => (
              <div key={st.n} className={lp.card}>
                <div className={lp.stepNum}>{st.n}</div>
                <h3 className={lp.cardTitle}>{st.t}</h3>
                <p className={lp.cardBody}>{st.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* what you get */}
        <section className={home.section}>
          <div className={home.label}>{c.get.label}</div>
          <h2 className={home.h2}>{c.get.h2}</h2>
          <div className={lp.grid4}>
            {c.get.items.map((it) => (
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
