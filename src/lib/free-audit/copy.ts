// src/lib/free-audit/copy.ts — the words of the free AI Readiness Audit page
// and its result (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2), en and fr. The
// page is en/fr (de-CH and en-CA read en, fr-CA reads fr), as it was. The
// gate and check titles and fixes come from src/lib/i18n/readiness.ts, by id.
//
// NAME: "AI Readiness Audit" (the tool) and "AI readiness score" (its number).
// It reads the site; it asks no AI engine anything, so nothing here promises
// answer tracking.
//
// Dependency-free: the Client Components import it. Numbers arrive as
// arguments (limits.ts, plan config); none is typed here.

import type { Bot, BotStatus, CheckState, VerdictBand } from "./view";

export type AuditBase = "en" | "fr";
export function auditBaseOf(locale: string | null | undefined): AuditBase {
  return (locale ?? "").startsWith("fr") ? "fr" : "en";
}

export type Effort = "minutes" | "hour" | "hours" | "day";

/** Effort per gate or check id: how long the fix usually takes. */
export const EFFORT: Record<string, Effort> = {
  placeholder: "day",
  noindex: "minutes",
  "answer-bots-blocked": "minutes",
  challenge: "minutes",
  "js-only": "day",
  "thin-homepage": "hours",
  "few-pages": "day",
  "no-entity": "hour",
  "robots-answer-bots": "minutes",
  "home-reachable": "hours",
  "pages-reachable": "hour",
  "explicit-welcome": "minutes",
  "raw-content": "day",
  "render-gap": "day",
  "main-words": "hours",
  headings: "hour",
  answerable: "hours",
  specifics: "hour",
  "low-boilerplate": "hours",
  dates: "hour",
  "org-schema": "hour",
  "about-page": "hour",
  "contact-page": "minutes",
  nap: "hour",
  identity: "hour",
  https: "hour",
  sitemap: "hour",
  canonical: "minutes",
  indexable: "minutes",
  "titles-meta": "hour",
  "internal-links": "minutes",
};

interface ResultCopy {
  verdict: Record<VerdictBand, string>;
  benchmark: (pct: number) => string;
  topFixesTitle: string;
  why: string;
  fix: string;
  effortLabel: string;
  effort: Record<Effort, string>;
  whyById: Record<string, string>;
  recover: (n: number) => string;
  snippet: { robots: string; org: string; copy: string; copied: string };
  crawlers: {
    title: string;
    lead: string;
    cols: { bot: string; status: string; rule: string; meaning: string };
    status: Record<BotStatus, string>;
    noRule: string;
    meaning: (bot: Bot, status: BotStatus) => string;
    cloudflare: string;
  };
  checks: { title: string; state: Record<CheckState, string>; group: (points: number, max: number) => string };
  bridge: { text: string; cta: string };
  upsell: {
    title: string;
    allowance: (prompts: number, engines: string, cadence: string) => string;
    body: string;
    cta: (price: string) => string;
    linkAuthority: (price: string) => string;
    nosyBat: (pages: string, name: string) => string;
  };
  keep: {
    title: string;
    pdf: string;
    pdfBusy: string;
    pdfErr: string;
    permalink: (days: number) => string;
    copyLink: string;
    linkCopied: string;
    noPermalink: string;
    emailLabel: string;
    emailPh: string;
    emailSend: string;
    emailBusy: string;
    consent: string;
    emailSent: string;
    emailErr: Record<"invalid" | "expired" | "rate_limited" | "already_sent" | "country_not_available" | "send_failed" | "generic", string>;
  };
  again: string;
  expired: { title: string; body: (days: number) => string; cta: string };
}

