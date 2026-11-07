// src/lib/authority-checker/copy.ts — every string of the free Website
// Authority Checker, en / fr / de-CH. en-CA folds to en and fr-CA to fr
// (authorityLocale). Dependency-free: the page, the client form and the API
// error bodies all read it.
//
// THE SCORE'S NAME IS "Echorank Authority", and it is always labelled as based
// on DataForSEO's backlink index. Other vendors' metric names never appear in
// this file (tests/authority-checker.test.ts scans every string for them).
//
// No fixed "good score" thresholds: the scale is relative to the index, so the
// copy tells people to compare with the sites they compete with instead.

export type AuthorityLocale = "en" | "fr" | "de-CH";

export function authorityLocale(locale: string | null | undefined): AuthorityLocale {
  const l = (locale ?? "").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de-CH";
  return "en";
}

export type AuthorityErrorCode =
  | "invalid_domain"
  | "invalid_competitor"
  | "too_many_competitors"
  | "turnstile"
  | "budget"
  | "rate_limited"
  | "no_ip"
  | "unavailable"
  | "upstream"
  | "not_found"
  | "invalid_email"
  | "generic";

export interface AuthoritySection {
  h: string;
  ps: string[];
}

export interface AuthorityCopy {
  name: string;
  blurb: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  limitNote: string;
  ctaTitle: string;
  /** "Track it monthly" — to /pricing?src=authority-checker. */
  ctaButton: string;
  allTools: string;
  form: {
    domainLabel: string;
    domainPlaceholder: string;
    competitorsLabel: string;
    competitorPlaceholder: (n: number) => string;
    submit: string;
    checking: string;
  };
  errors: Record<AuthorityErrorCode, string>;
  result: {
    scoreLabel: string;
    scoreSource: string;
    outOf: string;
    noRank: string;
    referringDomains: string;
    backlinks: string;
    dofollowShare: string;
    dofollowHint: string;
    checkedOn: (date: string) => string;
    aiTitle: string;
    aiBody: string;
    aiCta: string;
    again: string;
  };
  gate: {
    title: string;
    body: (competitors: number) => string;
    emailLabel: string;
    consent: string;
    submit: string;
    sending: string;
    privacy: string;
  };
  full: {
    refTitle: string;
    refEmpty: string;
    colDomain: string;
    colAuthority: string;
    colBacklinks: string;
    compTitle: string;
    compNone: string;
    colReferring: string;
    colDofollow: string;
    you: string;
    pdf: string;
    pending: string;
    retry: string;
  };
  sections: AuthoritySection[];
  faq: { q: string; a: string }[];
}

