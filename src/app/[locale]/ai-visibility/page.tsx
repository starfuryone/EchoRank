// app/[locale]/ai-visibility/page.tsx — AI Visibility landing + free audit widget

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from '@/lib/i18n/config';
import { CONTENT } from '@/lib/i18n/content';
import { AuditWidget, type AuditWidgetContent } from '@/components/AuditWidget';
import { KeywordWidget, type KeywordWidgetContent } from '@/components/KeywordWidget';
import { JsonLd, SITE_URL, buildMetadata, faqPage, normalizeLocale, organization, webSite } from "@/lib/seo";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://echorank360.com';

// Brand/product terms kept verbatim across locales: Echorank360, Trust Score,
// the engine names (ChatGPT/Claude/Gemini/Perplexity), the plan names
// (Growth/Agency), the mock-answer example brands (LedgerKit/Countable), and
// the price token "$29". Prices are not currency-switched (task scope).

interface AvContent {
  // `title` is the branded form for og/twitter; `titleShort` is bare and the
  // root layout's "%s | Echorank360" template appends the brand to it.
  meta: { title: string; titleShort: string; description: string };
  nav: { features: string; pricing: string; login: string; cta: string };
  hero: {
    eyebrow: string;
    h1a: string;
    h1b: string;
    sub: string;
    engines: string; // prefix before "ChatGPT · Claude · Gemini · Perplexity"
    answerAria: string;
  };
  answer: {
    q: string;
    l1: string;
    l2desc: string;
    youBrand: string;
    youDesc: string;
    pos: string;
    l4desc: string;
    alert: string;
  };
  band1: { h2: string; p: string };
  features: { h2: string; items: { h3: string; p: string }[] };
  prompts: { h2: string; list: string[]; more: string };
  pricing: {
    eyebrow: string;
    perMonth: string;
    features: string[];
    cta: string;
    finePre: string;
    fineLink: string;
    currency: string;
  };
  faq: { h2: string; items: { q: string; a: string }[] };
  final: { h2: string; cta: string };
  widget: AuditWidgetContent;
  kw: { h2: string; p: string; widget: KeywordWidgetContent };
}

