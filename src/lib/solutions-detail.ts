// src/lib/solutions-detail.ts  (v2)
//
// Optional per-item deep-dive for Solutions pages: prose sections (each an
// /0N section, optional graphic) followed by a card grid with an optional
// graphic. Rendered by [slug]/page.tsx after any longform sections, numbering
// continues automatically. Adding content for another slug is a config edit —
// no page files touched. Items without an entry render exactly as before.
//
// PURE — no Prisma, no React.

import type { SolutionBase } from "./solutions-taxonomy";

export interface SolutionDetailImage {
  /** Served from public/solutions/. */
  src: string;
  alt: string;
}

export interface SolutionProseSection {
  h2: string;
  paras: string[];
  image?: SolutionDetailImage;
}

export interface SolutionDetailCard {
  title: string;
  body: string;
}

export interface SolutionDetail {
  /** Long-read sections rendered first, one /0N section each. */
  prose?: SolutionProseSection[];
  /** Uppercase eyebrow after the /0N label on the cards section. */
  eyebrow: string;
  h2: string;
  cards: SolutionDetailCard[];
  image?: SolutionDetailImage;
}

const DETAILS: Record<string, Record<SolutionBase, SolutionDetail>> = {
  "agencies": {
    en: {
      prose: [
        {
          h2: "Retainers are kept with proof",
          paras: [
            "An agency's real product is confidence: the client's belief that the retainer is working. That belief dies in the gap between the work you did and the evidence you can show — and it dies fastest when the monthly report is an afternoon of screenshots assembled by whoever had time.",
            "Echorank keeps the evidence current by itself. Rankings, reviews, AI visibility and audit fixes accumulate per client as the month runs, so the report is a read-out of what moved and why, not a reconstruction. When a client asks how it's going on a Tuesday, the answer is already on screen.",
          ],
        },
        {
          h2: "Your brand on every screen",
          paras: [
            "The white-label dashboard runs under your name and your domain. Clients log into your tool, read your reports, and associate the results with you — the platform underneath is invisible.",
            "Client management keeps the estate clean: every client is a separate workspace with its own locations, competitors and tracked prompts, while your team works across all of them from one login. One subscription covers the roster; adding the next client is minutes, not an onboarding project — and the same audit that closes the pitch becomes their baseline on day one.",
          ],
          image: {
            src: "/solutions/agencies-en.svg",
            alt: "Multiple client workspaces managed in one place, producing white-labeled client-ready reports",
          },
        },
      ],
      eyebrow: "FOR AGENCIES",
      h2: "Built to be resold",
      cards: [
        { title: "White-label", body: "Your logo, your domain, your reports — clients see your brand, not a vendor's." },
        { title: "Client workspaces", body: "Each client isolated with its own tracking; your team works across all of them from one login." },
        { title: "Pitch to baseline", body: "The free audit that wins the deal becomes the client's day-one baseline and the retainer's yardstick." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Les contrats se conservent avec des preuves",
          paras: [
            "Le vrai produit d'une agence, c'est la confiance : la conviction du client que le contrat porte ses fruits. Cette conviction meurt dans l'écart entre le travail accompli et les preuves que vous pouvez montrer — et elle meurt d'autant plus vite quand le rapport mensuel est un après-midi de captures d'écran assemblées par la personne disponible.",
            "Echorank maintient les preuves à jour tout seul. Positions, avis, visibilité IA et corrections d'audit s'accumulent par client au fil du mois : le rapport devient une lecture de ce qui a bougé et pourquoi, pas une reconstruction. Quand un client demande où on en est un mardi, la réponse est déjà à l'écran.",
          ],
        },
        {
          h2: "Votre marque sur chaque écran",
          paras: [
            "Le tableau de bord en marque blanche tourne sous votre nom et votre domaine. Les clients se connectent à votre outil, lisent vos rapports et vous attribuent les résultats — la plateforme en dessous est invisible.",
            "La gestion de clients garde l'ensemble propre : chaque client est un espace de travail distinct avec ses établissements, ses concurrents et ses requêtes suivies, tandis que votre équipe travaille sur tous depuis une seule connexion. Un abonnement couvre le portefeuille ; ajouter le client suivant prend quelques minutes, pas un projet d'intégration — et l'audit qui conclut la vente devient sa référence dès le premier jour.",
          ],
          image: {
            src: "/solutions/agencies-fr.svg",
            alt: "Plusieurs espaces clients gérés au même endroit, produisant des rapports en marque blanche prêts à livrer",
          },
        },
      ],
      eyebrow: "POUR LES AGENCES",
      h2: "Conçu pour être revendu",
      cards: [
        { title: "Marque blanche", body: "Votre logo, votre domaine, vos rapports — les clients voient votre marque, pas celle d'un fournisseur." },
        { title: "Espaces par client", body: "Chaque client isolé avec son propre suivi ; votre équipe travaille sur tous depuis une seule connexion." },
        { title: "Du pitch à la référence", body: "L'audit gratuit qui remporte le contrat devient la référence du premier jour et l'étalon du contrat." },
      ],
    },
  },
  "mid-market": {
    en: {
      prose: [
        {
          h2: "Process, not headcount",
          paras: [
            "At your size the failure mode isn't ignorance, it's inconsistency. Someone answers reviews when they have time. Someone checks rankings when a client mentions them. Nobody checks what AI assistants say at all. The fix isn't hiring a reputation team — it's turning each of those into a process that runs whether or not anyone remembered.",
            "Echorank automates the repetitive layer: review requests go out on schedule, responses follow the standard you set once, monitoring runs daily and only interrupts you when something moves. What's left for humans is the part that needs judgment.",
          ],
        },
        {
          h2: "One platform, not a stack",
          paras: [
            "The alternative is a tool per problem: one for reviews, one for rank tracking, one for audits, a spreadsheet gluing them together. Five subscriptions, five logins, and data that never joins — the review dip and the ranking dip that are obviously the same story stay in separate tabs.",
            "One platform means one place where reputation, AI visibility and search sit against each other, one bill, and one dashboard your team actually opens. When you add a location or enter a new market, you add it once.",
          ],
          image: {
            src: "/solutions/midmarket-en.svg",
            alt: "Five separate tools consolidated into one platform with a single dashboard and workflow",
          },
        },
      ],
      eyebrow: "IN BETWEEN",
      h2: "Built for the size you actually are",
      cards: [
        { title: "Automation first", body: "Requests, responses and monitoring run on schedule — headcount stays on work that needs judgment." },
        { title: "One subscription", body: "Reputation, AI visibility and the SEO toolkit in one bill, replacing a stack of single-purpose tools." },
        { title: "Grows with you", body: "New locations and markets are added, not re-implemented — the standards you set carry over." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Du processus, pas des effectifs",
          paras: [
            "À votre taille, le problème n'est pas l'ignorance mais l'irrégularité. Quelqu'un répond aux avis quand il a le temps. Quelqu'un vérifie les positions quand un client en parle. Personne ne vérifie ce que disent les assistants IA. La solution n'est pas de recruter une équipe réputation — c'est de transformer chacune de ces tâches en processus qui tourne, qu'on y pense ou non.",
            "Echorank automatise la couche répétitive : les demandes d'avis partent selon le calendrier, les réponses suivent le standard défini une fois, la surveillance tourne chaque jour et ne vous interrompt que quand quelque chose bouge. Ce qui reste aux humains, c'est la part qui demande du jugement.",
          ],
        },
        {
          h2: "Une plateforme, pas une pile d'outils",
          paras: [
            "L'alternative, c'est un outil par problème : un pour les avis, un pour le suivi de positions, un pour les audits, et un tableur pour faire le lien. Cinq abonnements, cinq connexions, et des données qui ne se croisent jamais — la baisse d'avis et la baisse de positions qui racontent manifestement la même histoire restent dans des onglets séparés.",
            "Une seule plateforme, c'est un endroit où réputation, visibilité IA et référencement se lisent côte à côte, une seule facture, et un tableau de bord que votre équipe ouvre vraiment. Quand vous ajoutez un établissement ou un marché, vous l'ajoutez une fois.",
          ],
          image: {
            src: "/solutions/midmarket-fr.svg",
            alt: "Cinq outils distincts consolidés en une seule plateforme avec un tableau de bord et un flux de travail uniques",
          },
        },
      ],
      eyebrow: "ENTRE-DEUX",
      h2: "Conçu pour la taille que vous avez vraiment",
      cards: [
        { title: "L'automatisation d'abord", body: "Demandes, réponses et surveillance tournent selon le calendrier — vos effectifs restent sur ce qui demande du jugement." },
        { title: "Un seul abonnement", body: "Réputation, visibilité IA et boîte à outils SEO sur une seule facture, à la place d'une pile d'outils spécialisés." },
        { title: "Évolue avec vous", body: "Les nouveaux établissements et marchés s'ajoutent sans tout refaire — vos standards s'appliquent d'office." },
      ],
    },
  },
  "large-organizations": {
    en: {
      prose: [
        {
          h2: "One standard, applied everywhere",
          paras: [
            "One location with a weak review profile is a management problem. Two hundred locations each measured differently is a data problem, and data problems don't get fixed in quarterly meetings. Echorank applies one definition of visibility, one trust score, and one alert threshold across every location, brand, and market you track — so a score of 62 in Dallas means the same thing as a score of 62 in Manchester.",
            "The standard is set once, centrally. What changes by location is only what should: the local competitors, the local prompts, the local answers.",
          ],
        },
        {
          h2: "Roll-up that needs no spreadsheet",
          paras: [
            "Roll-up is built in, not exported. Region leads see their locations, head office sees the whole estate, and both are looking at the same numbers at the same time. No monthly collation, no version-conflicted spreadsheet, no \"whose figure is right.\" When an AI assistant stops recommending one of your locations, the alert reaches the person who owns that location — and the drop shows up in the aggregate view the moment it happens.",
          ],
          image: {
            src: "/solutions/rollup-en.svg",
            alt: "Nine locations measured to one standard, rolling up into a single estate view",
          },
        },
      ],
      eyebrow: "AT SCALE",
      h2: "Built for estates, not single sites",
      cards: [
        { title: "Central governance", body: "Thresholds, scoring and response standards defined once at head office, inherited by every location." },
        { title: "Roll-up reporting", body: "Location, region and estate views from the same live data — no exports, no collation." },
        { title: "Routed alerts", body: "A drop reaches the owner of that location, with severity deciding who else gets pulled in." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Un même standard, appliqué partout",
          paras: [
            "Un établissement au profil d'avis fragile est un problème de management. Deux cents établissements mesurés chacun différemment, c'est un problème de données — et les problèmes de données ne se règlent pas en réunion trimestrielle. Echorank applique une seule définition de la visibilité, un seul score de confiance et un seul seuil d'alerte à chaque établissement, marque et marché suivis : un score de 62 à Dallas signifie la même chose qu'un 62 à Manchester.",
            "Le standard est défini une fois, au niveau central. Ce qui varie par établissement est uniquement ce qui doit varier : les concurrents locaux, les requêtes locales, les réponses locales.",
          ],
        },
        {
          h2: "Une consolidation sans tableur",
          paras: [
            "La consolidation est intégrée, pas exportée. Les responsables régionaux voient leurs établissements, le siège voit l'ensemble, et tous regardent les mêmes chiffres au même moment. Pas de compilation mensuelle, pas de tableur en conflit de versions, pas de « quel chiffre est le bon ». Quand un assistant IA cesse de recommander un de vos établissements, l'alerte atteint la personne qui en a la charge — et la baisse apparaît dans la vue agrégée à l'instant même.",
          ],
          image: {
            src: "/solutions/rollup-fr.svg",
            alt: "Neuf établissements mesurés selon une même norme, consolidés en une vue globale unique",
          },
        },
      ],
      eyebrow: "À GRANDE ÉCHELLE",
      h2: "Conçu pour les réseaux, pas pour un site isolé",
      cards: [
        { title: "Gouvernance centrale", body: "Seuils, scores et standards de réponse définis une fois au siège, hérités par chaque établissement." },
        { title: "Reporting consolidé", body: "Vues établissement, région et réseau à partir des mêmes données en direct — sans exports ni compilation." },
        { title: "Alertes routées", body: "Une baisse atteint le responsable de l'établissement concerné, la gravité décidant qui d'autre est impliqué." },
      ],
    },
  },
  "boost-search-rankings": {
    en: {
      prose: [
        {
          h2: "Why rankings drift even when you change nothing",
          paras: [
            "A position is not a fact, it is a contest re-run every day. Competitors publish, Google reshuffles what a query deserves, and a page that sat at #4 for a year slides to #9 without anyone touching it. If you only check rankings when a client asks, you find out after the traffic is gone.",
            "Daily tracking turns that into a non-event. You see the slide the day it starts, open the SERP that changed, and read who moved above you and with what. Most recoveries are cheap when they start early: a refreshed title, a stronger internal link, a paragraph the new competitor covers and you don't.",
          ],
        },
        {
          h2: "Pick keywords by evidence, not instinct",
          paras: [
            "The expensive mistake in ranking work is spending months on a term nobody buys from. Volume alone doesn't tell you that — a keyword with 10,000 searches and zero purchase intent is worth less than one with 300 searches from people comparing vendors.",
            "Cross two sources before committing. Keyword research shows what the market types and how hard each term is to win; your own Search Console data shows where Google already trusts you — queries where you sit at position 8 to 20 with real impressions. Those near-miss terms are the fastest wins on the board: the relevance is proven, only the push is missing.",
          ],
          image: {
            src: "/solutions/boost-search-rankings-serp.svg",
            alt: "Search results with your listing at position 1: researched, fixed, tracked",
          },
        },
        {
          h2: "A first week that actually moves the needle",
          paras: [
            "Day one: run a site audit and connect Search Console. Don't fix anything yet — just get the full list of what's broken and what already ranks.",
            "Day two and three: fix the audit's top layer — broken links, duplicate titles, redirect chains, pages slow enough to fail Core Web Vitals. This is unglamorous work with the best effort-to-impact ratio in SEO, because it lifts every page at once.",
            "Rest of the week: seed your tracker with the near-miss queries from Search Console plus the terms you want to own, and strengthen the two or three pages behind them. From then on, ranking work stops being a quarterly panic and becomes a short daily read of what moved.",
          ],
        },
      ],
      eyebrow: "THE WORKFLOW",
      h2: "From tracked to ranked",
      cards: [
        {
          title: "See where you rank",
          body: "Rank Tracker checks your keywords daily; SERP Checker pulls any live result. Position history, movement, and who displaced you — no manual searches.",
        },
        {
          title: "Target terms that convert",
          body: "Keywords Explorer shows volume and difficulty so you invest in queries buyers actually type. GSC Insights adds your real clicks and impressions from Google.",
        },
        {
          title: "Fix what holds you back",
          body: "Audit Site crawls your pages and flags broken links, duplicate titles and redirect chains. Lighthouse scores the speed signals Google ranks on.",
        },
        {
          title: "Rank in AI answers too",
          body: "Search is no longer ten blue links. AI Lens shows what AI crawlers actually see on your pages, so you appear in assistant answers, not just Google.",
        },
      ],
      image: {
        src: "/solutions/boost-search-rankings.svg",
        alt: "Rank Tracker view: positions climbing from 14 to 3",
      },
    },
    fr: {
      prose: [
        {
          h2: "Pourquoi les positions glissent même sans rien changer",
          paras: [
            "Une position n'est pas un acquis : c'est un concours rejoué chaque jour. Les concurrents publient, Google réévalue ce qu'une requête mérite, et une page installée en 4e position depuis un an glisse en 9e sans que personne n'y ait touché. Si vous ne vérifiez vos positions que lorsqu'un client le demande, vous l'apprenez une fois le trafic parti.",
            "Le suivi quotidien en fait un non-événement. Vous voyez la glissade le jour où elle commence, vous ouvrez la SERP concernée et vous lisez qui est passé devant vous, et avec quoi. La plupart des rattrapages coûtent peu quand ils démarrent tôt : un titre rafraîchi, un lien interne plus solide, un paragraphe que le nouveau concurrent couvre et pas vous.",
          ],
        },
        {
          h2: "Choisir ses mots-clés sur des preuves, pas à l'instinct",
          paras: [
            "L'erreur coûteuse en référencement, c'est de passer des mois sur un terme qui ne fait rien vendre. Le volume seul ne le révèle pas : un mot-clé à 10 000 recherches sans intention d'achat vaut moins qu'un autre à 300 recherches tapé par des gens qui comparent des fournisseurs.",
            "Croisez deux sources avant de vous engager. La recherche de mots-clés montre ce que le marché tape et la difficulté de chaque terme ; vos propres données Search Console montrent où Google vous fait déjà confiance — les requêtes où vous êtes entre la 8e et la 20e position avec de vraies impressions. Ces termes « presque gagnés » sont les victoires les plus rapides : la pertinence est prouvée, il ne manque que la poussée.",
          ],
          image: {
            src: "/solutions/boost-search-rankings-serp.svg",
            alt: "Résultats de recherche avec votre fiche en position 1 : recherché, corrigé, suivi",
          },
        },
        {
          h2: "Une première semaine qui fait vraiment bouger les choses",
          paras: [
            "Jour un : lancez un audit de site et connectez Search Console. Ne corrigez rien encore — obtenez d'abord la liste complète de ce qui est cassé et de ce qui se classe déjà.",
            "Jours deux et trois : traitez la première couche de l'audit — liens brisés, titres dupliqués, chaînes de redirection, pages trop lentes pour les Core Web Vitals. C'est un travail ingrat, mais c'est le meilleur ratio effort-impact du SEO : il soulève toutes les pages à la fois.",
            "Le reste de la semaine : alimentez votre suivi avec les requêtes « presque gagnées » de Search Console et les termes que vous voulez conquérir, puis renforcez les deux ou trois pages qui les portent. Dès lors, le travail de positionnement cesse d'être une panique trimestrielle et devient une courte lecture quotidienne de ce qui a bougé.",
          ],
        },
      ],
      eyebrow: "LE PARCOURS",
      h2: "Du suivi au classement",
      cards: [
        {
          title: "Voyez où vous vous classez",
          body: "Rank Tracker vérifie vos mots-clés chaque jour ; SERP Checker interroge n'importe quel résultat en direct. Historique des positions, mouvements, et qui vous a délogé — sans recherches manuelles.",
        },
        {
          title: "Ciblez les termes qui convertissent",
          body: "Keywords Explorer affiche volume et difficulté pour investir dans les requêtes que les acheteurs tapent vraiment. GSC Insights ajoute vos clics et impressions réels tirés de Google.",
        },
        {
          title: "Corrigez ce qui vous freine",
          body: "Audit Site parcourt vos pages et signale liens brisés, titres dupliqués et chaînes de redirection. Lighthouse note les signaux de vitesse que Google prend en compte.",
        },
        {
          title: "Apparaissez aussi dans les réponses IA",
          body: "La recherche ne se limite plus à dix liens bleus. AI Lens montre ce que les robots IA voient réellement sur vos pages, pour figurer dans les réponses des assistants, pas seulement sur Google.",
        },
      ],
      image: {
        src: "/solutions/boost-search-rankings.svg",
        alt: "Vue Rank Tracker : positions passant de la 14e à la 3e place",
      },
    },
  },
  "get-cited-by-ai": {
    en: {
      prose: [
        {
          h2: "Being cited is the new ranking",
          paras: [
            "A growing share of buyers never see a results page. They ask an assistant, get one synthesized answer, and act on it. If your business is in that answer, you win the customer before a click happens; if it isn't, you were never in the running — and no rank tracker will tell you.",
            "Citations don't come from wanting them. Assistants assemble answers from what they can crawl and what the web agrees on. The work is making your pages readable to AI crawlers, your facts consistent everywhere they appear, and your reputation corroborated by sources assistants trust.",
          ],
        },
        {
          h2: "What makes a business quotable",
          paras: [
            "Assistants echo consensus. A business with clear factual pages, the same name and description across directories and reviews, and third parties saying the same thing gets quoted; a business whose story changes from site to site gets skipped as unreliable.",
            "The mechanics matter too. If your pages render their real content only in the browser, AI crawlers may see an empty shell — plenty of sites are invisible to assistants for that reason alone. Checking what bots actually see is step one, not an afterthought.",
          ],
          image: {
            src: "/solutions/get-cited-by-ai.svg",
            alt: "AI assistant answer citing your business, with per-engine citation tracking",
          },
        },
        {
          h2: "Measure it like a channel",
          paras: [
            "You already treat search and email as channels with numbers. AI answers deserve the same: which prompts mention you, on which engines, how that rate moves week over week, and what changed when it drops.",
            "Once it's measured, it's improvable. A dip on one engine after a content change is a signal, not a mystery — and being able to point at the trend is what turns AI visibility from a talking point into a line on the report.",
          ],
        },
      ],
      eyebrow: "THE WORKFLOW",
      h2: "From invisible to cited",
      cards: [
        {
          title: "See what assistants say today",
          body: "Run the free AI visibility audit — no account needed — then track your mention rate and how engines describe you from the dashboard.",
        },
        {
          title: "Track the prompts that matter",
          body: "Custom Prompts runs the exact questions your buyers ask and records when you appear, so a drop shows up as an alert, not a lost quarter.",
        },
        {
          title: "Show AI crawlers a full page",
          body: "AI Lens compares what a bot receives with what a browser renders. If crawlers see an empty shell, you can't be cited — the gap tells you what to fix.",
        },
        {
          title: "Keep it monitored on schedule",
          body: "Scheduled monitoring re-runs your checkups automatically and flags changes, so AI visibility becomes a metric you watch, not a one-off test.",
        },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Être cité est le nouveau classement",
          paras: [
            "Une part croissante des acheteurs ne voit jamais de page de résultats. Ils posent une question à un assistant, reçoivent une seule réponse synthétisée et agissent. Si votre entreprise figure dans cette réponse, vous gagnez le client avant tout clic ; sinon, vous n'étiez même pas en lice — et aucun suivi de positions ne vous le dira.",
            "Les citations ne s'obtiennent pas en les souhaitant. Les assistants composent leurs réponses à partir de ce qu'ils peuvent explorer et de ce sur quoi le web s'accorde. Le travail consiste à rendre vos pages lisibles par les robots IA, vos informations cohérentes partout où elles apparaissent, et votre réputation corroborée par des sources de confiance.",
          ],
        },
        {
          h2: "Ce qui rend une entreprise citable",
          paras: [
            "Les assistants reprennent le consensus. Une entreprise aux pages factuelles claires, au même nom et à la même description dans les annuaires et les avis, et dont des tiers disent la même chose, est citée ; celle dont l'histoire change d'un site à l'autre est écartée comme peu fiable.",
            "La mécanique compte aussi. Si vos pages n'affichent leur vrai contenu que dans le navigateur, les robots IA peuvent ne voir qu'une coquille vide — beaucoup de sites sont invisibles pour les assistants pour cette seule raison. Vérifier ce que voient réellement les robots est la première étape, pas un détail.",
          ],
          image: {
            src: "/solutions/get-cited-by-ai.svg",
            alt: "Réponse d'assistant IA citant votre entreprise, avec suivi des citations par moteur",
          },
        },
        {
          h2: "Mesurez-le comme un canal",
          paras: [
            "Vous traitez déjà la recherche et l'email comme des canaux chiffrés. Les réponses IA méritent la même rigueur : quels prompts vous mentionnent, sur quels moteurs, comment ce taux évolue de semaine en semaine, et ce qui a changé quand il baisse.",
            "Une fois mesuré, c'est améliorable. Une baisse sur un moteur après un changement de contenu est un signal, pas un mystère — et pouvoir montrer la tendance transforme la visibilité IA d'un argument de vente en une ligne du rapport.",
          ],
        },
      ],
      eyebrow: "LE PARCOURS",
      h2: "D'invisible à cité",
      cards: [
        {
          title: "Voyez ce que disent les assistants",
          body: "Lancez l'audit gratuit de visibilité IA — sans compte — puis suivez votre taux de mention et la façon dont les moteurs vous décrivent depuis le tableau de bord.",
        },
        {
          title: "Suivez les prompts qui comptent",
          body: "Custom Prompts exécute les questions exactes de vos acheteurs et note quand vous apparaissez : une baisse devient une alerte, pas un trimestre perdu.",
        },
        {
          title: "Montrez une page complète aux robots IA",
          body: "AI Lens compare ce que reçoit un robot et ce que rend un navigateur. Si les robots voient une coquille vide, vous ne pouvez pas être cité — l'écart indique quoi corriger.",
        },
        {
          title: "Gardez une surveillance planifiée",
          body: "La surveillance planifiée relance vos vérifications automatiquement et signale les changements : la visibilité IA devient une métrique suivie, pas un test ponctuel.",
        },
      ],
    },
  },
};

export function detailFor(slug: string, base: SolutionBase): SolutionDetail | undefined {
  return DETAILS[slug]?.[base];
}
