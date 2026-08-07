import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import lp from "../legal.module.css";
import BackButton from "../back-button";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * `ps` widened to ReactNode so section 10 can carry a link to the No Financial
 * Advice Disclaimer; every other paragraph is still a plain string.
 * `description` is separate because generateMetadata needs text, and a JSX
 * paragraph cannot serve as one.
 */
type Doc = {
  title: string;
  updated: string;
  description: string;
  sections: { h: string; ps: React.ReactNode[] }[];
};

/** Cross-reference only — NOT one of the four consent documents. */
function NfaLink({ locale, label }: { locale: string; label: string }) {
  return <Link href={`/${locale}/legal/no-financial-advice`}>{label}</Link>;
}

function buildEn(locale: string): Doc {
  return {
  title: "Terms of Use",
  updated: "Last updated: August 8, 2026",
  description:
    "These Terms govern access to and use of Echorank (echorank360.com), operated by ChatLogic Insights Ltd.",
  sections: [
    { h: "1. Agreement", ps: [
      "These Terms govern access to and use of Echorank (echorank360.com, the \"Service\"), operated by ChatLogic Insights Ltd, registered in England and Wales, company number 15593166 (\"ChatLogic\", \"we\"). By creating an account or using the Service you agree to these Terms and to the Privacy Policy. If you use the Service for an organisation, you represent that you can bind it.",
      "The Service is provided for business use. You must be at least 18 years old.",
    ]},
    { h: "2. Eligibility", ps: [
      "You must be at least 18 years old to use the Service. Echorank360 is not available to persons located in the United Kingdom. By creating an account or starting a trial you represent that you are not a UK national, UK resident, or accessing the Service from within the UK.",
    ]},
    { h: "3. Subscriptions, trials and billing", ps: [
      "Plans are billed in advance on a recurring basis at the prices shown at purchase. New accounts include a 7-day free trial. A payment card is required to start it, and the card is charged automatically when the trial ends unless you cancel first.",
      "Subscriptions renew automatically until cancelled. You can cancel at any time, effective at the end of the current billing period; amounts already paid are non-refundable except where the law requires otherwise. We may change prices with at least 30 days' notice, effective at your next renewal. Taxes are your responsibility where applicable.",
    ]},
    { h: "4. Acceptable use", ps: [
      "You agree not to misuse the Service, including: no unlawful, infringing or deceptive activity; no attempts to breach security or disrupt the Service; no reselling without authorisation; no scraping of the Service itself.",
      "Reviews integrity: you must not use the Service to create, purchase, solicit or publish fake or misleading reviews, to offer incentives conditioned on positive reviews, or to suppress reviews in ways prohibited by platform policies or applicable law (including consumer-protection and FTC rules on review gating).",
      "Outreach compliance: when you send review requests, feedback requests or any messages through the Service, you are solely responsible for having valid consent and honouring opt-outs under the laws that apply to your recipients, including CASL (Canada), the TCPA and CAN-SPAM (US), and the GDPR and ePrivacy rules (EU and UK).",
    ]},
    { h: "5. Your content", ps: [
      "You retain all rights in the data and content you submit (\"Customer Content\"). You grant us a limited licence to host and process it solely to provide, secure and improve the Service for you. You warrant that you have the rights and any consents needed for us to process Customer Content as described in the Privacy Policy.",
      "You are responsible for the accuracy and lawfulness of Customer Content and for your published responses to reviews.",
    ]},
    { h: "6. AI features and no guarantee of results", ps: [
      "The Service uses artificial intelligence and heuristic analysis to produce scores, estimates, drafts and recommendations. These are assistive outputs: they may be incomplete or inaccurate, and you must review them before acting on or publishing them.",
      "We do not control third-party platforms or AI systems. We make no promise that your business will appear in, rank in, or be described accurately by any search engine or AI assistant, that reviews or ratings will improve, or that any revenue estimate (including revenue-at-risk figures) will match reality. Such figures are estimates for prioritisation, not financial advice.",
    ]},
    { h: "7. Third-party services", ps: [
      "The Service interoperates with third-party platforms and providers (for example Google, review platforms, email and SMS carriers, payment and AI providers). Their terms govern your use of their services, and their availability is outside our control. Third-party names and marks belong to their owners; no affiliation or endorsement is implied.",
    ]},
    { h: "8. Intellectual property", ps: [
      "The Service, including software, design and content we provide, is owned by ChatLogic or its licensors and protected by law. We grant you a limited, non-exclusive, non-transferable licence to use it during your subscription. Feedback you send us may be used without restriction or obligation.",
    ]},
    { h: "9. Suspension and termination", ps: [
      "We may suspend or terminate access for breach of these Terms, non-payment, legal requirement, or risk to the Service or others, with notice where practicable. You may terminate by cancelling your account. Upon termination, your right to use the Service ends; clauses that by nature survive (including 4, 5, 9 to 12) survive.",
    ]},
    { h: "10. Disclaimer of warranties", ps: [
      "The Service is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, accuracy, and uninterrupted or error-free operation, to the maximum extent permitted by law.",
      <>
        Use of the Service is also subject to our{" "}
        <NfaLink locale={locale} label="No Financial Advice Disclaimer" />.
      </>,
    ]},
    { h: "11. Limitation of liability", ps: [
      "To the maximum extent permitted by law, ChatLogic will not be liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, goodwill or data, and our total aggregate liability arising out of or relating to the Service is limited to the amounts you paid us in the 12 months preceding the event giving rise to the claim.",
      "Nothing in these Terms excludes or limits liability that cannot be excluded by law, including for fraud or for death or personal injury caused by negligence. Some jurisdictions do not allow certain exclusions or limitations; where that is the case, they apply only to the extent permitted, and mandatory consumer rights, including under Québec law where applicable, remain unaffected.",
    ]},
    { h: "12. Indemnity", ps: [
      "You will defend and indemnify ChatLogic against claims arising from your Customer Content, your outreach and messaging practices, your breach of these Terms, or your violation of law or third-party rights.",
    ]},
    { h: "13. Governing law and disputes", ps: [
      "These Terms are governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction, except that either party may seek injunctive relief in any competent court and except where mandatory local law grants you rights or a forum that cannot be waived.",
    ]},
    { h: "14. Changes to these Terms", ps: [
      "We may update these Terms; material changes will be notified by email or in the Service at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.",
    ]},
    { h: "15. General", ps: [
      "If a provision is unenforceable, the rest remains in effect. These Terms and the Privacy Policy are the entire agreement between you and ChatLogic regarding the Service. You may not assign these Terms without our consent; we may assign them as part of a corporate transaction. Contact: privacy@echorank360.com.",
    ]},
  ],
  };
}

