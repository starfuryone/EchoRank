// /[locale]/about — company overview.
//
// Rebuilt Aug 2026 from supplied copy. Same pattern as /use-cases: inline
// per-base copy tables, home2 tokens, PublicNav with current="resources".
// Team image at public/about-team.webp (optional — remove the <img> block
// if the asset is absent).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { PublicNav } from "../PublicNav";
import s from "../home2.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr" | "de-CH";
const baseOf = (locale: string): Base =>
  locale.startsWith("fr") ? "fr" : locale === "de-CH" ? "de-CH" : "en";

interface Copy {
  metaTitle: string;
  metaDescription: string;
  label: string;
  h1: string;
  sub: string;
  whoLabel: string;
  whoH2: string;
  whoP1: string;
  whoP2: string;
  whoP3: string;
  missionLabel: string;
  missionH2: string;
  missionP: string;
  values: { title: string; body: string }[];
  closeH2: string;
  closeSub: string;
  ctaAudit: string;
  ctaTrial: string;
}

const COPY: Record<Base, Copy> = {
  en: {
    metaTitle: "About us | Echorank360",
    metaDescription:
      "Echorank360 helps brands strengthen their visibility across search, AI discovery and reputation channels — one connected platform for modern digital growth.",
    label: "ABOUT US",
    h1: "Helping brands grow across search, AI discovery, and the wider digital landscape.",
    sub: "Echorank360 helps brands strengthen their visibility, understand where opportunities exist, and take smarter action across an increasingly complex digital ecosystem.",
    whoLabel: "WHO WE ARE",
    whoH2: "A connected platform for modern digital growth.",
    whoP1: "Echorank360 is a digital growth platform designed for teams that want to strengthen their online presence and stay ahead of the competition.",
    whoP2: "From ambitious startups to established enterprises, we bring SEO, AI visibility, reputation management, and digital marketing insights together in one connected platform.",
    whoP3: "As discovery continues to expand beyond traditional search into AI-generated answers, social platforms, and emerging digital channels, Echorank360 gives businesses the insights and tools they need to understand their position, uncover new opportunities, and grow with confidence.",
    missionLabel: "OUR MISSION",
    missionH2: "To give businesses the intelligence and tools they need to compete, grow, and lead.",
    missionP: "In a rapidly evolving digital environment, data alone is not enough. Brands need clear, actionable insights that show where they stand, where opportunities exist, and what actions can improve their visibility, reputation, and long-term growth.",
    values: [
      { title: "Clarity", body: "Understand your position across search, AI, and reputation channels." },
      { title: "Opportunity", body: "Identify the areas that can make the biggest difference to your growth." },
      { title: "Action", body: "Turn insight into practical next steps your team can execute with confidence." },
    ],
    closeH2: "See where you stand today",
    closeSub: "Run the free AI visibility audit. No account needed, and it takes about a minute.",
    ctaAudit: "Run my free audit ↗",
    ctaTrial: "Start 7-day trial ↗",
  },
  fr: {
    metaTitle: "À propos | Echorank360",
    metaDescription:
      "Echorank360 aide les marques à renforcer leur visibilité dans la recherche, la découverte par IA et les canaux de réputation — une plateforme connectée pour la croissance numérique moderne.",
    label: "À PROPOS",
    h1: "Aider les marques à grandir dans la recherche, la découverte par IA et l'écosystème numérique.",
    sub: "Echorank360 aide les marques à renforcer leur visibilité, à repérer les opportunités et à agir plus intelligemment dans un écosystème numérique de plus en plus complexe.",
    whoLabel: "QUI NOUS SOMMES",
    whoH2: "Une plateforme connectée pour la croissance numérique moderne.",
    whoP1: "Echorank360 est une plateforme de croissance numérique conçue pour les équipes qui veulent renforcer leur présence en ligne et garder une longueur d'avance.",
    whoP2: "De la startup ambitieuse à l'entreprise établie, nous réunissons SEO, visibilité IA, gestion de réputation et insights marketing dans une seule plateforme connectée.",
    whoP3: "Alors que la découverte dépasse la recherche traditionnelle pour s'étendre aux réponses générées par IA, aux réseaux sociaux et aux nouveaux canaux numériques, Echorank360 donne aux entreprises les outils et les insights nécessaires pour comprendre leur position, saisir de nouvelles opportunités et croître en confiance.",
    missionLabel: "NOTRE MISSION",
    missionH2: "Donner aux entreprises l'intelligence et les outils pour rivaliser, croître et mener.",
    missionP: "Dans un environnement numérique en évolution rapide, les données seules ne suffisent pas. Les marques ont besoin d'insights clairs et actionnables qui montrent où elles se situent, où sont les opportunités et quelles actions améliorent leur visibilité, leur réputation et leur croissance durable.",
    values: [
      { title: "Clarté", body: "Comprenez votre position dans la recherche, l'IA et les canaux de réputation." },
      { title: "Opportunité", body: "Identifiez les leviers qui feront la plus grande différence pour votre croissance." },
      { title: "Action", body: "Transformez l'insight en étapes concrètes que votre équipe peut exécuter en confiance." },
    ],
    closeH2: "Découvrez où vous en êtes aujourd'hui",
    closeSub: "Lancez l'audit gratuit de visibilité IA. Sans compte, en une minute environ.",
    ctaAudit: "Lancer mon audit gratuit ↗",
    ctaTrial: "Essai 7 jours ↗",
  },
  "de-CH": {
    metaTitle: "Über uns | Echorank360",
    metaDescription:
      "Echorank360 hilft Marken, ihre Sichtbarkeit in Suche, KI-Discovery und Reputationskanälen zu stärken — eine vernetzte Plattform für modernes digitales Wachstum.",
    label: "ÜBER UNS",
    h1: "Wir helfen Marken, in Suche, KI-Discovery und der digitalen Landschaft zu wachsen.",
    sub: "Echorank360 hilft Marken, ihre Sichtbarkeit zu stärken, Chancen zu erkennen und in einem zunehmend komplexen digitalen Ökosystem klüger zu handeln.",
    whoLabel: "WER WIR SIND",
    whoH2: "Eine vernetzte Plattform für modernes digitales Wachstum.",
    whoP1: "Echorank360 ist eine Wachstumsplattform für Teams, die ihre Online-Präsenz stärken und der Konkurrenz voraus bleiben wollen.",
    whoP2: "Vom ambitionierten Startup bis zum etablierten Unternehmen vereinen wir SEO, KI-Sichtbarkeit, Reputationsmanagement und Marketing-Insights in einer vernetzten Plattform.",
    whoP3: "Da Discovery über die klassische Suche hinaus in KI-Antworten, soziale Plattformen und neue digitale Kanäle expandiert, gibt Echorank360 Unternehmen die Einblicke und Werkzeuge, um ihre Position zu verstehen, Chancen zu erkennen und selbstbewusst zu wachsen.",
    missionLabel: "UNSERE MISSION",
    missionH2: "Unternehmen die Intelligenz und Werkzeuge geben, um zu konkurrieren, zu wachsen und zu führen.",
    missionP: "In einem sich schnell wandelnden digitalen Umfeld reichen Daten allein nicht aus. Marken brauchen klare, umsetzbare Einblicke, die zeigen, wo sie stehen, wo Chancen liegen und welche Massnahmen Sichtbarkeit, Reputation und langfristiges Wachstum verbessern.",
    values: [
      { title: "Klarheit", body: "Verstehen Sie Ihre Position in Suche, KI und Reputationskanälen." },
      { title: "Chance", body: "Erkennen Sie die Bereiche mit dem grössten Hebel für Ihr Wachstum." },
      { title: "Umsetzung", body: "Machen Sie aus Einblicken konkrete Schritte, die Ihr Team sicher umsetzt." },
    ],
    closeH2: "Sehen Sie, wo Sie heute stehen",
    closeSub: "Starten Sie das kostenlose KI-Sichtbarkeits-Audit. Ohne Konto, in etwa einer Minute.",
    ctaAudit: "Gratis-Audit starten ↗",
    ctaTrial: "7 Tage testen ↗",
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const c = COPY[baseOf(locale)];
  return buildMetadata({
    locale,
    path: "/about",
    title: c.metaTitle,
    description: c.metaDescription,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = COPY[baseOf(locale)];
  const L = (p: string) => `/${locale}${p}`;

  return (
    <div className={s.page}>
      <PublicNav locale={locale} current="resources" />

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 01</b> — {c.label}</p>
          <h1 className={s.h1}>{c.h1}</h1>
          <p className={s.sub}>{c.sub}</p>
          <img
            src="/about-team.webp"
            alt=""
            style={{ width: "100%", height: "auto", borderRadius: 10, marginTop: 32 }}
          />
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {c.whoLabel}</p>
          <h2 className={s.h2}>{c.whoH2}</h2>
          <p className={s.sub}><strong>{c.whoP1}</strong></p>
          <p className={s.sub}>{c.whoP2}</p>
          <p className={s.sub}>{c.whoP3}</p>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 03</b> — {c.missionLabel}</p>
          <h2 className={s.h2}>{c.missionH2}</h2>
          <p className={s.sub}>{c.missionP}</p>
          <div className={s.ucGrid} style={{ marginTop: 28 }}>
            {c.values.map((v) => (
              <div key={v.title} className={s.ucCard}>
                <span className={s.ucTitle}>{v.title}</span>
                <span className={s.ucBody}>{v.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{c.closeH2}</h2>
          <p className={s.sub}>{c.closeSub}</p>
          <div className={s.ctarow} style={{ marginTop: 22 }}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/free-audit")}>{c.ctaAudit}</Link>
            <Link className={`${s.btn} ${s.btnGhost}`} href={L("/pricing")}>{c.ctaTrial}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
