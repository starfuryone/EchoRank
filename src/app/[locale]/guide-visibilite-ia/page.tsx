import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { CONTENT } from "@/lib/i18n/content";
import s from "./guide-ia.module.css";
import Checklist from "./checklist";
import EnGuide, { TITLE_EN, DESC_EN } from "./en";
import BackButton from "../legal/back-button";
import { GuideHeroArt, SerpToAnswerArt, ChecklistArt, CrawlerGateArt, ReviewPulseArt } from "./art";
import RevenueCalculator from "./calculator";
import { JsonLd, buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const TITLE = "Le guide complet de la visibilité dans l'IA en 2026";
const SUBTITLE = "Comment être recommandé par ChatGPT, Google AI, Gemini, Claude et Perplexity.";
const DESC = "Le guide de référence sur la visibilité IA et le Generative Engine Optimization (GEO) : comment apparaître dans ChatGPT, comment être recommandé par l'IA, référencement IA, audit et checklist pratique.";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const fr = locale.startsWith("fr");
  return buildMetadata({
    locale,
    path: "/guide-visibilite-ia",
    title: fr ? TITLE : TITLE_EN,
    description: fr ? DESC : DESC_EN,
    ogType: "article",
  });
}

/* ── building blocks ─────────────────────────────────────────────────── */

function Cta({ label }: { label?: string }) {
  return (
    <div className={s.ctaBand}>
      <span className={s.ctaText}>
        <b>Évaluez votre entreprise gratuitement</b>
        <span>Obtenez votre score EchoRank en moins de 60 secondes.</span>
      </span>
      <Link href="/register" className={s.ctaBtn}>{label ?? "Lancer mon audit IA →"}</Link>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.callout}>
      <div className={s.calloutTag}>📊 Le saviez-vous ?</div>
      <p className={s.calloutText}>{children}</p>
    </div>
  );
}

