// src/lib/site-crawler/free-copy.ts
//
// Copy for the free public site crawler (/[locale]/free-tools/site-crawler and
// its result page /r/<token>), en and fr. Marketing locales fold onto these
// two: fr, fr-CA → fr; everything else → en. The crawler's name comes from
// brand.ts; every number from free-limits.ts or the caller (the paid ceiling is
// read from the plan config, never written here). Dependency-free beyond
// those, so the Client Components import it directly.

import { CRAWLER_BRAND } from "./brand";
import { FREE_CRAWL_ABUSE_EMAIL, FREE_CRAWL_IP_DAILY, FREE_CRAWL_RETENTION_DAYS, FREE_CRAWL_URL_CAP } from "./free-limits";

export type FreeBase = "en" | "fr";
export const freeBase = (locale: string): FreeBase => (locale.startsWith("fr") ? "fr" : "en");

const NB = CRAWLER_BRAND.name;

export interface FreeCrawlerCopy {
  name: string;
  blurb: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  limitNote: string;
  urlLabel: string;
  urlPlaceholder: string;
  submit: string;
  starting: string;
  challengeNote: string;
  abuse: string;
  progress: {
    title: string;
    queued: (position: number | null) => string;
    crawling: (pages: number, cap: number) => string;
    done: string;
    failed: string;
    reused: string;
  };
  errors: Record<string, string>;
  result: {
    kicker: string;
    lockupAlt: string;
    pagesCrawled: string;
    health: string;
    healthHelp: string;
    kinds: { issue: string; warning: string; opportunity: string };
    fixFirst: string;
    fixFirstHelp: string;
    fixFirstNone: string;
    pages: (n: string) => string;
    findings: (n: string) => string;
    fullTitle: string;
    fullHelp: string;
    unlockTitle: string;
    unlockBody: string;
    emailLabel: string;
    consentLabel: string;
    unlockButton: string;
    unlocking: string;
    csv: string;
    share: string;
    copied: string;
    kept: (date: string) => string;
    ctaTitle: (maxUrls: string) => string;
    ctaBody: string;
    ctaButton: string;
    again: string;
    lockedNote: string;
    kindLabel: { issue: string; warning: string; opportunity: string };
    priority: { high: string; medium: string; low: string };
    stopped: Record<string, string>;
  };
  faq: { q: string; a: string }[];
}

