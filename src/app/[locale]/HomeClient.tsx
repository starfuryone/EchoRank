"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./home2.module.css";
import { FAQ } from "./faq-data";
import { DemoVideoModal } from "@/components/demo-video";
import { HomeVideo, type HomeVideoLabels } from "./HomeVideo";
import { PublicNav } from "./PublicNav";
import { PricingSection, type HomePricingTier } from "./PricingSection";
import type { HomePricingChrome } from "@/lib/i18n/content";
import TestimonialSection from "@/app/[locale]/TestimonialSection";
// The ROI calculator's note. Lifted out of this file so the AI Revenue
// dashboard can carry the same promise without a second copy of the sentence
// drifting away from this one — see src/lib/revenue/disclaimer.ts. The
// "~35% / 30%" assumptions clause stays with the calculator that makes it.
import { ROI_CALCULATOR_NOTE } from "@/lib/revenue/disclaimer";

/**
 * One pricing card, built server-side from PLAN_CONFIGS. Prices and feature
 * bullets are NOT authored here — see pricingTiers() in page.tsx for why.
 */
// The pricing grid lives in PricingSection so /pricing can render the very same
// cards from the very same numbers. Re-exported here because page.tsx has
// always imported the type from this module.
export type { HomePricingTier } from "./PricingSection";

/* ---------- copy ---------- */

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