const en: AuthorityCopy = {
  name: "Website Authority Checker",
  blurb: "Your Echorank Authority, referring domains and backlinks, next to up to three competitors.",
  intro:
    "Enter a domain and up to three competitors. You get its Echorank Authority, a 0–100 score based on DataForSEO's backlink index, with its referring domains, backlinks and dofollow share. No account needed.",
  metaTitle: "Free Website Authority Checker — your Echorank Authority, 0–100",
  metaDescription:
    "Check any website's authority for free: its Echorank Authority, from 0 to 100, based on DataForSEO's backlink index, referring domains, backlinks and dofollow share, compared with your competitors.",
  limitNote: "Free, no account. 10 new checks per day; a domain checked in the last 7 days is served from cache.",
  ctaTitle: "Authority moves slowly. Watch it move.",
  ctaButton: "Track it monthly",
  allTools: "All free tools",
  form: {
    domainLabel: "Your domain",
    domainPlaceholder: "example.com",
    competitorsLabel: "Competitors (optional, up to 3)",
    competitorPlaceholder: (n) => `competitor${n}.com`,
    submit: "Check authority",
    checking: "Checking…",
  },
  errors: {
    invalid_domain: "Enter a domain like example.com.",
    invalid_competitor: "One of the competitors is not a domain. Use the form example.com.",
    too_many_competitors: "Add up to three competitors.",
    turnstile: "Please complete the check above the button.",
    budget:
      "The Authority Checker has used today's free data budget. It will be back tomorrow (midnight UTC). Domains checked in the last 7 days still load.",
    rate_limited: "You have used today's 10 free checks. They reset at midnight UTC.",
    no_ip: "We could not identify your connection, so this tool is unavailable. If you use a VPN or proxy, try disabling it.",
    unavailable: "This tool is briefly unavailable. Try again in a few minutes.",
    upstream: "The backlink data source did not answer. Try again in a few minutes.",
    not_found: "This result has expired. Run the check again.",
    invalid_email: "Enter a valid email address.",
    generic: "Something went wrong. Please try again.",
  },
  result: {
    scoreLabel: "Echorank Authority",
    scoreSource: "Based on DataForSEO's backlink index",
    outOf: "/ 100",
    noRank: "No score yet",
    referringDomains: "Referring domains",
    backlinks: "Backlinks",
    dofollowShare: "Dofollow share",
    dofollowHint: "Share of referring domains linking without rel=nofollow.",
    checkedOn: (d) => `Data from ${d}.`,
    aiTitle: "And how do AI assistants see this site?",
    aiBody: "Links help search engines trust a site. AI assistants also read structure, facts and sources. The free AI visibility audit scores that from 0 to 100.",
    aiCta: "Run the free AI audit",
    again: "Check another domain",
  },
  gate: {
    title: "See who links to you, and how you compare",
    body: (n) =>
      n > 0
        ? `Get your top 10 referring domains, the comparison with your ${n === 1 ? "competitor" : `${n} competitors`}, and a PDF of the report.`
        : "Get your top 10 referring domains and a PDF of the report. Add competitors above to compare with them too.",
    emailLabel: "Work email",
    consent: "Send me occasional tips and product news (you can unsubscribe at any time).",
    submit: "Show the full report",
    sending: "Unlocking…",
    privacy: "We use your email to send the report link and, only if you tick the box, our newsletter.",
  },
  full: {
    refTitle: "Top 10 referring domains",
    refEmpty: "The index holds no referring domains for this site yet.",
    colDomain: "Domain",
    colAuthority: "Echorank Authority",
    colBacklinks: "Backlinks",
    compTitle: "You and your competitors",
    compNone: "Add competitors to the check to compare with them.",
    colReferring: "Referring domains",
    colDofollow: "Dofollow",
    you: "you",
    pdf: "Download the PDF",
    pending: "The full report could not be loaded today: the free data budget is used up. Come back tomorrow and it will load.",
    retry: "Try again",
  },
  sections: [
    {
      h: "What is website authority?",
      ps: [
        "Website authority is a way of measuring how strongly the rest of the web vouches for a site. Every link from another site is a small vote of confidence, and a link from a site that is itself well linked carries more weight than one from a site nobody links to.",
        "Search engines have used links this way since the earliest days of Google, and they still do. A higher authority does not guarantee rankings, but it makes a site's pages easier to rank and quicker to be trusted.",
      ],
    },
    {
      h: "How Echorank Authority is calculated",
      ps: [
        "Echorank Authority is DataForSEO's domain rank, shown on a 0–100 scale. DataForSEO crawls the web continuously and keeps an index of the links it finds. The rank is computed over that link graph in the spirit of the original PageRank: a domain scores higher when strong domains link to it, and links from weak or spammy domains count for little.",
        "Referring domains counts the distinct sites linking to yours. Backlinks counts every link, so one site linking from a hundred pages adds a hundred backlinks but one referring domain. Dofollow share is the share of referring domains that link without rel=nofollow, the links search engines are asked to follow.",
        "Because the score is based on DataForSEO's index, other tools will show different numbers for the same site. Compare scores from the same source, over time and against the same competitors.",
      ],
    },
    {
      h: "What is a good Echorank Authority?",
      ps: [
        "There is no absolute good score. The scale is relative to the whole web, so a young local business and a national newspaper sit at very different points, and both can be healthy.",
        "The useful comparison is with the sites you compete with for the same searches. If they score well above you, links are likely part of why they outrank you. Add up to three competitors to the check to see the gap, and track it over months rather than days: authority moves slowly.",
      ],
    },
    {
      h: "How to improve your website authority",
      ps: [
        "Earn links from relevant, trusted sites: publish data, guides and tools that others want to cite, get listed in the directories and associations of your industry, and turn mentions of your brand that do not link into links.",
        "Grow referring domains rather than raw backlinks. Ten links from ten different sites do more than a hundred from one. Avoid paid link schemes and link farms: they add backlinks without adding authority, and can cost you rankings.",
        "Fix what you already have: redirect old URLs that still receive links, and repair broken pages that other sites point to.",
      ],
    },
  ],
  faq: [
    {
      q: "Is the Website Authority Checker free?",
      a: "Yes. The score, referring domains, backlinks and dofollow share are free with no account. The top 10 referring domains, the competitor comparison and the PDF need an email address.",
    },
    {
      q: "Where does the data come from?",
      a: "From DataForSEO's backlink index, the same data our paid backlink tools use. Echorank Authority is DataForSEO's domain rank on a 0–100 scale.",
    },
    {
      q: "Why is my score different in other SEO tools?",
      a: "Each tool crawls the web with its own crawler, keeps its own link index and uses its own formula. Scores from different sources are not comparable; compare like with like.",
    },
    {
      q: "How often is the data updated?",
      a: "Results are cached for 7 days per domain, so a domain checked this week shows the same numbers until the cache expires. Echorank's paid plans track your links every month, with history.",
    },
    {
      q: "Does a higher authority mean higher rankings?",
      a: "Not on its own. Authority reflects links, which are one of many ranking signals. Content, relevance, technical health and, for AI assistants, clear facts and sources matter as much.",
    },
  ],
};

