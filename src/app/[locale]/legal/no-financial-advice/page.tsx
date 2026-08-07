// No Financial Advice Disclaimer.
//
// Same typed-Doc + shared-chrome pattern as the other legal pages, with a full
// FR body (not the English-with-a-banner treatment the Subscription Agreement
// and Cookie Policy got) because this one was asked for in both languages.
//
// DELIBERATELY NOT IN CONSENT_DOCUMENTS. The consent set stays at four and
// CONSENT_VERSION does not move: this document is REFERENCED by the Subscription
// Agreement and the Terms of Use rather than separately accepted at checkout.
// Adding it to the consent config would invalidate every consent already on
// record and force every buyer to re-accept, which is not what a cross-reference
// warrants.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import { buildMetadata } from "@/lib/seo";
import BackButton from "../back-button";
import lp from "../legal.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Doc = { title: string; updated: string; sections: { h: string; ps: string[] }[] };

const EN: Doc = {
  title: "No Financial Advice",
  updated: "Last updated: August 7, 2026",
  sections: [
    { h: "Important Notice", ps: [
      "Echorank360, operated by ChatLogic Insights LTD (\"we,\" \"us,\" \"our\"), provides reputation management, AI visibility monitoring, SEO analytics, and related informational tooling. Nothing on this website, application, API, reports, emails, or any other Echorank360 channel constitutes financial, investment, legal, tax, accounting, or other professional advice.",
    ]},
    { h: "1. No Professional Advice", ps: [
      "Echorank360 and its owners, operators, affiliates, employees, contractors, and representatives do not provide financial, investment, legal, accounting, tax, or other regulated professional advice. Any content, scores, rankings, audits, recommendations, alerts, dashboards, reports, or commentary provided by the Service is offered for general informational purposes only. Decisions about your business, marketing spend, or finances should be made with appropriately qualified professional advisers.",
    ]},
    { h: "2. No Fiduciary Relationship", ps: [
      "Your use of Echorank360 does not create any fiduciary, advisory, agency, or other special relationship between you and us. You remain solely responsible for your business decisions.",
    ]},
    { h: "3. Scores and AI Outputs Are Not Recommendations", ps: [
      "The Service displays visibility scores, trust scores, rankings, keyword and traffic metrics, sentiment analysis, and AI-generated content and suggestions. These are data representations and algorithmic outputs based on inputs that may be incomplete, delayed, or inaccurate. They are estimates, not guarantees, and past results are not indicative of future outcomes.",
    ]},
    { h: "4. Your Responsibility", ps: [
      "You are solely responsible for evaluating any insight or recommendation before acting on it, including reviewing AI-generated content before publishing it. Actions you take toward customers, review platforms, search engines, or AI providers based on the Service are taken at your own risk and must comply with those platforms' terms.",
    ]},
    { h: "5. Data Accuracy and Third-Party Content", ps: [
      "The Service incorporates data from third parties, including search engines, review platforms, AI model providers, and public sources. We do not guarantee the accuracy, completeness, or timeliness of third-party data.",
    ]},
    { h: "6. No Guarantees", ps: [
      "We make no representations or warranties regarding business outcomes, revenue, search rankings, AI visibility, review volume, or reputation improvements. We do not guarantee that any strategy or recommendation will be successful.",
    ]},
    { h: "7. Limitation of Liability", ps: [
      "To the maximum extent permitted by applicable law, we shall not be liable for any direct, indirect, incidental, consequential, special, or punitive damages arising from your use of the Service or any decision you make based on its content.",
    ]},
    { h: "8. No Reliance", ps: [
      "You acknowledge that you do not rely on Echorank360 as the sole basis for any financial or business decision. Any actions you take are at your own risk.",
    ]},
    { h: "9. Compliance and Local Laws", ps: [
      "You are responsible for ensuring your use of Echorank360 complies with all applicable laws in your jurisdiction. Echorank360 is not available to persons located in the United Kingdom.",
    ]},
    { h: "10. Contact", ps: [
      "Legal enquiries: support@echorank360.com — ChatLogic Insights LTD",
    ]},
  ],
};