const T = {
  en: {
    hero: {
      live: "LIVE — MONITORING 6 AI ENGINES",
      h1a: "The business AI recommends ",
      h1b: "wins.",
      sub: "Echorank is the AI Visibility Management platform. We measure how ChatGPT, Google AI, Perplexity, Claude, Gemini and Copilot see your business — then tell you exactly how to become the answer.",
      cta1: "Run My Free AI Visibility Audit ↗",
      // Secondary path for visitors who already want an account. The primary
      // CTA runs the anonymous audit instead — no signup, no card.
      cta3: "Create an account",
      cta2: "Watch a 2-minute demo",
      note: "RESULTS IN 60 SECONDS",
      dashTitle: "AI VISIBILITY AUDITOR",
      dashBiz: "ACME PLUMBING",
      score: "AI Visibility Score",
      trendTxt: "▲ +9 this month",
      last: "Last recommendation: 14 min ago · Perplexity",
      you: "Acme Plumbing — you",
    },
    how: {
      label: "THE MECHANISM", h2: "How AI decides who to recommend",
      sub: "Search rankings are a list. AI answers are a verdict. Here's what happens in the seconds before an AI engine names a business.",
      k1: "A customer asks", q1: "\u201CWho's the best plumber near me?\u201D",
      k2: "Each engine evaluates your signals",
      signals: ["Reviews", "Website quality", "Citations", "Trust", "Authority", "Freshness", "Structured data", "Brand mentions"],
      k3: "Echorank analyzes every signal", q3: "…and scores you before AI does.",
      k4: "The verdict", q4: "AI recommends your business.",
    },
    cards: {
      label: "WHAT WE MEASURE", h2: "Five scores. Zero paragraphs.",
      sub: "Everything AI weighs about your business, reduced to numbers you can move.",
      items: [
        { k: "AI Citation Score", tm: true, v: "74", u: "/100", w: 74, c: "gold", d: "▲ +9 / 30d", dc: "g" },
        { k: "Authority Score", tm: true, v: "68", u: "/100", w: 68, c: "gold", d: "▲ +4 / 30d", dc: "g" },
        { k: "Review Health", tm: false, v: "4.6", u: "★", w: 92, c: "green", d: "312 reviews · 91% replied", dc: "" },
        { k: "Citation Consistency", tm: false, v: "83", u: "%", w: 83, c: "blue", d: "3 NAP mismatches found", dc: "" },
        { k: "Competitor Gap", tm: false, v: "−7", u: "pts", w: 46, c: "red", d: "vs. #1 ProFlow Services", dc: "r" },
      ],
    },
    shots: {
      label: "THE PLATFORM", h2: "See the product, not the pitch.",
      more: "More details →",
      items: [
        { tag: "AI VISIBILITY AUDITOR", h: "One score for how AI sees you", p: "Crawlability, structured data, llms.txt, citations, authority — audited across 6 engines, recalculated on schedule, alerted on every drop." },
        { tag: "REPUTATION RISK ENGINE", h: "Revenue at risk, hourly", p: "Every review, rating drop and competitor surge feeds one explainable risk score — with the dollar impact attached to each alert." },
        { tag: "RECOMMENDATION INTELLIGENCE", h: "Your key questions, asked daily", p: "We run your customers' real questions against every engine, every day — and log the moment you appear, get misquoted, or vanish." },
        { tag: "COMPETITOR GAP ANALYZER", h: "Know the week a rival gains ground", p: "Daily snapshots of competitor ratings, review velocity and AI visibility. Momentum alerts land the same week, not next quarter." },
      ],
    },
    tlx: {
      label: "THE TRAJECTORY", h2: "What 90 days of AI visibility work looks like",
      videoLabel: "Video: what 90 days of AI visibility work looks like",
      items: [
        { w: "WEEK 0", t: "Baseline audit", d: "First AI Visibility Score, engine coverage map, and full signal inventory.", m: "Score 47 · cited by 2/6 engines", hot: false },
        { w: "WEEK 2", t: "Review velocity climbs", d: "SMS, email and QR campaigns bring fresh, authentic reviews online.", m: "+38 reviews · reply rate 91%", hot: false },
        { w: "WEEK 4", t: "New citations discovered", d: "Citation Monitor finds and fixes inconsistent listings across the sources AI trusts.", m: "11 citations added · 3 NAP conflicts resolved", hot: false },
        { w: "WEEK 7", t: "Authority improves", d: "Structured data, author profiles and FAQ schema shipped from the roadmap.", m: "Authority Score 52 → 68", hot: false },
        { w: "WEEK 9", t: "AI starts recommending you", d: "Recommendation Intelligence logs the first unprompted mentions.", m: "First cited in ChatGPT + Perplexity answers", hot: true },
        { w: "WEEK 12", t: "Competitor gap closes", d: "You pass two rivals; alerts now watch your lead instead of your deficit.", m: "Score 74 · rank #3 → #2 · +9/month trend", hot: false },
      ],
    },
    sim: {
      label: "WHAT AI SEES", h2: "Ask what your customers ask.",
      sub: "This is the diagnostic every audit produces: the real prompt, the real answer, and exactly why you're in it — or not.",
      prompt: "\u201CWho is the best plumber in Milwaukee?\u201D",
      promptLbl: "PROMPT →",
      missRow: "Acme Plumbing (your business) — not mentioned",
      whyMiss: "Why you're missing", whyNot1: "Why you're not #1", fixes: "Recommended fixes",
      data: {
        chatgpt: {
          answers: ["ProFlow Services — 4.8★, 24/7 emergency, strong recent reviews", "City Drain Co. — 4.7★, cited by 3 local directories", "Bow Valley Plumbing — 4.6★, detailed service pages"],
          missing: true,
          why: ["Missing authority signals — no author profiles, thin service pages", "Weak review velocity — last review 26 days old", "Incomplete citations — 3 NAP mismatches across directories", "Poor structured data — no LocalBusiness or FAQ schema"],
          fix: [["Add FAQ + LocalBusiness schema", "+5 pts, ~1 hr"], ["Launch review campaign (SMS + QR)", "+4 pts, ongoing"], ["Resolve 3 citation conflicts", "+3 pts, ~30 min"]],
        },
        perplexity: {
          answers: ["ProFlow Services — cited from 4 sources", "Acme Plumbing (you) — cited from 2 sources", "City Drain Co."],
          missing: false,
          why: ["You appear at #2 — cited from only 2 sources vs. ProFlow's 4", "Review freshness is your weakest cited signal"],
          fix: [["Earn 2+ new authoritative citations", "+4 pts"], ["Keep review cadence under 21 days", "+3 pts"], ["Add comparison content Perplexity can quote", "+2 pts"]],
        },
        google: {
          answers: ["ProFlow Services", "Bow Valley Plumbing", "City Drain Co."],
          missing: true,
          why: ["Google Business primary category mismatched to prompt intent", "No FAQ schema — AI Overviews prefer structured answers", "Competitor review velocity outpacing yours 2.1×"],
          fix: [["Fix Google Business categories", "+6 pts, 15 min"], ["Ship FAQ schema on top 5 pages", "+5 pts"], ["Close the review velocity gap", "+4 pts"]],
        },
      },
    },
    cmp: {
      label: "THE SUCCESSOR", h2a: "SEO got you ranked. ", h2b: "AI Visibility gets you chosen.",
      sub: "A ranking is a chance to be clicked. A recommendation is the decision already made. Echorank manages the second one.",
      oldH: "Traditional SEO", newH: "AI Visibility Management",
      rows: [["Rankings", "AI recommendations"], ["Keywords", "AI citations"], ["Backlinks", "Trust signals"], ["Search traffic", "Recommendation frequency"], ["SERP position", "AI Visibility Score™"], ["Click-through rate", "Share of AI answers"]],
    },
    eng: {
      label: "COVERAGE", h2: "Every engine that names businesses. Watched continuously.",
      sub: "Not a one-time audit. Answers tracked daily, risk recalculated hourly, alerts the moment coverage flips.",
      daily: "DAILY",
    },
    trad: {
      label: "THE FOUNDATION", h2: "The classic reputation stack, built in.",
      sub: "AI engines learn from the same platforms you already manage. Echorank monitors and works them directly — the reviews that feed your AI visibility.",
      platforms: [
        ["Google Reviews", "MONITORING · CAMPAIGNS · AI REPLIES"],
        ["Trustpilot", "MONITORING · ALERTS"],
        ["Meta — Facebook & Instagram", "REVIEWS · MENTIONS"],
        ["Yelp", "MONITORING"],
        ["TripAdvisor", "MONITORING"],
      ],
      feats: "Review campaigns by email, SMS and QR · Private feedback & routing · AI response drafting in your voice · Suspicious review detection",
      videoLabel: "Video: the classic reputation stack, explained",
    },
    faqVideoLabel: "Video: an introduction to Echorank",
    hist: {
      label: "AI RECOMMENDATION TRACKER", h2: "Recommendations, on the record",
      sub: "Last 30 days of mentions across engines — so a quiet disappearance never goes unnoticed.",
      unit: "recommendations / 30d",
    },
    rmx: {
      label: "THE ROADMAP", h2: "Every audit ends in a to-do list, not a report",
      sub: "Prioritized fixes, each with an estimated score lift and expected impact. Do them in order; watch the score move.",
      items: [
        { p: 1, t: "Fix Google Business categories", d: "Primary category mismatched against your top AI prompts.", lift: "+6 pts est.", imp: "HIGH IMPACT · 15 MIN" },
        { p: 1, t: "Add FAQ schema to service pages", d: "Engines cite structured answers first; you have none.", lift: "+5 pts est.", imp: "HIGH IMPACT · 1 HR" },
        { p: 2, t: "Improve review freshness", d: "Last review is 26 days old — freshness decay starts at 21.", lift: "+4 pts est.", imp: "MED IMPACT · ONGOING" },
        { p: 3, t: "Create author profiles", d: "Unattributed content scores lower on authority signals.", lift: "+2 pts est.", imp: "MED IMPACT · 2 HRS" },
      ],
    },
    roi: {
      label: "REVENUE IMPACT CALCULATOR", h2: "Put a number on being recommended",
      sub: "Estimate what closing your AI visibility gap is worth. Conservative model: each visibility point adds a proportional share of AI-referred leads.",
      leads: "Current monthly leads", sale: "Average sale value", cur: "Current AI Visibility Score™", tgt: "Target AI Visibility Score™",
      xleads: "Additional qualified leads / month", xmo: "Monthly revenue increase", xyr: "Annual business impact",
      leadsUnit: "leads", perMo: "/ mo", perYr: "/ yr",
      note: ROI_CALCULATOR_NOTE.en,
    },
    pricing: {
      label: "PRICING", h2: "Plans",
      cadLink: "See pricing in Canadian dollars →",
      tax: "Try Echorank free for 7 days. Cancel anytime. Card required.",
      currency: "All prices are in US dollars (USD). If you pay with a card in another currency, your bank converts the charge at its own exchange rate.",
    },
    close: {
      label: "START",
      h2a: "Every day, AI recommends businesses to thousands of customers. ", h2b: "Is yours one of them?",
      sub: "Run your AI Visibility Audit in under 60 seconds. See exactly what AI says about your business — and exactly what to do next.",
      cta1: "Run My Free AI Visibility Audit ↗", cta2: "Watch a 2-Minute Demo",
    },
    // Section /15. Both labels name their paper: they read side by side, and
    // two buttons both saying "Download the whitepaper (PDF)" told a visitor
    // nothing about which was which.
    resources: {
      repPaper: "Reputation Intelligence guide (PDF)",
      seoPaper: "The SEO tools, explained (PDF)",
      extension: "Browser extension",
    },
    foot: { links: [["pricing", "PRICING"], ["use-cases", "USE CASES"], ["about", "ABOUT"], ["resources", "RESOURCES"], ["guide", "GUIDE"], ["guide-visibilite-ia", "AI VISIBILITY GUIDE"], ["legal/subscription-agreement", "SUBSCRIPTION"], ["legal/privacy", "PRIVACY"], ["legal/terms", "TERMS"], ["legal/cookies", "COOKIES"], ["legal/no-financial-advice", "NO FINANCIAL ADVICE"], ["legal/disclaimer", "DISCLAIMER"]] },
  },

  fr: {
    hero: {
      live: "EN DIRECT — 6 MOTEURS IA SURVEILLÉS",
      h1a: "L'entreprise que l'IA recommande ",
      h1b: "gagne.",
      sub: "Echorank est la plateforme de gestion de visibilité IA. Nous mesurons comment ChatGPT, Google AI, Perplexity, Claude, Gemini et Copilot perçoivent votre entreprise — puis nous vous montrons exactement comment devenir la réponse.",
      cta1: "Lancer mon audit de visibilité IA gratuit ↗",
      cta3: "Créer un compte",
      cta2: "Voir la démo de 2 minutes",
      note: "RÉSULTATS EN 60 SECONDES",
      dashTitle: "AUDITEUR DE VISIBILITÉ IA",
      dashBiz: "PLOMBERIE ACME",
      score: "Score de visibilité IA",
      trendTxt: "▲ +9 ce mois-ci",
      last: "Dernière recommandation : il y a 14 min · Perplexity",
      you: "Plomberie Acme — vous",
    },
    how: {
      label: "LE MÉCANISME", h2: "Comment l'IA décide qui recommander",
      sub: "Un classement de recherche est une liste. Une réponse d'IA est un verdict. Voici ce qui se passe dans les secondes avant qu'un moteur IA nomme une entreprise.",
      k1: "Un client demande", q1: "« Quel est le meilleur plombier près de chez moi? »",
      k2: "Chaque moteur évalue vos signaux",
      signals: ["Avis", "Qualité du site", "Citations", "Confiance", "Autorité", "Fraîcheur", "Données structurées", "Mentions de marque"],
      k3: "Echorank analyse chaque signal", q3: "…et vous note avant que l'IA le fasse.",
      k4: "Le verdict", q4: "L'IA recommande votre entreprise.",
    },
    cards: {
      label: "CE QUE NOUS MESURONS", h2: "Cinq scores. Zéro paragraphe.",
      sub: "Tout ce que l'IA pèse à propos de votre entreprise, réduit à des chiffres que vous pouvez faire bouger.",
      items: [
        { k: "Score de citation IA", tm: true, v: "74", u: "/100", w: 74, c: "gold", d: "▲ +9 / 30 j", dc: "g" },
        { k: "Score d'autorité", tm: true, v: "68", u: "/100", w: 68, c: "gold", d: "▲ +4 / 30 j", dc: "g" },
        { k: "Santé des avis", tm: false, v: "4,6", u: "★", w: 92, c: "green", d: "312 avis · 91 % de réponses", dc: "" },
        { k: "Cohérence des citations", tm: false, v: "83", u: "%", w: 83, c: "blue", d: "3 incohérences NAP détectées", dc: "" },
        { k: "Écart concurrentiel", tm: false, v: "−7", u: "pts", w: 46, c: "red", d: "vs no 1 ProFlow Services", dc: "r" },
      ],
    },
    shots: {
      label: "LA PLATEFORME", h2: "Voyez le produit, pas le discours.",
      more: "Plus de détails →",
      items: [
        { tag: "AUDITEUR DE VISIBILITÉ IA", h: "Un score pour votre image auprès de l'IA", p: "Explorabilité, données structurées, llms.txt, citations, autorité — audités sur 6 moteurs, recalculés selon un horaire, avec alerte à chaque baisse." },
        { tag: "MOTEUR DE RISQUE RÉPUTATIONNEL", h: "Le revenu à risque, chaque heure", p: "Chaque avis, chaque baisse de note et chaque poussée d'un concurrent alimente un score de risque explicable — avec l'impact en dollars rattaché à chaque alerte." },
        { tag: "INTELLIGENCE DE RECOMMANDATION", h: "Vos questions clés, posées chaque jour", p: "Nous soumettons les vraies questions de vos clients à chaque moteur, chaque jour — et consignons le moment où vous apparaissez, êtes mal cité, ou disparaissez." },
        { tag: "ANALYSEUR D'ÉCART CONCURRENTIEL", h: "Sachez la semaine où un rival gagne du terrain", p: "Instantanés quotidiens des notes, de la vélocité d'avis et de la visibilité IA des concurrents. Les alertes arrivent la même semaine, pas le trimestre suivant." },
      ],
    },
    tlx: {
      label: "LA TRAJECTOIRE", h2: "À quoi ressemblent 90 jours de travail sur la visibilité IA",
      videoLabel: "Vidéo : à quoi ressemblent 90 jours de travail sur la visibilité IA",
      items: [
        { w: "SEMAINE 0", t: "Audit de référence", d: "Premier score de visibilité IA, carte de couverture des moteurs et inventaire complet des signaux.", m: "Score 47 · cité par 2/6 moteurs", hot: false },
        { w: "SEMAINE 2", t: "La vélocité d'avis grimpe", d: "Les campagnes SMS, courriel et QR ramènent des avis frais et authentiques.", m: "+38 avis · taux de réponse 91 %", hot: false },
        { w: "SEMAINE 4", t: "Nouvelles citations découvertes", d: "Le moniteur de citations trouve et corrige les fiches incohérentes sur les sources auxquelles l'IA se fie.", m: "11 citations ajoutées · 3 conflits NAP résolus", hot: false },
        { w: "SEMAINE 7", t: "L'autorité s'améliore", d: "Données structurées, profils d'auteurs et schéma FAQ livrés depuis la feuille de route.", m: "Score d'autorité 52 → 68", hot: false },
        { w: "SEMAINE 9", t: "L'IA commence à vous recommander", d: "L'intelligence de recommandation consigne les premières mentions spontanées.", m: "Premières citations dans ChatGPT + Perplexity", hot: true },
        { w: "SEMAINE 12", t: "L'écart concurrentiel se referme", d: "Vous dépassez deux rivaux; les alertes surveillent maintenant votre avance plutôt que votre retard.", m: "Score 74 · rang no 3 → no 2 · tendance +9/mois", hot: false },
      ],
    },
    sim: {
      label: "CE QUE L'IA VOIT", h2: "Posez la question que vos clients posent.",
      sub: "C'est le diagnostic que chaque audit produit : la vraie question, la vraie réponse, et exactement pourquoi vous y êtes — ou pas.",
      prompt: "« Quel est le meilleur plombier à Milwaukee? »",
      promptLbl: "QUESTION →",
      missRow: "Plomberie Acme (votre entreprise) — non mentionnée",
      whyMiss: "Pourquoi vous êtes absent", whyNot1: "Pourquoi vous n'êtes pas no 1", fixes: "Correctifs recommandés",
      data: {
        chatgpt: {
          answers: ["ProFlow Services — 4,8★, urgence 24/7, avis récents solides", "City Drain Co. — 4,7★, cité par 3 annuaires locaux", "Bow Valley Plumbing — 4,6★, pages de services détaillées"],
          missing: true,
          why: ["Signaux d'autorité manquants — aucun profil d'auteur, pages de services minces", "Vélocité d'avis faible — dernier avis il y a 26 jours", "Citations incomplètes — 3 incohérences NAP entre annuaires", "Données structurées déficientes — aucun schéma LocalBusiness ni FAQ"],
          fix: [["Ajouter les schémas FAQ + LocalBusiness", "+5 pts, ~1 h"], ["Lancer une campagne d'avis (SMS + QR)", "+4 pts, en continu"], ["Résoudre les 3 conflits de citations", "+3 pts, ~30 min"]],
        },
        perplexity: {
          answers: ["ProFlow Services — cité par 4 sources", "Plomberie Acme (vous) — citée par 2 sources", "City Drain Co."],
          missing: false,
          why: ["Vous êtes no 2 — cité par seulement 2 sources contre 4 pour ProFlow", "La fraîcheur des avis est votre signal cité le plus faible"],
          fix: [["Obtenir 2+ nouvelles citations d'autorité", "+4 pts"], ["Garder la cadence d'avis sous 21 jours", "+3 pts"], ["Publier du contenu comparatif que Perplexity peut citer", "+2 pts"]],
        },
        google: {
          answers: ["ProFlow Services", "Bow Valley Plumbing", "City Drain Co."],
          missing: true,
          why: ["Catégorie principale Google Business inadaptée à l'intention de la question", "Aucun schéma FAQ — les aperçus IA privilégient les réponses structurées", "La vélocité d'avis des concurrents dépasse la vôtre de 2,1×"],
          fix: [["Corriger les catégories Google Business", "+6 pts, 15 min"], ["Déployer le schéma FAQ sur vos 5 pages clés", "+5 pts"], ["Combler l'écart de vélocité d'avis", "+4 pts"]],
        },
      },
    },
    cmp: {
      label: "LE SUCCESSEUR", h2a: "Le SEO vous a classé. ", h2b: "La visibilité IA vous fait choisir.",
      sub: "Un classement est une chance d'être cliqué. Une recommandation est une décision déjà prise. Echorank gère la seconde.",
      oldH: "SEO traditionnel", newH: "Gestion de visibilité IA",
      rows: [["Classements", "Recommandations IA"], ["Mots-clés", "Citations IA"], ["Backlinks", "Signaux de confiance"], ["Trafic de recherche", "Fréquence de recommandation"], ["Position SERP", "Score de visibilité IA™"], ["Taux de clics", "Part des réponses IA"]],
    },
    eng: {
      label: "COUVERTURE", h2: "Chaque moteur qui nomme des entreprises. Surveillé en continu.",
      sub: "Pas un audit ponctuel. Réponses suivies chaque jour, risque recalculé chaque heure, alerte dès que la couverture bascule.",
      daily: "QUOTIDIEN",
    },
    trad: {
      label: "LA FONDATION", h2: "La gestion de réputation classique, intégrée.",
      sub: "Les moteurs IA apprennent des mêmes plateformes que vous gérez déjà. Echorank les surveille et les travaille directement — les avis qui alimentent votre visibilité IA.",
      platforms: [
        ["Avis Google", "SURVEILLANCE · CAMPAGNES · RÉPONSES IA"],
        ["Trustpilot", "SURVEILLANCE · ALERTES"],
        ["Meta — Facebook et Instagram", "AVIS · MENTIONS"],
        ["Yelp", "SURVEILLANCE"],
        ["TripAdvisor", "SURVEILLANCE"],
      ],
      feats: "Campagnes d'avis par courriel, SMS et QR · Rétroaction privée et routage · Réponses IA dans votre ton · Détection d'avis suspects",
      videoLabel: "Vidéo : la panoplie de réputation classique, expliquée",
    },
    faqVideoLabel: "Vidéo : une introduction à Echorank",
    hist: {
      label: "SUIVI DES RECOMMANDATIONS IA", h2: "Les recommandations, consignées",
      sub: "30 derniers jours de mentions par moteur — pour qu'une disparition silencieuse ne passe jamais inaperçue.",
      unit: "recommandations / 30 j",
    },
    rmx: {
      label: "LA FEUILLE DE ROUTE", h2: "Chaque audit se termine par une liste d'actions, pas un rapport",
      sub: "Des correctifs priorisés, chacun avec un gain de score estimé et un impact attendu. Faites-les dans l'ordre; regardez le score bouger.",
      items: [
        { p: 1, t: "Corriger les catégories Google Business", d: "Catégorie principale inadaptée à vos questions IA principales.", lift: "+6 pts est.", imp: "IMPACT ÉLEVÉ · 15 MIN" },
        { p: 1, t: "Ajouter le schéma FAQ aux pages de services", d: "Les moteurs citent d'abord les réponses structurées; vous n'en avez aucune.", lift: "+5 pts est.", imp: "IMPACT ÉLEVÉ · 1 H" },
        { p: 2, t: "Améliorer la fraîcheur des avis", d: "Dernier avis il y a 26 jours — la décote commence à 21.", lift: "+4 pts est.", imp: "IMPACT MOYEN · EN CONTINU" },
        { p: 3, t: "Créer des profils d'auteurs", d: "Le contenu non attribué obtient un score d'autorité plus faible.", lift: "+2 pts est.", imp: "IMPACT MOYEN · 2 H" },
      ],
    },
    roi: {
      label: "CALCULATEUR D'IMPACT SUR LE REVENU", h2: "Chiffrez ce que vaut d'être recommandé",
      sub: "Estimez la valeur de combler votre écart de visibilité IA. Modèle conservateur : chaque point de visibilité ajoute une part proportionnelle de clients référés par l'IA.",
      leads: "Prospects mensuels actuels", sale: "Valeur moyenne d'une vente", cur: "Score de visibilité IA™ actuel", tgt: "Score de visibilité IA™ cible",
      xleads: "Prospects qualifiés additionnels / mois", xmo: "Hausse de revenu mensuelle", xyr: "Impact annuel",
      leadsUnit: "prospects", perMo: "/ mois", perYr: "/ an",
      note: ROI_CALCULATOR_NOTE.fr,
    },
    pricing: {
      label: "TARIFS", h2: "Forfaits",
      cadLink: "Voir les tarifs en dollars canadiens →",
      tax: "Essayez Echorank gratuitement pendant 7 jours. Annulez à tout moment. Carte requise.",
      currency: "Tous les prix sont en dollars américains (USD). Si vous payez avec une carte dans une autre devise, votre banque effectue la conversion à son propre taux de change.",
    },
    close: {
      label: "COMMENCER",
      h2a: "Chaque jour, l'IA recommande des entreprises à des milliers de clients. ", h2b: "La vôtre en fait-elle partie?",
      sub: "Lancez votre audit de visibilité IA en moins de 60 secondes. Voyez exactement ce que l'IA dit de votre entreprise — et exactement quoi faire ensuite.",
      cta1: "Lancer mon audit de visibilité IA gratuit ↗", cta2: "Voir la démo de 2 minutes",
    },
    resources: {
      repPaper: "Guide Reputation Intelligence (PDF)",
      seoPaper: "Les outils SEO, expliqués (PDF)",
      extension: "Extension navigateur",
    },
    foot: { links: [["pricing", "TARIFS"], ["use-cases", "CAS D’USAGE"], ["about", "À PROPOS"], ["resources", "RESSOURCES"], ["guide", "GUIDE"], ["guide-visibilite-ia", "GUIDE VISIBILITÉ IA"], ["legal/subscription-agreement", "ABONNEMENT"], ["legal/privacy", "CONFIDENTIALITÉ"], ["legal/terms", "CONDITIONS"], ["legal/cookies", "COOKIES"], ["legal/no-financial-advice", "CONSEIL FINANCIER"], ["legal/disclaimer", "AVIS"]] },
  },
} as const;