export interface AuditPageCopy {
  metaTitle: string;
  metaDescription: string;
  label: string;
  h1: string;
  heroSub: string;
  toolLine: string;
  form: { label: string; placeholder: string; run: string; fine: (perDay: number, hours: number) => string };
  steps: { title: string; items: string[]; note: string };
  errors: {
    invalid: string;
    unreachable: string;
    generic: string;
    rateLimited: (when: string | null, perDay: number, hours: number) => string;
  };
  what: { label: string; title: string; items: { h: string; p: string }[] };
  how: { label: string; title: string; steps: { h: string; p: string }[] };
  cta: { title: string; p: string; button: string };
  faq: { label: string; title: string; items: (perDay: number, hours: number) => { q: string; a: string }[] };
  result: ResultCopy;
}

const EN_WHY: Record<string, string> = {
  placeholder: "A parked or placeholder page tells an engine there is no business here to describe.",
  noindex: "Search indexes drop a noindex page, and AI search answers draw on those indexes.",
  "answer-bots-blocked": "With every major answer bot blocked, ChatGPT search, Claude and Perplexity cannot read your pages at all.",
  challenge: "A bot challenge stops AI fetchers before they see a word; to them the site is empty.",
  "js-only": "Most AI crawlers do not run JavaScript, so text that appears only after scripts run is invisible to them.",
  "thin-homepage": "With little text on the homepage, an engine has nothing specific to quote about you.",
  "few-pages": "Too few indexable pages leave little for an answer to draw on.",
  "no-entity": "Without an About page or business details, an engine cannot tell who is behind the site.",
  "robots-answer-bots": "Blocked answer bots cannot read your pages, so they cannot quote or cite them.",
  "home-reachable": "If the homepage does not return its text to a crawler, nothing else gets read.",
  "pages-reachable": "Inner pages that fail for a crawler are pages an answer can never cite.",
  "explicit-welcome": "Naming the answer bots with Allow: / removes any doubt about what you allow.",
  "raw-content": "AI crawlers read the HTML the server sends; text missing from it is not there for them.",
  "render-gap": "Content that only appears after JavaScript runs is missed by most AI crawlers.",
  "main-words": "Specific, substantial copy is what an engine can quote when it describes you.",
  headings: "Clear headings tell a reader, and a crawler, what each part of the page answers.",
  answerable: "Questions answered on the page, lists and tables are the passages answers lift.",
  specifics: "Prices, addresses, hours and numbers are the facts an answer quotes.",
  "low-boilerplate": "When menus and footers outweigh your copy, the page says little of its own.",
  dates: "A visible date tells a reader and an engine that the page is current.",
  "org-schema": "Organization or LocalBusiness markup helps Google and Bing identify your business.",
  "about-page": "An About page says who runs the business, which is what a recommendation needs.",
  "contact-page": "Contact details written as text are facts an engine can confirm and repeat.",
  nap: "The same name, address and phone everywhere is what makes your details trustworthy.",
  identity: "A named owner or author gives an answer a person to attribute the business to.",
  https: "Plain HTTP is a trust problem for every crawler and browser.",
  sitemap: "A sitemap lists the pages you want found, so crawlers do not have to guess.",
  canonical: "A canonical link tells indexes which URL is the page, so its signals are not split.",
  indexable: "A noindex homepage is dropped from the search indexes AI search draws on.",
  "titles-meta": "A page's title is what search matches a question against.",
  "internal-links": "Links from the homepage are how crawlers find your key pages.",
};