const fr: AuthorityCopy = {
  name: "Vérificateur d'autorité de site",
  blurb: "Votre score d'autorité Echorank, vos domaines référents et vos backlinks, face à trois concurrents au plus.",
  intro:
    "Saisissez un domaine et jusqu'à trois concurrents. Vous obtenez son autorité Echorank, un score de 0 à 100 fondé sur l'index de backlinks de DataForSEO, avec ses domaines référents, ses backlinks et sa part de liens dofollow. Sans compte.",
  metaTitle: "Vérificateur d'autorité de site gratuit — score d'autorité Echorank",
  metaDescription:
    "Vérifiez gratuitement l'autorité de n'importe quel site : un score d'autorité Echorank de 0 à 100 fondé sur l'index de backlinks de DataForSEO, les domaines référents, les backlinks et la part dofollow, comparés à vos concurrents.",
  limitNote: "Gratuit, sans compte. 10 nouvelles vérifications par jour ; un domaine vérifié ces 7 derniers jours est servi depuis le cache.",
  ctaTitle: "L'autorité évolue lentement. Suivez-la.",
  ctaButton: "La suivre chaque mois",
  allTools: "Tous les outils gratuits",
  form: {
    domainLabel: "Votre domaine",
    domainPlaceholder: "exemple.fr",
    competitorsLabel: "Concurrents (facultatif, 3 au plus)",
    competitorPlaceholder: (n) => `concurrent${n}.fr`,
    submit: "Vérifier l'autorité",
    checking: "Vérification…",
  },
  errors: {
    invalid_domain: "Saisissez un domaine comme exemple.fr.",
    invalid_competitor: "L'un des concurrents n'est pas un domaine. Utilisez la forme exemple.fr.",
    too_many_competitors: "Ajoutez trois concurrents au plus.",
    turnstile: "Veuillez valider la vérification au-dessus du bouton.",
    budget:
      "Le vérificateur d'autorité a épuisé son budget de données gratuit du jour. Il revient demain (minuit UTC). Les domaines vérifiés ces 7 derniers jours restent disponibles.",
    rate_limited: "Vous avez utilisé vos 10 vérifications gratuites du jour. Elles se renouvellent à minuit UTC.",
    no_ip: "Nous n'avons pas pu identifier votre connexion : cet outil n'est donc pas disponible. Si vous utilisez un VPN ou un proxy, essayez de le désactiver.",
    unavailable: "Cet outil est momentanément indisponible. Réessayez dans quelques minutes.",
    upstream: "La source de données de backlinks n'a pas répondu. Réessayez dans quelques minutes.",
    not_found: "Ce résultat a expiré. Relancez la vérification.",
    invalid_email: "Saisissez une adresse e-mail valide.",
    generic: "Une erreur s'est produite. Veuillez réessayer.",
  },
  result: {
    scoreLabel: "Autorité Echorank",
    scoreSource: "Fondée sur l'index de backlinks de DataForSEO",
    outOf: "/ 100",
    noRank: "Pas encore de score",
    referringDomains: "Domaines référents",
    backlinks: "Backlinks",
    dofollowShare: "Part dofollow",
    dofollowHint: "Part des domaines référents qui font un lien sans rel=nofollow.",
    checkedOn: (d) => `Données du ${d}.`,
    aiTitle: "Et comment les assistants IA voient-ils ce site ?",
    aiBody: "Les liens aident les moteurs de recherche à faire confiance à un site. Les assistants IA lisent aussi la structure, les faits et les sources. L'audit gratuit de visibilité IA les note de 0 à 100.",
    aiCta: "Lancer l'audit IA gratuit",
    again: "Vérifier un autre domaine",
  },
  gate: {
    title: "Voyez qui fait des liens vers vous, et où vous en êtes",
    body: (n) =>
      n > 0
        ? `Recevez vos 10 principaux domaines référents, la comparaison avec ${n === 1 ? "votre concurrent" : `vos ${n} concurrents`} et le rapport en PDF.`
        : "Recevez vos 10 principaux domaines référents et le rapport en PDF. Ajoutez des concurrents ci-dessus pour vous comparer à eux.",
    emailLabel: "E-mail professionnel",
    consent: "Envoyez-moi de temps en temps des conseils et des nouveautés (désinscription à tout moment).",
    submit: "Afficher le rapport complet",
    sending: "Déverrouillage…",
    privacy: "Nous utilisons votre e-mail pour le lien du rapport et, seulement si vous cochez la case, pour notre lettre d'information.",
  },
  full: {
    refTitle: "Les 10 principaux domaines référents",
    refEmpty: "L'index ne contient encore aucun domaine référent pour ce site.",
    colDomain: "Domaine",
    colAuthority: "Autorité Echorank",
    colBacklinks: "Backlinks",
    compTitle: "Vous et vos concurrents",
    compNone: "Ajoutez des concurrents à la vérification pour vous comparer à eux.",
    colReferring: "Domaines référents",
    colDofollow: "Dofollow",
    you: "vous",
    pdf: "Télécharger le PDF",
    pending: "Le rapport complet n'a pas pu être chargé aujourd'hui : le budget de données gratuit est épuisé. Revenez demain, il se chargera.",
    retry: "Réessayer",
  },
  sections: [
    {
      h: "Qu'est-ce que l'autorité d'un site ?",
      ps: [
        "L'autorité d'un site mesure à quel point le reste du web se porte garant de lui. Chaque lien venu d'un autre site est un petit vote de confiance, et un lien venu d'un site lui-même bien lié pèse plus qu'un lien venu d'un site vers lequel personne ne pointe.",
        "Les moteurs de recherche utilisent les liens ainsi depuis les débuts de Google, et c'est toujours le cas. Une autorité élevée ne garantit pas un classement, mais elle aide les pages d'un site à se classer et à gagner la confiance plus vite.",
      ],
    },
    {
      h: "Comment l'autorité Echorank est calculée",
      ps: [
        "L'autorité Echorank est le rang de domaine de DataForSEO, affiché sur une échelle de 0 à 100. DataForSEO explore le web en continu et tient un index des liens qu'il trouve. Le rang est calculé sur ce graphe de liens dans l'esprit du PageRank d'origine : un domaine obtient un meilleur score quand des domaines forts pointent vers lui, et les liens de domaines faibles ou de spam comptent peu.",
        "Les domaines référents comptent les sites distincts qui font un lien vers le vôtre. Les backlinks comptent chaque lien : un site qui vous cite depuis cent pages ajoute cent backlinks mais un seul domaine référent. La part dofollow est la part des domaines référents qui font un lien sans rel=nofollow, les liens que les moteurs sont invités à suivre.",
        "Comme le score repose sur l'index de DataForSEO, d'autres outils affichent d'autres chiffres pour le même site. Comparez des scores de même source, dans le temps et face aux mêmes concurrents.",
      ],
    },
    {
      h: "Qu'est-ce qu'un bon score d'autorité ?",
      ps: [
        "Il n'y a pas de bon score dans l'absolu. L'échelle est relative à l'ensemble du web : une jeune entreprise locale et un grand quotidien national s'y placent très différemment, et tous deux peuvent être en bonne santé.",
        "La comparaison utile est celle avec les sites qui visent les mêmes recherches que vous. S'ils dépassent nettement votre score, les liens expliquent sans doute en partie pourquoi ils passent devant vous. Ajoutez jusqu'à trois concurrents pour mesurer l'écart, et suivez-le sur des mois plutôt que des jours : l'autorité évolue lentement.",
      ],
    },
    {
      h: "Comment améliorer l'autorité de votre site",
      ps: [
        "Obtenez des liens de sites pertinents et fiables : publiez des données, des guides et des outils que d'autres voudront citer, faites-vous référencer dans les annuaires et les associations de votre secteur, et transformez en liens les mentions de votre marque qui n'en ont pas.",
        "Visez plus de domaines référents plutôt que plus de backlinks. Dix liens venus de dix sites différents font plus que cent liens venus d'un seul. Évitez les liens payants et les fermes de liens : ils ajoutent des backlinks sans ajouter d'autorité, et peuvent vous coûter des positions.",
        "Tirez parti de l'existant : redirigez les anciennes URL qui reçoivent encore des liens et réparez les pages cassées vers lesquelles d'autres sites pointent.",
      ],
    },
  ],
  faq: [
    {
      q: "Le vérificateur d'autorité de site est-il gratuit ?",
      a: "Oui. Le score, les domaines référents, les backlinks et la part dofollow sont gratuits, sans compte. Les 10 principaux domaines référents, la comparaison avec vos concurrents et le PDF demandent une adresse e-mail.",
    },
    {
      q: "D'où viennent les données ?",
      a: "De l'index de backlinks de DataForSEO, les mêmes données que nos outils de backlinks payants. L'autorité Echorank est le rang de domaine de DataForSEO sur une échelle de 0 à 100.",
    },
    {
      q: "Pourquoi mon score diffère-t-il dans d'autres outils SEO ?",
      a: "Chaque outil explore le web avec son propre robot, tient son propre index de liens et applique sa propre formule. Des scores de sources différentes ne se comparent pas ; comparez ce qui est comparable.",
    },
    {
      q: "À quelle fréquence les données sont-elles mises à jour ?",
      a: "Les résultats sont mis en cache 7 jours par domaine : un domaine vérifié cette semaine affiche les mêmes chiffres jusqu'à l'expiration du cache. Les formules payantes d'Echorank suivent vos liens chaque mois, avec l'historique.",
    },
    {
      q: "Une autorité plus élevée signifie-t-elle un meilleur classement ?",
      a: "Pas à elle seule. L'autorité reflète les liens, qui sont un signal de classement parmi beaucoup d'autres. Le contenu, la pertinence, la santé technique et, pour les assistants IA, des faits et des sources clairs comptent tout autant.",
    },
  ],
};