/* ---------- static data ---------- */

const ENGINES = [
  ["ChatGPT", 82], ["Google AI", 76], ["Perplexity", 88], ["Claude", 71], ["Gemini", 64], ["Copilot", 59],
] as const;

const HIST = [
  { n: "ChatGPT", t: "▲ 31%", v: 42, col: "url(#erg)", pts: "0,44 20,40 40,42 60,34 80,36 100,28 120,30 140,22 160,18 180,14 200,10", up: true },
  { n: "Perplexity", t: "▲ 24%", v: 57, col: "#4ade80", pts: "0,38 20,36 40,30 60,32 80,26 100,24 120,26 140,18 160,16 180,12 200,8", up: true },
  { n: "Google AI", t: "▲ 12%", v: 29, col: "#7aa7ff", pts: "0,46 20,44 40,46 60,40 80,42 100,36 120,38 140,32 160,30 180,28 200,24", up: true },
  { n: "Claude", t: "▲ 18%", v: 21, col: "#c9a2ff", pts: "0,48 20,46 40,44 60,44 80,40 100,38 120,34 140,34 160,30 180,26 200,24", up: true },
  { n: "Gemini", t: "▲ 9%", v: 17, col: "#ffa6c1", pts: "0,50 20,48 40,48 60,44 80,44 100,42 120,40 140,38 160,36 180,34 200,32", up: true },
  { n: "Copilot", t: "▼ 4%", v: 11, col: "#f87171", pts: "0,40 20,42 40,40 60,42 80,44 100,42 120,44 140,46 160,44 180,46 200,48", up: false },
];