const FR_WHY: Record<string, string> = {
  placeholder: "Une page parquée ou provisoire indique au moteur qu’il n’y a aucune entreprise à décrire.",
  noindex: "Les index de recherche écartent une page noindex, et les réponses de recherche IA s’appuient sur ces index.",
  "answer-bots-blocked": "Avec tous les grands robots de réponse bloqués, la recherche ChatGPT, Claude et Perplexity ne peuvent pas lire vos pages.",
  challenge: "Un défi anti-robot arrête les robots d’IA avant le premier mot : pour eux, le site est vide.",
  "js-only": "La plupart des robots d’IA n’exécutent pas JavaScript : un texte qui n’apparaît qu’après les scripts leur est invisible.",
  "thin-homepage": "Avec peu de texte sur la page d’accueil, un moteur n’a rien de précis à citer sur vous.",
  "few-pages": "Trop peu de pages indexables laissent peu de matière à une réponse.",
  "no-entity": "Sans page À propos ni coordonnées, un moteur ne sait pas qui est derrière le site.",
  "robots-answer-bots": "Des robots de réponse bloqués ne lisent pas vos pages : ils ne peuvent ni les citer ni y renvoyer.",
  "home-reachable": "Si la page d’accueil ne rend pas son texte à un robot, rien d’autre n’est lu.",
  "pages-reachable": "Les pages internes qui échouent pour un robot ne seront jamais citées.",
  "explicit-welcome": "Nommer les robots de réponse avec Allow: / lève tout doute sur ce que vous autorisez.",
  "raw-content": "Les robots d’IA lisent le HTML envoyé par le serveur ; un texte absent de ce HTML n’existe pas pour eux.",
  "render-gap": "Le contenu qui n’apparaît qu’après JavaScript échappe à la plupart des robots d’IA.",
  "main-words": "Un texte précis et substantiel, c’est ce qu’un moteur peut citer pour vous décrire.",
  headings: "Des titres clairs disent au lecteur, et au robot, à quoi répond chaque partie de la page.",
  answerable: "Les questions traitées sur la page, les listes et les tableaux sont les passages que reprennent les réponses.",
  specifics: "Les prix, adresses, horaires et chiffres sont les faits qu’une réponse cite.",
  "low-boilerplate": "Quand menus et pieds de page pèsent plus que votre texte, la page dit peu de choses par elle-même.",
  dates: "Une date visible indique au lecteur et au moteur que la page est à jour.",
  "org-schema": "Le balisage Organization ou LocalBusiness aide Google et Bing à identifier votre entreprise.",
  "about-page": "Une page À propos dit qui dirige l’entreprise : c’est ce qu’une recommandation demande.",
  "contact-page": "Des coordonnées écrites en texte sont des faits qu’un moteur peut vérifier et répéter.",
  nap: "Le même nom, la même adresse et le même téléphone partout rendent vos informations fiables.",
  identity: "Un responsable ou un auteur nommé donne à la réponse une personne à qui rattacher l’entreprise.",
  https: "Le HTTP simple pose un problème de confiance à chaque robot et à chaque navigateur.",
  sitemap: "Un sitemap liste les pages à trouver, pour que les robots n’aient pas à deviner.",
  canonical: "Un lien canonique indique aux index quelle URL est la page, pour ne pas disperser ses signaux.",
  indexable: "Une page d’accueil noindex sort des index de recherche sur lesquels s’appuie la recherche IA.",
  "titles-meta": "Le titre d’une page est ce que la recherche compare à une question.",
  "internal-links": "Les liens depuis la page d’accueil sont le chemin des robots vers vos pages clés.",
};

const EN_MEANING: Record<Bot, { allowed: string; blocked: string }> = {
  "OAI-SearchBot": { allowed: "ChatGPT search can read your site.", blocked: "ChatGPT search can’t read your site (at most a plain link)." },
  "ChatGPT-User": { allowed: "ChatGPT can open your pages when a user asks it to.", blocked: "ChatGPT can’t open your pages when a user asks it to." },
  GPTBot: { allowed: "OpenAI may use your pages to train its models.", blocked: "OpenAI won’t train on your pages. ChatGPT search is not affected." },
  "Claude-SearchBot": { allowed: "Claude’s web search can read your site.", blocked: "Claude’s web search can’t read your site." },
  ClaudeBot: { allowed: "Anthropic may use your pages to train its models.", blocked: "Anthropic won’t train on your pages. Claude’s search is not affected." },
  PerplexityBot: { allowed: "Perplexity can index your site for its answers.", blocked: "Perplexity can’t index your site for its answers." },
  "Google-Extended": {
    allowed: "Google may use your pages for Gemini.",
    blocked: "Google won’t use your pages for Gemini. Google Search and AI Overviews are not affected.",
  },
};