const C: Record<Locale, AvContent> = {
  en: {
    meta: {
      title: 'AI Visibility — Echorank360',
      titleShort: 'AI Visibility',
      description:
        'Track whether ChatGPT, Claude, Gemini and Perplexity recommend your business. Prompt tracking, lost-recommendation alerts and an AI Trust Score for $29/month.',
    },
    nav: { features: 'Features', pricing: 'Pricing', login: 'Login', cta: 'Start tracking' },
    hero: {
      eyebrow: 'AI Visibility · $29/mo',
      h1a: 'When someone asks ChatGPT for a recommendation,',
      h1b: ' are you in the answer?',
      sub: 'Millions of buying decisions now start as a prompt, not a search. Echorank360 tracks the prompts that matter to your business, alerts you the moment an AI stops recommending you, and scores your standing across the major assistants.',
      engines: 'Tracks answers from',
      answerAria: 'Example of a tracked AI answer',
    },
    answer: {
      q: 'best accounting software for freelancers',
      l1: 'Here are the tools freelancers rate highest:',
      l2desc: 'strong invoicing',
      youBrand: 'Your brand',
      youDesc: 'best value for solo work',
      pos: '↑ #2 this week',
      l4desc: 'good bank sync',
      alert: '⚠ Dropped from Gemini answers — Jul 9',
    },
    band1: {
      h2: 'The new search results have no page two',
      p: 'An AI answer names three or four businesses. Everyone else is invisible — and nothing tells you when you fall out. Rankings you could watch in Google happen silently inside models. AI Visibility makes that layer observable.',
    },
    features: {
      h2: 'What $29 a month watches for you',
      items: [
        { h3: 'Answer tracking', p: 'We run your tracked prompts against the major assistants every week and record exactly how each one answers — who gets named, in what order, and with what reasoning.' },
        { h3: 'Prompt trends', p: 'A sparkline per prompt shows your mention rate over time, so a slow slide is visible weeks before it costs you customers.' },
        { h3: 'Lost-recommendation alerts', p: 'The moment you drop out of an answer you used to appear in, you get an email digest naming the prompt, the assistant, and who replaced you.' },
        { h3: 'AI Trust Score', p: 'One number, refreshed on schedule, summarizing how consistently AIs recommend you across your prompt set. Watch it respond as you improve your presence.' },
      ],
    },
    prompts: {
      h2: 'Track the prompts your customers actually type',
      list: [
        'best CRM for small agencies',
        'accounting software freelancers actually use',
        'top AI visibility tools 2026',
      ],
      more: '…up to 25 prompts of your own',
    },
    pricing: {
      eyebrow: 'AI Visibility',
      perMonth: '/month',
      features: [
        '1 brand',
        '25 tracked prompts',
        'Weekly answer refresh',
        'Lost-recommendation alerts',
        'AI Trust Score',
        'ChatGPT, Claude, Gemini & Perplexity coverage',
      ],
      cta: 'Start tracking — $29/mo',
      finePre: 'Cancel anytime. Need more brands, seats or nightly refresh? ',
      fineLink: 'Compare plans',
      currency: 'All prices are in US dollars (USD). If you pay with a card in another currency, your bank converts the charge at its own exchange rate.',
    },
    faq: {
      h2: 'Questions',
      items: [
        { q: 'Which AI assistants do you track?', a: 'ChatGPT, Claude, Gemini and Perplexity. Coverage expands as new assistants gain real usage.' },
        { q: 'How often are answers refreshed?', a: 'Weekly on this plan. Higher plans refresh nightly.' },
        { q: 'Can I change my tracked prompts?', a: 'Yes — edit your prompt set anytime. Changes apply from the next refresh.' },
        { q: 'Does this include review management?', a: 'No. AI Visibility is the tracking layer only. Review and reputation tools are on Growth and Agency plans.' },
      ],
    },
    final: {
      h2: 'Find out what the AIs say about you',
      cta: 'Start tracking — $29/mo',
    },
    widget: {
      label: 'Run a free basic audit',
      placeholder: 'Your brand or domain, e.g. acme.com',
      runIdle: 'Run free audit',
      runBusy: 'Auditing…',
      noteTemplate: 'Asking the AIs about “{brand}” — takes ~20 seconds.',
      errLimit: 'Free audit limit reached for today. Sign up to run unlimited audits.',
      errGeneric: 'The audit could not run. Try again in a minute.',
      fine: 'No account needed. One audit per day.',
      resultAppearedIn: 'appeared in',
      resultOfPrompts: 'of test prompts',
      trustScore: 'Trust Score',
      upsell: 'This was 3 generic prompts, one engine pass. The full plan tracks 25 prompts of your choosing, weekly, with alerts when you drop out.',
      ctaTemplate: 'Track {brand} — $29/mo',
      again: 'Run another audit',
      pdfIdle: 'Download PDF report',
      pdfBusy: 'Generating…',
      pdfErr: 'The report could not be generated.',
      pdfRetry: 'Try again',
    },
    kw: {
      h2: 'What keywords should your site own?',
      p: 'Free scan: we read your homepage and extract the keywords, question searches and AI prompts it should be winning — no account needed.',
      widget: {
        label: 'Run a free keyword scan',
        placeholder: 'yourdomain.com',
        runIdle: 'Scan keywords',
        runBusy: 'Scanning…',
        note: 'Reading your page and extracting keywords — takes a few seconds.',
        errLimit: 'Free scan limit reached (2 per day). Sign up for unlimited scans.',
        errGeneric: 'The scan could not run. Check the URL and try again in a minute.',
        fine: 'No account needed. 2 scans per day.',
        seedsTitle: 'Seed keywords',
        questionsTitle: 'Question keywords',
        promptsTitle: 'AI prompts you should be recommended in',
        techTitle: 'Technical SEO',
        techSummaryTemplate:
          '{pass} checks passed · {warn} warnings · {fail} failed — full details on the full plan.',
        diffLow: 'easy',
        diffMedium: 'medium',
        diffHigh: 'hard',
        lockedTemplate: '+{n} more on the full plan',
        upsell:
          'This scan read your homepage only, heuristics only. The full plan scans up to 5 pages, adds AI-suggested keywords and title/meta rewrites, and tracks whether AIs actually recommend you.',
        cta: 'Unlock full keyword insights — $29/mo',
        again: 'Scan another site',
      },
    },
  },

  'en-CA': null as unknown as AvContent,

  fr: {
    meta: {
      title: 'Visibilité IA — Echorank360',
      titleShort: 'Visibilité IA',
      description:
        'Suivez si ChatGPT, Claude, Gemini et Perplexity recommandent votre entreprise. Suivi des requêtes, alertes de perte de recommandation et un AI Trust Score pour $29/mois.',
    },
    nav: { features: 'Fonctionnalités', pricing: 'Tarifs', login: 'Connexion', cta: 'Commencer le suivi' },
    hero: {
      eyebrow: 'Visibilité IA · $29/mo',
      h1a: 'Quand quelqu’un demande une recommandation à ChatGPT,',
      h1b: ' êtes-vous dans la réponse ?',
      sub: 'Des millions de décisions d’achat commencent désormais par une requête, pas une recherche. Echorank360 suit les requêtes qui comptent pour votre entreprise, vous alerte dès qu’une IA cesse de vous recommander, et évalue votre position auprès des principaux assistants.',
      engines: 'Suit les réponses de',
      answerAria: 'Exemple de réponse d’IA suivie',
    },
    answer: {
      q: 'meilleur logiciel de comptabilité pour indépendants',
      l1: 'Voici les outils les mieux notés par les indépendants :',
      l2desc: 'facturation solide',
      youBrand: 'Votre marque',
      youDesc: 'meilleur rapport qualité-prix en solo',
      pos: '↑ n°2 cette semaine',
      l4desc: 'bonne synchro bancaire',
      alert: '⚠ Sorti des réponses Gemini — 9 juil.',
    },
    band1: {
      h2: 'Les nouveaux résultats de recherche n’ont pas de page deux',
      p: 'Une réponse d’IA nomme trois ou quatre entreprises. Toutes les autres sont invisibles — et rien ne vous avertit quand vous en sortez. Les classements que vous pouviez suivre dans Google se jouent en silence à l’intérieur des modèles. La Visibilité IA rend cette couche observable.',
    },
    features: {
      h2: 'Ce que $29 par mois surveille pour vous',
      items: [
        { h3: 'Suivi des réponses', p: 'Nous exécutons vos requêtes suivies contre les principaux assistants chaque semaine et enregistrons exactement comment chacun répond — qui est nommé, dans quel ordre et avec quel raisonnement.' },
        { h3: 'Tendances des requêtes', p: 'Une courbe par requête montre votre taux de mention dans le temps, de sorte qu’un lent déclin est visible des semaines avant qu’il ne vous coûte des clients.' },
        { h3: 'Alertes de perte de recommandation', p: 'Dès que vous disparaissez d’une réponse où vous figuriez, vous recevez un résumé par e-mail nommant la requête, l’assistant et qui vous a remplacé.' },
        { h3: 'AI Trust Score', p: 'Un seul chiffre, actualisé selon un calendrier, résumant la constance avec laquelle les IA vous recommandent sur l’ensemble de vos requêtes. Regardez-le réagir à mesure que vous améliorez votre présence.' },
      ],
    },
    prompts: {
      h2: 'Suivez les requêtes que vos clients tapent vraiment',
      list: [
        'meilleur CRM pour petites agences',
        'logiciel de comptabilité que les indépendants utilisent vraiment',
        'meilleurs outils de visibilité IA 2026',
      ],
      more: '…jusqu’à 25 requêtes bien à vous',
    },
    pricing: {
      eyebrow: 'Visibilité IA',
      perMonth: '/mois',
      features: [
        '1 marque',
        '25 requêtes suivies',
        'Actualisation hebdomadaire des réponses',
        'Alertes de perte de recommandation',
        'AI Trust Score',
        'Couverture ChatGPT, Claude, Gemini et Perplexity',
      ],
      cta: 'Commencer le suivi — $29/mo',
      finePre: 'Annulable à tout moment. Besoin de plus de marques, de sièges ou d’une actualisation nocturne ? ',
      fineLink: 'Comparer les forfaits',
      currency: 'Tous les prix sont en dollars américains (USD). Si vous payez avec une carte dans une autre devise, votre banque effectue la conversion à son propre taux de change.',
    },
    faq: {
      h2: 'Questions',
      items: [
        { q: 'Quels assistants IA suivez-vous ?', a: 'ChatGPT, Claude, Gemini et Perplexity. La couverture s’étend à mesure que de nouveaux assistants gagnent en usage réel.' },
        { q: 'À quelle fréquence les réponses sont-elles actualisées ?', a: 'Chaque semaine sur ce forfait. Les forfaits supérieurs s’actualisent chaque nuit.' },
        { q: 'Puis-je modifier mes requêtes suivies ?', a: 'Oui — modifiez votre jeu de requêtes à tout moment. Les changements s’appliquent dès l’actualisation suivante.' },
        { q: 'Cela inclut-il la gestion des avis ?', a: 'Non. La Visibilité IA n’est que la couche de suivi. Les outils d’avis et de réputation sont sur les forfaits Growth et Agency.' },
      ],
    },
    final: {
      h2: 'Découvrez ce que les IA disent de vous',
      cta: 'Commencer le suivi — $29/mo',
    },
    widget: {
      label: 'Lancez un audit de base gratuit',
      placeholder: 'Votre marque ou domaine, p. ex. acme.com',
      runIdle: 'Lancer l’audit gratuit',
      runBusy: 'Audit en cours…',
      noteTemplate: 'Interrogation des IA sur « {brand} » — environ 20 secondes.',
      errLimit: 'Limite d’audit gratuit atteinte pour aujourd’hui. Inscrivez-vous pour des audits illimités.',
      errGeneric: 'L’audit n’a pas pu s’exécuter. Réessayez dans une minute.',
      fine: 'Aucun compte requis. Un audit par jour.',
      resultAppearedIn: 'est apparu dans',
      resultOfPrompts: 'des requêtes testées',
      trustScore: 'Trust Score',
      upsell: 'Il s’agissait de 3 requêtes génériques, un seul passage moteur. Le forfait complet suit 25 requêtes de votre choix, chaque semaine, avec des alertes quand vous décrochez.',
      ctaTemplate: 'Suivre {brand} — $29/mo',
      again: 'Lancer un autre audit',
      pdfIdle: 'Télécharger le rapport PDF',
      pdfBusy: 'Génération…',
      pdfErr: 'Le rapport n’a pas pu être généré.',
      pdfRetry: 'Réessayer',
    },
    kw: {
      h2: 'Quels mots-clés votre site devrait-il dominer ?',
      p: 'Analyse gratuite : nous lisons votre page d’accueil et en extrayons les mots-clés, les recherches en question et les requêtes IA que vous devriez gagner — aucun compte requis.',
      widget: {
        label: 'Lancez une analyse de mots-clés gratuite',
        placeholder: 'votredomaine.com',
        runIdle: 'Analyser les mots-clés',
        runBusy: 'Analyse en cours…',
        note: 'Lecture de votre page et extraction des mots-clés — quelques secondes.',
        errLimit: 'Limite d’analyses gratuites atteinte (2 par jour). Inscrivez-vous pour des analyses illimitées.',
        errGeneric: 'L’analyse n’a pas pu s’exécuter. Vérifiez l’URL et réessayez dans une minute.',
        fine: 'Aucun compte requis. 2 analyses par jour.',
        seedsTitle: 'Mots-clés de base',
        questionsTitle: 'Mots-clés en question',
        promptsTitle: 'Requêtes IA où vous devriez être recommandé',
        techTitle: 'SEO technique',
        techSummaryTemplate:
          '{pass} vérifications réussies · {warn} avertissements · {fail} échecs — détails complets avec le forfait complet.',
        diffLow: 'facile',
        diffMedium: 'moyen',
        diffHigh: 'difficile',
        lockedTemplate: '+{n} de plus avec le forfait complet',
        upsell:
          'Cette analyse n’a lu que votre page d’accueil, heuristiques seulement. Le forfait complet analyse jusqu’à 5 pages, ajoute des mots-clés suggérés par IA et des réécritures de titre/méta, et suit si les IA vous recommandent vraiment.',
        cta: 'Débloquer l’analyse complète — $29/mo',
        again: 'Analyser un autre site',
      },
    },
  },

  'fr-CA': null as unknown as AvContent,

  'de-CH': {
    meta: {
      title: 'KI-Sichtbarkeit — Echorank360',
      titleShort: 'KI-Sichtbarkeit',
      description:
        'Verfolgen Sie, ob ChatGPT, Claude, Gemini und Perplexity Ihr Unternehmen empfehlen. Prompt-Tracking, Benachrichtigungen bei verlorenen Empfehlungen und ein AI Trust Score für $29/Monat.',
    },
    nav: { features: 'Funktionen', pricing: 'Preise', login: 'Anmelden', cta: 'Jetzt starten' },
    hero: {
      eyebrow: 'KI-Sichtbarkeit · $29/mo',
      h1a: 'Wenn jemand ChatGPT um eine Empfehlung bittet,',
      h1b: ' sind Sie in der Antwort?',
      sub: 'Millionen von Kaufentscheidungen beginnen heute als Prompt, nicht als Suche. Echorank360 verfolgt die Prompts, die für Ihr Unternehmen zählen, benachrichtigt Sie in dem Moment, in dem eine KI Sie nicht mehr empfiehlt, und bewertet Ihre Stellung bei den grossen Assistenten.',
      engines: 'Verfolgt Antworten von',
      answerAria: 'Beispiel einer verfolgten KI-Antwort',
    },
    answer: {
      q: 'beste Buchhaltungssoftware für Freelancer',
      l1: 'Hier sind die von Freelancern am höchsten bewerteten Tools:',
      l2desc: 'starke Rechnungsstellung',
      youBrand: 'Ihre Marke',
      youDesc: 'bestes Preis-Leistungs-Verhältnis für Solo-Arbeit',
      pos: '↑ Nr. 2 diese Woche',
      l4desc: 'gute Banksynchronisierung',
      alert: '⚠ Aus Gemini-Antworten gefallen — 9. Juli',
    },
    band1: {
      h2: 'Die neuen Suchergebnisse haben keine zweite Seite',
      p: 'Eine KI-Antwort nennt drei oder vier Unternehmen. Alle anderen sind unsichtbar — und nichts sagt Ihnen, wann Sie herausfallen. Rankings, die Sie in Google beobachten konnten, geschehen still in den Modellen. KI-Sichtbarkeit macht diese Ebene sichtbar.',
    },
    features: {
      h2: 'Was $29 im Monat für Sie beobachtet',
      items: [
        { h3: 'Antwort-Tracking', p: 'Wir führen Ihre verfolgten Prompts wöchentlich gegen die grossen Assistenten aus und erfassen genau, wie jeder antwortet — wer genannt wird, in welcher Reihenfolge und mit welcher Begründung.' },
        { h3: 'Prompt-Trends', p: 'Eine Sparkline pro Prompt zeigt Ihre Nennungsrate über die Zeit, sodass ein langsamer Rückgang Wochen sichtbar wird, bevor er Sie Kunden kostet.' },
        { h3: 'Benachrichtigungen bei verlorenen Empfehlungen', p: 'Sobald Sie aus einer Antwort fallen, in der Sie zuvor erschienen, erhalten Sie eine E-Mail-Zusammenfassung mit Prompt, Assistent und wer Sie ersetzt hat.' },
        { h3: 'AI Trust Score', p: 'Eine Zahl, planmässig aktualisiert, die zusammenfasst, wie konstant KIs Sie über Ihr Prompt-Set empfehlen. Beobachten Sie, wie sie reagiert, während Sie Ihre Präsenz verbessern.' },
      ],
    },
    prompts: {
      h2: 'Verfolgen Sie die Prompts, die Ihre Kunden wirklich eingeben',
      list: [
        'bestes CRM für kleine Agenturen',
        'Buchhaltungssoftware, die Freelancer wirklich nutzen',
        'beste KI-Sichtbarkeits-Tools 2026',
      ],
      more: '…bis zu 25 eigene Prompts',
    },
    pricing: {
      eyebrow: 'KI-Sichtbarkeit',
      perMonth: '/Monat',
      features: [
        '1 Marke',
        '25 verfolgte Prompts',
        'Wöchentliche Antwort-Aktualisierung',
        'Benachrichtigungen bei verlorenen Empfehlungen',
        'AI Trust Score',
        'Abdeckung von ChatGPT, Claude, Gemini und Perplexity',
      ],
      cta: 'Jetzt starten — $29/mo',
      finePre: 'Jederzeit kündbar. Mehr Marken, Sitze oder nächtliche Aktualisierung nötig? ',
      fineLink: 'Pläne vergleichen',
      currency: 'Alle Preise in US-Dollar (USD). Bei Zahlung mit einer Karte in einer anderen Währung rechnet Ihre Bank den Betrag zu ihrem eigenen Wechselkurs um.',
    },
    faq: {
      h2: 'Fragen',
      items: [
        { q: 'Welche KI-Assistenten verfolgen Sie?', a: 'ChatGPT, Claude, Gemini und Perplexity. Die Abdeckung wächst, sobald neue Assistenten echte Nutzung gewinnen.' },
        { q: 'Wie oft werden Antworten aktualisiert?', a: 'Wöchentlich in diesem Plan. Höhere Pläne aktualisieren nächtlich.' },
        { q: 'Kann ich meine verfolgten Prompts ändern?', a: 'Ja — bearbeiten Sie Ihr Prompt-Set jederzeit. Änderungen gelten ab der nächsten Aktualisierung.' },
        { q: 'Ist die Bewertungsverwaltung enthalten?', a: 'Nein. KI-Sichtbarkeit ist nur die Tracking-Ebene. Bewertungs- und Reputations-Tools gibt es in den Plänen Growth und Agency.' },
      ],
    },
    final: {
      h2: 'Finden Sie heraus, was die KIs über Sie sagen',
      cta: 'Jetzt starten — $29/mo',
    },
    widget: {
      label: 'Kostenlosen Basis-Audit starten',
      placeholder: 'Ihre Marke oder Domain, z. B. acme.com',
      runIdle: 'Gratis-Audit starten',
      runBusy: 'Audit läuft…',
      noteTemplate: 'Die KIs werden zu «{brand}» befragt — etwa 20 Sekunden.',
      errLimit: 'Gratis-Audit-Limit für heute erreicht. Registrieren Sie sich für unbegrenzte Audits.',
      errGeneric: 'Der Audit konnte nicht ausgeführt werden. Versuchen Sie es in einer Minute erneut.',
      fine: 'Kein Konto nötig. Ein Audit pro Tag.',
      resultAppearedIn: 'erschien in',
      resultOfPrompts: 'der Testfragen',
      trustScore: 'Trust Score',
      upsell: 'Das waren 3 generische Prompts, ein Engine-Durchlauf. Der volle Plan verfolgt 25 Prompts Ihrer Wahl, wöchentlich, mit Benachrichtigungen, wenn Sie herausfallen.',
      ctaTemplate: '{brand} verfolgen — $29/mo',
      again: 'Weiteren Audit starten',
      pdfIdle: 'PDF-Bericht herunterladen',
      pdfBusy: 'Wird erstellt…',
      pdfErr: 'Der Bericht konnte nicht erstellt werden.',
      pdfRetry: 'Erneut versuchen',
    },
    kw: {
      h2: 'Welche Keywords sollte Ihre Website besitzen?',
      p: 'Gratis-Scan: Wir lesen Ihre Startseite und extrahieren die Keywords, Fragesuchen und KI-Prompts, die Sie gewinnen sollten — kein Konto nötig.',
      widget: {
        label: 'Kostenlosen Keyword-Scan starten',
        placeholder: 'ihredomain.com',
        runIdle: 'Keywords scannen',
        runBusy: 'Scan läuft…',
        note: 'Ihre Seite wird gelesen und Keywords werden extrahiert — dauert wenige Sekunden.',
        errLimit: 'Gratis-Scan-Limit erreicht (2 pro Tag). Registrieren Sie sich für unbegrenzte Scans.',
        errGeneric: 'Der Scan konnte nicht ausgeführt werden. Prüfen Sie die URL und versuchen Sie es in einer Minute erneut.',
        fine: 'Kein Konto nötig. 2 Scans pro Tag.',
        seedsTitle: 'Basis-Keywords',
        questionsTitle: 'Frage-Keywords',
        promptsTitle: 'KI-Prompts, in denen Sie empfohlen werden sollten',
        techTitle: 'Technisches SEO',
        techSummaryTemplate:
          '{pass} Prüfungen bestanden · {warn} Warnungen · {fail} fehlgeschlagen — alle Details im vollen Plan.',
        diffLow: 'leicht',
        diffMedium: 'mittel',
        diffHigh: 'schwer',
        lockedTemplate: '+{n} weitere im vollen Plan',
        upsell:
          'Dieser Scan hat nur Ihre Startseite gelesen, nur Heuristiken. Der volle Plan scannt bis zu 5 Seiten, ergänzt KI-vorgeschlagene Keywords sowie Titel-/Meta-Vorschläge und verfolgt, ob KIs Sie wirklich empfehlen.',
        cta: 'Volle Keyword-Analyse freischalten — $29/mo',
        again: 'Weitere Website scannen',
      },
    },
  },
};