const FR: Doc = {
  title: "Absence de conseil financier",
  updated: "Dernière mise à jour : 7 août 2026",
  sections: [
    { h: "Avis important", ps: [
      "Echorank360, exploité par ChatLogic Insights LTD (« nous », « notre »), fournit des outils de gestion de la réputation, de suivi de la visibilité IA, d'analyse SEO et d'information connexe. Aucun élément de ce site web, de l'application, de l'API, des rapports, des courriels ou de tout autre canal Echorank360 ne constitue un conseil financier, d'investissement, juridique, fiscal, comptable ou tout autre conseil professionnel.",
    ]},
    { h: "1. Absence de conseil professionnel", ps: [
      "Echorank360 ainsi que ses propriétaires, exploitants, sociétés affiliées, employés, sous-traitants et représentants ne fournissent aucun conseil financier, d'investissement, juridique, comptable, fiscal ou autre conseil professionnel réglementé. Tout contenu, score, classement, audit, recommandation, alerte, tableau de bord, rapport ou commentaire fourni par le Service l'est à titre purement informatif. Les décisions concernant votre entreprise, vos dépenses marketing ou vos finances doivent être prises avec des conseillers professionnels dûment qualifiés.",
    ]},
    { h: "2. Absence de relation fiduciaire", ps: [
      "Votre utilisation d'Echorank360 ne crée aucune relation fiduciaire, de conseil, de mandat ou autre relation particulière entre vous et nous. Vous demeurez seul responsable de vos décisions commerciales.",
    ]},
    { h: "3. Les scores et résultats d'IA ne sont pas des recommandations", ps: [
      "Le Service affiche des scores de visibilité, des scores de confiance, des classements, des mesures de mots-clés et de trafic, des analyses de sentiment ainsi que des contenus et suggestions générés par IA. Il s'agit de représentations de données et de résultats algorithmiques fondés sur des entrées qui peuvent être incomplètes, différées ou inexactes. Ce sont des estimations et non des garanties ; les résultats passés ne préjugent pas des résultats futurs.",
    ]},
    { h: "4. Votre responsabilité", ps: [
      "Il vous incombe d'évaluer toute analyse ou recommandation avant d'agir, y compris de relire les contenus générés par IA avant de les publier. Les actions que vous entreprenez auprès de vos clients, des plateformes d'avis, des moteurs de recherche ou des fournisseurs d'IA sur la base du Service le sont à vos propres risques et doivent respecter les conditions de ces plateformes.",
    ]},
    { h: "5. Exactitude des données et contenus de tiers", ps: [
      "Le Service intègre des données provenant de tiers, notamment des moteurs de recherche, des plateformes d'avis, des fournisseurs de modèles d'IA et des sources publiques. Nous ne garantissons ni l'exactitude, ni l'exhaustivité, ni l'actualité des données de tiers.",
    ]},
    { h: "6. Absence de garanties", ps: [
      "Nous ne formulons aucune déclaration ni garantie quant aux résultats commerciaux, au chiffre d'affaires, au classement dans les moteurs de recherche, à la visibilité IA, au volume d'avis ou à l'amélioration de la réputation. Nous ne garantissons le succès d'aucune stratégie ni d'aucune recommandation.",
    ]},
    { h: "7. Limitation de responsabilité", ps: [
      "Dans toute la mesure permise par le droit applicable, nous ne saurions être tenus responsables de dommages directs, indirects, accessoires, consécutifs, spéciaux ou punitifs découlant de votre utilisation du Service ou de toute décision que vous prenez sur la base de son contenu.",
    ]},
    { h: "8. Absence de dépendance", ps: [
      "Vous reconnaissez ne pas vous appuyer sur Echorank360 comme unique fondement d'une décision financière ou commerciale. Toute action que vous entreprenez l'est à vos propres risques.",
    ]},
    { h: "9. Conformité et lois locales", ps: [
      "Il vous appartient de veiller à ce que votre utilisation d'Echorank360 respecte l'ensemble des lois applicables dans votre juridiction. Echorank360 n'est pas disponible pour les personnes situées au Royaume-Uni.",
    ]},
    { h: "10. Contact", ps: [
      "Questions juridiques : support@echorank360.com — ChatLogic Insights LTD",
    ]},
  ],
};

function pick(locale: Locale): Doc { return locale.startsWith("fr") ? FR : EN; }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const d = pick(locale);
  return buildMetadata({
    locale,
    path: "/legal/no-financial-advice",
    title: d.title,
    description: d.sections[0]?.ps[0],
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = pick(locale as Locale);
  const nav = CONTENT[locale as Locale].nav;
  const foot = CONTENT[locale as Locale].footer;
  const backLabel = locale.startsWith("fr") ? "← Retour" : locale === "de-CH" ? "← Zurück" : "← Back";
  return (
    <div className={lp.page}>
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          <Link href={`/${locale}/pricing`}>{nav.cta}</Link>
        </div>
        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        {locale === "de-CH" && (
          <p className={lp.banner}>
            Diese Seite ist derzeit auf Englisch verfügbar. Bei Fragen: support@echorank360.com.
          </p>
        )}
        <h1 className={lp.h1}>{d.title}</h1>
        <p className={lp.updated}>{d.updated}</p>
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className={lp.h2}>{s.h}</h2>
            {s.ps.map((p, i) => (<p key={i} className={lp.p}>{p}</p>))}
          </section>
        ))}
        <div className={lp.backRowBottom}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
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