const FR_MEANING: Record<Bot, { allowed: string; blocked: string }> = {
  "OAI-SearchBot": { allowed: "La recherche ChatGPT peut lire votre site.", blocked: "La recherche ChatGPT ne peut pas lire votre site (tout au plus un simple lien)." },
  "ChatGPT-User": { allowed: "ChatGPT peut ouvrir vos pages quand un utilisateur le lui demande.", blocked: "ChatGPT ne peut pas ouvrir vos pages quand un utilisateur le lui demande." },
  GPTBot: { allowed: "OpenAI peut utiliser vos pages pour entraîner ses modèles.", blocked: "OpenAI n’entraîne pas ses modèles sur vos pages. La recherche ChatGPT n’est pas touchée." },
  "Claude-SearchBot": { allowed: "La recherche web de Claude peut lire votre site.", blocked: "La recherche web de Claude ne peut pas lire votre site." },
  ClaudeBot: { allowed: "Anthropic peut utiliser vos pages pour entraîner ses modèles.", blocked: "Anthropic n’entraîne pas ses modèles sur vos pages. La recherche de Claude n’est pas touchée." },
  PerplexityBot: { allowed: "Perplexity peut indexer votre site pour ses réponses.", blocked: "Perplexity ne peut pas indexer votre site pour ses réponses." },
  "Google-Extended": {
    allowed: "Google peut utiliser vos pages pour Gemini.",
    blocked: "Google n’utilise pas vos pages pour Gemini. La recherche Google et les aperçus IA ne sont pas touchés.",
  },
};

