// src/lib/authority-checker/copy.ts — every string of the Link Authority
// Checker, en / fr / de-CH: its public landing page (/free-tools/authority-
// checker) and its in-app tool (/visibility/tools/link-authority). en-CA folds
// to en and fr-CA to fr (authorityLocale), the same folding dashboardLocale()
// does. Dependency-free: the landing page, the client tool and the API error
// bodies all read it.
//
// THE TOOL'S NAME IS "Link Authority Checker" in every locale (2026-11-09),
// a product name like Marketing Studio. THE SCORE'S NAME IS "Echorank
// Authority" (Autorité Echorank / Echorank-Autorität), always labelled as based
// on DataForSEO's backlink index. Other vendors' metric names never appear in
// this file (tests/authority-checker.test.ts scans every string for them).
//
// No plan number is typed here: the landing CTA takes the lowest price from
// plan-config, and the monthly allowance is read from it at run time.
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
  | "unauthorized"
  | "plan_required"
  | "quota"
  | "unavailable"
  | "upstream"
  | "expired"
  | "pdf_failed"
  | "generic";

export interface AuthoritySection {
  h: string;
  ps: string[];
}

export interface AuthorityCopy {
  name: string;
  // ─── The landing page ───
  blurb: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  /** The hero kicker (the shell's default is "/ FREE TOOL"). */
  kicker: string;
  ctaTitle: string;
  /** "Included in every plan from $<price>": the price comes from plan-config. */
  ctaButton: (price: string) => string;
  allTools: string;
  shows: { title: string; items: string[] };
  sample: { badge: string; caption: string };
  sections: AuthoritySection[];
  faq: { q: string; a: string }[];
  // ─── The in-app tool ───
  appSubtitle: string;
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
    cached: string;
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
  };
  usage: {
    line: (used: number, limit: number) => string;
    unlimited: (used: number) => string;
    resets: (date: string) => string;
  };
  quota: {
    title: string;
    body: (used: number, limit: number, date: string) => string;
    cacheNote: string;
    upgrade: string;
  };
  pdf: { download: string; preparing: string };
}

const SECTIONS_EN: AuthoritySection[] = [
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
      "The useful comparison is with the sites you compete with for the same searches. If they score well above you, links are likely part of why they outrank you. Add up to three competitors to a check to see the gap, and follow it over months rather than days: authority moves slowly.",
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
];

const en: AuthorityCopy = {
  name: "Link Authority Checker",
  blurb: "Your Echorank Authority, referring domains and backlinks, next to up to three competitors.",
  intro:
    "See how strongly the rest of the web vouches for a site: its Echorank Authority, a 0–100 score based on DataForSEO's backlink index, its referring domains, backlinks and dofollow share, its top 10 referring domains, and the same numbers for up to three competitors. Included in every Echorank plan.",
  metaTitle: "Link Authority Checker — Echorank Authority, 0–100, against your competitors",
  metaDescription:
    "Check a website's link authority: its Echorank Authority from 0 to 100, based on DataForSEO's backlink index, with referring domains, backlinks, dofollow share and the top referring domains, compared with up to three competitors. Included in every Echorank plan.",
  kicker: "/ INCLUDED IN EVERY PLAN",
  ctaTitle: "Run it on your own domain and your competitors, from your Echorank dashboard.",
  ctaButton: (price) => `Included in every plan from ${price}`,
  allTools: "All free tools",
  shows: {
    title: "What the report shows",
    items: [
      "Echorank Authority, from 0 to 100, for your domain and each competitor",
      "Referring domains, backlinks and dofollow share",
      "Your top 10 referring domains, strongest first",
      "A side-by-side comparison with up to three competitors",
    ],
  },
  sample: {
    badge: "Sample",
    caption: "An example report with illustrative numbers, not a real site's.",
  },
  sections: SECTIONS_EN,
  faq: [
    {
      q: "Is the Link Authority Checker free?",
      a: "It is included in every Echorank plan, from the AI Visibility plan up, with a monthly number of checks set by the plan. A check whose domains were all checked in the last 7 days loads from cache and does not count.",
    },
    {
      q: "Where does the data come from?",
      a: "From DataForSEO's backlink index, the same data our backlink tools use. Echorank Authority is DataForSEO's domain rank on a 0–100 scale.",
    },
    {
      q: "Why is my score different in other SEO tools?",
      a: "Each tool crawls the web with its own crawler, keeps its own link index and uses its own formula. Scores from different sources are not comparable; compare like with like.",
    },
    {
      q: "How often is the data updated?",
      a: "Results are cached for 7 days per domain, so a domain checked this week shows the same numbers until the cache expires.",
    },
    {
      q: "Does a higher authority mean higher rankings?",
      a: "Not on its own. Authority reflects links, which are one of many ranking signals. Content, relevance, technical health and, for AI assistants, clear facts and sources matter as much.",
    },
  ],
  appSubtitle: "Echorank Authority, link counts and top referring domains for a domain and up to three competitors.",
  form: {
    domainLabel: "Domain",
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
    unauthorized: "Sign in to run a check.",
    plan_required: "The Link Authority Checker is included in every Echorank plan. Choose a plan to run checks.",
    quota: "You have used this month's checks.",
    unavailable: "This tool is briefly unavailable. Try again in a few minutes.",
    upstream: "The backlink data source did not answer. Try again in a few minutes.",
    expired: "This report is more than 7 days old. Run the check again to download it.",
    pdf_failed: "The PDF could not be created. Try again in a few minutes.",
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
    cached: "Every domain was checked in the last 7 days, so this came from cache and did not use a check.",
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
  },
  usage: {
    line: (used, limit) => `${used} of ${limit} checks used this month.`,
    unlimited: (used) => `${used} checks this month, no monthly limit.`,
    resets: (d) => `Resets on ${d}.`,
  },
  quota: {
    title: "You have used this month's checks",
    body: (used, limit, d) => `${used} of ${limit} checks used. Your checks reset on ${d}.`,
    cacheNote: "Domains checked in the last 7 days still load without using a check.",
    upgrade: "Upgrade for more checks",
  },
  pdf: { download: "Download PDF", preparing: "Preparing PDF…" },
};