// en-CA shares en; fr-CA shares fr (task permits — prices stay USD, no strong
// québécois divergence needed for this page).
C['en-CA'] = C.en;
C['fr-CA'] = C.fr;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

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
    path: "/ai-visibility",
    title: meta.titleShort,
    description: meta.description,
  });
}

export default async function AIVisibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const c = C[locale];
  // de-CH highlights neither side of the EN/FR toggle — it is a third locale,
  // not a variant of either.
  const base = locale.startsWith('fr') ? 'fr' : locale.startsWith('en') ? 'en' : null;
  // Footer reuses the shared catalog (same mechanism as the other localized
  // public pages) — translated labels + the exact homepage copyright.
  const foot = CONTENT[locale].footer;

  const l = normalizeLocale(locale);

  return (
    <main className="av">
      {/* FAQPage built from c.faq.items — the same array rendered below. */}
      <JsonLd
        graph={[
          organization(l),
          webSite(l),
          faqPage(c.faq.items, `${SITE_URL}/${l}/ai-visibility`),
        ]}
      />
      <header className="av-header">
        <a href="/" aria-label="Echorank home" className="av-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/echorank-logo-light.svg" alt="Echorank" width={180} height={34} />
        </a>
        <nav className="av-nav" aria-label="Primary">
          <a href="#how">{c.nav.features}</a>
          <a href="#pricing">{c.nav.pricing}</a>
          <a href="/login">{c.nav.login}</a>
          <span className="av-toggle">
            <a className={base === 'en' ? 'av-toggle-on' : undefined} href="/en/ai-visibility">EN</a>
            <span aria-hidden="true">/</span>
            <a className={base === 'fr' ? 'av-toggle-on' : undefined} href="/fr/ai-visibility">FR</a>
          </span>
          <a href="/register?plan=ai_visibility" className="av-btn av-btn-gold av-nav-cta">
            {c.nav.cta}
          </a>
        </nav>
      </header>
      <section className="av-hero">
        <div className="av-hero-copy">
          <p className="av-eyebrow">{c.hero.eyebrow}</p>
          <h1>
            {c.hero.h1a}
            <span className="av-gold">{c.hero.h1b}</span>
          </h1>
          <p className="av-sub">{c.hero.sub}</p>
          <AuditWidget c={c.widget} />
          <p className="av-engines">
            {c.hero.engines} ChatGPT · Claude · Gemini · Perplexity
          </p>
        </div>

        <div className="av-answer" aria-label={c.hero.answerAria}>
          <div className="av-answer-prompt">
            <span className="av-answer-q">Q</span>
            “{c.answer.q}”
          </div>
          <div className="av-answer-body">
            <p className="av-line av-d1">{c.answer.l1}</p>
            <p className="av-line av-d2">1. LedgerKit — {c.answer.l2desc}</p>
            <p className="av-line av-d3 av-you">
              2. <strong>{c.answer.youBrand}</strong> — {c.answer.youDesc}
              <span className="av-pos">{c.answer.pos}</span>
            </p>
            <p className="av-line av-d4">3. Countable — {c.answer.l4desc}</p>
            <span className="av-cursor" aria-hidden="true" />
          </div>
          <div className="av-answer-foot">
            <span className="av-chip av-chip-alert">{c.answer.alert}</span>
            <span className="av-chip">Trust Score 74</span>
          </div>
        </div>
      </section>

      <section className="av-band">
        <h2>{c.band1.h2}</h2>
        <p>{c.band1.p}</p>
      </section>

      <section className="av-band-alt av-kw-section" id="keywords">
        <h2>{c.kw.h2}</h2>
        <p>{c.kw.p}</p>
        <KeywordWidget c={c.kw.widget} />
      </section>

      <section className="av-features" id="how">
        <h2>{c.features.h2}</h2>
        <div className="av-grid">
          {c.features.items.map((it) => (
            <article key={it.h3}>
              <h3>{it.h3}</h3>
              <p>{it.p}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="av-band av-band-alt">
        <h2>{c.prompts.h2}</h2>
        <ul className="av-prompts">
          {c.prompts.list.map((p) => (
            <li key={p}>“{p}”</li>
          ))}
          <li className="av-prompts-more">{c.prompts.more}</li>
        </ul>
      </section>

      <section className="av-pricing" id="pricing">
        <div className="av-price-card">
          <p className="av-eyebrow">{c.pricing.eyebrow}</p>
          <p className="av-price">$29<span>{c.pricing.perMonth}</span></p>
          <ul>
            {c.pricing.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a className="av-btn av-btn-gold av-btn-block" href="/register?plan=ai_visibility">
            {c.pricing.cta}
          </a>
          <p className="av-fine">
            {c.pricing.finePre}
            <a href="/#pricing">{c.pricing.fineLink}</a>.
          </p>
          <p className="av-fine">{c.pricing.currency}</p>
        </div>
      </section>

      <section className="av-faq">
        <h2>{c.faq.h2}</h2>
        {c.faq.items.map((it) => (
          <details key={it.q}>
            <summary>{it.q}</summary>
            <p>{it.a}</p>
          </details>
        ))}
      </section>

      <section className="av-final">
        <h2>{c.final.h2}</h2>
        <a className="av-btn av-btn-gold" href="/register?plan=ai_visibility">
          {c.final.cta}
        </a>
      </section>

      <footer className="av-footer">
        <span className="av-footer-copy">{foot.copyright}</span>
        <nav className="av-footer-links" aria-label="Footer">
          {foot.links.map((l) => (
            <a key={l.href} href={`/${locale}${l.href}`}>{l.label}</a>
          ))}
        </nav>
      </footer>

      <style>{css}</style>
    </main>
  );
}

const css = `
.av {
  --gold: #d4a843;
  --gold-soft: rgba(212, 168, 67, 0.14);
  background: var(--bg, #0c0d10);
  color: #e9e6df;
  line-height: 1.6;
}
.av h1, .av h2, .av h3 { line-height: 1.15; letter-spacing: -0.015em; margin: 0 0 0.6em; }
.av h1 { font-size: clamp(2rem, 4.5vw, 3.4rem); font-weight: 750; }
.av h2 { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 700; }
.av h3 { font-size: 1.05rem; color: var(--gold); font-weight: 650; }
.av section { padding: clamp(3rem, 7vw, 6rem) clamp(1.25rem, 6vw, 6rem); }
.av-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem 1.5rem; flex-wrap: wrap;
  padding: 1.1rem clamp(1.25rem, 6vw, 6rem) 0;
}
.av-header img { display: block; }
.av-nav { display: flex; align-items: center; gap: 1.4rem; flex-wrap: wrap; }
.av-nav a:not(.av-nav-cta) { color: #b8b4aa; text-decoration: none; font-size: 0.9rem; font-weight: 550; }
.av-nav a:not(.av-nav-cta):hover { color: var(--gold); }
.av-nav a:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.av-header .av-nav-cta { padding: 0.5rem 1rem; font-size: 0.85rem; }
/* EN/FR toggle — adapted from home2.module.css .toggle / .toggleOn */
.av-toggle {
  display: inline-flex; gap: 0.5rem; align-items: center;
  font-size: 0.78rem; letter-spacing: 0.06em; color: #8b877e;
}
.av-nav .av-toggle a:not(.av-toggle-on) { color: #8b877e; }
.av-nav .av-toggle a:hover { color: var(--gold); }
.av-nav .av-toggle a.av-toggle-on { color: var(--gold); font-weight: 650; }
.av-gold { color: var(--gold); }
.av-eyebrow {
  color: var(--gold); font-size: 0.8rem; letter-spacing: 0.14em;
  text-transform: uppercase; font-weight: 600; margin-bottom: 1rem;
}
.av-sub { max-width: 34rem; color: #b8b4aa; font-size: 1.05rem; }
.av-hero {
  display: grid; grid-template-columns: 1.1fr 0.9fr;
  gap: clamp(2rem, 5vw, 4rem); align-items: center; min-height: 70vh;
}
.av-engines { font-size: 0.85rem; color: #8b877e; }
.av-btn {
  display: inline-block; padding: 0.8rem 1.5rem; border-radius: 10px;
  font-weight: 650; text-decoration: none; font-size: 0.95rem;
  transition: transform 120ms ease, background 120ms ease;
}
.av-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.av-btn-gold { background: var(--gold); color: #17140c; border: 0; cursor: pointer; }
.av-btn-gold:hover { transform: translateY(-1px); }
.av-btn-ghost { border: 1px solid var(--surface2, #2a2c33); color: #e9e6df; background: transparent; cursor: pointer; font: inherit; }
.av-btn-ghost:hover { background: var(--surface, #16181d); }
.av-btn-block { display: block; text-align: center; margin-top: 1.5rem; width: 100%; }
.av-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.av-answer {
  background: var(--surface, #16181d);
  border: 1px solid var(--surface2, #2a2c33);
  border-radius: 16px; padding: 1.5rem;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45);
}
.av-answer-prompt {
  display: flex; gap: 0.6rem; align-items: baseline;
  color: #b8b4aa; font-size: 0.92rem; padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--surface2, #2a2c33); margin-bottom: 0.9rem;
}
.av-answer-q {
  color: var(--gold); font-weight: 700; font-size: 0.8rem;
  border: 1px solid var(--gold); border-radius: 6px; padding: 0 0.4rem;
}
.av-line { margin: 0.45rem 0; font-size: 0.95rem; opacity: 0; animation: av-in 400ms ease forwards; }
.av-d1 { animation-delay: 200ms; } .av-d2 { animation-delay: 700ms; }
.av-d3 { animation-delay: 1200ms; } .av-d4 { animation-delay: 1700ms; }
.av-you {
  background: var(--gold-soft); border-left: 3px solid var(--gold);
  padding: 0.35rem 0.6rem; border-radius: 6px;
}
.av-pos { color: var(--gold); font-size: 0.8rem; margin-left: 0.5rem; font-weight: 600; }
.av-cursor {
  display: inline-block; width: 8px; height: 1em; background: var(--gold);
  vertical-align: text-bottom; animation: av-blink 1s steps(1) infinite;
}
@keyframes av-in { to { opacity: 1; } }
@keyframes av-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .av-line { animation: none; opacity: 1; }
  .av-cursor { animation: none; }
}
.av-answer-foot { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
.av-chip {
  font-size: 0.78rem; padding: 0.25rem 0.65rem; border-radius: 999px;
  border: 1px solid var(--surface2, #2a2c33); color: #b8b4aa;
}
.av-chip-alert { border-color: #a4552f; color: #e0a184; }
.av-band { text-align: center; }
.av-band p { max-width: 40rem; margin: 0 auto; color: #b8b4aa; }
.av-band-alt { background: var(--surface, #16181d); }
.av-features h2 { text-align: center; margin-bottom: 2.5rem; }
.av-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1rem;
}
.av-grid article {
  background: var(--surface, #16181d);
  border: 1px solid var(--surface2, #2a2c33);
  border-radius: 14px; padding: 1.5rem;
}
.av-grid p { color: #b8b4aa; font-size: 0.93rem; margin: 0; }
.av-prompts { list-style: none; padding: 0; margin: 1.5rem auto 0; max-width: 34rem; }
.av-prompts li {
  border: 1px solid var(--surface2, #2a2c33); border-radius: 999px;
  padding: 0.55rem 1.1rem; margin: 0.5rem 0; font-size: 0.95rem;
}
.av-prompts-more { color: #8b877e; border-style: dashed !important; }
.av-pricing { display: flex; justify-content: center; }
.av-price-card {
  background: var(--surface, #16181d);
  border: 1px solid var(--gold); border-radius: 18px;
  padding: 2.25rem; max-width: 24rem; width: 100%;
}
.av-price { font-size: 3rem; font-weight: 750; margin: 0 0 1rem; }
.av-price span { font-size: 1rem; color: #8b877e; font-weight: 400; }
.av-price-card ul { list-style: none; padding: 0; margin: 0; }
.av-price-card li {
  padding: 0.45rem 0 0.45rem 1.4rem; position: relative; font-size: 0.95rem;
  border-bottom: 1px solid var(--surface2, #2a2c33);
}
.av-price-card li::before { content: '✓'; position: absolute; left: 0; color: var(--gold); }
.av-fine { font-size: 0.8rem; color: #8b877e; margin-top: 0.9rem; }
.av-fine a { color: var(--gold); }
.av-faq { max-width: 44rem; margin: 0 auto; }
.av-faq details { border-bottom: 1px solid var(--surface2, #2a2c33); padding: 0.9rem 0; }
.av-faq summary { cursor: pointer; font-weight: 600; }
.av-faq summary:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.av-faq p { color: #b8b4aa; font-size: 0.95rem; }
.av-final { text-align: center; }
.av-footer {
  display: flex; flex-wrap: wrap; gap: 1rem 1.5rem;
  align-items: center; justify-content: space-between;
  padding: 2rem clamp(1.25rem, 6vw, 6rem);
  border-top: 1px solid var(--surface2, #2a2c33);
  font-size: 0.78rem; color: #8b877e; letter-spacing: 0.04em;
}
.av-footer-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; }
.av-footer-links a {
  color: #8b877e; text-decoration: none;
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem;
}
.av-footer-links a:hover { color: var(--gold); }
.av-footer-links a:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
/* ---- Audit widget ---- */
.av-audit { margin: 1.75rem 0 1rem; max-width: 32rem; }
.av-audit-label { display: block; font-weight: 650; margin-bottom: 0.6rem; }
.av-audit-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.av-audit-row input {
  flex: 1; min-width: 220px; padding: 0.8rem 1rem; border-radius: 10px;
  border: 1px solid var(--surface2, #2a2c33);
  background: var(--surface, #16181d); color: #e9e6df; font-size: 0.95rem;
}
.av-audit-row input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.av-audit-row button:disabled { opacity: 0.55; cursor: not-allowed; }
.av-audit-note { color: #b8b4aa; font-size: 0.85rem; margin-top: 0.6rem; }
.av-audit-err { color: #e0a184; font-size: 0.9rem; margin-top: 0.6rem; }
.av-audit-fine { color: #8b877e; font-size: 0.78rem; margin-top: 0.5rem; }
.av-audit-result {
  background: var(--surface, #16181d);
  border: 1px solid var(--gold); border-radius: 14px; padding: 1.5rem;
}
.av-audit-headline { font-size: 1.05rem; margin: 0 0 0.9rem; }
.av-audit-engines { list-style: none; padding: 0; margin: 0 0 0.9rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.av-audit-engines li {
  font-size: 0.82rem; padding: 0.25rem 0.7rem; border-radius: 999px;
  border: 1px solid var(--surface2, #2a2c33);
}
.av-audit-engines .av-hit { color: var(--gold); border-color: var(--gold); }
.av-audit-engines .av-miss { color: #8b877e; }
.av-audit-sample {
  margin: 0 0 0.9rem; padding: 0.7rem 1rem; font-size: 0.88rem; color: #b8b4aa;
  border-left: 3px solid var(--surface2, #2a2c33); font-style: italic;
}
.av-audit-upsell { color: #b8b4aa; font-size: 0.9rem; }
.av-audit-again {
  display: block; text-align: center; margin-top: 0.7rem;
  color: #8b877e; font-size: 0.85rem;
}
/* ---- Keyword widget ---- */
.av-kw-section { text-align: center; background: var(--surface, #16181d); }
.av-kw-section > p { max-width: 40rem; margin: 0 auto; color: #b8b4aa; }
.av-kw { margin: 2rem auto 0; max-width: 36rem; text-align: left; }
.av-kw-label { display: block; font-weight: 650; margin-bottom: 0.6rem; }
.av-kw-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.av-kw-row input {
  flex: 1; min-width: 220px; padding: 0.8rem 1rem; border-radius: 10px;
  border: 1px solid var(--surface2, #2a2c33);
  background: var(--bg, #0c0d10); color: #e9e6df; font-size: 0.95rem;
}
.av-kw-row input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.av-kw-note { color: #b8b4aa; font-size: 0.85rem; margin-top: 0.6rem; }
.av-kw-err { color: #e0a184; font-size: 0.9rem; margin-top: 0.6rem; }
.av-kw-fine { color: #8b877e; font-size: 0.78rem; margin-top: 0.5rem; }
.av-kw-result {
  background: var(--bg, #0c0d10);
  border: 1px solid var(--gold); border-radius: 14px; padding: 1.5rem;
}
.av-kw-result .av-kw-h { margin: 1.1rem 0 0.4rem; }
.av-kw-result .av-kw-h:first-child { margin-top: 0; }
.av-kw-list { list-style: none; padding: 0; margin: 0; }
.av-kw-list li {
  display: flex; justify-content: space-between; align-items: center;
  gap: 0.75rem; padding: 0.45rem 0.1rem; font-size: 0.92rem;
  border-bottom: 1px solid var(--surface2, #2a2c33);
}
.av-kw-diff {
  font-size: 0.72rem; border-radius: 999px; padding: 0.12rem 0.6rem;
  border: 1px solid; white-space: nowrap;
}
.av-kw-diff-low { color: #9ad17b; border-color: #4f7a3a; }
.av-kw-diff-med { color: #e5c46f; border-color: #8a6d2c; }
.av-kw-diff-high { color: #e0a184; border-color: #a4552f; }
.av-kw-blur { filter: blur(5px); user-select: none; }
.av-kw-lock { color: #8b877e; font-size: 0.8rem; white-space: nowrap; }
.av-kw-tech { color: #b8b4aa; font-size: 0.9rem; margin: 0.2rem 0 0; }
.av-kw-upsell { color: #b8b4aa; font-size: 0.9rem; margin-top: 1.2rem; }
.av-kw-again {
  display: block; text-align: center; margin-top: 0.7rem;
  color: #8b877e; font-size: 0.85rem;
}
@media (max-width: 860px) {
  .av-hero { grid-template-columns: 1fr; min-height: unset; }
}
`;
