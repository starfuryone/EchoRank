// src/lib/reddit-threads/copy.ts — every string of the free Reddit Threads
// Finder, en / fr / de-CH. en-CA folds to en and fr-CA to fr (redditLocale).
// Dependency-free: the page, the client form and the API error bodies all
// read it. de-CH uses ss, never ß.

import { CSV_PER_IP_PER_DAY, SEARCHES_PER_IP_PER_DAY, type TimeFilter } from "./config";

export type RedditLocale = "en" | "fr" | "de-CH";

export function redditLocale(locale: string | null | undefined): RedditLocale {
  const l = (locale ?? "").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de-CH";
  return "en";
}

export type RedditErrorCode =
  | "invalid_keyword"
  | "invalid_country"
  | "invalid_email"
  | "turnstile"
  | "no_ip"
  | "rate_limited"
  | "budget"
  | "upstream"
  | "unavailable"
  | "expired"
  | "generic";

export interface RedditCopy {
  name: string;
  blurb: string;
  intro: string;
  /** The line under the results: why these threads matter. */
  aiLine: string;
  metaTitle: string;
  metaDescription: string;
  limitNote: string;
  /** The line above the CTA buttons. */
  upsell: string;
  ctaButton: string;
  allTools: string;
  form: {
    keywordLabel: string;
    keywordPlaceholder: string;
    countryLabel: string;
    timeLabel: string;
    time: Record<TimeFilter, string>;
    submit: string;
    searching: string;
  };
  result: {
    heading: (n: number, keyword: string) => string;
    none: string;
    position: string;
    forums: string;
    opens: string;
    again: string;
  };
  gate: {
    title: string;
    body: string;
    emailLabel: string;
    consent: string;
    submit: string;
    working: string;
  };
  errors: Record<RedditErrorCode, string>;
  faq: { q: string; a: string }[];
}

const en: RedditCopy = {
  name: "Reddit Threads Finder",
  blurb: "The Reddit threads Google ranks for a keyword, by country, with a link to each.",
  intro:
    "Type a keyword and pick a country: we ask Google for the Reddit threads it ranks for it there, with the subreddit, Google's snippet and the date when Google shows one.",
  aiLine:
    "AI answers often cite Reddit, so these are the threads to join: answer the question well, say who you are, and you have a better chance of being part of the answer.",
  metaTitle: "Free Reddit thread finder: the threads Google ranks for a keyword",
  metaDescription:
    "Find the Reddit threads Google ranks for any keyword, by country and date range. Free, no account needed.",
  limitNote: `${SEARCHES_PER_IP_PER_DAY} free searches a day. A search someone already ran this week is free and does not count.`,
  upsell: "Echorank360 tracks your keywords over time, and whether AI assistants name you for them.",
  ctaButton: "Track these keywords",
  allTools: "All free tools",
  form: {
    keywordLabel: "Keyword",
    keywordPlaceholder: "e.g. best crm for small business",
    countryLabel: "Country",
    timeLabel: "Posted",
    time: { any: "Any time", year: "Past year", month: "Past month" },
    submit: "Find threads",
    searching: "Searching…",
  },
  result: {
    heading: (n, k) => `${n} Reddit thread${n === 1 ? "" : "s"} Google ranks for “${k}”`,
    none: "Google lists no Reddit threads for this keyword in this country and date range. Try a broader keyword or “Any time”.",
    position: "Position",
    forums: "From Google's Discussions and forums box",
    opens: "(opens in a new tab)",
    again: "New search",
  },
  gate: {
    title: "Download these threads as CSV",
    body: "Enter your email and the download starts at once.",
    emailLabel: "Email",
    consent: "Send me occasional tips and product news (you can unsubscribe at any time).",
    submit: "Download CSV",
    working: "Preparing…",
  },
  errors: {
    invalid_keyword: "Enter a keyword (up to 120 characters).",
    invalid_country: "Pick a country from the list.",
    invalid_email: "Enter a valid email address.",
    turnstile: "Please complete the check above and try again.",
    no_ip: "We could not verify your connection. Please try again from a normal browser.",
    rate_limited: `You have used today's ${SEARCHES_PER_IP_PER_DAY} free searches. Come back tomorrow, or see the plans to track keywords every day.`,
    budget: "Today's free searches have run out for everyone. Come back tomorrow; searches already run this week still work.",
    upstream: "Google's results did not come through. Please try again in a minute; it did not use one of your searches.",
    unavailable: "The tool is not available right now. Please try again later.",
    expired: "This search is no longer stored. Run it again, then download.",
    generic: "Something went wrong. Please try again.",
  },
  faq: [
    {
      q: "Where do these threads come from?",
      a: "From Google's own results for site:reddit.com and your keyword, in the country you pick, through our search-data provider. We never fetch pages from reddit.com and never use Reddit's API.",
    },
    {
      q: "Why join Reddit threads at all?",
      a: "AI assistants often cite Reddit when they answer, and Google ranks these threads for real searches. A useful, honest answer in the right thread is seen by people and can be read by the engines.",
    },
    {
      q: "Why is the date missing on some threads?",
      a: "We show the date only when Google prints one in its result. We do not open the thread to look it up.",
    },
    {
      q: `How many searches can I run?`,
      a: `${SEARCHES_PER_IP_PER_DAY} a day. A search anyone already ran this week for the same keyword, country and date range is served from our store and does not count. CSV downloads: ${CSV_PER_IP_PER_DAY} a day.`,
    },
  ],
};