const de: AuthorityCopy = {
  name: "Website-Autoritäts-Checker",
  blurb: "Ihre Echorank-Autorität, verweisende Domains und Backlinks, neben bis zu drei Mitbewerbern.",
  intro:
    "Geben Sie eine Domain und bis zu drei Mitbewerber ein. Sie erhalten ihre Echorank-Autorität, einen Wert von 0 bis 100 auf Basis des Backlink-Index von DataForSEO, mit verweisenden Domains, Backlinks und Dofollow-Anteil. Ohne Konto.",
  metaTitle: "Kostenloser Website-Autoritäts-Checker — Echorank-Autorität",
  metaDescription:
    "Prüfen Sie kostenlos die Autorität jeder Website: eine Echorank-Autorität von 0 bis 100 auf Basis des Backlink-Index von DataForSEO, verweisende Domains, Backlinks und Dofollow-Anteil, im Vergleich mit Ihren Mitbewerbern.",
  limitNote: "Kostenlos, ohne Konto. 10 neue Prüfungen pro Tag; eine in den letzten 7 Tagen geprüfte Domain kommt aus dem Cache.",
  ctaTitle: "Autorität ändert sich langsam. Behalten Sie sie im Blick.",
  ctaButton: "Monatlich verfolgen",
  allTools: "Alle kostenlosen Tools",
  form: {
    domainLabel: "Ihre Domain",
    domainPlaceholder: "beispiel.ch",
    competitorsLabel: "Mitbewerber (optional, bis zu 3)",
    competitorPlaceholder: (n) => `mitbewerber${n}.ch`,
    submit: "Autorität prüfen",
    checking: "Wird geprüft…",
  },
  errors: {
    invalid_domain: "Geben Sie eine Domain wie beispiel.ch ein.",
    invalid_competitor: "Einer der Mitbewerber ist keine Domain. Verwenden Sie die Form beispiel.ch.",
    too_many_competitors: "Fügen Sie höchstens drei Mitbewerber hinzu.",
    turnstile: "Bitte schliessen Sie die Prüfung über der Schaltfläche ab.",
    budget:
      "Der Autoritäts-Checker hat sein kostenloses Datenbudget für heute aufgebraucht. Morgen ist er wieder da (Mitternacht UTC). In den letzten 7 Tagen geprüfte Domains laden weiterhin.",
    rate_limited: "Sie haben Ihre 10 kostenlosen Prüfungen für heute genutzt. Sie werden um Mitternacht UTC zurückgesetzt.",
    no_ip: "Wir konnten Ihre Verbindung nicht zuordnen, deshalb ist dieses Tool nicht verfügbar. Wenn Sie ein VPN oder einen Proxy nutzen, deaktivieren Sie ihn bitte.",
    unavailable: "Dieses Tool ist kurz nicht verfügbar. Versuchen Sie es in ein paar Minuten erneut.",
    upstream: "Die Backlink-Datenquelle hat nicht geantwortet. Versuchen Sie es in ein paar Minuten erneut.",
    not_found: "Dieses Ergebnis ist abgelaufen. Starten Sie die Prüfung erneut.",
    invalid_email: "Geben Sie eine gültige E-Mail-Adresse ein.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
  result: {
    scoreLabel: "Echorank-Autorität",
    scoreSource: "Auf Basis des Backlink-Index von DataForSEO",
    outOf: "/ 100",
    noRank: "Noch kein Wert",
    referringDomains: "Verweisende Domains",
    backlinks: "Backlinks",
    dofollowShare: "Dofollow-Anteil",
    dofollowHint: "Anteil der verweisenden Domains, die ohne rel=nofollow verlinken.",
    checkedOn: (d) => `Daten vom ${d}.`,
    aiTitle: "Und wie sehen KI-Assistenten diese Website?",
    aiBody: "Links helfen Suchmaschinen, einer Website zu vertrauen. KI-Assistenten lesen ausserdem Struktur, Fakten und Quellen. Das kostenlose KI-Sichtbarkeits-Audit bewertet das von 0 bis 100.",
    aiCta: "Kostenloses KI-Audit starten",
    again: "Andere Domain prüfen",
  },
  gate: {
    title: "Sehen Sie, wer auf Sie verlinkt und wo Sie stehen",
    body: (n) =>
      n > 0
        ? `Erhalten Sie Ihre 10 stärksten verweisenden Domains, den Vergleich mit ${n === 1 ? "Ihrem Mitbewerber" : `Ihren ${n} Mitbewerbern`} und den Bericht als PDF.`
        : "Erhalten Sie Ihre 10 stärksten verweisenden Domains und den Bericht als PDF. Fügen Sie oben Mitbewerber hinzu, um sich auch mit ihnen zu vergleichen.",
    emailLabel: "Geschäftliche E-Mail",
    consent: "Senden Sie mir gelegentlich Tipps und Produktneuigkeiten (Abmeldung jederzeit möglich).",
    submit: "Vollständigen Bericht anzeigen",
    sending: "Wird freigeschaltet…",
    privacy: "Wir verwenden Ihre E-Mail für den Link zum Bericht und, nur wenn Sie das Kästchen ankreuzen, für unseren Newsletter.",
  },
  full: {
    refTitle: "Die 10 stärksten verweisenden Domains",
    refEmpty: "Der Index enthält noch keine verweisenden Domains für diese Website.",
    colDomain: "Domain",
    colAuthority: "Echorank-Autorität",
    colBacklinks: "Backlinks",
    compTitle: "Sie und Ihre Mitbewerber",
    compNone: "Fügen Sie der Prüfung Mitbewerber hinzu, um sich mit ihnen zu vergleichen.",
    colReferring: "Verweisende Domains",
    colDofollow: "Dofollow",
    you: "Sie",
    pdf: "PDF herunterladen",
    pending: "Der vollständige Bericht konnte heute nicht geladen werden: Das kostenlose Datenbudget ist aufgebraucht. Kommen Sie morgen wieder, dann lädt er.",
    retry: "Erneut versuchen",
  },
  sections: [
    {
      h: "Was ist die Autorität einer Website?",
      ps: [
        "Die Autorität einer Website misst, wie stark der Rest des Webs für sie bürgt. Jeder Link von einer anderen Website ist ein kleines Vertrauensvotum, und ein Link von einer selbst gut verlinkten Website zählt mehr als einer von einer Website, auf die niemand verlinkt.",
        "Suchmaschinen nutzen Links so seit den Anfängen von Google, und sie tun es noch immer. Eine hohe Autorität garantiert keine Rankings, aber sie hilft den Seiten einer Website, zu ranken und schneller Vertrauen zu gewinnen.",
      ],
    },
    {
      h: "Wie die Echorank-Autorität berechnet wird",
      ps: [
        "Die Echorank-Autorität ist der Domain-Rang von DataForSEO auf einer Skala von 0 bis 100. DataForSEO durchsucht das Web laufend und führt einen Index der gefundenen Links. Der Rang wird über diesen Linkgraphen im Sinne des ursprünglichen PageRank berechnet: Eine Domain erhält einen höheren Wert, wenn starke Domains auf sie verlinken, und Links von schwachen oder Spam-Domains zählen wenig.",
        "Verweisende Domains zählen die verschiedenen Websites, die auf Ihre verlinken. Backlinks zählen jeden einzelnen Link: Eine Website, die von hundert Seiten auf Sie verlinkt, bringt hundert Backlinks, aber nur eine verweisende Domain. Der Dofollow-Anteil ist der Anteil der verweisenden Domains, die ohne rel=nofollow verlinken, also mit Links, denen Suchmaschinen folgen sollen.",
        "Weil der Wert auf dem Index von DataForSEO beruht, zeigen andere Tools für dieselbe Website andere Zahlen. Vergleichen Sie Werte aus derselben Quelle, über die Zeit und mit denselben Mitbewerbern.",
      ],
    },
    {
      h: "Was ist ein guter Autoritätswert?",
      ps: [
        "Einen absolut guten Wert gibt es nicht. Die Skala bezieht sich auf das gesamte Web: Ein junges lokales Unternehmen und eine landesweite Zeitung stehen an ganz verschiedenen Punkten, und beide können gesund sein.",
        "Aussagekräftig ist der Vergleich mit den Websites, die um dieselben Suchanfragen konkurrieren. Liegen sie deutlich über Ihnen, erklären Links vermutlich einen Teil davon, warum sie vor Ihnen ranken. Fügen Sie bis zu drei Mitbewerber hinzu, um den Abstand zu sehen, und verfolgen Sie ihn über Monate statt Tage: Autorität ändert sich langsam.",
      ],
    },
    {
      h: "So verbessern Sie die Autorität Ihrer Website",
      ps: [
        "Gewinnen Sie Links von relevanten, vertrauenswürdigen Websites: Veröffentlichen Sie Daten, Leitfäden und Tools, die andere zitieren möchten, lassen Sie sich in die Verzeichnisse und Verbände Ihrer Branche eintragen, und machen Sie aus Erwähnungen Ihrer Marke ohne Link einen Link.",
        "Steigern Sie die Zahl der verweisenden Domains statt der blossen Backlinks. Zehn Links von zehn verschiedenen Websites bringen mehr als hundert von einer einzigen. Meiden Sie gekaufte Links und Linkfarmen: Sie bringen Backlinks ohne Autorität und können Sie Rankings kosten.",
        "Nutzen Sie, was schon da ist: Leiten Sie alte URLs weiter, die noch Links erhalten, und reparieren Sie defekte Seiten, auf die andere Websites verlinken.",
      ],
    },
  ],
  faq: [
    {
      q: "Ist der Website-Autoritäts-Checker kostenlos?",
      a: "Ja. Wert, verweisende Domains, Backlinks und Dofollow-Anteil sind kostenlos und ohne Konto. Die 10 stärksten verweisenden Domains, der Vergleich mit Mitbewerbern und das PDF erfordern eine E-Mail-Adresse.",
    },
    {
      q: "Woher stammen die Daten?",
      a: "Aus dem Backlink-Index von DataForSEO, denselben Daten, die unsere kostenpflichtigen Backlink-Tools nutzen. Die Echorank-Autorität ist der Domain-Rang von DataForSEO auf einer Skala von 0 bis 100.",
    },
    {
      q: "Warum ist mein Wert in anderen SEO-Tools anders?",
      a: "Jedes Tool durchsucht das Web mit seinem eigenen Crawler, führt einen eigenen Linkindex und rechnet mit einer eigenen Formel. Werte aus verschiedenen Quellen sind nicht vergleichbar; vergleichen Sie Gleiches mit Gleichem.",
    },
    {
      q: "Wie oft werden die Daten aktualisiert?",
      a: "Ergebnisse werden pro Domain 7 Tage im Cache gehalten: Eine diese Woche geprüfte Domain zeigt dieselben Zahlen, bis der Cache abläuft. Die kostenpflichtigen Pläne von Echorank verfolgen Ihre Links monatlich, mit Verlauf.",
    },
    {
      q: "Bedeutet eine höhere Autorität bessere Rankings?",
      a: "Nicht für sich allein. Autorität spiegelt Links wider, und Links sind eines von vielen Ranking-Signalen. Inhalt, Relevanz, technische Gesundheit und, für KI-Assistenten, klare Fakten und Quellen zählen ebenso.",
    },
  ],
};

export const AUTHORITY_COPY: Record<AuthorityLocale, AuthorityCopy> = { en, fr, "de-CH": de };