export const FREE_CRAWLER_COPY: Record<FreeBase, FreeCrawlerCopy> = {
  en: {
    name: "Free site crawler",
    blurb: `${NB} crawls ${FREE_CRAWL_URL_CAP} pages of any site and tells you what to fix first.`,
    intro: `${NB} crawls up to ${FREE_CRAWL_URL_CAP} pages of a site the way a search engine does (robots.txt obeyed, two requests a second) and scores what it finds against the full rule library. No account needed.`,
    metaTitle: `Free site crawler: audit ${FREE_CRAWL_URL_CAP} pages`,
    metaDescription: `Crawl ${FREE_CRAWL_URL_CAP} pages of any site for free: site health score, issues by kind and the five problems to fix first.`,
    limitNote: `${FREE_CRAWL_URL_CAP} pages, raw HTML, one crawl per site per day and ${FREE_CRAWL_IP_DAILY} crawls per visitor per day. Results are kept ${FREE_CRAWL_RETENTION_DAYS} days.`,
    urlLabel: "Site to crawl",
    urlPlaceholder: "https://example.com",
    submit: `Crawl ${FREE_CRAWL_URL_CAP} pages free`,
    starting: "Starting…",
    challengeNote: "A quick check that you are not a robot.",
    abuse: `Own a site and want the free crawler to stay away? Write to ${FREE_CRAWL_ABUSE_EMAIL} and we will stop crawling it.`,
    progress: {
      title: `${NB} is crawling`,
      queued: (p) => (p && p > 1 ? `Waiting in line: position ${p}.` : "Next in line, starting shortly."),
      crawling: (n, cap) => `Crawling: ${n} of ${cap} pages.`,
      done: "Done. Opening your results…",
      failed: "The crawl could not finish. Try again later.",
      reused: "This site was crawled in the last 24 hours, so here is that result.",
    },
    errors: {
      invalid_url: "Enter a public website address, such as https://example.com.",
      blocked: "The owner of this site has asked us not to crawl it.",
      turnstile: "The robot check failed. Try it again.",
      unavailable: "The free crawler is unavailable right now. Try again in a few minutes.",
      rate_limited: `You have used today's ${FREE_CRAWL_IP_DAILY} free crawls. Come back tomorrow.`,
      busy: "This site is being started right now. Try again in a moment.",
      no_ip: "We could not identify your connection. Try again from another network.",
      invalid_email: "Enter a valid email address.",
      generic: "Something went wrong. Try again.",
    },
    result: {
      kicker: "FREE CRAWL RESULT",
      lockupAlt: `${CRAWLER_BRAND.nameTm}, ${CRAWLER_BRAND.byline}`,
      pagesCrawled: "Pages crawled",
      health: "Site health",
      healthHelp: "0 to 100, from high-priority findings per page.",
      kinds: { issue: "Issues", warning: "Warnings", opportunity: "Opportunities" },
      fixFirst: "Fix first",
      fixFirstHelp: "The high-priority problems that touch the most pages.",
      fixFirstNone: "No high-priority problem found. Nice.",
      pages: (n) => `${n} pages`,
      findings: (n) => `${n} findings`,
      fullTitle: "Every finding",
      fullHelp: "Every rule that fired on this crawl, with the CSV of each affected URL.",
      unlockTitle: "See every finding and download the CSV",
      unlockBody: "Enter your email to unlock the full list for this browser.",
      emailLabel: "Email",
      consentLabel: "Send me SEO tips and product news from Echorank (you can unsubscribe at any time; we ask you to confirm first).",
      unlockButton: "Unlock the full list",
      unlocking: "Unlocking…",
      csv: "Download CSV",
      share: "Copy result link",
      copied: "Link copied",
      kept: (d) => `Kept until ${d}.`,
      ctaTitle: (m) => `Crawl your whole site: up to ${m} URLs, every export, on a schedule`,
      ctaBody: "JavaScript rendering, segments, comparisons between crawls, scheduled crawls with email alerts, and the API.",
      ctaButton: "See plans and pricing",
      again: "Crawl another site",
      lockedNote: "Hidden until you unlock it.",
      kindLabel: { issue: "Issue", warning: "Warning", opportunity: "Opportunity" },
      priority: { high: "High", medium: "Medium", low: "Low" },
      stopped: {
        url_cap: `Stopped at the free limit of ${FREE_CRAWL_URL_CAP} pages.`,
        time_cap: "Stopped at the free crawl's time limit.",
      },
    },
    faq: [
      {
        q: "What does the free crawl check?",
        a: `The same rule library as the paid crawler: status codes, titles and descriptions, headings, canonicals, redirects, broken links, indexability, structured data and more, on up to ${FREE_CRAWL_URL_CAP} pages of raw HTML.`,
      },
      {
        q: "Does it respect my robots.txt?",
        a: `Yes. ${NB} identifies itself as Echorank360Bot, obeys robots.txt and fetches at most two pages a second.`,
      },
      {
        q: "How long are results kept?",
        a: `${FREE_CRAWL_RETENTION_DAYS} days. Anyone with the result link can see it until then; the full list needs an email.`,
      },
    ],
  },
  fr: {
    name: "Crawler de site gratuit",
    blurb: `${NB} explore ${FREE_CRAWL_URL_CAP} pages de n'importe quel site et vous dit quoi corriger en premier.`,
    intro: `${NB} explore jusqu'à ${FREE_CRAWL_URL_CAP} pages d'un site comme le ferait un moteur de recherche (robots.txt respecté, deux requêtes par seconde) et évalue ce qu'il trouve avec toute la bibliothèque de règles. Aucun compte requis.`,
    metaTitle: `Crawler de site gratuit : auditez ${FREE_CRAWL_URL_CAP} pages`,
    metaDescription: `Explorez gratuitement ${FREE_CRAWL_URL_CAP} pages de n'importe quel site : score de santé, problèmes par type et les cinq points à corriger en premier.`,
    limitNote: `${FREE_CRAWL_URL_CAP} pages, HTML brut, une exploration par site par jour et ${FREE_CRAWL_IP_DAILY} explorations par visiteur par jour. Les résultats sont conservés ${FREE_CRAWL_RETENTION_DAYS} jours.`,
    urlLabel: "Site à explorer",
    urlPlaceholder: "https://exemple.com",
    submit: `Explorer ${FREE_CRAWL_URL_CAP} pages gratuitement`,
    starting: "Démarrage…",
    challengeNote: "Une vérification rapide que vous n'êtes pas un robot.",
    abuse: `Vous êtes propriétaire d'un site et ne voulez pas que le crawler gratuit le visite ? Écrivez à ${FREE_CRAWL_ABUSE_EMAIL} et nous cesserons de l'explorer.`,
    progress: {
      title: `${NB} explore le site`,
      queued: (p) => (p && p > 1 ? `En file d'attente : position ${p}.` : "Prochain dans la file, démarrage imminent."),
      crawling: (n, cap) => `Exploration : ${n} pages sur ${cap}.`,
      done: "Terminé. Ouverture des résultats…",
      failed: "L'exploration n'a pas pu aboutir. Réessayez plus tard.",
      reused: "Ce site a été exploré au cours des dernières 24 heures : voici ce résultat.",
    },
    errors: {
      invalid_url: "Saisissez l'adresse d'un site public, par exemple https://exemple.com.",
      blocked: "Le propriétaire de ce site nous a demandé de ne pas l'explorer.",
      turnstile: "La vérification anti-robot a échoué. Réessayez.",
      unavailable: "Le crawler gratuit est indisponible pour le moment. Réessayez dans quelques minutes.",
      rate_limited: `Vous avez utilisé vos ${FREE_CRAWL_IP_DAILY} explorations gratuites du jour. Revenez demain.`,
      busy: "Ce site est en cours de démarrage. Réessayez dans un instant.",
      no_ip: "Nous n'avons pas pu identifier votre connexion. Réessayez depuis un autre réseau.",
      invalid_email: "Saisissez une adresse courriel valide.",
      generic: "Une erreur s'est produite. Réessayez.",
    },
    result: {
      kicker: "RÉSULTAT DE L'EXPLORATION GRATUITE",
      lockupAlt: `${CRAWLER_BRAND.nameTm}, crawler par Echorank`,
      pagesCrawled: "Pages explorées",
      health: "Santé du site",
      healthHelp: "De 0 à 100, selon les problèmes prioritaires par page.",
      kinds: { issue: "Problèmes", warning: "Avertissements", opportunity: "Opportunités" },
      fixFirst: "À corriger en premier",
      fixFirstHelp: "Les problèmes prioritaires qui touchent le plus de pages.",
      fixFirstNone: "Aucun problème prioritaire. Bravo.",
      pages: (n) => `${n} pages`,
      findings: (n) => `${n} constats`,
      fullTitle: "Tous les constats",
      fullHelp: "Chaque règle déclenchée par cette exploration, avec le CSV de toutes les URL concernées.",
      unlockTitle: "Voir tous les constats et télécharger le CSV",
      unlockBody: "Saisissez votre courriel pour débloquer la liste complète dans ce navigateur.",
      emailLabel: "Courriel",
      consentLabel: "Envoyez-moi des conseils SEO et les nouveautés d'Echorank (désinscription possible à tout moment ; nous vous demandons d'abord de confirmer).",
      unlockButton: "Débloquer la liste complète",
      unlocking: "Déblocage…",
      csv: "Télécharger le CSV",
      share: "Copier le lien du résultat",
      copied: "Lien copié",
      kept: (d) => `Conservé jusqu'au ${d}.`,
      ctaTitle: (m) => `Explorez tout votre site : jusqu'à ${m} URL, tous les exports, selon un calendrier`,
      ctaBody: "Rendu JavaScript, segments, comparaison entre explorations, explorations planifiées avec alertes par courriel, et l'API.",
      ctaButton: "Voir les forfaits et les prix",
      again: "Explorer un autre site",
      lockedNote: "Masqué jusqu'au déblocage.",
      kindLabel: { issue: "Problème", warning: "Avertissement", opportunity: "Opportunité" },
      priority: { high: "Haute", medium: "Moyenne", low: "Basse" },
      stopped: {
        url_cap: `Arrêtée à la limite gratuite de ${FREE_CRAWL_URL_CAP} pages.`,
        time_cap: "Arrêtée à la limite de durée de l'exploration gratuite.",
      },
    },
    faq: [
      {
        q: "Que vérifie l'exploration gratuite ?",
        a: `La même bibliothèque de règles que le crawler payant : codes HTTP, titres et descriptions, titres de section, URL canoniques, redirections, liens brisés, indexabilité, données structurées et plus encore, sur jusqu'à ${FREE_CRAWL_URL_CAP} pages de HTML brut.`,
      },
      {
        q: "Respecte-t-il mon robots.txt ?",
        a: `Oui. ${NB} s'identifie comme Echorank360Bot, respecte le robots.txt et ne charge pas plus de deux pages par seconde.`,
      },
      {
        q: "Combien de temps les résultats sont-ils conservés ?",
        a: `${FREE_CRAWL_RETENTION_DAYS} jours. Toute personne qui a le lien peut le consulter d'ici là ; la liste complète demande un courriel.`,
      },
    ],
  },
};