const fr: RedditCopy = {
  name: "Détecteur de fils Reddit",
  blurb: "Les fils Reddit que Google classe pour un mot-clé, par pays, avec un lien vers chacun.",
  intro:
    "Entrez un mot-clé et choisissez un pays : nous demandons à Google les fils Reddit qu'il y classe pour ce mot-clé, avec le subreddit, l'extrait de Google et la date quand Google l'affiche.",
  aiLine:
    "Les réponses des IA citent souvent Reddit : ce sont donc les fils où intervenir. Répondez bien à la question, dites qui vous êtes, et vous avez plus de chances de faire partie de la réponse.",
  metaTitle: "Détecteur gratuit de fils Reddit : ceux que Google classe pour un mot-clé",
  metaDescription:
    "Trouvez les fils Reddit que Google classe pour n'importe quel mot-clé, par pays et par période. Gratuit, sans compte.",
  limitNote: `${SEARCHES_PER_IP_PER_DAY} recherches gratuites par jour. Une recherche déjà faite cette semaine est gratuite et ne compte pas.`,
  upsell: "Echorank360 suit vos mots-clés dans le temps, et vérifie si les assistants IA vous citent pour eux.",
  ctaButton: "Suivre ces mots-clés",
  allTools: "Tous les outils gratuits",
  form: {
    keywordLabel: "Mot-clé",
    keywordPlaceholder: "p. ex. meilleur crm pour pme",
    countryLabel: "Pays",
    timeLabel: "Publié",
    time: { any: "N'importe quand", year: "Depuis un an", month: "Depuis un mois" },
    submit: "Trouver les fils",
    searching: "Recherche…",
  },
  result: {
    heading: (n, k) => `${n} fil${n > 1 ? "s" : ""} Reddit classé${n > 1 ? "s" : ""} par Google pour « ${k} »`,
    none: "Google ne liste aucun fil Reddit pour ce mot-clé dans ce pays et sur cette période. Essayez un mot-clé plus large ou « N'importe quand ».",
    position: "Position",
    forums: "Tiré de l'encadré « Discussions et forums » de Google",
    opens: "(s'ouvre dans un nouvel onglet)",
    again: "Nouvelle recherche",
  },
  gate: {
    title: "Télécharger ces fils en CSV",
    body: "Entrez votre courriel et le téléchargement démarre aussitôt.",
    emailLabel: "Courriel",
    consent: "Envoyez-moi de temps en temps des conseils et des nouveautés (désinscription à tout moment).",
    submit: "Télécharger le CSV",
    working: "Préparation…",
  },
  errors: {
    invalid_keyword: "Entrez un mot-clé (120 caractères au plus).",
    invalid_country: "Choisissez un pays dans la liste.",
    invalid_email: "Entrez une adresse courriel valide.",
    turnstile: "Veuillez compléter la vérification ci-dessus et réessayer.",
    no_ip: "Nous n'avons pas pu vérifier votre connexion. Réessayez depuis un navigateur habituel.",
    rate_limited: `Vous avez utilisé vos ${SEARCHES_PER_IP_PER_DAY} recherches gratuites du jour. Revenez demain, ou consultez les forfaits pour suivre vos mots-clés chaque jour.`,
    budget: "Les recherches gratuites du jour sont épuisées pour tout le monde. Revenez demain ; les recherches déjà faites cette semaine fonctionnent toujours.",
    upstream: "Les résultats de Google ne sont pas arrivés. Réessayez dans une minute ; cela n'a pas compté comme une recherche.",
    unavailable: "L'outil n'est pas disponible pour le moment. Réessayez plus tard.",
    expired: "Cette recherche n'est plus enregistrée. Relancez-la, puis téléchargez.",
    generic: "Une erreur s'est produite. Veuillez réessayer.",
  },
  faq: [
    {
      q: "D'où viennent ces fils ?",
      a: "Des résultats de Google pour site:reddit.com et votre mot-clé, dans le pays choisi, par l'intermédiaire de notre fournisseur de données de recherche. Nous ne chargeons jamais de pages de reddit.com et n'utilisons pas l'API de Reddit.",
    },
    {
      q: "Pourquoi intervenir dans des fils Reddit ?",
      a: "Les assistants IA citent souvent Reddit dans leurs réponses, et Google classe ces fils pour de vraies recherches. Une réponse utile et honnête dans le bon fil est lue par les gens et peut l'être par les moteurs.",
    },
    {
      q: "Pourquoi la date manque-t-elle sur certains fils ?",
      a: "Nous n'affichons la date que si Google l'indique dans son résultat. Nous n'ouvrons pas le fil pour la chercher.",
    },
    {
      q: "Combien de recherches puis-je faire ?",
      a: `${SEARCHES_PER_IP_PER_DAY} par jour. Une recherche déjà faite cette semaine pour le même mot-clé, le même pays et la même période vient de notre stockage et ne compte pas. Téléchargements CSV : ${CSV_PER_IP_PER_DAY} par jour.`,
    },
  ],
};