const EN: AuditPageCopy = {
  metaTitle: "Free AI Readiness Audit: can AI read, trust and cite your site? | Echorank360",
  metaDescription:
    "Free AI Readiness Audit: check whether AI answer engines can read, trust and cite your website. AI readiness score, AI crawler access, the top fixes with copy-ready snippets, and a PDF. No account.",
  label: "FREE TOOL",
  h1: "Can AI read, trust and cite your website?",
  heroSub:
    "The AI Readiness Audit reads your site the way AI crawlers do: whether they are let in, whether your text is in the page, and whether the facts an answer quotes are there. No account, no card.",
  toolLine: "Checks crawler access, readable content, identity and discoverability. It asks no AI engine anything.",
  form: {
    label: "Your website",
    placeholder: "yourdomain.com",
    run: "Run the free audit",
    fine: (perDay, hours) => `No account needed. ${perDay === 1 ? "One audit" : `${perDay} audits`} per IP address every ${hours} hours.`,
  },
  steps: {
    title: "Auditing your site",
    items: [
      "Fetching your homepage and key pages",
      "Reading robots.txt and the AI crawler rules",
      "Rendering the page the way a crawler sees it",
      "Checking content, identity and discoverability",
      "Scoring",
    ],
    note: "Usually 20 to 40 seconds.",
  },
  errors: {
    invalid: "Enter a public website, like yourdomain.com.",
    unreachable: "We couldn’t reach that website. Check the address, make sure the site is up, and try again. This didn’t use your free audit.",
    generic: "The audit could not run. Try again in a minute.",
    rateLimited: (when, perDay, hours) =>
      when
        ? `You’ve used your free audit: ${perDay === 1 ? "one" : perDay} per IP address every ${hours} hours. You can run the next one at ${when}.`
        : `You’ve used your free audit: ${perDay === 1 ? "one" : perDay} per IP address every ${hours} hours. Try again later.`,
  },
  what: {
    label: "WHAT YOU GET",
    title: "What you get",
    items: [
      { h: "An AI readiness score", p: "One number, 0–100, for whether AI answer engines can read, trust and cite your site. Anything capping it is named." },
      { h: "The fixes worth the most", p: "The top three, each with why it matters, what to do, how long it takes and, where it helps, a snippet to copy." },
      { h: "AI crawler access", p: "For each AI crawler: allowed, blocked or challenged, the robots.txt line that decides it, and what that means." },
    ],
  },
  how: {
    label: "HOW IT WORKS",
    title: "How it works",
    steps: [
      { h: "Enter your domain", p: "No signup form, no email gate." },
      { h: "We read your site", p: "Your public pages, the way AI crawlers and search engines see them." },
      { h: "Read your result", p: "Score, fixes and every check, with a PDF and a link that lasts a week." },
    ],
  },
  cta: {
    title: "Want to know what AI actually says about you?",
    p: "The audit shows whether AI can read your site. The AI Visibility plan asks the engines your customers’ questions every day and alerts you when you drop out.",
    button: "See plans & pricing →",
  },
  faq: {
    label: "FAQ",
    title: "Common questions",
    items: (perDay, hours) => [
      { q: "Is it really free?", a: `Yes. ${perDay === 1 ? "One audit" : `${perDay} audits`} per IP address every ${hours} hours, no account and no card.` },
      { q: "What do you do with my domain?", a: "We read publicly available pages only. The result is kept for a week so its link works, the score is counted (without your domain) for the benchmark, and you are not added to any mailing list." },
      {
        q: "Does it check what ChatGPT says about me?",
        a: "No. The AI Readiness Audit checks whether AI engines can read, trust and cite your site; it asks no engine anything. To see what the engines say, run the free AI Visibility Check.",
      },
    ],
  },
  result: {
    verdict: {
      strong: "AI engines can read and trust this site. Keep it that way.",
      good: "AI engines can read this site; a few fixes would make it easier to cite.",
      fair: "AI engines can read parts of this site, but important signals are missing.",
      weak: "AI engines will struggle to read or trust this site as it is.",
      poor: "As it stands, AI engines can’t use this site.",
    },
    benchmark: (pct) => `Higher than ${pct}% of sites checked.`,
    topFixesTitle: "Top 3 fixes",
    why: "Why it matters",
    fix: "The fix",
    effortLabel: "Effort",
    effort: { minutes: "minutes", hour: "about an hour", hours: "a few hours", day: "a day or more" },
    whyById: EN_WHY,
    recover: (n) => `up to +${n} points`,
    snippet: { robots: "robots.txt lines to add", org: "JSON-LD to paste in your homepage <head>", copy: "Copy", copied: "Copied" },
    crawlers: {
      title: "AI crawler access",
      lead: "What each AI crawler is allowed to do on your site, from your robots.txt.",
      cols: { bot: "Crawler", status: "Status", rule: "Deciding rule", meaning: "What it means" },
      status: { allowed: "Allowed", blocked: "Blocked", challenged: "Challenged", unknown: "Not checked" },
      noRule: "No rule (allowed by default)",
      meaning: (bot, status) =>
        status === "challenged"
          ? `A bot challenge stops it before it reads anything: ${EN_MEANING[bot].blocked}`
          : status === "unknown"
            ? "Not checked."
            : EN_MEANING[bot][status],
      cloudflare: "Cloudflare is in front of your site. Its “Block AI bots” switch can block these crawlers whatever robots.txt says: check Security → Bots.",
    },
    checks: {
      title: "All checks",
      state: { pass: "Pass", partial: "Partial", fail: "Fail", not_assessable: "Not assessable", not_scored: "Not scored" },
      group: (p, m) => `${p} / ${m}`,
    },
    bridge: { text: "This shows whether AI can read you. See whether AI actually recommends you.", cta: "Run the free AI Visibility Check" },
    upsell: {
      title: "AI Visibility plan",
      allowance: (prompts, engines, cadence) => `${prompts} prompts · ${engines} · ${cadence}`,
      body: "Track this score daily and get an alert when it drops.",
      cta: (price) => `See AI Visibility, ${price}/mo`,
      linkAuthority: (price) => `Link Authority Checker: included in every plan from ${price}.`,
      nosyBat: (pages, name) => `Crawl ${pages} pages free with ${name}.`,
    },
    keep: {
      title: "Keep this result",
      pdf: "Download the PDF",
      pdfBusy: "Preparing the PDF…",
      pdfErr: "The PDF could not be created. Try again.",
      permalink: (days) => `Link to this result, valid for ${days} days:`,
      copyLink: "Copy link",
      linkCopied: "Link copied",
      noPermalink: "This result has no link (it could not be saved). Download the PDF to keep it.",
      emailLabel: "Email me the PDF (optional)",
      emailPh: "you@example.com",
      emailSend: "Send",
      emailBusy: "Sending…",
      consent: "Also send me occasional emails about AI visibility. You can unsubscribe at any time.",
      emailSent: "Sent. Check your inbox.",
      emailErr: {
        invalid: "Enter a valid email address.",
        expired: "This result has expired. Run a new audit to get its PDF.",
        rate_limited: "Too many emails from this connection today. Download the PDF instead.",
        already_sent: "This result’s PDF has already been emailed.",
        country_not_available: "Email isn’t available in your country yet. Download the PDF instead.",
        send_failed: "The email could not be sent. Download the PDF instead, or try again later.",
        generic: "Something went wrong. Download the PDF instead.",
      },
    },
    again: "Audit another site",
    expired: {
      title: "This result has expired",
      body: (days) => `Results stay online for ${days} days. Run the audit again to see where the site stands today.`,
      cta: "Run the free audit",
    },
  },
};