function Figure({ file, caption }: { file: string; caption: string }) {
  if (!existsSync(join(process.cwd(), "public", "guide", file))) return null;
  return (
    <figure className={s.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/guide/${file}`} alt={caption} loading="lazy" />
      <figcaption className={s.figcap}>{caption}</figcaption>
    </figure>
  );
}

function RecoFlowDiagram() {
  return (
    <div className={s.diagram} aria-label="Le parcours d'une recommandation par l'IA" role="img">
      <svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg">
        {["Le client pose sa question", "L'assistant IA (ChatGPT, Gemini...)", "Les sources que l'IA consulte et cite", "Votre entreprise y figure... ou pas"].map((t, i) => (
          <g key={i}>
            <rect x="120" y={12 + i * 74} width="320" height="44" className={s.dbox} rx="8" />
            <text x="280" y={39 + i * 74} textAnchor="middle" className={s.dtext}>{t}</text>
            {i < 3 && <line x1="280" y1={56 + i * 74} x2="280" y2={86 + i * 74} className={`${s.dgold} ${s.dflow}`} />}
          </g>
        ))}
      </svg>
    </div>
  );
}

function ReputationFlowDiagram() {
  const sources = ["Avis Google", "Facebook", "Trustpilot", "Site web", "Presse", "Schema.org"];
  return (
    <div className={s.diagram} aria-label="Les sources qui construisent la réputation lue par l'IA" role="img">
      <svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg">
        {sources.map((t, i) => {
          const x = 10 + (i % 3) * 185;
          const y = i < 3 ? 12 : 66;
          return (
            <g key={t}>
              <rect x={x} y={y} width="170" height="38" className={s.dbox} rx="8" />
              <text x={x + 85} y={y + 24} textAnchor="middle" className={s.dtext}>{t}</text>
              <line x1={x + 85} y1={y + 38} x2="280" y2="150" className={s.dln} />
            </g>
          );
        })}
        <rect x="150" y="150" width="260" height="44" className={s.dbox} rx="8" />
        <text x="280" y="177" textAnchor="middle" className={s.dtext}>Réputation lue par l'IA</text>
        <line x1="280" y1="194" x2="280" y2="238" className={`${s.dgold} ${s.dflow}`} />
        <rect x="120" y="238" width="320" height="44" className={s.dbox} rx="8" />
        <text x="280" y="265" textAnchor="middle" className={s.dtext}>Recommandations de ChatGPT et des autres IA</text>
      </svg>
    </div>
  );
}

function TrendGrid() {
  const items = ["Visibilité IA", "Vélocité d'avis", "Citations IA", "Prospects qualifiés"];
  return (
    <div className={s.diagram} aria-label="Tendances attendues après corrections" role="img">
      <svg viewBox="0 0 560 120" xmlns="http://www.w3.org/2000/svg">
        {items.map((t, i) => (
          <g key={t}>
            <path d={`M ${40 + i * 135} 84 L ${90 + i * 135} 40`} className={s.dgold} />
            <path d={`M ${82 + i * 135} 40 L ${90 + i * 135} 40 L ${90 + i * 135} 48`} className={s.dgold} />
            <text x={65 + i * 135} y="106" textAnchor="middle" className={s.dtext}>{t} ↑</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CompareTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <table className={s.table}>
      <thead><tr><th>{head[0]}</th><th>{head[1]}</th></tr></thead>
      <tbody>
        {rows.map((r) => (<tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td></tr>))}
      </tbody>
    </table>
  );
}

/* ── vertical sections data ──────────────────────────────────────────── */

const VERTICALS: { name: string; ask: string; signals: string; problems: string; steps: string }[] = [
  { name: "Dentistes", ask: "« Quel dentiste accepte les nouveaux patients près de chez moi et propose des urgences ? »", signals: "Avis mentionnant la douceur et l'attente, page d'équipe avec diplômes, prise de rendez-vous en ligne, FAQ sur les actes courants.", problems: "Fiches multiples par praticien qui diluent les avis, absence de page urgences, horaires incohérents entre plateformes.", steps: "Une fiche par clinique, pages de soins distinctes (implants, orthodontie, urgences), Schema MedicalClinic ou Dentist, réponses systématiques aux avis." },
  { name: "Avocats", ask: "« Quel avocat en droit du travail défend les salariés dans ma ville, et combien coûte une consultation ? »", signals: "Domaines de pratique explicites, articles qui répondent à de vraies questions juridiques, mentions dans la presse locale, barreau vérifiable.", problems: "Sites vitrines sans contenu par domaine, aucun avis (par prudence excessive), jargon que les IA ne relient pas aux questions des clients.", steps: "Une page par domaine de pratique, FAQ en langage client, avis Google sollicités dans le respect des règles déontologiques, Schema LegalService." },
  { name: "Restaurants", ask: "« Où manger italien ce soir, terrasse, adapté aux enfants ? »", signals: "Volume et fraîcheur des avis, menus accessibles en texte (pas seulement en PDF ou en image), photos, attributs (terrasse, végétarien).", problems: "Menus en image illisibles pour les IA, horaires de jours fériés faux, avis récents laissés sans réponse.", steps: "Menu en HTML avec Schema Menu, attributs de la fiche Google complets, campagne d'avis après réservation, réponses aux avis en moins de 48 heures." },
  { name: "Plombiers", ask: "« Plombier d'urgence disponible maintenant, fuite d'eau, quel est le tarif de déplacement ? »", signals: "Mention explicite des urgences 24/7, zone d'intervention détaillée, tarifs de déplacement affichés, avis citant la rapidité.", problems: "Zone de service vague, aucun prix indicatif, avis anciens, numéro différent selon les annuaires.", steps: "Page urgences dédiée, pages par ville desservie, NAP identique partout, demande d'avis par texto après chaque intervention." },
  { name: "Électriciens", ask: "« Électricien certifié pour mise aux normes d'un panneau, devis rapide ? »", signals: "Certifications et licences visibles, photos de chantiers, avis mentionnant la conformité et la propreté, devis en ligne.", problems: "Licences absentes du site, portfolio inexistant, confusion entre résidentiel et commercial.", steps: "Numéro de licence sur chaque page, pages séparées résidentiel et commercial, Schema Electrician, sollicitation d'avis post-chantier." },
  { name: "Hôtels", ask: "« Hôtel calme près du centre avec parking et annulation gratuite ? »", signals: "Cohérence des notes entre plateformes, réponses de la direction aux critiques, politique d'annulation claire, attributs détaillés.", problems: "Notes divergentes entre Google et les plateformes de réservation, critiques ignorées, équipements non déclarés.", steps: "Réponse à chaque critique, attributs exhaustifs (parking, climatisation, animaux), Schema Hotel, surveillance quotidienne multi-plateformes." },
  { name: "Agences immobilières", ask: "« Quelle agence vend le mieux les maisons dans mon quartier, et à quels frais ? »", signals: "Avis de vendeurs et d'acheteurs, connaissance du quartier démontrée par du contenu, transparence sur les honoraires, fiches d'agents.", problems: "Avis concentrés sur un seul agent vedette, contenu générique sans ancrage local, honoraires cachés.", steps: "Pages par quartier avec données locales, avis sollicités après chaque transaction, profils d'agents structurés, Schema RealEstateAgent." },
  { name: "Cliniques", ask: "« Clinique sans rendez-vous ouverte ce soir, quels délais d'attente ? »", signals: "Horaires exacts y compris les exceptions, services listés précisément, avis sur l'attente et l'accueil, informations d'accès.", problems: "Horaires obsolètes (le pire signal en santé), services flous, absence de page dédiée aux sans rendez-vous.", steps: "Horaires vérifiés chaque semaine, page par service, Schema MedicalClinic, réponses empathiques et conformes aux avis." },
  { name: "Entrepreneurs généraux", ask: "« Entrepreneur fiable pour agrandissement, licence RBQ, références vérifiables ? »", signals: "Licence affichée, portfolio par type de projet, avis détaillés citant budget et délais tenus, assurances mentionnées.", problems: "Projets sans photos ni contexte, avis peu nombreux pour des contrats pourtant longs, informations légales introuvables.", steps: "Page par type de projet avec photos avant/après, licence et assurances en pied de page, demande d'avis à la livraison, citations locales cohérentes." },
];

const GLOSSARY: [string, string][] = [
  ["GEO (Generative Engine Optimization)", "L'ensemble des pratiques qui augmentent la probabilité qu'un moteur génératif (ChatGPT, Gemini, Perplexity) mentionne, cite ou recommande votre entreprise dans ses réponses."],
  ["AI Search", "La recherche assistée par IA, où l'utilisateur reçoit une réponse rédigée plutôt qu'une liste de liens. La visibilité s'y mesure en mentions, pas en positions."],
  ["LLM (grand modèle de langage)", "Le moteur statistique derrière les assistants IA. Il produit du texte à partir de ce qu'il a appris et, de plus en plus, de ce qu'il récupère sur le web en direct."],
  ["Citation", "Le fait, pour une IA, de nommer votre entreprise ou de renvoyer vers votre site comme source. C'est l'unité de valeur de la visibilité IA."],
  ["Visibilité IA (AI Visibility)", "Votre présence mesurable dans les réponses des assistants IA : êtes-vous mentionné, correctement décrit, et recommandé quand un client pose la question ?"],
  ["AI Retrieval", "L'étape où l'assistant va chercher des informations fraîches (pages web, fiches, avis) avant de rédiger sa réponse. Sans accès à vos contenus, pas de citation possible."],
  ["Hallucination", "Une affirmation inventée par le modèle. Des informations publiques claires et cohérentes sur votre entreprise réduisent le risque qu'une IA se trompe à votre sujet."],
  ["Embeddings", "La représentation mathématique du sens d'un texte, utilisée pour rapprocher une question client de vos contenus. Des pages précises et bien rédigées produisent de meilleurs rapprochements."],
  ["Données structurées (Structured Data)", "Des balises normalisées (Schema.org) qui décrivent votre entreprise aux machines : type d'activité, horaires, avis, FAQ. Le format préféré des systèmes automatisés."],
  ["Knowledge Graph", "La base de connaissances où les moteurs relient entités, lieux et faits. Une présence cohérente sur plusieurs sources fiables vous y ancre."],
  ["RAG (Retrieval-Augmented Generation)", "L'architecture qui combine récupération d'informations et génération de texte. C'est elle qui permet à une IA de citer des sources récentes plutôt que sa seule mémoire."],
  ["Recherche sémantique (Semantic Search)", "La recherche par le sens plutôt que par les mots exacts. Elle récompense les contenus qui répondent vraiment à l'intention, pas ceux qui répètent un mot-clé."],
  ["AI Overview", "Le résumé génératif affiché par Google en tête des résultats. Y être cité capte l'attention avant même le premier lien classique."],
];

const FAQ: [string, string][] = [
  ["Comment apparaître dans ChatGPT ?", "En rendant votre entreprise lisible et fiable pour les systèmes de récupération : robots des IA autorisés, données structurées, fiche Google active, avis récents et répondus, informations identiques partout. Un audit de visibilité IA identifie précisément les points qui vous bloquent."],
  ["Le SEO classique suffit-il pour être recommandé par l'IA ?", "Non. Le SEO optimise un classement de liens; la visibilité IA optimise une recommandation. Les backlinks comptent moins que la confiance, la cohérence des informations et la réputation mesurable par les avis."],
  ["Qu'est-ce que le GEO (Generative Engine Optimization) ?", "La discipline qui consiste à optimiser sa présence pour les moteurs génératifs. Elle couvre l'accès technique (crawlers, structure), la réputation (avis, cohérence) et le contenu (FAQ, pages de services, fraîcheur)."],
  ["Combien de temps avant de voir des résultats ?", "Les corrections techniques (robots, données structurées, NAP) sont lues dès les prochains passages des robots, souvent en quelques semaines. La réputation se construit en continu; c'est pour cela qu'un suivi quotidien des réponses IA vaut mieux qu'une vérification ponctuelle."],
  ["Comment savoir si une IA me recommande déjà ?", "Posez les questions que vos clients posent, sur chaque assistant, régulièrement. Ou laissez une plateforme le faire chaque jour à votre place : EchoRank suit vos requêtes clés sur les moteurs IA et vous alerte quand vous apparaissez, êtes déformé ou disparaissez."],
  ["Pourquoi ChatGPT ne recommande-t-il pas mon entreprise ?", "Les causes les plus fréquentes : robots des IA bloqués par le robots.txt, informations incohérentes entre vos fiches, avis rares ou anciens, absence de données structurées, pages qui ne répondent pas aux questions réelles. Un audit de visibilité IA les identifie une par une, avec un correctif priorisé pour chacune."],
  ["Les avis Google influencent-ils ChatGPT ?", "Indirectement, mais fortement. Les assistants s'appuient sur des sources qui reflètent votre réputation : fiches, plateformes d'avis, presse, annuaires. Des avis frais, nombreux et répondus renforcent le dossier de preuve que l'IA consulte avant de vous citer; des avis abandonnés l'affaiblissent."],
  ["Comment apparaître dans Google AI Overview ?", "Les prérequis : une indexation Google saine, du contenu qui répond directement aux questions, des données structurées propres, et ne pas bloquer Google-Extended. Personne ne peut garantir un placement dans AI Overview, mais sans ces fondations l'éligibilité même fait défaut."],
  ["ChatGPT utilise-t-il Google ?", "Non. La navigation de ChatGPT repose sur ses propres systèmes et des index partenaires, pas sur Google. Conséquence pratique : une stratégie limitée à Google ne couvre plus le terrain; chaque robot d'IA doit pouvoir lire votre site, et chaque assistant se surveille séparément."],
  ["Qu'est-ce que la visibilité IA ?", "Votre présence mesurable dans les réponses des assistants IA : êtes-vous mentionné, correctement décrit et recommandé quand un client pose la question ? Elle se mesure en citations et en exactitude, pas en positions."],
  ["Quelle est la différence entre SEO et GEO ?", "Le SEO optimise le classement de pages dans une liste de liens; le GEO (Generative Engine Optimization) optimise la probabilité qu'un moteur génératif recommande votre entreprise dans une réponse rédigée. Le premier se joue sur les mots-clés et les backlinks, le second sur la confiance, la cohérence et la réputation."],
];

/* ── page ─────────────────────────────────────────────────────────────── */

export default async function GuideIaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const foot = CONTENT[locale].footer;
  const nav = CONTENT[locale].nav;
  const isFr = locale.startsWith("fr");
  if (!isFr) return <EnGuide locale={locale} foot={foot} />;
  const backLabel = "← Retour";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: TITLE,
        description: DESC,
        inLanguage: "fr",
        dateModified: "2026-07-06",
        author: { "@type": "Organization", name: "EchoRank" },
        publisher: { "@type": "Organization", name: "ChatLogic Insights Ltd" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "EchoRank", item: "https://echorank360.com/fr" },
          { "@type": "ListItem", position: 2, name: TITLE, item: "https://echorank360.com/fr/guide-visibilite-ia" },
        ],
      },
      {
        "@type": "DefinedTermSet",
        name: "Glossaire de la visibilité IA",
        hasDefinedTerm: GLOSSARY.map(([term, def]) => ({
          "@type": "DefinedTerm",
          name: term,
          description: def,
        })),
      },
      {
        "@type": "HowTo",
        name: "Préparer son entreprise à la visibilité IA : la checklist en 10 points",
        step: [
          "Passer le site en HTTPS",
          "Maintenir une fiche Google active avec des avis récents",
          "Ajouter les données structurées Schema.org",
          "Publier une page FAQ répondant aux vraies questions",
          "Autoriser les robots des IA dans le robots.txt",
          "Déclarer un sitemap XML à jour",
          "Obtenir des mentions dans la presse ou des médias locaux",
          "Construire des citations locales cohérentes",
          "Unifier le NAP sur toutes les plateformes",
          "Créer des pages de services distinctes et détaillées",
        ].map((name, i) => ({ "@type": "HowToStep", position: i + 1, name })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  const chapters: [string, string][] = [
    ["seo-vs-ia", "1. Du référencement au GEO : ce qui a changé"],
    ["comment-ia-choisit", "2. Comment ChatGPT choisit une entreprise"],
    ["sources", "3. Les sources que lisent les IA"],
    ["checklist", "4. Votre entreprise est-elle prête pour l'IA ?"],
    ["technique", "5. Optimisation technique : ouvrir la porte aux IA"],
    ["reputation", "6. Réputation et avis : la matière première de la confiance"],
    ["erreurs", "7. Les erreurs qui empêchent l'IA de recommander votre entreprise"],
    ["analyse", "8. Ce que nous avons analysé"],
    ["etudes-de-cas", "9. Études de cas : le parcours d'optimisation"],
    ["secteurs", "10. Guides par secteur d'activité"],
    ["calculateur", "11. Calculateur de revenus potentiellement perdus"],
    ["glossaire", "12. Glossaire de la visibilité IA"],
    ["faq", "13. Questions fréquentes"],
    ["ressources", "14. Ressources à télécharger"],
  ];

  return (
    <div className={s.page}>
      <JsonLd graph={jsonLd["@graph"]} />
      <div className={s.wrap}>
        <header className={s.navbar}>
          <Link href={`/${locale}`} className={s.logoLink} aria-label="EchoRank 360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={s.logo} />
          </Link>
          <nav className={s.navLinks} aria-label="Main">
            <Link href={`/${locale}`} className={s.navLink}>{nav.product}</Link>
            <Link href={`/${locale}#pricing`} className={s.navLink}>{nav.pricing}</Link>
            <Link href={`/${locale}#field`} className={s.navLink}>{nav.customers}</Link>
            <Link href="/login" className={s.navLink}>{nav.login}</Link>
          </nav>
          <div className={s.navRight}>
            <span className={s.switcher}>
              {nav.switcher.map((l) => (
                <Link key={l} href={`/${l}/guide-visibilite-ia`}
                  className={`${s.switchItem} ${l === locale ? s.switchActive : ""}`}>
                  {l.toUpperCase()}
                </Link>
              ))}
            </span>
            <Link href="/register" className={s.btnPrimary}>{nav.cta}</Link>
          </div>
        </header>

        <div className={s.backRow}>
          <BackButton locale={locale} label={backLabel} className={s.backBtnGrey} />
        </div>

        {!isFr && (
          <p className={s.notice}>
            {locale === "de-CH"
              ? "Dieses Referenzhandbuch ist derzeit auf Französisch verfügbar."
              : "This reference guide is currently available in French."}
          </p>
        )}

        <h1 className={s.h1}>{TITLE}</h1>
        <p className={s.subtitle}>{SUBTITLE}</p>
        <p className={s.updated}>Mis à jour le 6 juillet 2026 · EchoRank, plateforme d'intelligence de réputation IA</p>
        <GuideHeroArt label="Une réponse d'IA mettant une recommandation en avant" />

        <nav className={s.toc} aria-label="Sommaire">
          <div className={s.tocTitle}>Sommaire</div>
          {chapters.map(([id, t]) => (<a key={id} href={`#${id}`}>{t}</a>))}
        </nav>

        {/* 1 ─────────────────────────────────────────────────────────── */}
        <h2 id="seo-vs-ia" className={s.h2}>1. Du référencement au GEO : ce qui a changé</h2>
        <p className={s.p}>Pendant vingt ans, être visible voulait dire être classé : dix liens bleus, et une bataille de positions. La recherche assistée par IA remplace la liste par une réponse. ChatGPT, Google AI, Gemini, Claude et Perplexity ne classent pas dix options; ils en recommandent deux ou trois, avec des raisons. Cette bascule fait naître une nouvelle discipline, le GEO (Generative Engine Optimization), aussi appelée référencement IA ou AI Search Optimization : optimiser non pas pour un classement, mais pour une recommandation.</p>
        <p className={s.p}>La différence n'est pas cosmétique. Un moteur classique évalue des pages; un moteur génératif évalue une entreprise. Il croise votre site, vos avis, vos fiches, la presse et les annuaires, puis décide s'il peut vous citer sans se tromper. La visibilité ChatGPT se gagne donc sur un terrain plus large que le SEO : la confiance.</p>
        <CompareTable
          head={["SEO classique (Google)", "Visibilité IA (GEO)"]}
          rows={[
            ["Classement de liens", "Recommandation directe"],
            ["Backlinks", "Confiance et cohérence"],
            ["Mots-clés", "Réputation et avis"],
            ["Taux de clic (CTR)", "Citations par l'IA"],
            ["Position numéro 1", "Être mentionné, ou ne pas exister"],
          ]}
        />
        <Callout>Lorsqu'une IA recommande seulement trois entreprises, être absent de cette liste signifie perdre la totalité des prospects issus de cette recherche. Il n'existe pas de page 2 dans une réponse générée.</Callout>
        <CompareTable
          head={["Google Search", "ChatGPT et assistants IA"]}
          rows={[
            ["Dix liens à comparer soi-même", "Une réponse rédigée, deux ou trois noms"],
            ["L'utilisateur clique et vérifie", "L'utilisateur fait confiance à la synthèse"],
            ["Optimisation page par page", "Évaluation de l'entreprise entière"],
            ["Trafic mesuré en clics", "Valeur mesurée en mentions et citations"],
          ]}
        />
        <SerpToAnswerArt label="De la liste de liens à la réponse unique" />
        <Cta />

        {/* 2 ─────────────────────────────────────────────────────────── */}
        <h2 id="comment-ia-choisit" className={s.h2}>2. Comment ChatGPT choisit une entreprise</h2>
        <p className={s.p}>Un assistant IA ne « préfère » personne. Il assemble une réponse à partir de ce qu'il peut vérifier, et il écarte ce qui est ambigu. Dix familles de signaux reviennent systématiquement dans cette évaluation :</p>
        <ul className={s.ul}>
          <li className={s.li}>Réputation : le volume, la note et la fraîcheur de vos avis, et la manière dont vous y répondez.</li>
          <li className={s.li}>Cohérence des informations : mêmes nom, adresse, téléphone et horaires partout. Une contradiction rend la citation risquée pour l'IA.</li>
          <li className={s.li}>Citations : votre présence dans des annuaires, médias et sources tierces crédibles.</li>
          <li className={s.li}>Avis clients : pas seulement la note, mais le contenu. Les IA lisent le texte des avis pour comprendre ce que vous faites bien.</li>
          <li className={s.li}>Autorité : l'ancienneté, les mentions par des sources reconnues, les licences et certifications vérifiables.</li>
          <li className={s.li}>Qualité du contenu : des pages qui répondent réellement aux questions, écrites pour des humains, exploitables par des machines.</li>
          <li className={s.li}>Fraîcheur : des horaires à jour, des avis récents, un contenu daté. Le signal le plus sous-estimé.</li>
          <li className={s.li}>Données structurées : Schema.org traduit votre activité dans le langage natif des machines.</li>
          <li className={s.li}>Présence multi-plateformes : Google, Facebook, plateformes sectorielles. Chaque source concordante augmente la confiance.</li>
          <li className={s.li}>Signaux de confiance : HTTPS, mentions légales, politique de confidentialité, informations de contact vérifiables.</li>
        </ul>
        <RecoFlowDiagram />
        <Figure file="chatgpt-reco.png" caption="ChatGPT recommandant des entreprises : la réponse remplace la liste de résultats." />
        <Figure file="google-ai-overview.png" caption="Google AI Overview : le résumé génératif capte l'attention avant les liens classiques." />
        <p className={s.p}>Chacun de ces dix signaux se vérifie. C'est exactement ce que fait l'<Link href={`/${locale}/ai-visibility`}>audit de visibilité IA d'EchoRank</Link> : contrôle par contrôle, avec un score et une feuille de route.</p>
        <Cta />

        {/* 3 ─────────────────────────────────────────────────────────── */}
        <h2 id="sources" className={s.h2}>3. Les sources que lisent les IA</h2>
        <p className={s.p}>Avant de vous recommander, un assistant croise plusieurs surfaces publiques. Votre site n'est qu'une pièce du dossier : les avis Google, votre page Facebook, les plateformes comme Trustpilot, la presse et vos données structurées pèsent ensemble dans la réputation que l'IA reconstruit à votre sujet.</p>
        <ReputationFlowDiagram />
        <p className={s.p}>La conséquence pratique : travailler une seule surface ne suffit pas. Une excellente fiche Google avec un site que les robots des IA ne peuvent pas lire, ou un beau site avec des avis abandonnés, produit le même résultat : une recommandation qui va ailleurs.</p>
        <CompareTable
          head={["Citations traditionnelles (annuaires)", "Citations par l'IA"]}
          rows={[
            ["Une inscription statique", "Une mention gagnée à chaque réponse"],
            ["Valeur : un lien et un NAP", "Valeur : la recommandation elle-même"],
            ["Se vérifie une fois", "Se surveille en continu, car elle peut disparaître"],
            ["Portée locale fixe", "Portée : chaque conversation avec un client"],
          ]}
        />
        <p className={s.p}>Une citation IA n'est jamais acquise : elle peut disparaître à la prochaine mise à jour d'un index. C'est la raison d'être de la <Link href={`/${locale}/live-monitoring`}>surveillance en continu</Link>, qui vérifie chaque jour ce que les moteurs répondent réellement.</p>
        <Figure file="perplexity.png" caption="Perplexity cite ses sources en clair : la citabilité se voit à l'oeil nu." />
        <Figure file="gemini.png" caption="Gemini : la recommandation locale s'appuie sur les fiches et les avis." />
        <Callout>Perplexity affiche ses sources au-dessus de chaque réponse. Si vos concurrents y figurent et pas vous, vous savez exactement quelles surfaces travailler en premier.</Callout>
        <Cta />

        {/* 4 ─────────────────────────────────────────────────────────── */}
        <h2 id="checklist" className={s.h2}>4. Votre entreprise est-elle prête pour l'IA ?</h2>
        <p className={s.p}>Cochez ce qui est vrai aujourd'hui, sans indulgence. Chaque élément correspond à une vérification que les systèmes automatisés effectuent réellement.</p>
        <ChecklistArt label="Une liste de vérifications en cours" />
        <Checklist />

        {/* 5 ─────────────────────────────────────────────────────────── */}
        <h2 id="technique" className={s.h2}>5. Optimisation technique : ouvrir la porte aux IA</h2>
        <p className={s.p}>La première cause d'invisibilité est brutale de simplicité : la porte est fermée. Les assistants s'appuient sur des robots d'indexation dédiés, dont GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot et Google-Extended. Un robots.txt trop strict, une règle héritée d'un ancien prestataire ou une protection anti-bots mal réglée peuvent les bloquer sans qu'aucun humain ne s'en aperçoive : votre site reste parfait pour les visiteurs et inexistant pour les IA.</p>
        <CrawlerGateArt label="Des robots d'IA franchissant une porte ouverte" />
        <h3 className={s.h3}>Les fondations, dans l'ordre</h3>
        <ul className={s.ul}>
          <li className={s.li}>Robots.txt : autorisez explicitement les robots des IA, ou au minimum ne les bloquez pas par défaut.</li>
          <li className={s.li}>HTTPS et sitemap XML déclaré : le socle minimal de la confiance technique.</li>
          <li className={s.li}>Schema.org : LocalBusiness (ou le type précis de votre activité), horaires, zone de service, FAQPage sur vos pages de questions.</li>
          <li className={s.li}>Contenu en texte réel : les menus, tarifs et informations en image ou en PDF sont invisibles pour la récupération.</li>
          <li className={s.li}>Pages de services distinctes : une page précise par prestation rapproche vos contenus des questions réelles (recherche sémantique).</li>
          <li className={s.li}>Fraîcheur : horaires exacts, contenus datés, avis récents. Une information périmée coûte plus cher qu'une information absente.</li>
        </ul>
        <Callout>Un blocage de robots dans un fichier robots.txt ne déclenche aucune alerte nulle part. C'est précisément pour cela que l'audit EchoRank vérifie l'accès de chaque robot d'IA, et que la surveillance alerte si un accès bascule du jour au lendemain.</Callout>
        <Cta />

        {/* 6 ─────────────────────────────────────────────────────────── */}
        <h2 id="reputation" className={s.h2}>6. Réputation et avis : la matière première de la confiance</h2>
        <p className={s.p}>Quand une IA doit départager trois entreprises techniquement lisibles, la réputation tranche. Les avis sont la source la plus riche : ils sont datés, rédigés par des tiers, distribués sur plusieurs plateformes, et leur texte décrit concrètement l'expérience. Les assistants les lisent comme un dossier de preuve.</p>
        <ul className={s.ul}>
          <li className={s.li}>La régularité bat le volume : un flux constant d'avis frais pèse plus qu'un pic ancien.</li>
          <li className={s.li}>Les réponses comptent double : elles montrent une entreprise qui écoute, et elles ajoutent votre voix au dossier.</li>
          <li className={s.li}>La cohérence entre plateformes rassure : des notes très divergentes entre Google et une autre plateforme sont un signal d'ambiguïté.</li>
          <li className={s.li}>L'authenticité se vérifie : les rafales d'avis suspects se détectent, et elles détruisent la confiance qu'elles prétendent construire.</li>
        </ul>
        <CompareTable
          head={["Avis (la matière brute)", "Signaux de réputation (ce que lit l'IA)"]}
          rows={[
            ["Une note sur cinq", "Note, volume, fraîcheur et tendance combinés"],
            ["Un texte isolé", "Des thèmes récurrents extraits de tous les textes"],
            ["Une plateforme", "La cohérence entre toutes les plateformes"],
            ["Un événement", "Un historique daté, avec réponses de l'entreprise"],
          ]}
        />
        <ReviewPulseArt label="Le pouls des avis dans le temps" />
        <p className={s.p}>Transformer les avis en signaux exploitables est un travail de lecture continue : c'est ce que fait l'<Link href={`/${locale}/customer-feedback`}>intelligence des retours clients</Link>, et le <Link href={`/${locale}/reputation-risk`}>score de risque de réputation</Link> en fait une mesure unique et explicable.</p>
        <Figure file="dashboard-echorank.png" caption="Le tableau de bord EchoRank : avis, rétroaction et intelligence de réputation au même endroit." />
        <Figure file="score-visibilite.png" caption="Le score de visibilité IA sur 100, avec chaque vérification détaillée." />
        <Figure file="dashboard-reputation.png" caption="Le score de risque de réputation : cinq composantes, chaque facteur nommé." />
        <Figure file="comparaison-concurrents.png" caption="Comparaison concurrentielle : qui gagne du terrain, et à quel rythme." />
        <Cta />

        {/* 7 ─────────────────────────────────────────────────────────── */}
        <h2 id="erreurs" className={s.h2}>7. Les erreurs qui empêchent l'IA de recommander votre entreprise</h2>
        <p className={s.p}>Dans les audits, les mêmes causes d'invisibilité reviennent. Dix erreurs expliquent l'essentiel des absences dans les recommandations. Chacune se corrige.</p>
        <h3 className={s.h3}>1. Peu d'avis récents</h3>
        <p className={s.p}>Un profil dont le dernier avis date de huit mois raconte une entreprise à l'arrêt. Correction : un flux régulier de demandes après chaque prestation, plutôt que des campagnes ponctuelles. La <Link href={`/${locale}/reputation-engine`}>mécanique de campagnes</Link> automatise exactement cela.</p>
        <h3 className={s.h3}>2. Informations incohérentes</h3>
        <p className={s.p}>Deux numéros de téléphone, trois graphies du nom, des horaires contradictoires : pour une IA, citer devient risqué, donc elle s'abstient. Correction : un inventaire de toutes vos fiches, puis un NAP identique partout.</p>
        <h3 className={s.h3}>3. Site lent</h3>
        <p className={s.p}>Les robots des IA travaillent avec des budgets de temps. Un site qui répond en plusieurs secondes est moins exploré, donc moins lu. Correction : mesurer le temps de réponse, compresser, mettre en cache.</p>
        <h3 className={s.h3}>4. Absence de données structurées</h3>
        <p className={s.p}>Sans Schema.org, la machine doit deviner votre activité, vos horaires, votre zone. Correction : LocalBusiness (ou le type précis), plus FAQPage sur vos pages de questions.</p>
        <h3 className={s.h3}>5. Peu de mentions externes</h3>
        <p className={s.p}>Une entreprise que seul son propre site décrit est invérifiable. Correction : annuaires sectoriels, presse locale, chambres de commerce, partenaires. Chaque source concordante rend la citation plus sûre.</p>
        <h3 className={s.h3}>6. Contenu obsolète</h3>
        <p className={s.p}>Des tarifs de l'an dernier ou des horaires de l'ancien local font pire que l'absence : ils font mentir l'IA qui vous cite, et elle apprend à ne plus le faire. Correction : une revue trimestrielle datée des pages clés.</p>
        <h3 className={s.h3}>7. Faible autorité numérique</h3>
        <p className={s.p}>L'autorité au sens IA n'est pas un score de backlinks : c'est la vérifiabilité. Licences affichées, ancienneté documentée, équipe réelle, mentions tierces.</p>
        <CompareTable
          head={["Autorité web (SEO)", "Confiance IA"]}
          rows={[
            ["Backlinks et domaines référents", "Sources concordantes et vérifiables"],
            ["PageRank et jus de lien", "Cohérence des faits entre surfaces"],
            ["Ancres optimisées", "Réputation lisible : avis, réponses, presse"],
            ["Se manipule (et se pénalise)", "Se construit, difficilement falsifiable"],
          ]}
        />
        <h3 className={s.h3}>8. Absence de FAQ</h3>
        <p className={s.p}>Les clients posent des questions; la recherche sémantique rapproche les questions des réponses. Pas de page de réponses, pas de rapprochement. Correction : une FAQ en langage client, balisée FAQPage.</p>
        <h3 className={s.h3}>9. Mauvaise réputation</h3>
        <p className={s.p}>Aucune optimisation technique ne compense des avis négatifs laissés sans réponse. Correction : répondre à tout, vite et bien, et traiter les causes récurrentes en amont, avant l'avis public.</p>
        <h3 className={s.h3}>10. Aucun suivi de visibilité IA</h3>
        <p className={s.p}>La plus coûteuse : ne pas savoir. Sans mesure, une disparition des recommandations passe inaperçue pendant des mois. Correction : poser chaque jour les questions de vos clients aux moteurs IA, et être alerté au changement. C'est précisément le <Link href={`/${locale}/act-on-signals`}>passage du signal à l'action</Link>.</p>
        <Cta />

        <h2 id="analyse" className={s.h2}>8. Ce que nous avons analysé</h2>
        <p className={s.p}>EchoRank exécute des audits de visibilité IA sur des sites d'entreprises de services, de commerces et de cliniques. Chaque audit vérifie les mêmes familles de critères : accès des robots d'IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), fondations techniques (HTTPS, sitemap, temps de réponse), lisibilité machine (données structurées, sémantique des pages), signaux de confiance (mentions légales, coordonnées vérifiables, cohérence NAP) et surface de réputation (fiche Google, fraîcheur des avis). Le résultat est un score sur 100 et une note, reproductibles d'un audit à l'autre.</p>
        <p className={s.p}>Notre méthodologie de suivi complète l'instantané : les requêtes clés d'une entreprise sont posées chaque jour aux moteurs IA, et chaque réponse est archivée. C'est cette série temporelle, et non une capture unique, qui permet d'affirmer qu'une entreprise est apparue, a été déformée ou a disparu des recommandations, et de dater le changement.</p>
        <h3 className={s.h3}>Le cadre EchoRank : cinq composantes, des pondérations publiées</h3>
        <p className={s.p}>Notre score de risque de réputation n'est pas une boîte noire, et nous publions sa structure. Cinq composantes pondérées, dont les poids de la version actuelle du modèle sont les suivants :</p>
        <CompareTable
          head={["Composante", "Poids"]}
          rows={[
            ["Pression négative (avis et retours défavorables, pondérés par récence)", "0,40"],
            ["Vélocité des avis (rythme comparé à votre propre historique)", "0,25"],
            ["Signaux critiques récents (incidents à sévérité élevée)", "0,15"],
            ["Visibilité IA (accès des robots, lisibilité, présence dans les réponses)", "0,15"],
            ["Stagnation (absence prolongée de signaux frais)", "0,05"],
          ]}
        />
        <p className={s.p}>Chaque composante est calculée à partir de signaux datés, avec une demi-vie de quatorze jours : un incident d'hier pèse plus qu'un incident du mois dernier. Le score est recalculé chaque heure, et chaque facteur qui le fait bouger est nommé. Publier ces pondérations est un choix : un score que l'on peut expliquer est un score que l'on peut contester, améliorer et citer.</p>
        <h3 className={s.h3}>Les familles de contrôles de l'audit de visibilité</h3>
        <p className={s.p}>L'audit examine cinq familles : accès des robots d'IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), fondations techniques (HTTPS, sitemap, temps de réponse), lisibilité machine (données structurées, sémantique), signaux de confiance (mentions légales, coordonnées vérifiables, cohérence NAP) et surface de réputation (fiche, fraîcheur des avis). Chaque contrôle est binaire ou gradué, ce qui rend le score sur 100 reproductible d'un audit à l'autre.</p>
        <p className={s.p}>[À COMPLÉTER : synthèse chiffrée de vos audits réels, par exemple la part de sites audités bloquant au moins un robot d'IA, le score moyen par secteur, ou un cas client anonymisé avant et après correctifs. Publier ici des chiffres issus de vos propres données rendra cette section citée; publier des chiffres inventés la rendra radioactive.]</p>
        <Cta label="Contribuer une donnée : auditez votre site →" />

        <h2 id="etudes-de-cas" className={s.h2}>9. Études de cas : le parcours d'optimisation</h2>
        <p className={s.p}>Le chemin est toujours le même : Avant, Audit, Corrections, Résultats. Voici le cadre, illustré par un scénario composite. Aucun client n'est nommé et aucun chiffre n'est inventé; les emplacements marqués attendent des données vérifiées.</p>
        <div className={s.vertical}>
          <h3 className={s.h3} style={{ marginTop: 0 }}>Scénario composite : entreprise de services locale</h3>
          <p className={s.p}><strong>Avant :</strong> une clientèle fidèle, une fiche Google correcte, mais aucune mention dans les réponses des assistants IA. Les demandes de soumission arrivent surtout par bouche-à-oreille.</p>
          <p className={s.p}><strong>Audit :</strong> robots des IA bloqués par une règle héritée du robots.txt, aucune donnée structurée, avis anciens sans réponse, horaires divergents entre deux annuaires.</p>
          <p className={s.p}><strong>Corrections :</strong> ouverture explicite aux robots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), Schema LocalBusiness et FAQPage, campagne d'avis relancée après chaque intervention, NAP unifié, réponses systématiques aux avis.</p>
          <p className={s.p}><strong>Résultats :</strong> [À COMPLÉTER : évolution du score de visibilité, première apparition datée dans une réponse IA, variation de la vélocité d'avis, sur données réelles du tableau de bord.]</p>
        </div>
        <TrendGrid />
        <p className={s.p} style={{ fontSize: 12, color: "rgba(17,17,17,.5)" }}>Tendances attendues du cadre d'optimisation, à titre d'illustration. Les courbes réelles proviennent du suivi quotidien de chaque compte.</p>
        <Cta />

        {/* 8 ─────────────────────────────────────────────────────────── */}
        <h2 id="secteurs" className={s.h2}>10. Guides par secteur d'activité</h2>
        <p className={s.p}>Les IA ne recommandent pas un dentiste comme elles recommandent un restaurant. Chaque secteur a ses questions types, ses signaux de confiance et ses pièges de visibilité.</p>
        {VERTICALS.map((v) => (
          <div key={v.name} className={s.vertical}>
            <h3 className={s.h3} style={{ marginTop: 0 }}>{v.name}</h3>
            <p className={s.p}><strong>Comment les clients demandent :</strong> {v.ask}</p>
            <p className={s.p}><strong>Signaux de confiance du secteur :</strong> {v.signals}</p>
            <p className={s.p}><strong>Problèmes de visibilité fréquents :</strong> {v.problems}</p>
            <p className={s.p}><strong>Étapes d'optimisation :</strong> {v.steps}</p>
          </div>
        ))}
        <Cta />

        {/* 9 ─────────────────────────────────────────────────────────── */}
        <h2 id="calculateur" className={s.h2}>11. Calculateur de revenus potentiellement perdus</h2>
        <p className={s.p}>Combien coûte l'invisibilité ? Quatre entrées suffisent pour un ordre de grandeur honnête.</p>
        <RevenueCalculator />

        <h2 id="glossaire" className={s.h2}>12. Glossaire de la visibilité IA</h2>
        {GLOSSARY.map(([term, def]) => (
          <div key={term}>
            <div className={s.glossTerm}>{term}</div>
            <p className={s.glossDef}>{def}</p>
          </div>
        ))}

        {/* 10 ────────────────────────────────────────────────────────── */}
        <h2 id="faq" className={s.h2}>13. Questions fréquentes</h2>
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <h3 className={s.h3}>{q}</h3>
            <p className={s.p}>{a}</p>
          </div>
        ))}
        <Cta />

        <h2 id="ressources" className={s.h2}>14. Ressources à télécharger</h2>
        <p className={s.p}>Des outils concrets, sans formulaire. Le premier est disponible dès maintenant; d'autres suivront au rythme de nos analyses.</p>
        <div className={s.ctaBand}>
          <span className={s.ctaText}>
            <b>Checklist Visibilité IA (PDF)</b>
            <span>Les 10 critères de préparation, prêts à imprimer et à cocher en équipe.</span>
          </span>
          <a href="/guide/checklist-visibilite-ia.pdf" download className={s.ctaBtn}>Télécharger le PDF →</a>
        </div>

        <h2 className={s.h2}>À propos de cette ressource</h2>
        <p className={s.p}>Ce guide est rédigé et maintenu par EchoRank, plateforme d'intelligence de réputation IA exploitée par ChatLogic Insights Ltd. Il documente une méthodologie en production : les pondérations, cadences et contrôles décrits sont ceux du système réel, mis à jour au fil des versions. Signalements et corrections : privacy@echorank360.com.</p>
        <h3 className={s.h3}>Comment citer ce guide</h3>
        <p className={s.p} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>EchoRank (2026). Le guide complet de la visibilité dans l'IA en 2026. ChatLogic Insights Ltd. https://echorank360.com/fr/guide-visibilite-ia</p>

        <div className={s.backRow}>
          <BackButton locale={locale} label={backLabel} className={s.backBtnGrey} />
        </div>

        <footer className={s.footer}>
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
// EOF-guide-ia