const de: RedditCopy = {
  name: "Reddit-Thread-Finder",
  blurb: "Die Reddit-Threads, die Google für ein Keyword rankt, nach Land, mit Link zu jedem.",
  intro:
    "Geben Sie ein Keyword ein und wählen Sie ein Land: Wir fragen Google nach den Reddit-Threads, die es dort dafür rankt, mit Subreddit, Googles Snippet und dem Datum, wenn Google eines zeigt.",
  aiLine:
    "KI-Antworten zitieren oft Reddit, also sind das die Threads, in denen Sie mitreden sollten: Beantworten Sie die Frage gut, sagen Sie, wer Sie sind, und Ihre Chance steigt, Teil der Antwort zu werden.",
  metaTitle: "Gratis Reddit-Thread-Finder: die Threads, die Google für ein Keyword rankt",
  metaDescription:
    "Finden Sie die Reddit-Threads, die Google für ein beliebiges Keyword rankt, nach Land und Zeitraum. Gratis, ohne Konto.",
  limitNote: `${SEARCHES_PER_IP_PER_DAY} Gratis-Suchen pro Tag. Eine Suche, die diese Woche schon jemand gemacht hat, ist gratis und zählt nicht.`,
  upsell: "Echorank360 verfolgt Ihre Keywords über die Zeit und prüft, ob KI-Assistenten Sie dafür nennen.",
  ctaButton: "Diese Keywords verfolgen",
  allTools: "Alle Gratis-Tools",
  form: {
    keywordLabel: "Keyword",
    keywordPlaceholder: "z. B. bestes crm für kmu",
    countryLabel: "Land",
    timeLabel: "Veröffentlicht",
    time: { any: "Jederzeit", year: "Letztes Jahr", month: "Letzter Monat" },
    submit: "Threads finden",
    searching: "Suche läuft…",
  },
  result: {
    heading: (n, k) => `${n} Reddit-Thread${n === 1 ? "" : "s"}, die Google für «${k}» rankt`,
    none: "Google listet für dieses Keyword in diesem Land und Zeitraum keine Reddit-Threads. Versuchen Sie ein breiteres Keyword oder «Jederzeit».",
    position: "Position",
    forums: "Aus Googles Box «Diskussionen und Foren»",
    opens: "(öffnet in einem neuen Tab)",
    again: "Neue Suche",
  },
  gate: {
    title: "Diese Threads als CSV herunterladen",
    body: "Geben Sie Ihre E-Mail-Adresse ein, und der Download startet sofort.",
    emailLabel: "E-Mail",
    consent: "Senden Sie mir gelegentlich Tipps und Produktneuigkeiten (Abmeldung jederzeit möglich).",
    submit: "CSV herunterladen",
    working: "Wird vorbereitet…",
  },
  errors: {
    invalid_keyword: "Geben Sie ein Keyword ein (höchstens 120 Zeichen).",
    invalid_country: "Wählen Sie ein Land aus der Liste.",
    invalid_email: "Geben Sie eine gültige E-Mail-Adresse ein.",
    turnstile: "Bitte schliessen Sie die Prüfung oben ab und versuchen Sie es erneut.",
    no_ip: "Wir konnten Ihre Verbindung nicht prüfen. Bitte versuchen Sie es mit einem normalen Browser erneut.",
    rate_limited: `Sie haben die ${SEARCHES_PER_IP_PER_DAY} Gratis-Suchen von heute aufgebraucht. Kommen Sie morgen wieder, oder sehen Sie sich die Abos an, um Keywords täglich zu verfolgen.`,
    budget: "Die Gratis-Suchen von heute sind für alle aufgebraucht. Kommen Sie morgen wieder; Suchen, die diese Woche schon liefen, funktionieren weiterhin.",
    upstream: "Die Google-Ergebnisse sind nicht angekommen. Bitte versuchen Sie es in einer Minute erneut; es hat keine Suche verbraucht.",
    unavailable: "Das Werkzeug ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.",
    expired: "Diese Suche ist nicht mehr gespeichert. Führen Sie sie erneut aus und laden Sie dann herunter.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
  faq: [
    {
      q: "Woher kommen diese Threads?",
      a: "Aus Googles eigenen Ergebnissen für site:reddit.com und Ihr Keyword, im gewählten Land, über unseren Anbieter für Suchdaten. Wir laden nie Seiten von reddit.com und nutzen die Reddit-API nicht.",
    },
    {
      q: "Warum überhaupt in Reddit-Threads mitreden?",
      a: "KI-Assistenten zitieren in ihren Antworten oft Reddit, und Google rankt diese Threads für echte Suchen. Eine hilfreiche, ehrliche Antwort im richtigen Thread lesen Menschen, und die Engines können sie lesen.",
    },
    {
      q: "Warum fehlt bei manchen Threads das Datum?",
      a: "Wir zeigen das Datum nur, wenn Google es im Ergebnis angibt. Wir öffnen den Thread nicht, um es nachzuschlagen.",
    },
    {
      q: "Wie viele Suchen kann ich machen?",
      a: `${SEARCHES_PER_IP_PER_DAY} pro Tag. Eine Suche, die diese Woche schon jemand mit demselben Keyword, Land und Zeitraum gemacht hat, kommt aus unserem Speicher und zählt nicht. CSV-Downloads: ${CSV_PER_IP_PER_DAY} pro Tag.`,
    },
  ],
};

export const REDDIT_COPY: Record<RedditLocale, RedditCopy> = { en, fr, "de-CH": de };