const fr: AuthorityCopy = {
  name: "Link Authority Checker",
  blurb: "Votre autorité Echorank, vos domaines référents et vos backlinks, face à trois concurrents au plus.",
  intro:
    "Mesurez à quel point le reste du web se porte garant d'un site : son autorité Echorank, un score de 0 à 100 fondé sur l'index de backlinks de DataForSEO, ses domaines référents, ses backlinks et sa part de liens dofollow, ses 10 principaux domaines référents, et les mêmes chiffres pour trois concurrents au plus. Inclus dans toutes les formules Echorank.",
  metaTitle: "Link Authority Checker — autorité Echorank de 0 à 100, face à vos concurrents",
  metaDescription:
    "Vérifiez l'autorité des liens d'un site : son autorité Echorank de 0 à 100, fondée sur l'index de backlinks de DataForSEO, avec les domaines référents, les backlinks, la part dofollow et les principaux domaines référents, comparés à trois concurrents au plus. Inclus dans toutes les formules Echorank.",
  kicker: "/ INCLUS DANS TOUTES LES FORMULES",
  ctaTitle: "Lancez-le sur votre domaine et ceux de vos concurrents, depuis votre tableau de bord Echorank.",
  ctaButton: (price) => `Inclus dans toutes les formules dès ${price}`,
  allTools: "Tous les outils gratuits",
  shows: {
    title: "Ce que montre le rapport",
    items: [
      "L'autorité Echorank, de 0 à 100, de votre domaine et de chaque concurrent",
      "Les domaines référents, les backlinks et la part dofollow",
      "Vos 10 principaux domaines référents, du plus fort au plus faible",
      "Une comparaison côte à côte avec trois concurrents au plus",
    ],
  },
  sample: {
    badge: "Exemple",
    caption: "Un exemple de rapport aux chiffres fictifs, pas ceux d'un vrai site.",
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
        "La comparaison utile est celle avec les sites qui visent les mêmes recherches que vous. S'ils dépassent nettement votre score, les liens expliquent sans doute en partie pourquoi ils passent devant vous. Ajoutez jusqu'à trois concurrents à une vérification pour mesurer l'écart, et suivez-le sur des mois plutôt que des jours : l'autorité évolue lentement.",
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
      q: "Le Link Authority Checker est-il gratuit ?",
      a: "Il est inclus dans toutes les formules d'Echorank, dès la formule AI Visibility, avec un nombre de vérifications par mois fixé par la formule. Une vérification dont tous les domaines ont été vérifiés ces 7 derniers jours se charge depuis le cache et ne compte pas.",
    },
    {
      q: "D'où viennent les données ?",
      a: "De l'index de backlinks de DataForSEO, les mêmes données que nos outils de backlinks. L'autorité Echorank est le rang de domaine de DataForSEO sur une échelle de 0 à 100.",
    },
    {
      q: "Pourquoi mon score diffère-t-il dans d'autres outils SEO ?",
      a: "Chaque outil explore le web avec son propre robot, tient son propre index de liens et applique sa propre formule. Des scores de sources différentes ne se comparent pas ; comparez ce qui est comparable.",
    },
    {
      q: "À quelle fréquence les données sont-elles mises à jour ?",
      a: "Les résultats sont mis en cache 7 jours par domaine : un domaine vérifié cette semaine affiche les mêmes chiffres jusqu'à l'expiration du cache.",
    },
    {
      q: "Une autorité plus élevée signifie-t-elle un meilleur classement ?",
      a: "Pas à elle seule. L'autorité reflète les liens, qui sont un signal de classement parmi beaucoup d'autres. Le contenu, la pertinence, la santé technique et, pour les assistants IA, des faits et des sources clairs comptent tout autant.",
    },
  ],
  appSubtitle: "L'autorité Echorank, les chiffres de liens et les principaux domaines référents d'un domaine et de trois concurrents au plus.",
  form: {
    domainLabel: "Domaine",
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
    unauthorized: "Connectez-vous pour lancer une vérification.",
    plan_required: "Le Link Authority Checker est inclus dans toutes les formules Echorank. Choisissez une formule pour lancer des vérifications.",
    quota: "Vous avez utilisé les vérifications de ce mois-ci.",
    unavailable: "Cet outil est momentanément indisponible. Réessayez dans quelques minutes.",
    upstream: "La source de données de backlinks n'a pas répondu. Réessayez dans quelques minutes.",
    expired: "Ce rapport date de plus de 7 jours. Relancez la vérification pour le télécharger.",
    pdf_failed: "Le PDF n'a pas pu être créé. Réessayez dans quelques minutes.",
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
    cached: "Tous les domaines ont été vérifiés ces 7 derniers jours : ce résultat vient du cache et n'a pas utilisé de vérification.",
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
  },
  usage: {
    line: (used, limit) => `${used} vérification${used > 1 ? "s" : ""} sur ${limit} utilisée${used > 1 ? "s" : ""} ce mois-ci.`,
    unlimited: (used) => `${used} vérification${used > 1 ? "s" : ""} ce mois-ci, sans limite mensuelle.`,
    resets: (d) => `Renouvellement le ${d}.`,
  },
  quota: {
    title: "Vous avez utilisé les vérifications de ce mois-ci",
    body: (used, limit, d) => `${used} vérification${used > 1 ? "s" : ""} sur ${limit} utilisée${used > 1 ? "s" : ""}. Elles se renouvellent le ${d}.`,
    cacheNote: "Les domaines vérifiés ces 7 derniers jours se chargent toujours sans utiliser de vérification.",
    upgrade: "Passer à une formule supérieure",
  },
  pdf: { download: "Télécharger le PDF", preparing: "Préparation du PDF…" },
};