const FR: AuditPageCopy = {
  metaTitle: "Audit de préparation IA gratuit : l’IA peut-elle lire, croire et citer votre site ? | Echorank360",
  metaDescription:
    "Audit de préparation IA gratuit : vérifiez si les moteurs de réponse IA peuvent lire votre site, s’y fier et le citer. Score, accès des robots d’IA, les correctifs prioritaires avec des extraits prêts à copier, et un PDF. Sans compte.",
  label: "OUTIL GRATUIT",
  h1: "L’IA peut-elle lire, croire et citer votre site ?",
  heroSub:
    "L’audit de préparation IA lit votre site comme le font les robots d’IA : sont-ils autorisés, votre texte est-il dans la page, les faits qu’une réponse cite sont-ils là ? Sans compte, sans carte.",
  toolLine: "Vérifie l’accès des robots, le contenu lisible, l’identité et la découvrabilité. Il n’interroge aucun moteur d’IA.",
  form: {
    label: "Votre site web",
    placeholder: "votredomaine.com",
    run: "Lancer l’audit gratuit",
    fine: (perDay, hours) => `Aucun compte requis. ${perDay === 1 ? "Un audit" : `${perDay} audits`} par adresse IP toutes les ${hours} heures.`,
  },
  steps: {
    title: "Audit de votre site en cours",
    items: [
      "Récupération de la page d’accueil et des pages clés",
      "Lecture du robots.txt et des règles des robots d’IA",
      "Rendu de la page telle qu’un robot la voit",
      "Vérification du contenu, de l’identité et de la découvrabilité",
      "Calcul du score",
    ],
    note: "Généralement de 20 à 40 secondes.",
  },
  errors: {
    invalid: "Saisissez un site web public, comme votredomaine.com.",
    unreachable: "Nous n’avons pas pu joindre ce site. Vérifiez l’adresse et que le site est en ligne, puis réessayez. Votre audit gratuit n’a pas été utilisé.",
    generic: "L’audit n’a pas pu s’exécuter. Réessayez dans une minute.",
    rateLimited: (when, perDay, hours) =>
      when
        ? `Vous avez utilisé votre audit gratuit : ${perDay === 1 ? "un" : perDay} par adresse IP toutes les ${hours} heures. Vous pourrez lancer le suivant le ${when}.`
        : `Vous avez utilisé votre audit gratuit : ${perDay === 1 ? "un" : perDay} par adresse IP toutes les ${hours} heures. Réessayez plus tard.`,
  },
  what: {
    label: "CE QUE VOUS OBTENEZ",
    title: "Ce que vous obtenez",
    items: [
      { h: "Un score de préparation IA", p: "Un chiffre de 0 à 100 : les moteurs de réponse IA peuvent-ils lire votre site, s’y fier et le citer ? Ce qui plafonne le score est nommé." },
      { h: "Les correctifs qui rapportent le plus", p: "Les trois premiers, chacun avec pourquoi il compte, quoi faire, combien de temps cela prend et, quand c’est utile, un extrait à copier." },
      { h: "L’accès des robots d’IA", p: "Pour chaque robot d’IA : autorisé, bloqué ou soumis à un défi, la ligne du robots.txt qui en décide, et ce que cela signifie." },
    ],
  },
  how: {
    label: "COMMENT ÇA MARCHE",
    title: "Comment ça marche",
    steps: [
      { h: "Saisissez votre domaine", p: "Aucun formulaire d’inscription, aucune adresse exigée." },
      { h: "Nous lisons votre site", p: "Vos pages publiques, telles que les voient les robots d’IA et les moteurs de recherche." },
      { h: "Lisez votre résultat", p: "Score, correctifs et toutes les vérifications, avec un PDF et un lien valable une semaine." },
    ],
  },
  cta: {
    title: "Envie de savoir ce que l’IA dit vraiment de vous ?",
    p: "L’audit montre si l’IA peut lire votre site. Le forfait Visibilité IA pose chaque jour les questions de vos clients aux moteurs et vous alerte quand vous disparaissez.",
    button: "Voir les forfaits et tarifs →",
  },
  faq: {
    label: "FAQ",
    title: "Questions fréquentes",
    items: (perDay, hours) => [
      { q: "Est-ce vraiment gratuit ?", a: `Oui. ${perDay === 1 ? "Un audit" : `${perDay} audits`} par adresse IP toutes les ${hours} heures, sans compte ni carte.` },
      { q: "Que faites-vous de mon domaine ?", a: "Nous lisons uniquement des pages publiques. Le résultat est conservé une semaine pour que son lien fonctionne, le score est compté (sans votre domaine) pour la comparaison, et vous n’êtes ajouté à aucune liste de diffusion." },
      {
        q: "Vérifie-t-il ce que ChatGPT dit de moi ?",
        a: "Non. L’audit de préparation IA vérifie si les moteurs d’IA peuvent lire votre site, s’y fier et le citer ; il n’interroge aucun moteur. Pour voir ce que disent les moteurs, lancez la Vérification de visibilité IA gratuite.",
      },
    ],
  },
  result: {
    verdict: {
      strong: "Les moteurs d’IA peuvent lire ce site et s’y fier. Gardez-le ainsi.",
      good: "Les moteurs d’IA peuvent lire ce site ; quelques correctifs le rendraient plus facile à citer.",
      fair: "Les moteurs d’IA lisent une partie de ce site, mais des signaux importants manquent.",
      weak: "En l’état, les moteurs d’IA auront du mal à lire ce site ou à s’y fier.",
      poor: "En l’état, les moteurs d’IA ne peuvent pas utiliser ce site.",
    },
    benchmark: (pct) => `Mieux que ${pct} % des sites vérifiés.`,
    topFixesTitle: "Les 3 correctifs prioritaires",
    why: "Pourquoi c’est important",
    fix: "Le correctif",
    effortLabel: "Effort",
    effort: { minutes: "quelques minutes", hour: "environ une heure", hours: "quelques heures", day: "une journée ou plus" },
    whyById: FR_WHY,
    recover: (n) => `jusqu’à +${n} points`,
    snippet: { robots: "Lignes à ajouter au robots.txt", org: "JSON-LD à coller dans le <head> de votre page d’accueil", copy: "Copier", copied: "Copié" },
    crawlers: {
      title: "Accès des robots d’IA",
      lead: "Ce que chaque robot d’IA a le droit de faire sur votre site, d’après votre robots.txt.",
      cols: { bot: "Robot", status: "Statut", rule: "Règle décisive", meaning: "Ce que cela signifie" },
      status: { allowed: "Autorisé", blocked: "Bloqué", challenged: "Défi anti-robot", unknown: "Non vérifié" },
      noRule: "Aucune règle (autorisé par défaut)",
      meaning: (bot, status) =>
        status === "challenged"
          ? `Un défi anti-robot l’arrête avant toute lecture : ${FR_MEANING[bot].blocked}`
          : status === "unknown"
            ? "Non vérifié."
            : FR_MEANING[bot][status],
      cloudflare: "Cloudflare est devant votre site. Son option « Block AI bots » peut bloquer ces robots quoi que dise le robots.txt : vérifiez Security → Bots.",
    },
    checks: {
      title: "Toutes les vérifications",
      state: { pass: "Réussi", partial: "Partiel", fail: "Échec", not_assessable: "Non évaluable", not_scored: "Non noté" },
      group: (p, m) => `${p} / ${m}`,
    },
    bridge: { text: "Ceci montre si l’IA peut vous lire. Voyez si l’IA vous recommande vraiment.", cta: "Lancer la Vérification de visibilité IA gratuite" },
    upsell: {
      title: "Forfait Visibilité IA",
      allowance: (prompts, engines, cadence) => `${prompts} requêtes · ${engines} · ${cadence}`,
      body: "Suivez ce score chaque jour et recevez une alerte s’il baisse.",
      cta: (price) => `Voir Visibilité IA, ${price}/mois`,
      linkAuthority: (price) => `Link Authority Checker : inclus dans toutes les formules dès ${price}.`,
      nosyBat: (pages, name) => `Explorez ${pages} pages gratuitement avec ${name}.`,
    },
    keep: {
      title: "Conserver ce résultat",
      pdf: "Télécharger le PDF",
      pdfBusy: "Préparation du PDF…",
      pdfErr: "Le PDF n’a pas pu être créé. Réessayez.",
      permalink: (days) => `Lien vers ce résultat, valable ${days} jours :`,
      copyLink: "Copier le lien",
      linkCopied: "Lien copié",
      noPermalink: "Ce résultat n’a pas de lien (il n’a pas pu être enregistré). Téléchargez le PDF pour le garder.",
      emailLabel: "M’envoyer le PDF par courriel (facultatif)",
      emailPh: "vous@exemple.com",
      emailSend: "Envoyer",
      emailBusy: "Envoi…",
      consent: "M’envoyer aussi, de temps en temps, des courriels sur la visibilité IA. Désinscription possible à tout moment.",
      emailSent: "Envoyé. Consultez votre boîte de réception.",
      emailErr: {
        invalid: "Saisissez une adresse courriel valide.",
        expired: "Ce résultat a expiré. Lancez un nouvel audit pour obtenir son PDF.",
        rate_limited: "Trop de courriels depuis cette connexion aujourd’hui. Téléchargez plutôt le PDF.",
        already_sent: "Le PDF de ce résultat a déjà été envoyé.",
        country_not_available: "L’envoi par courriel n’est pas encore disponible dans votre pays. Téléchargez plutôt le PDF.",
        send_failed: "Le courriel n’a pas pu être envoyé. Téléchargez plutôt le PDF, ou réessayez plus tard.",
        generic: "Une erreur s’est produite. Téléchargez plutôt le PDF.",
      },
    },
    again: "Auditer un autre site",
    expired: {
      title: "Ce résultat a expiré",
      body: (days) => `Les résultats restent en ligne ${days} jours. Relancez l’audit pour voir où en est le site aujourd’hui.`,
      cta: "Lancer l’audit gratuit",
    },
  },
};

export const AUDIT_COPY: Record<AuditBase, AuditPageCopy> = { en: EN, fr: FR };

/** The name everywhere it is shown (nav, footer, page, PDF, metadata). */
export const AUDIT_NAME: Record<AuditBase, string> = { en: "AI Readiness Audit", fr: "Audit de préparation IA" };