const CARD_COLOR: Record<string, string> = {
  gold: "linear-gradient(120deg,#f7d76f,#b88420)",
  green: "#4ade80",
  blue: "#7aa7ff",
  red: "#f87171",
};

/* ---------- component ---------- */

export default function HomeClient({
  locale,
  pricing,
  priceChrome,
  liveToolCount,
  toolsSection,
  playerLabels,
}: {
  locale: string;
  pricing: HomePricingTier[];
  priceChrome: HomePricingChrome;
  liveToolCount: number;
  /** Server-rendered Classic SEO Tools section, slotted in after /03. */
  toolsSection: ReactNode;
  /**
   * HomeVideo's control labels, from HOME_TOOLS[locale].player. Passed in
   * rather than imported: HOME_TOOLS is a five-locale catalog and this file's
   * own T table only has en and fr, so importing it here would both bloat the
   * client bundle and give de-CH English chrome. Same reason priceChrome is
   * a prop.
   */
  playerLabels: HomeVideoLabels;
}) {
  const t = T[baseOf(locale)];
  const faq = FAQ[baseOf(locale)];
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;

  /* Monthly vs annual pricing. Annual shows the per-month equivalent with a
     "billed annually" line, so the number under the tier name is always the
     same unit and the two modes are directly comparable. */
  const [annual, setAnnual] = useState(false);

  /* hero score animation */
  const numRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const C = 326.7, target = 74;
    const num = numRef.current, ring = ringRef.current, bars = barsRef.current;
    if (!num || !ring) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const setBars = (instant: boolean) =>
      bars?.querySelectorAll<HTMLElement>("[data-w]").forEach((f, i) => {
        const w = f.dataset.w + "%";
        instant ? (f.style.width = w) : setTimeout(() => (f.style.width = w), 200 + i * 90);
      });
    if (reduce) {
      num.textContent = String(target);
      ring.style.strokeDashoffset = String(C * (1 - target / 100));
      setBars(true);
      return;
    }
    const t0 = performance.now(), dur = 1400;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      num.textContent = String(Math.round(target * e));
      ring.style.strokeDashoffset = String(C * (1 - (target / 100) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    setBars(false);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* scroll reveal */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll(`.${s.reveal}`);
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add(s.revealIn); io.unobserve(e.target); } }),
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* demo video modal */
  const [demoOpen, setDemoOpen] = useState(false);

  /* simulator */
  const [engKey, setEngKey] = useState<"chatgpt" | "perplexity" | "google">("chatgpt");
  const sim = t.sim.data[engKey];

  /* ROI */
  const [leads, setLeads] = useState(40);
  const [sale, setSale] = useState(450);
  const [cur, setCur] = useState(47);
  const [tgt, setTgt] = useState(74);
  const tEff = Math.max(tgt, cur);
  const aiPool = (leads * 0.35) / Math.max(cur / 100, 0.15);
  const extraLeads = Math.max(0, aiPool * ((tEff - cur) / 100));
  const monthly = extraLeads * 0.3 * sale;
  const money = (n: number) =>
    baseOf(locale) === "fr"
      ? `${Math.round(n).toLocaleString("fr-CA")} $`
      : `$${Math.round(n).toLocaleString("en-US")}`;

  const Tm = () => <sup className={s.tm}>™</sup>;

  return (
    <div className={s.page} ref={rootRef}>
      {/* NAV — shared with /resources and any future public page. Extracted
          from here, so its section links are absolute now: the homepage is
          just one of the pages it renders on. */}
      <PublicNav locale={locale} />

      {/* 1. HERO */}
      <header className={s.hero}>
        <div className={`${s.container} ${s.herogrid}`}>
          <div>
            <span className={s.livechip}><span className={s.pulse} />{t.hero.live}</span>
            <h1 className={s.h1}>{t.hero.h1a}<span className={s.goldtext}>{t.hero.h1b}</span></h1>
            <p className={s.heroSub}>{t.hero.sub}</p>
            {/* Primary CTA runs the real audit with no account: the widget on
                /ai-visibility is anonymous and rate-limited to 1/IP/day.
                /register is the secondary path for people who already want an
                account — and that path DOES take a card, which is why the hero
                label no longer promises otherwise. The "no card" claims on
                /ai-visibility itself stay: they describe the anonymous widget,
                where they are still true. */}
            <div className={s.ctarow}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/free-audit")}>{t.hero.cta1}</Link>
              <Link className={`${s.btn} ${s.btnGhost}`} href={L("/pricing")}>{t.hero.cta3}</Link>
              <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setDemoOpen(true)}>{t.hero.cta2}</button>
            </div>
            <p className={s.label} style={{ marginTop: 22 }}>{t.hero.note}</p>
          </div>

          <div className={s.dash} aria-label={t.hero.score}>
            <div className={s.dashhead}>
              <span className={s.dashtitle}>{t.hero.dashTitle}<Tm /> — {t.hero.dashBiz}</span>
              <span className={s.chipGreen}>LIVE</span>
            </div>
            <div className={s.scorerow}>
              <div className={s.ring}>
                <svg width="118" height="118" viewBox="0 0 118 118">
                  <circle cx="59" cy="59" r="52" fill="none" stroke="var(--lineSoft)" strokeWidth="9" />
                  <circle ref={ringRef} cx="59" cy="59" r="52" fill="none" stroke="url(#erg)" strokeWidth="9" strokeLinecap="round" strokeDasharray="326.7" strokeDashoffset="326.7" />
                  <defs><linearGradient id="erg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7d76f" /><stop offset="1" stopColor="#b88420" /></linearGradient></defs>
                </svg>
                <div className={s.ringval}><span className={s.ringnum} ref={numRef}>0</span><span className={s.ringden}>/ 100</span></div>
              </div>
              <div>
                <div className={s.scorebig}>{t.hero.score}<Tm /></div>
                <div className={s.trend}>{t.hero.trendTxt}</div>
                <div className={s.ts}>{t.hero.last}</div>
              </div>
            </div>
            <div className={s.engines} ref={barsRef}>
              {ENGINES.map(([n, v]) => (
                <div className={s.eng} key={n}>
                  <span className={s.engname}>{n}</span>
                  <span className={s.engbar}><span className={s.engfill} data-w={v} /></span>
                  <span className={s.engval}>{v}</span>
                </div>
              ))}
            </div>
            <div className={s.comp}>
              <div className={s.comprow}><span><span className={s.comprank}>#1</span>ProFlow Services</span><span className={s.compsc}>81</span></div>
              <div className={`${s.comprow} ${s.compyou}`}><span><span className={s.comprank}>#2</span>{t.hero.you}</span><span className={s.compsc} style={{ color: "var(--gold)" }}>74</span></div>
              <div className={s.comprow}><span><span className={s.comprank}>#3</span>City Drain Co.</span><span className={s.compsc}>62</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HOW AI DECIDES */}
      <section id="how" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 01</b> — {t.how.label}</p>
          <h2 className={s.h2}>{t.how.h2}</h2>
          <p className={s.sub}>{t.how.sub}</p>
          <div className={s.flow}>
            <div className={`${s.fnode} ${s.reveal}`}><span className={s.fkey}>{t.how.k1}</span><span className={s.fq}>{t.how.q1}</span></div>
            <div className={s.farrow} />
            <div className={`${s.fengines} ${s.reveal}`}>{ENGINES.map(([n]) => <span key={n}>{n}</span>)}</div>
            <div className={s.farrow} />
            <div className={`${s.fnode} ${s.fdashed} ${s.reveal}`}>
              <span className={s.fkey}>{t.how.k2}</span>
              <div className={s.signals}>{t.how.signals.map((x) => <span key={x}>{x}</span>)}</div>
            </div>
            <div className={s.farrow} />
            <div className={`${s.fnode} ${s.reveal}`}><span className={s.fkey}>{t.how.k3}</span><span className={s.fq}>{t.how.q3}</span></div>
            <div className={s.farrow} />
            <div className={`${s.fnode} ${s.ffinal} ${s.reveal}`}><span className={s.fkey}>{t.how.k4}</span><span className={s.fverdict}>{t.how.q4}</span></div>
          </div>
        </div>
      </section>

      {/* 3. SCORECARDS */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 02</b> — {t.cards.label}</p>
          <h2 className={s.h2}>{t.cards.h2}</h2>
          <p className={s.sub}>{t.cards.sub}</p>
          <div className={s.cards5}>
            {t.cards.items.map((c) => (
              <div className={`${s.mcard} ${s.reveal}`} key={c.k}>
                <div className={s.mk}>{c.k}{c.tm && <Tm />}</div>
                <div className={s.mv}>{c.v}<span className={s.mu}>{c.u}</span></div>
                <div className={s.mbar}><div className={s.mfill} style={{ width: `${c.w}%`, background: CARD_COLOR[c.c] }} /></div>
                <div className={c.dc === "g" ? s.mdGreen : c.dc === "r" ? s.mdRed : s.md}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PRODUCT SHOTS */}
      <section id="platform" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 03</b> — {t.shots.label}</p>
          <h2 className={s.h2}>{t.shots.h2}</h2>
          <div className={s.shots}>
            {t.shots.items.map((it, i) => (
              <div className={`${i % 2 ? s.shotRev : s.shot} ${s.reveal}`} key={it.tag}>
                <div className={s.shotcopy}>
                  <p className={s.label}>{it.tag}<Tm /></p>
                  <h3>{it.h}</h3>
                  <p>{it.p}</p>
                  {i === 0 && (
                    <Link className={s.shotlink} href={L("/ai-visibility")}>{t.shots.more}</Link>
                  )}
                </div>
                <div className={s.frame}>
                  <div className={s.framebar}><i /><i /><i /></div>
                  <div className={s.framebody}>
                    {i === 0 && (<>
                      <div className={s.skrow}><div className={s.sk}><div className={s.skl}>Score</div><div className={s.sknGd}>74</div></div><div className={s.sk}><div className={s.skl}>30d</div><div className={s.sknG}>+9</div></div><div className={s.sk}><div className={s.skl}>Engines</div><div className={s.skn}>5/6</div></div></div>
                      <div className={s.skchart}><div className={s.sklines}>{[82, 76, 88, 64].map((w, j) => <div className={s.skline} key={j}><i style={{ width: `${w}%`, background: "linear-gradient(90deg,#b88420,#f7d76f)" }} /></div>)}</div></div>
                    </>)}
                    {i === 1 && (<>
                      <div className={s.skrow}><div className={s.sk}><div className={s.skl}>Risk</div><div className={s.sknR}>MED</div></div><div className={s.sk}><div className={s.skl}>At risk</div><div className={s.sknR}>$3.2k</div></div><div className={s.sk}><div className={s.skl}>Alerts</div><div className={s.skn}>4</div></div></div>
                      <div className={s.skchart}><div className={s.sklines}>{[["38%", "#f87171"], ["55%", "#e8c565"], ["24%", "#f87171"]].map(([w, c], j) => <div className={s.skline} key={j}><i style={{ width: w as string, background: c as string }} /></div>)}</div></div>
                    </>)}
                    {i === 2 && (<>
                      <div className={s.skrow}><div className={s.sk}><div className={s.skl}>Prompts</div><div className={s.skn}>24</div></div><div className={s.sk}><div className={s.skl}>Appear</div><div className={s.sknG}>61%</div></div><div className={s.sk}><div className={s.skl}>Today</div><div className={s.sknGd}>+3</div></div></div>
                      <div className={s.skchart}><div className={s.sklines}>{[61, 47, 70].map((w, j) => <div className={s.skline} key={j}><i style={{ width: `${w}%`, background: "#4ade80" }} /></div>)}</div></div>
                    </>)}
                    {i === 3 && (<>
                      <div className={s.skrow}><div className={s.sk}><div className={s.skl}>Rivals</div><div className={s.skn}>5</div></div><div className={s.sk}><div className={s.skl}>Gaining</div><div className={s.sknR}>2</div></div><div className={s.sk}><div className={s.skl}>Rank</div><div className={s.sknGd}>#2</div></div></div>
                      <div className={s.skchart}><div className={s.sklines}>{[["81%", "#232330"], ["74%", "linear-gradient(90deg,#b88420,#f7d76f)"], ["62%", "#232330"]].map(([w, c], j) => <div className={s.skline} key={j}><i style={{ width: w as string, background: c as string }} /></div>)}</div></div>
                    </>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. CLASSIC SEO TOOLS — server-rendered from src/lib/seo-tools.ts,
           the same config the paid hub at /visibility/tools renders. */}
      {toolsSection}


      {/* 5. TIMELINE */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 05</b> — {t.tlx.label}</p>
          <h2 className={s.h2}>{t.tlx.h2}</h2>
          <div className={s.trajLayout}><div className={s.timeline}>
            {t.tlx.items.map((it) => (
              <div className={`${s.tl} ${it.hot ? s.tlHot : ""} ${s.reveal}`} key={it.w}>
                <span className={s.tlw}>{it.w}</span>
                <div className={s.tlt}>{it.t}</div>
                <div className={s.tld}>{it.d}</div>
                <div className={it.hot ? s.tlmGold : s.tlm}>{it.m}</div>
              </div>
            ))}
          </div>
          {/* Same player as the /04 overview: click to toggle, arrow overlay,
              mute chip while playing, caption under the box. Already sized by
              .foundVideo (9/16), the same box HomeVideo is used with there, so
              className passthrough was all this needed — no aspect override. */}
          <HomeVideo
            wrapClassName={s.trajVideoWrap}
            className={s.foundVideo}
            src="/videos/90-Days-AI-Visibility_1080p_caption.mp4"
            poster="/videos/90-Days-AI-Visibility_1080p_caption-poster.jpg"
            ariaLabel={t.tlx.videoLabel}
            labels={playerLabels}
          />
        </div>
        </div>
      </section>

      {/* 6. SIMULATOR */}
      <section id="simulator" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 06</b> — {t.sim.label}</p>
          <h2 className={s.h2}>{t.sim.h2}</h2>
          <p className={s.sub}>{t.sim.sub}</p>
          <div className={s.sim}>
            <div className={s.simq}><span className={s.simqic}>{t.sim.promptLbl}</span><span>{t.sim.prompt}</span></div>
            <div className={s.simtabs} role="tablist">
              {(["chatgpt", "perplexity", "google"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={engKey === k}
                  className={engKey === k ? s.simtabOn : s.simtab}
                  onClick={() => setEngKey(k)}>
                  {k === "chatgpt" ? "ChatGPT" : k === "perplexity" ? "Perplexity" : "Google AI"}
                </button>
              ))}
            </div>
            <div className={s.simans}>
              {sim.answers.map((a, i) => (
                <div className={s.simrow} key={i}><span className={s.simrank}>{i + 1}.</span><span>{a}</span></div>
              ))}
              {sim.missing && <div className={s.simmiss}><span className={s.simrank}>✕</span><span>{t.sim.missRow}</span></div>}
            </div>
            <div className={s.simgrid}>
              <div className={s.simcol}>
                <div className={s.simhR}>{sim.missing ? t.sim.whyMiss : t.sim.whyNot1}</div>
                <ul className={s.simWhy}>{sim.why.map((w, i) => <li key={i}><i>▸</i>{w}</li>)}</ul>
              </div>
              <div className={s.simcol}>
                <div className={s.simhG}>{t.sim.fixes}</div>
                <ul className={s.simFix}>{sim.fix.map(([f, m], i) => <li key={i}><i>✓</i><span><b>{f}</b> — {m}</span></li>)}</ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SEO VS AIV */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 07</b> — {t.cmp.label}</p>
          <h2 className={s.h2}>{t.cmp.h2a}<span className={s.goldtext}>{t.cmp.h2b}</span></h2>
          <p className={s.sub}>{t.cmp.sub}</p>
          <div className={s.cmp}>
            <div className={`${s.cmpr} ${s.cmphead}`}><div className={s.cmpold}>{t.cmp.oldH}</div><div className={s.cmpnew}>{t.cmp.newH}</div></div>
            {t.cmp.rows.map(([o, n]) => (
              <div className={s.cmpr} key={o}><div className={s.cmpold}><s>{o}</s></div><div className={s.cmpnew}>{n}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. ENGINES */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 08</b> — {t.eng.label}</p>
          <h2 className={s.h2}>{t.eng.h2}</h2>
          <p className={s.sub}>{t.eng.sub}</p>
          <div className={s.englogos}>
            {["ChatGPT", "Google AI", "Perplexity", "Claude", "Gemini", "Microsoft Copilot"].map((n) => (
              <div className={`${s.elogo} ${s.reveal}`} key={n}><span className={s.edot} />{n} <span className={s.est}>{t.eng.daily}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* 8b. TRADITIONAL REPUTATION STACK */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 09</b> — {t.trad.label}</p>
          <div className={s.foundLayout}>
            {/* This one used to loop. HomeVideo does not, and a clip the
                visitor deliberately started should end rather than restart
                behind them — same behaviour as the other three now. */}
            <HomeVideo
              wrapClassName={s.foundVideoWrap}
              className={s.foundVideo}
              src="/videos/Avatar_Video_with_captions.mp4"
              poster="/videos/Avatar_Video_with_captions-poster.jpg"
              ariaLabel={t.trad.videoLabel}
              labels={playerLabels}
            />
            <div>
              <h2 className={s.h2}>{t.trad.h2}</h2>
              <p className={s.sub}>{t.trad.sub}</p>
              <div className={s.englogos}>
                {t.trad.platforms.map(([n, role]) => (
                  <div className={`${s.elogo} ${s.reveal}`} key={n}><span className={s.edot} />{n} <span className={s.est}>{role}</span></div>
                ))}
              </div>
              <p className={s.label} style={{ marginTop: 22, lineHeight: 1.8 }}>{t.trad.feats}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. HISTORY */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 10</b> — {t.hist.label}<Tm /></p>
          <h2 className={s.h2}>{t.hist.h2}</h2>
          <p className={s.sub}>{t.hist.sub}</p>
          <div className={s.hist}>
            {HIST.map((h) => (
              <div className={`${s.hcard} ${s.reveal}`} key={h.n}>
                <div className={s.hk}><span className={s.hn}>{h.n}</span><span className={h.up ? s.ht : s.htRed}>{h.t}</span></div>
                <div className={s.hv}>{h.v} {t.hist.unit}</div>
                <svg viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden>
                  <polyline fill="none" stroke={h.col} strokeWidth="2" points={h.pts} />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. ROADMAP */}
      <section className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 11</b> — {t.rmx.label}</p>
          <h2 className={s.h2}>{t.rmx.h2}</h2>
          <p className={s.sub}>{t.rmx.sub}</p>
          <div className={s.roadmap}>
            {t.rmx.items.map((r) => (
              <div className={`${s.rm} ${s.reveal}`} key={r.t}>
                <span className={r.p === 1 ? s.rp1 : r.p === 2 ? s.rp2 : s.rp3}>P{r.p}</span>
                <span className={s.rt}>{r.t}<small>{r.d}</small></span>
                <span className={s.rlift}>{r.lift}</span>
                <span className={s.rimp}>{r.imp}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. ROI */}
      <section id="roi" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 12</b> — {t.roi.label}<Tm /></p>
          <h2 className={s.h2}>{t.roi.h2}</h2>
          <p className={s.sub}>{t.roi.sub}</p>
          <div className={s.roi}>
            <div className={s.roiin}>
              <div className={s.field}>
                <label>{t.roi.leads} <output>{leads}</output></label>
                <input className={s.range} type="range" min={5} max={500} step={5} value={leads} onChange={(e) => setLeads(+e.target.value)} />
              </div>
              <div className={s.field}>
                <label>{t.roi.sale} <output>{money(sale)}</output></label>
                <input className={s.range} type="range" min={50} max={10000} step={50} value={sale} onChange={(e) => setSale(+e.target.value)} />
              </div>
              <div className={s.field}>
                <label>{t.roi.cur} <output>{cur}</output></label>
                <input className={s.range} type="range" min={0} max={100} value={cur} onChange={(e) => setCur(+e.target.value)} />
              </div>
              <div className={s.fieldLast}>
                <label>{t.roi.tgt} <output>{tEff}</output></label>
                <input className={s.range} type="range" min={0} max={100} value={tEff} onChange={(e) => setTgt(+e.target.value)} />
              </div>
            </div>
            <div className={s.roiout}>
              <div className={s.rok}>{t.roi.xleads}</div>
              <div className={`${s.romid} ${s.goldtext}`}>+{Math.round(extraLeads)} {t.roi.leadsUnit}</div>
              <div className={s.rok}>{t.roi.xmo}</div>
              <div className={s.romid}>{money(monthly)} {t.roi.perMo}</div>
              <div className={s.rok}>{t.roi.xyr}</div>
              <div className={`${s.robig} ${s.goldtext}`}>{money(monthly * 12)} {t.roi.perYr}</div>
              <div className={s.ronote}>{t.roi.note}</div>
            </div>
          </div>
        </div>
      </section>

      <TestimonialSection />

      {/* 12. PRICING (compact, keeps #pricing anchor) */}
      <section id="pricing" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 13</b> — {t.pricing.label}</p>
          {baseOf(locale) === "en" && locale !== "en-CA" && (
            <p><Link className={s.label} href="/en-CA#pricing">{t.pricing.cadLink}</Link></p>
          )}
          <PricingSection
            locale={locale}
            pricing={pricing}
            priceChrome={priceChrome}
            liveToolCount={liveToolCount}
            tax={t.pricing.tax}
            currency={t.pricing.currency}
            header={null}
          />
        </div>
      </section>

      {/* 13. FAQ — rendered from faq-data.ts, the same source the FAQPage
           JSON-LD in page.tsx reads. Answers are always visible (not collapsed)
           so the structured data matches what a crawler sees. */}
      <section id="faq" className={s.section}>
        <div className={s.container}>
          <p className={s.label}><b>/ 14</b> — {faq.label}</p>
          <h2 className={s.h2}>{faq.h2}</h2>
          <p className={s.sub}>{faq.sub}</p>
          <div className={s.faqLayout}>
            <div className={s.faq}>
            {faq.items.map((it) => (
              <div className={`${s.faqItem} ${s.reveal}`} key={it.q}>
                <h3 className={s.faqQ}>{it.q}</h3>
                <p className={s.faqA}>{it.a}</p>
              </div>
            ))}
          </div>
            {/* .faqVideo is its own class but the same 9/16 box as
                .foundVideo, so the className passthrough is all this needs. */}
            {locale === 'en' && (
              <HomeVideo
                wrapClassName={s.faqVideoWrap}
                className={s.faqVideo}
                src="/videos/faq-intro.mp4"
                poster="/videos/faq-intro-poster.jpg"
                ariaLabel={t.faqVideoLabel}
                labels={playerLabels}
              />
            )}
          </div>
        </div>
      </section>

      {/* 14. CLOSE */}
      <section className={s.section}><div className={s.container}><p className={s.label}><b>/ 15</b> — RESOURCES</p><h2 className={s.h2}>Reputation Intelligence, Made Simple</h2><p className={s.sub}>The plain-English guide to running Echorank: the 30-minute setup, daily operating rhythm, AI visibility and answer tracking, and risk &amp; competitor intelligence. Free PDF, no email required.</p><a className={`${s.btn} ${s.btnPrimary}`} href="/whitepapers/Echorank_Reputation_Intelligence_Whitepaper.pdf" download target="_blank" rel="noopener">{t.resources.repPaper} ↓</a> <a className={s.btn} href="/whitepapers/echorank360-seo-tools-whitepaper.pdf" download target="_blank" rel="noopener">{t.resources.seoPaper} ↓</a> {/*
        A plain <a>, and a plain path, for two separate reasons.

        NOT <Link>: /extension is served by Caddy from /opt/echorank/extension-dist
        (handle_path /extension/*), outside the Next app entirely. next/link would
        try a client-side route transition to a route that does not exist in the
        router and land on the 404 rather than the install page.

        NO LOCALE PREFIX: same reason. Caddy serves one copy of that directory;
        L() would produce /en/extension, which the locale routing owns and Caddy
        never sees.

        The glyph is ↗, not the ↓ its two neighbours carry: they download a file,
        this navigates to the install page. Pointing it at the .crx directly is
        exactly what the guide modal and video exist to prevent, so promising a
        download here would be the wrong signal.

        The lint rule below assumes any bare path is a Next page and wants
        <Link>. Here that assumption is false and following it would break the
        link, so it is disabled at this one line rather than left to grow the
        repo's no-html-link-for-pages baseline.
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className={s.btn} href="/extension">{t.resources.extension} ↗</a></div></section><section className={s.close}>
        <div className={s.container}>
          <p className={s.label}><b>/ 16</b> — {t.close.label}</p>
          <h2 className={s.h2c}>{t.close.h2a}<span className={s.goldtext}>{t.close.h2b}</span></h2>
          <p className={s.closesub} style={{ maxWidth: 560 }}>{t.close.sub}</p>
          <div className={s.closebtns}>
            {/* Same target as the hero's identical CTA (line ~493). This said
                /register, which asked for a signup for the one thing the
                product deliberately does without one. */}
            <Link className={`${s.btn} ${s.btnPrimary}`} href={L("/free-audit")}>{t.close.cta1}</Link>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setDemoOpen(true)}>{t.close.cta2}</button>
          </div>
        </div>
      </section>

      <DemoVideoModal locale={locale} open={demoOpen} onClose={() => setDemoOpen(false)} />

      <footer className={s.footer}>
        <div className={`${s.container} ${s.footin}`}>
          <span>© 2026 ECHORANK / CHATLOGIC INSIGHTS LTD</span>
          <span className={s.footlinks}>
            {t.foot.links.map(([href, lbl]) => <Link key={href} href={L(href)}>{lbl}</Link>)}
          </span>
        </div>
      </footer>
    </div>
  );
}