const de: AuthorityCopy = {
  name: "Link Authority Checker",
  blurb: "Ihre Echorank-Autorität, verweisende Domains und Backlinks, neben bis zu drei Mitbewerbern.",
  intro:
    "Sehen Sie, wie stark der Rest des Webs für eine Website bürgt: ihre Echorank-Autorität, ein Wert von 0 bis 100 auf Basis des Backlink-Index von DataForSEO, ihre verweisenden Domains, Backlinks und den Dofollow-Anteil, ihre 10 stärksten verweisenden Domains und dieselben Zahlen für bis zu drei Mitbewerber. In jedem Echorank-Plan enthalten.",
  metaTitle: "Link Authority Checker — Echorank-Autorität von 0 bis 100, im Vergleich mit Mitbewerbern",
  metaDescription:
    "Prüfen Sie die Link-Autorität einer Website: ihre Echorank-Autorität von 0 bis 100 auf Basis des Backlink-Index von DataForSEO, mit verweisenden Domains, Backlinks, Dofollow-Anteil und den stärksten verweisenden Domains, im Vergleich mit bis zu drei Mitbewerbern. In jedem Echorank-Plan enthalten.",
  kicker: "/ IN JEDEM PLAN ENTHALTEN",
  ctaTitle: "Prüfen Sie Ihre eigene Domain und die Ihrer Mitbewerber, direkt in Ihrem Echorank-Dashboard.",
  ctaButton: (price) => `In jedem Plan ab ${price} enthalten`,
  allTools: "Alle kostenlosen Tools",
  shows: {
    title: "Was der Bericht zeigt",
    items: [
      "Die Echorank-Autorität von 0 bis 100 für Ihre Domain und jeden Mitbewerber",
      "Verweisende Domains, Backlinks und Dofollow-Anteil",
      "Ihre 10 stärksten verweisenden Domains, die stärkste zuerst",
      "Einen direkten Vergleich mit bis zu drei Mitbewerbern",
    ],
  },
  sample: {
    badge: "Beispiel",
    caption: "Ein Beispielbericht mit erfundenen Zahlen, nicht die einer echten Website.",
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
        "Aussagekräftig ist der Vergleich mit den Websites, die um dieselben Suchanfragen konkurrieren. Liegen sie deutlich über Ihnen, erklären Links vermutlich einen Teil davon, warum sie vor Ihnen ranken. Fügen Sie einer Prüfung bis zu drei Mitbewerber hinzu, um den Abstand zu sehen, und verfolgen Sie ihn über Monate statt Tage: Autorität ändert sich langsam.",
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
      q: "Ist der Link Authority Checker kostenlos?",
      a: "Er ist in jedem Echorank-Plan enthalten, ab dem Plan AI Visibility, mit einer monatlichen Zahl an Prüfungen je nach Plan. Eine Prüfung, deren Domains alle in den letzten 7 Tagen geprüft wurden, kommt aus dem Cache und zählt nicht.",
    },
    {
      q: "Woher stammen die Daten?",
      a: "Aus dem Backlink-Index von DataForSEO, denselben Daten, die unsere Backlink-Tools nutzen. Die Echorank-Autorität ist der Domain-Rang von DataForSEO auf einer Skala von 0 bis 100.",
    },
    {
      q: "Warum ist mein Wert in anderen SEO-Tools anders?",
      a: "Jedes Tool durchsucht das Web mit seinem eigenen Crawler, führt einen eigenen Linkindex und rechnet mit einer eigenen Formel. Werte aus verschiedenen Quellen sind nicht vergleichbar; vergleichen Sie Gleiches mit Gleichem.",
    },
    {
      q: "Wie oft werden die Daten aktualisiert?",
      a: "Ergebnisse werden pro Domain 7 Tage im Cache gehalten: Eine diese Woche geprüfte Domain zeigt dieselben Zahlen, bis der Cache abläuft.",
    },
    {
      q: "Bedeutet eine höhere Autorität bessere Rankings?",
      a: "Nicht für sich allein. Autorität spiegelt Links wider, und Links sind eines von vielen Ranking-Signalen. Inhalt, Relevanz, technische Gesundheit und, für KI-Assistenten, klare Fakten und Quellen zählen ebenso.",
    },
  ],
  appSubtitle: "Echorank-Autorität, Linkzahlen und die stärksten verweisenden Domains für eine Domain und bis zu drei Mitbewerber.",
  form: {
    domainLabel: "Domain",
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
    unauthorized: "Melden Sie sich an, um eine Prüfung zu starten.",
    plan_required: "Der Link Authority Checker ist in jedem Echorank-Plan enthalten. Wählen Sie einen Plan, um Prüfungen zu starten.",
    quota: "Sie haben die Prüfungen dieses Monats aufgebraucht.",
    unavailable: "Dieses Tool ist kurz nicht verfügbar. Versuchen Sie es in ein paar Minuten erneut.",
    upstream: "Die Backlink-Datenquelle hat nicht geantwortet. Versuchen Sie es in ein paar Minuten erneut.",
    expired: "Dieser Bericht ist älter als 7 Tage. Führen Sie die Prüfung erneut aus, um ihn herunterzuladen.",
    pdf_failed: "Das PDF konnte nicht erstellt werden. Versuchen Sie es in ein paar Minuten erneut.",
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
    cached: "Alle Domains wurden in den letzten 7 Tagen geprüft: Dieses Ergebnis kommt aus dem Cache und hat keine Prüfung verbraucht.",
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
  },
  usage: {
    line: (used, limit) => `${used} von ${limit} Prüfungen in diesem Monat genutzt.`,
    unlimited: (used) => `${used} Prüfungen in diesem Monat, ohne Monatslimit.`,
    resets: (d) => `Zurückgesetzt am ${d}.`,
  },
  quota: {
    title: "Sie haben die Prüfungen dieses Monats aufgebraucht",
    body: (used, limit, d) => `${used} von ${limit} Prüfungen genutzt. Ihre Prüfungen werden am ${d} zurückgesetzt.`,
    cacheNote: "In den letzten 7 Tagen geprüfte Domains laden weiterhin, ohne eine Prüfung zu verbrauchen.",
    upgrade: "Upgrade für mehr Prüfungen",
  },
  pdf: { download: "PDF herunterladen", preparing: "PDF wird erstellt…" },
};

export const AUTHORITY_COPY: Record<AuthorityLocale, AuthorityCopy> = { en, fr, "de-CH": de };