function buildFr(locale: string): Doc {
  return {
  title: "Conditions d'utilisation",
  updated: "Dernière mise à jour : 8 août 2026",
  description:
    "Les présentes Conditions régissent l'accès au service Echorank (echorank360.com), exploité par ChatLogic Insights Ltd.",
  sections: [
    { h: "1. Accord", ps: [
      "Les présentes Conditions régissent l'accès et l'utilisation d'Echorank (echorank360.com, le « Service »), exploité par ChatLogic Insights Ltd, société d'Angleterre et du Pays de Galles, numéro 15593166 (« ChatLogic », « nous »). En créant un compte ou en utilisant le Service, vous acceptez ces Conditions et la Politique de confidentialité. Si vous utilisez le Service pour une organisation, vous déclarez pouvoir l'engager.",
      "Le Service est destiné à un usage professionnel. Vous devez avoir au moins 18 ans.",
    ]},
    { h: "2. Admissibilité", ps: [
      "Vous devez être âgé d'au moins 18 ans pour utiliser le Service. Echorank360 n'est pas disponible pour les personnes situées au Royaume-Uni. En créant un compte ou en démarrant un essai, vous déclarez que vous n'êtes ni ressortissant britannique, ni résident du Royaume-Uni, et que vous n'accédez pas au Service depuis le Royaume-Uni.",
    ]},
    { h: "3. Abonnements, essai et facturation", ps: [
      "Les forfaits sont facturés d'avance, de façon récurrente, aux prix affichés lors de l'achat. Les nouveaux comptes bénéficient d'un essai gratuit de 7 jours. Une carte de paiement est requise pour le démarrer et elle est débitée automatiquement à la fin de l'essai, sauf annulation préalable.",
      "Les abonnements se renouvellent automatiquement jusqu'à annulation. Vous pouvez annuler à tout moment, avec effet à la fin de la période en cours ; les sommes déjà payées ne sont pas remboursables, sauf lorsque la loi l'exige. Nous pouvons modifier les prix avec un préavis d'au moins 30 jours, applicable au prochain renouvellement. Les taxes applicables sont à votre charge.",
    ]},
    { h: "4. Utilisation acceptable", ps: [
      "Vous vous engagez à ne pas détourner le Service : aucune activité illégale, contrefaisante ou trompeuse ; aucune tentative d'atteinte à la sécurité ; pas de revente sans autorisation ; pas d'extraction automatisée du Service lui-même.",
      "Intégrité des avis : il est interdit d'utiliser le Service pour créer, acheter, solliciter ou publier de faux avis ou des avis trompeurs, pour offrir des avantages conditionnés à un avis positif, ou pour filtrer les avis d'une manière prohibée par les politiques des plateformes ou la loi applicable (y compris les règles de protection du consommateur).",
      "Conformité des envois : lorsque vous envoyez des demandes d'avis, des demandes de retour ou tout message via le Service, vous êtes seul responsable d'obtenir les consentements valides et de respecter les désabonnements selon les lois applicables à vos destinataires, notamment la LCAP (Canada), le TCPA et CAN-SPAM (États-Unis), et le RGPD et les règles ePrivacy (UE et Royaume-Uni).",
    ]},
    { h: "5. Votre contenu", ps: [
      "Vous conservez tous les droits sur les données et contenus que vous soumettez (« Contenu Client »). Vous nous accordez une licence limitée pour les héberger et les traiter uniquement afin de fournir, sécuriser et améliorer le Service pour vous. Vous garantissez disposer des droits et consentements nécessaires.",
      "Vous êtes responsable de l'exactitude et de la licéité du Contenu Client et des réponses que vous publiez aux avis.",
    ]},
    { h: "6. Fonctions d'IA et absence de garantie de résultats", ps: [
      "Le Service utilise l'intelligence artificielle et des analyses heuristiques pour produire des scores, des estimations, des brouillons et des recommandations. Ce sont des aides : elles peuvent être incomplètes ou inexactes et doivent être vérifiées avant toute action ou publication.",
      "Nous ne contrôlons ni les plateformes tierces ni les systèmes d'IA. Nous ne promettons pas que votre entreprise apparaîtra dans un moteur de recherche ou un assistant d'IA, y sera bien classée ou correctement décrite, que vos avis ou notes s'amélioreront, ni qu'une estimation de revenus (y compris le chiffre d'affaires à risque) correspondra à la réalité. Ces chiffres servent à prioriser ; ce ne sont pas des conseils financiers.",
    ]},
    { h: "7. Services tiers", ps: [
      "Le Service interagit avec des plateformes et prestataires tiers (par exemple Google, plateformes d'avis, opérateurs de courriel et de SMS, prestataires de paiement et d'IA). Leurs conditions régissent votre usage de leurs services et leur disponibilité échappe à notre contrôle. Les noms et marques de tiers appartiennent à leurs titulaires ; aucune affiliation ni approbation n'est suggérée.",
    ]},
    { h: "8. Propriété intellectuelle", ps: [
      "Le Service, y compris les logiciels, le design et les contenus que nous fournissons, appartient à ChatLogic ou à ses concédants. Nous vous accordons une licence limitée, non exclusive et non transférable pendant votre abonnement. Vos suggestions peuvent être utilisées sans restriction ni obligation.",
    ]},
    { h: "9. Suspension et résiliation", ps: [
      "Nous pouvons suspendre ou résilier l'accès en cas de violation des Conditions, de défaut de paiement, d'exigence légale ou de risque pour le Service ou autrui, avec préavis lorsque possible. Vous pouvez résilier en annulant votre compte. Les clauses qui par nature survivent (dont 4, 5, 9 à 12) survivent.",
    ]},
    { h: "10. Exclusion de garanties", ps: [
      "Le Service est fourni « tel quel » et « selon disponibilité », sans garantie d'aucune sorte, expresse ou implicite, y compris de qualité marchande, d'adéquation à un usage particulier, d'absence de contrefaçon, d'exactitude ou de fonctionnement ininterrompu et sans erreur, dans toute la mesure permise par la loi.",
      <>
        L&apos;utilisation du Service est également soumise à notre{" "}
        <NfaLink locale={locale} label="Avis d'absence de conseil financier" />.
      </>,
    ]},
    { h: "11. Limitation de responsabilité", ps: [
      "Dans toute la mesure permise par la loi, ChatLogic n'est pas responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, ni des pertes de profits, de revenus, de clientèle ou de données, et notre responsabilité totale cumulée liée au Service est limitée aux sommes que vous nous avez payées au cours des 12 mois précédant le fait générateur.",
      "Rien dans ces Conditions n'exclut une responsabilité qui ne peut l'être légalement, notamment en cas de fraude ou de décès ou blessure corporelle causés par négligence. Certaines juridictions n'autorisent pas certaines exclusions ; elles ne s'appliquent alors que dans la mesure permise, et les droits impératifs des consommateurs, y compris, le cas échéant, en droit québécois, demeurent intacts.",
    ]},
    { h: "12. Indemnisation", ps: [
      "Vous défendrez et indemniserez ChatLogic contre les réclamations découlant de votre Contenu Client, de vos pratiques d'envoi de messages, de votre violation des présentes Conditions ou de la loi ou de droits de tiers.",
    ]},
    { h: "13. Droit applicable et litiges", ps: [
      "Ces Conditions sont régies par le droit d'Angleterre et du Pays de Galles ; les tribunaux d'Angleterre et du Pays de Galles ont compétence exclusive, sous réserve des mesures d'urgence devant tout tribunal compétent et des règles impératives locales qui vous accorderaient des droits ou un for auxquels il ne peut être renoncé.",
    ]},
    { h: "14. Modification des Conditions", ps: [
      "Nous pouvons mettre à jour ces Conditions ; les changements importants seront notifiés par courriel ou dans le Service au moins 14 jours avant leur prise d'effet. L'utilisation continue vaut acceptation.",
    ]},
    { h: "15. Dispositions générales", ps: [
      "Si une clause est inapplicable, le reste demeure en vigueur. Ces Conditions et la Politique de confidentialité constituent l'intégralité de l'accord relatif au Service. Vous ne pouvez céder ces Conditions sans notre accord ; nous pouvons les céder dans le cadre d'une opération d'entreprise. Contact : privacy@echorank360.com.",
    ]},
  ],
  };
}

function pick(locale: Locale): Doc {
  return locale.startsWith("fr") ? buildFr(locale) : buildEn(locale);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const d = pick(locale);
  return buildMetadata({
    locale,
    path: "/legal/terms",
    title: d.title,
    description: d.description,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const d = pick(locale);
  const nav = CONTENT[locale].nav;
  const foot = CONTENT[locale].footer;
  const backLabel = locale.startsWith("fr") ? "← Retour" : locale === "de-CH" ? "← Zurück" : "← Back";
  return (
    <div className={lp.page}>
      <div className={lp.wrap}>
        <div className={lp.top}>
          <Link href={`/${locale}`} aria-label="Echorank360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={lp.logo} />
          </Link>
          <Link href="/register">{nav.cta}</Link>
        </div>
        <div className={lp.backRow}>
          <BackButton locale={locale} label={backLabel} className={lp.backBtnSolid} />
        </div>
        {locale === "de-CH" && <p className={lp.banner}>Diese Seite ist derzeit auf Englisch verfügbar. Bei Fragen: privacy@echorank360.com.</p>}
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
// EOF-terms
