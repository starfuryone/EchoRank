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
  /** Optional CSS max-width in px; image stays full-width below it. */
  maxWidth?: number;
  /** "right" floats the image beside the text instead of below it. */
  position?: "right";
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
  "agency-leaders": {
    en: {
      prose: [
        {
          h2: "Retention is the business model",
          paras: [
            "New logos get the applause, but the P&L is made by the clients who stay. A retainer survives on one belief — that the work is visibly working — and that belief is rebuilt every month or quietly eroded. The agencies that churn least aren't always the ones with the best results; they're the ones whose results are easiest to see.",
            "Echorank makes the proof continuous instead of monthly. Rankings, reviews and AI visibility accumulate per client as the month runs, so account managers walk into every call with the trend already on screen — and the quarterly review is a summary of what the client has been watching, not a reveal.",
          ],
        },
        {
          h2: "Margin lives in the unbillable hours",
          paras: [
            "Look at where a retainer's hours actually go: strategy earns its rate, but monitoring, collation and report assembly are cost dressed as diligence. Every hour a senior spends screenshotting dashboards is margin leaving the building — and it scales linearly with every client you add, which is why growth so often makes agencies less profitable.",
            "Automating that layer changes the unit economics. Collection runs continuously, reports assemble from data that was gathered all along, and responses to routine reviews draft themselves for approval. The retainer price stays; the hours behind it shrink; the same team carries more accounts without the quality sag that usually comes with it.",
          ],
          image: {
            src: "/solutions/agencyleaders-en.svg",
            alt: "Hours per client before and after automation: reporting, monitoring and collation shrink, strategy grows",
          },
        },
        {
          h2: "A pipeline that demos itself",
          paras: [
            "The free AI visibility audit is a pitch that runs in a minute of the first meeting: what ChatGPT and Perplexity say about the prospect, next to what they say about the competitor the prospect hates most. That gap on screen does what a capabilities deck can't — it makes the problem theirs before you've proposed anything.",
            "And the pitch converts into delivery without a handoff: the audit's findings become the tracked prompts, the fix list and the day-one baseline. The first monthly report shows movement against numbers the client saw before they signed — which is the cleanest expectation-setting an agency can buy.",
          ],
        },
        {
          h2: "Oversight without micromanaging",
          paras: [
            "Past a handful of accounts, the leader's job stops being doing the work and becomes knowing where the work is slipping. The book-of-clients view gives you that in one read: every account's visibility trend, review health and open alerts side by side, with the slipping one surfacing itself instead of hiding inside an AM's status update.",
            "Your team works from the same data — client workspaces keep accounts isolated, one login spans them all, and white-label means everything a client sees carries your brand. You find out about problems from the platform, and clients find out about them from you. That ordering is most of what agency reputation is.",
          ],
          image: {
            src: "/solutions/agencyleaders-book-en.svg",
            alt: "A book-of-clients view with visibility trends per account, one slipping account flagged with an alert",
          },
        },
      ],
      eyebrow: "RUNNING THE AGENCY",
      h2: "Built for the person who owns the number",
      cards: [
        { title: "Proof, continuously", body: "Every account accumulates evidence as the month runs — retention stops depending on the reporting scramble." },
        { title: "Margin by automation", body: "Monitoring, collation and reporting come off the clock — more accounts per head at the same quality." },
        { title: "The whole book, one read", body: "Trends and alerts across every client side by side — slipping accounts surface before clients call." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "La rétention est le modèle économique",
          paras: [
            "Les nouveaux logos récoltent les applaudissements, mais le compte de résultat se fait avec les clients qui restent. Un contrat survit sur une seule conviction — que le travail porte visiblement ses fruits — et cette conviction se reconstruit chaque mois ou s'érode en silence. Les agences qui perdent le moins de clients ne sont pas toujours celles qui ont les meilleurs résultats ; ce sont celles dont les résultats sont les plus faciles à voir.",
            "Echorank rend la preuve continue plutôt que mensuelle. Positions, avis et visibilité IA s'accumulent par client au fil du mois : les chargés de compte arrivent à chaque appel avec la tendance déjà à l'écran — et la revue trimestrielle résume ce que le client observait, au lieu de le lui révéler.",
          ],
        },
        {
          h2: "La marge vit dans les heures non facturables",
          paras: [
            "Regardez où vont réellement les heures d'un contrat : la stratégie vaut son taux, mais la surveillance, la compilation et l'assemblage de rapports sont du coût déguisé en rigueur. Chaque heure qu'un senior passe à capturer des tableaux de bord, c'est de la marge qui sort du bâtiment — et cela croît linéairement avec chaque client ajouté, ce qui explique pourquoi la croissance rend si souvent les agences moins rentables.",
            "Automatiser cette couche change l'équation unitaire. La collecte tourne en continu, les rapports s'assemblent à partir de données recueillies au fil de l'eau, et les réponses aux avis courants se rédigent seules pour validation. Le prix du contrat reste ; les heures derrière fondent ; la même équipe porte plus de comptes sans l'affaissement de qualité qui l'accompagne d'habitude.",
          ],
          image: {
            src: "/solutions/agencyleaders-fr.svg",
            alt: "Heures par client avant et après automatisation : reporting, surveillance et compilation fondent, la stratégie grandit",
          },
        },
        {
          h2: "Un pipeline qui fait sa propre démonstration",
          paras: [
            "L'audit de visibilité IA gratuit est un argumentaire qui tourne pendant la première minute du premier rendez-vous : ce que ChatGPT et Perplexity disent du prospect, à côté de ce qu'ils disent du concurrent qu'il déteste le plus. Cet écart à l'écran fait ce qu'aucune plaquette ne fait — il rend le problème sien avant toute proposition.",
            "Et l'argumentaire se convertit en prestation sans passage de témoin : les constats de l'audit deviennent les requêtes suivies, la liste de corrections et la référence du premier jour. Le premier rapport mensuel montre le mouvement par rapport à des chiffres que le client a vus avant de signer — le cadrage d'attentes le plus propre qu'une agence puisse s'offrir.",
          ],
        },
        {
          h2: "Superviser sans microgérer",
          paras: [
            "Au-delà d'une poignée de comptes, le métier du dirigeant cesse d'être de faire le travail et devient de savoir où le travail glisse. La vue portefeuille vous le donne en une lecture : tendance de visibilité, santé des avis et alertes ouvertes de chaque compte côte à côte, le compte qui décroche se signalant de lui-même au lieu de se cacher dans le point d'étape d'un chargé de compte.",
            "Votre équipe travaille sur les mêmes données — les espaces clients isolent les comptes, une seule connexion les couvre tous, et la marque blanche fait que tout ce que voit un client porte votre marque. Vous apprenez les problèmes par la plateforme, et vos clients les apprennent par vous. Cet ordre-là, c'est l'essentiel de la réputation d'une agence.",
          ],
          image: {
            src: "/solutions/agencyleaders-book-fr.svg",
            alt: "Une vue portefeuille avec la tendance de visibilité par compte, un compte en baisse signalé par une alerte",
          },
        },
      ],
      eyebrow: "DIRIGER L'AGENCE",
      h2: "Conçu pour la personne qui répond du chiffre",
      cards: [
        { title: "La preuve, en continu", body: "Chaque compte accumule ses preuves au fil du mois — la rétention ne dépend plus du sprint de reporting." },
        { title: "La marge par l'automatisation", body: "Surveillance, compilation et reporting sortent du compteur — plus de comptes par personne, à qualité égale." },
        { title: "Tout le portefeuille, une lecture", body: "Tendances et alertes de tous les clients côte à côte — les comptes qui glissent se signalent avant l'appel du client." },
      ],
    },
  },
  "seo-professionals": {
    en: {
      prose: [
        {
          h2: "The SERP is no longer the whole job",
          paras: [
            "You already run the classic discipline: keyword research, rank tracking, technical audits, link analysis. But a growing share of the queries you optimize for are now answered before the click — in AI Overviews, in ChatGPT, in Perplexity — and those answers have their own ranking logic: entity clarity, citable sources, review corpora, crawlable structure. A page can hold #3 in the SERP and be invisible in the answer above it.",
            "That second surface is measurable. The assistants can be queried on the prompts your clients' customers actually ask; the answers can be parsed for who gets named, cited and recommended; and the citations point at exactly which pages earned each brand its slot. Which means AI visibility stops being a talking point and becomes a column in your tracking — with the same weekly cadence and the same accountability as positions.",
          ],
        },
        {
          h2: "Two disciplines, one workflow",
          paras: [
            "Echorank runs both from the same keyword set. Classic side: rank tracking with daily movement, SERP snapshots, share-of-search, site audits, backlink analysis and Search Console cross-checks. AI side: the same intents phrased as prompts, executed across the major assistants, with mentions, positions, sentiment and citation sources recorded per answer.",
            "The overlap is where the leverage is. The comparison pages and review corpora that win AI citations are usually the same assets that lift classic rankings; the technical fixes that make a site crawlable feed both. Instead of running a GEO project next to an SEO retainer, you run one prioritized backlog where every item shows which surface it moves — and the near-miss queries at position 8–20 with an AI answer naming nobody yet are flagged as the cheapest wins on the board.",
          ],
          image: {
            src: "/solutions/seopros-en.svg",
            alt: "The classic SERP and the AI answer tracked together in one workbench with daily evidence",
          },
        },
        {
          h2: "Recommendations that survive scrutiny",
          paras: [
            "Every recommendation you make gets challenged — by a client, a dev team, or a stakeholder who read a different blog. The defensible ones come with receipts: the crawl that shows the duplication, the SERP snapshot that shows who overtook you and with what, the AI answer that cites a competitor's comparison page you don't have.",
            "The toolkit is built for that evidence chain. Findings arrive with the artifact attached, not a summary of it — so the recommendation, the proof and the expected effect travel together into whatever document the decision gets made in. Fewer meetings arguing about whether the problem exists; more sign-offs on the fix.",
          ],
          image: {
            src: "/solutions/seopros-evidence-en.svg",
            alt: "A ranking drop backed by crawl report, SERP snapshot and AI citations, ending in a signed-off recommendation",
          },
        },
        {
          h2: "The daily read, the weekly move",
          paras: [
            "The working rhythm is short: a daily read of what moved — positions, new AI answers, review shifts — with the changed artifact one click away, then a weekly decision about where the next unit of effort goes. Volatile prompts and slipping pages surface themselves; stable ones stay out of your way.",
            "Everything rolls up per project, so the same data serves the practitioner view and the client-facing one: the report your client reads is assembled from the evidence you worked from, not rebuilt for the occasion. When something jumps or breaks, you knew before they asked — which is, in the end, most of what a retainer buys.",
          ],
        },
      ],
      eyebrow: "FOR PRACTITIONERS",
      h2: "A working toolkit, not a dashboard tour",
      cards: [
        { title: "Both result pages", body: "Classic rank tracking and AI answer tracking on the same keywords — one view of where visibility actually is." },
        { title: "Evidence attached", body: "Audits, SERP snapshots and citation sources behind every finding — recommendations ship with receipts." },
        { title: "Daily, not quarterly", body: "Movement lands the day it happens, with what changed — recoveries start while they're still cheap." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "La SERP n'est plus tout le métier",
          paras: [
            "Vous pratiquez déjà la discipline classique : recherche de mots-clés, suivi de positions, audits techniques, analyse de liens. Mais une part croissante des requêtes que vous optimisez trouve désormais réponse avant le clic — dans les AI Overviews, dans ChatGPT, dans Perplexity — et ces réponses ont leur propre logique de classement : clarté des entités, sources citables, corpus d'avis, structure explorable. Une page peut tenir la position 3 dans la SERP et rester invisible dans la réponse au-dessus.",
            "Cette seconde surface se mesure. On peut interroger les assistants sur les requêtes que posent réellement les clients de vos clients ; analyser les réponses pour savoir qui est nommé, cité et recommandé ; et remonter les citations jusqu'aux pages qui ont valu sa place à chaque marque. La visibilité IA cesse d'être un sujet de conférence et devient une colonne de votre suivi — avec la même cadence hebdomadaire et la même redevabilité que les positions.",
          ],
        },
        {
          h2: "Deux disciplines, un seul flux de travail",
          paras: [
            "Echorank exécute les deux à partir du même jeu de mots-clés. Côté classique : suivi de positions quotidien, instantanés de SERP, part de recherche, audits de site, analyse de backlinks et recoupements Search Console. Côté IA : les mêmes intentions formulées en requêtes, exécutées sur les principaux assistants, avec mentions, positions, sentiment et sources de citation enregistrés par réponse.",
            "Le levier est dans le recouvrement. Les pages comparatives et les corpus d'avis qui gagnent des citations IA sont généralement les mêmes actifs qui font monter les positions classiques ; les corrections techniques qui rendent un site explorable nourrissent les deux. Au lieu de mener un projet GEO à côté d'un contrat SEO, vous gérez un seul backlog priorisé où chaque élément indique quelle surface il fait bouger — et les requêtes en position 8-20 dont la réponse IA ne nomme encore personne sont signalées comme les gains les moins chers du tableau.",
          ],
          image: {
            src: "/solutions/seopros-fr.svg",
            alt: "La SERP classique et la réponse IA suivies ensemble dans un même plan de travail, avec des preuves quotidiennes",
          },
        },
        {
          h2: "Des recommandations qui résistent à l'examen",
          paras: [
            "Chacune de vos recommandations est contestée — par un client, une équipe de dev, ou un décideur qui a lu un autre blog. Celles qui tiennent arrivent avec des pièces : le crawl qui montre la duplication, l'instantané de SERP qui montre qui vous a dépassé et avec quoi, la réponse IA qui cite la page comparative d'un concurrent que vous n'avez pas.",
            "La boîte à outils est construite pour cette chaîne de preuves. Les constats arrivent avec l'artefact joint, pas son résumé — la recommandation, la preuve et l'effet attendu voyagent ensemble jusqu'au document où la décision se prend. Moins de réunions à débattre de l'existence du problème ; plus de validations de la correction.",
          ],
          image: {
            src: "/solutions/seopros-evidence-fr.svg",
            alt: "Une baisse de positions étayée par rapport de crawl, instantané SERP et citations IA, aboutissant à une recommandation validée",
          },
        },
        {
          h2: "La lecture quotidienne, la décision hebdomadaire",
          paras: [
            "Le rythme de travail est court : une lecture quotidienne de ce qui a bougé — positions, nouvelles réponses IA, évolutions d'avis — avec l'artefact modifié à un clic, puis une décision hebdomadaire sur la destination du prochain effort. Les requêtes volatiles et les pages qui glissent se signalent d'elles-mêmes ; les stables ne vous encombrent pas.",
            "Tout se consolide par projet : les mêmes données servent la vue praticien et la vue client — le rapport que lit votre client est assemblé à partir des preuves sur lesquelles vous avez travaillé, pas reconstruit pour l'occasion. Quand quelque chose saute ou casse, vous le saviez avant qu'on vous le demande — ce qui est, au fond, l'essentiel de ce qu'achète un contrat.",
          ],
        },
      ],
      eyebrow: "POUR LES PRATICIENS",
      h2: "Une boîte à outils de travail, pas une visite guidée",
      cards: [
        { title: "Les deux pages de résultats", body: "Suivi de positions classique et suivi des réponses IA sur les mêmes mots-clés — une seule vue de la visibilité réelle." },
        { title: "Preuves jointes", body: "Audits, instantanés de SERP et sources de citation derrière chaque constat — vos recommandations arrivent avec pièces." },
        { title: "Quotidien, pas trimestriel", body: "Les mouvements tombent le jour même, avec ce qui a changé — les récupérations commencent quand elles coûtent encore peu." },
      ],
    },
  },
  "google-reviews": {
    en: {
      prose: [
        {
          h2: "Your rating is read before your website",
          paras: [
            "For a local search, the map pack loads first — three businesses, three star ratings. Most customers never scroll past it, and among the three, the rating and the last handful of reviews decide who gets the call. Quantity, recency, rating and owner responses are documented factors in Google's local ranking; the text of your reviews even feeds the snippets Google shows under your listing.",
            "That makes your review profile a storefront you don't fully control — but one you can systematically influence. The businesses with 4.8 and eighty recent reviews are rarely luckier than yours; they ask more consistently and answer everything.",
          ],
        },
        {
          h2: "A system, not a scramble",
          paras: [
            "Improvement is mechanical once it's a workflow. After every job, the customer gets a review request — timed, polite, compliant, and only ever asking for honest feedback. Every incoming review triggers a response drafted in your approved tone: specific and signed for the good ones, calm and factual for the bad ones, because that reply is read by a hundred prospects for every one reviewer.",
            "Monitoring closes the loop: a negative review raises an alert the day it lands, rating drift is visible as a trend rather than a surprise, and review authenticity checks flag patterns worth disputing. Ten minutes a week of decisions; the platform does the asking, drafting and watching.",
          ],
          image: {
            src: "/solutions/googlereviews-en.svg",
            alt: "Review requests sent after every job through one system, producing a climbing Google rating",
          },
        },
      ],
      eyebrow: "GOOGLE REVIEWS",
      h2: "Everything the rating depends on",
      cards: [
        { title: "Get more reviews", body: "Automatic, compliant requests after every job — volume and recency stop depending on memory." },
        { title: "Answer every review", body: "Responses drafted in your tone for approval — the reply prospects read is never missing." },
        { title: "Watch the rating", body: "Alerts on negative reviews and rating drift, plus authenticity checks on suspicious patterns." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Votre note est lue avant votre site",
          paras: [
            "Pour une recherche locale, le pack local s'affiche en premier — trois entreprises, trois notes. La plupart des clients ne défilent jamais plus bas, et parmi les trois, la note et les derniers avis décident qui reçoit l'appel. Volume, fraîcheur, note et réponses du propriétaire sont des facteurs documentés du classement local de Google ; le texte de vos avis alimente même les extraits affichés sous votre fiche.",
            "Votre profil d'avis est donc une vitrine que vous ne contrôlez pas entièrement — mais que vous pouvez influencer méthodiquement. Les entreprises à 4,8 avec quatre-vingts avis récents ont rarement plus de chance que vous ; elles sollicitent plus régulièrement et répondent à tout.",
          ],
        },
        {
          h2: "Un système, pas de l'improvisation",
          paras: [
            "L'amélioration devient mécanique dès qu'elle est un flux de travail. Après chaque prestation, le client reçoit une demande d'avis — au bon moment, polie, conforme, et ne demandant jamais qu'un retour honnête. Chaque avis entrant déclenche une réponse rédigée sur votre ton approuvé : précise et signée pour les bons, calme et factuelle pour les mauvais — car cette réponse est lue par cent prospects pour un seul auteur d'avis.",
            "La surveillance boucle la boucle : un avis négatif déclenche une alerte le jour même, la dérive de la note se lit en tendance plutôt qu'en surprise, et les contrôles d'authenticité signalent les schémas à contester. Dix minutes de décisions par semaine ; la plateforme sollicite, rédige et surveille.",
          ],
          image: {
            src: "/solutions/googlereviews-fr.svg",
            alt: "Des demandes d'avis envoyées après chaque prestation via un système, produisant une note Google qui monte",
          },
        },
      ],
      eyebrow: "AVIS GOOGLE",
      h2: "Tout ce dont la note dépend",
      cards: [
        { title: "Obtenez plus d'avis", body: "Demandes automatiques et conformes après chaque prestation — volume et fraîcheur ne dépendent plus de la mémoire." },
        { title: "Répondez à chaque avis", body: "Réponses rédigées sur votre ton, soumises à validation — la réponse que lisent les prospects n'est jamais absente." },
        { title: "Surveillez la note", body: "Alertes sur avis négatifs et dérive de la note, plus contrôles d'authenticité sur les schémas suspects." },
      ],
    },
  },
  "business-owners": {
    en: {
      prose: [
        {
          h2: "Your reputation sells while you work",
          paras: [
            "Before a customer ever calls, they've checked. They've read your reviews, seen your star rating on Maps, or asked ChatGPT who to hire — and by the time the phone rings, the decision is mostly made. That checking happens every day, whether you watch it or not; the only question is whether you find out what it concluded.",
            "Echorank watches those moments for you: what your reviews say, where your rating is drifting, and what AI assistants answer when someone asks for a business like yours. No jargon, no analyst screens — a plain read of how you look to the people deciding whether to call.",
          ],
          image: {
            src: "/solutions/business-owner-photo.webp",
            maxWidth: 420,
            position: "right",
            alt: "A business owner outside their workshop beside a branded service van",
          },
        },
        {
          h2: "Run the business, not the dashboards",
          paras: [
            "You didn't open a business to monitor software. So the platform is built to leave you alone: review requests go to customers automatically, replies follow the tone you approved, and alerts arrive only when something needs an owner's decision — a bad review to respond to, a competitor overtaking you in AI recommendations, a rating slide worth stopping early.",
            "Ten minutes a week is the honest cost. What you get back is the assurance that the moment something starts hurting the business's name, you'll hear about it that day — not discover it in a slow month.",
          ],
          image: {
            src: "/solutions/businessowners-en.svg",
            alt: "The places customers check a business, watched in one place, ending with the business recommended first",
          },
        },
      ],
      eyebrow: "OWNER-OPERATED",
      h2: "Built for people with a business to run",
      cards: [
        { title: "Plain language", body: "Scores and alerts written for an owner, not an analyst — what changed, why it matters, what to do." },
        { title: "Automatic follow-up", body: "Review requests and responses run on your approved tone — happy customers get asked, every review gets answered." },
        { title: "Owner-level alerts", body: "You're interrupted only for decisions worth an owner's time; everything else waits in the weekly read." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Votre réputation vend pendant que vous travaillez",
          paras: [
            "Avant d'appeler, le client a vérifié. Il a lu vos avis, vu votre note sur Maps, ou demandé à ChatGPT qui engager — et quand le téléphone sonne, la décision est déjà presque prise. Cette vérification a lieu tous les jours, que vous la regardiez ou non ; la seule question est de savoir si vous apprenez ce qu'elle a conclu.",
            "Echorank surveille ces moments pour vous : ce que disent vos avis, où glisse votre note, et ce que répondent les assistants IA quand on cherche une entreprise comme la vôtre. Pas de jargon, pas d'écrans d'analyste — une lecture claire de l'image que vous renvoyez aux gens qui décident d'appeler ou non.",
          ],
          image: {
            src: "/solutions/business-owner-photo.webp",
            maxWidth: 420,
            position: "right",
            alt: "Un chef d'entreprise devant son atelier, à côté de son véhicule de service",
          },
        },
        {
          h2: "Gérez l'entreprise, pas les tableaux de bord",
          paras: [
            "Vous n'avez pas ouvert une entreprise pour surveiller un logiciel. La plateforme est donc conçue pour vous laisser tranquille : les demandes d'avis partent automatiquement, les réponses suivent le ton que vous avez approuvé, et les alertes n'arrivent que quand une décision de patron s'impose — un mauvais avis à traiter, un concurrent qui vous dépasse dans les recommandations IA, une note qui glisse et qu'il vaut mieux arrêter tôt.",
            "Dix minutes par semaine, c'est le coût honnête. En échange, vous avez l'assurance que le jour où quelque chose commence à nuire au nom de l'entreprise, vous l'apprendrez le jour même — pas au détour d'un mois creux.",
          ],
          image: {
            src: "/solutions/businessowners-fr.svg",
            alt: "Les endroits où les clients vérifient une entreprise, surveillés au même endroit, jusqu'à la recommandation en premier",
          },
        },
      ],
      eyebrow: "PATRON AUX COMMANDES",
      h2: "Conçu pour ceux qui ont une entreprise à gérer",
      cards: [
        { title: "Langage clair", body: "Scores et alertes écrits pour un patron, pas un analyste — ce qui a changé, pourquoi c'est important, quoi faire." },
        { title: "Relances automatiques", body: "Demandes et réponses aux avis tournent sur le ton approuvé — les clients satisfaits sont sollicités, chaque avis reçoit une réponse." },
        { title: "Alertes de niveau patron", body: "Vous n'êtes interrompu que pour les décisions qui valent votre temps ; le reste attend la lecture hebdomadaire." },
      ],
    },
  },
  "small-teams": {
    en: {
      prose: [
        {
          h2: "Minutes a week, not a role",
          paras: [
            "In a small team, reputation work belongs to nobody — which means it happens when someone remembers and stops when things get busy. The weeks it stops are exactly the weeks a bad review sits unanswered or an AI assistant quietly drops you from its recommendations.",
            "Echorank shrinks the job to minutes. Review requests go out by themselves, monitoring runs daily, and you only hear about it when something actually changed. The weekly routine is a short read of what moved and one or two decisions — not an afternoon of checking dashboards that mostly say nothing happened.",
          ],
        },
        {
          h2: "Useful on day one",
          paras: [
            "You don't have a spare week to configure software. The defaults are chosen so tracking, alerts and review flows work out of the box for a single-location business — you adjust them if you want to, not because you have to.",
            "Start with the free AI visibility audit: it shows what assistants currently say about you before you've created an account. From there, the setup is your business details and a connected review profile — the platform does the rest on schedule.",
          ],
          image: {
            src: "/solutions/smallteams-en.svg",
            alt: "A full weekly task list automated on schedule, leaving only two items that need a person",
          },
        },
      ],
      eyebrow: "SMALL BY DESIGN",
      h2: "Built to be nobody's full-time job",
      cards: [
        { title: "Runs unattended", body: "Requests, monitoring and alerts happen on schedule — the platform works the weeks you're slammed." },
        { title: "Interrupts rarely", body: "Alerts fire on real changes, not noise, so opening the dashboard is a choice, not a chore." },
        { title: "No setup project", body: "Sensible defaults for a single location; the free audit shows value before the account exists." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Quelques minutes par semaine, pas un poste",
          paras: [
            "Dans une petite équipe, la réputation n'appartient à personne — donc on s'en occupe quand on y pense, et on arrête dès que ça s'accélère. Or les semaines où ça s'arrête sont exactement celles où un mauvais avis reste sans réponse, ou où un assistant IA vous retire discrètement de ses recommandations.",
            "Echorank réduit la tâche à quelques minutes. Les demandes d'avis partent toutes seules, la surveillance tourne chaque jour, et vous n'êtes prévenu que quand quelque chose a réellement changé. La routine hebdomadaire, c'est une lecture rapide de ce qui a bougé et une ou deux décisions — pas un après-midi de tableaux de bord qui disent surtout que rien ne s'est passé.",
          ],
        },
        {
          h2: "Utile dès le premier jour",
          paras: [
            "Vous n'avez pas une semaine à consacrer à configurer un logiciel. Les réglages par défaut sont pensés pour qu'un commerce à établissement unique ait le suivi, les alertes et les flux d'avis opérationnels d'emblée — vous les ajustez si vous le souhaitez, pas parce qu'il le faut.",
            "Commencez par l'audit de visibilité IA gratuit : il montre ce que les assistants disent de vous avant même la création d'un compte. Ensuite, l'installation se résume à vos informations d'entreprise et un profil d'avis connecté — la plateforme fait le reste selon le calendrier.",
          ],
          image: {
            src: "/solutions/smallteams-fr.svg",
            alt: "Une liste de tâches hebdomadaire automatisée selon le calendrier, ne laissant que deux éléments nécessitant une personne",
          },
        },
      ],
      eyebrow: "PETIT PAR CONCEPTION",
      h2: "Conçu pour n'être le poste à plein temps de personne",
      cards: [
        { title: "Tourne sans surveillance", body: "Demandes, suivi et alertes s'exécutent selon le calendrier — la plateforme travaille même les semaines où vous êtes débordé." },
        { title: "Interrompt rarement", body: "Les alertes se déclenchent sur de vrais changements, pas du bruit : ouvrir le tableau de bord devient un choix, pas une corvée." },
        { title: "Aucun projet d'installation", body: "Des réglages par défaut adaptés à un établissement unique ; l'audit gratuit montre la valeur avant même le compte." },
      ],
    },
  },
  "solo-founders": {
    en: {
      prose: [
        {
          h2: "Marketing in the gaps",
          paras: [
            "As a solo founder you are the product team, the support desk and the marketing department — and marketing is the hat that falls first, because it's the one where nothing breaks visibly when you skip it. Except things do break: a review goes unanswered, a competitor takes your spot in an AI recommendation, and you find out months later as slower signups.",
            "Echorank is the marketing person you haven't hired. It watches rankings, reviews and what AI assistants say about your product every day, and compresses all of it into the short list of things worth your reaction. You spend minutes deciding, not hours checking.",
          ],
        },
        {
          h2: "Distribution you can't skip anymore",
          paras: [
            "Your next customers increasingly don't browse ten sites — they ask ChatGPT or Perplexity what to use, and buy from the shortlist in the answer. Whether your product appears in that answer is now as consequential as your Google position, and most founders have never once checked it.",
            "Check it in a minute with the free audit — no account, just what assistants currently say about your product and who they name instead of you. From there, the platform tracks the prompts that matter for your category and tells you when the answer changes, in either direction.",
          ],
          image: {
            src: "/solutions/solofounders-en.svg",
            alt: "A founder's six hats consolidated into one platform that watches, freeing time to build",
          },
        },
      ],
      eyebrow: "FOUNDER-LED",
      h2: "Built for a company of one",
      cards: [
        { title: "The hat you can drop", body: "Monitoring, review flows and alerts run daily without you — marketing stops being the thing that slips." },
        { title: "AI answers, watched", body: "Know when assistants recommend you, drop you, or name a competitor — the day it happens." },
        { title: "Minutes, not mornings", body: "One short read of what moved replaces the tab-cycle of dashboards, profiles and search results." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Le marketing dans les interstices",
          paras: [
            "En fondateur solo, vous êtes l'équipe produit, le support et le service marketing — et le marketing est la casquette qui tombe en premier, parce que c'est celle où rien ne casse visiblement quand on la saute. Sauf que si : un avis reste sans réponse, un concurrent prend votre place dans une recommandation IA, et vous l'apprenez des mois plus tard sous forme d'inscriptions en baisse.",
            "Echorank est le marketeur que vous n'avez pas embauché. Il surveille chaque jour les positions, les avis et ce que les assistants IA disent de votre produit, et compresse le tout en une courte liste de points qui méritent votre réaction. Vous passez des minutes à décider, pas des heures à vérifier.",
          ],
        },
        {
          h2: "Une distribution qu'on ne peut plus ignorer",
          paras: [
            "Vos prochains clients ne parcourent plus dix sites — ils demandent à ChatGPT ou Perplexity quoi utiliser, et achètent dans la liste de la réponse. Que votre produit figure dans cette réponse compte désormais autant que votre position Google, et la plupart des fondateurs ne l'ont jamais vérifié une seule fois.",
            "Vérifiez-le en une minute avec l'audit gratuit — sans compte, juste ce que les assistants disent aujourd'hui de votre produit et qui ils citent à votre place. Ensuite, la plateforme suit les requêtes qui comptent pour votre catégorie et vous prévient quand la réponse change, dans un sens comme dans l'autre.",
          ],
          image: {
            src: "/solutions/solofounders-fr.svg",
            alt: "Les six casquettes d'un fondateur consolidées en une plateforme qui surveille, libérant du temps pour construire",
          },
        },
      ],
      eyebrow: "MENÉ PAR LE FONDATEUR",
      h2: "Conçu pour une entreprise d'une personne",
      cards: [
        { title: "La casquette à poser", body: "Surveillance, flux d'avis et alertes tournent chaque jour sans vous — le marketing cesse d'être ce qui glisse." },
        { title: "Réponses IA surveillées", body: "Sachez quand les assistants vous recommandent, vous retirent ou citent un concurrent — le jour même." },
        { title: "Des minutes, pas des matinées", body: "Une courte lecture de ce qui a bougé remplace le défilé d'onglets, de profils et de résultats de recherche." },
      ],
    },
  },
  "freelancers": {
    en: {
      prose: [
        {
          h2: "Deliver like a team of five",
          paras: [
            "Your clients don't grade you on effort — they grade you against agencies with account managers and reporting departments. The gap was never skill; it's the hours those agencies can throw at monitoring, collation and slide-making that you have to bill somewhere.",
            "Echorank closes that gap by doing the unbillable layer for you. Rankings, reviews and AI visibility are tracked continuously for every client; findings arrive ready to forward. The deliverable that used to eat a Sunday — the monthly report — assembles itself from data that was collected all along.",
          ],
        },
        {
          h2: "Win the client before the contract",
          paras: [
            "The free AI visibility audit is a pitch that runs in a minute: show a prospect what ChatGPT and Perplexity actually say about their business, next to what those assistants say about the competitor down the street. Few sales conversations open better than that gap on screen.",
            "Then the pitch becomes the plan. The audit's findings turn into the tracked prompts, the fixes and the baseline you report progress against — so from the first invoice, the client can see the line move on something they watched you measure.",
          ],
          image: {
            src: "/solutions/freelancers-en.svg",
            alt: "One freelancer supported by one platform, delivering tracked results across every client",
          },
        },
      ],
      eyebrow: "SOLO PRACTICE",
      h2: "Priced and shaped for one",
      cards: [
        { title: "The unbillable hours, automated", body: "Monitoring, collation and reporting run by themselves — your billed hours stay on the work clients pay for." },
        { title: "A pitch in a minute", body: "The free audit shows prospects their AI visibility gap on screen, before you've written a proposal." },
        { title: "Per-client clarity", body: "Each client tracked separately with its own competitors and prompts — nothing bleeds between accounts." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Livrez comme une équipe de cinq",
          paras: [
            "Vos clients ne vous jugent pas à l'effort — ils vous comparent à des agences avec chargés de compte et service reporting. L'écart n'a jamais été le talent : ce sont les heures que ces agences peuvent consacrer à la surveillance, à la compilation et aux slides, des heures que vous devez bien facturer quelque part.",
            "Echorank comble cet écart en prenant en charge la couche non facturable. Positions, avis et visibilité IA sont suivis en continu pour chaque client ; les constats arrivent prêts à transférer. Le livrable qui mangeait un dimanche — le rapport mensuel — s'assemble tout seul à partir de données collectées au fil de l'eau.",
          ],
        },
        {
          h2: "Gagnez le client avant le contrat",
          paras: [
            "L'audit de visibilité IA gratuit est un argumentaire qui tourne en une minute : montrez à un prospect ce que ChatGPT et Perplexity disent réellement de son entreprise, à côté de ce que ces assistants disent du concurrent d'en face. Peu de conversations commerciales s'ouvrent mieux que cet écart à l'écran.",
            "Ensuite, l'argumentaire devient le plan. Les constats de l'audit se transforment en requêtes suivies, en corrections et en référence de départ pour mesurer les progrès — dès la première facture, le client voit la courbe bouger sur ce qu'il vous a vu mesurer.",
          ],
          image: {
            src: "/solutions/freelancers-fr.svg",
            alt: "Un indépendant appuyé par une seule plateforme, livrant des résultats suivis pour chaque client",
          },
        },
      ],
      eyebrow: "EN INDÉPENDANT",
      h2: "Pensé et tarifé pour une seule personne",
      cards: [
        { title: "Les heures non facturables, automatisées", body: "Surveillance, compilation et reporting tournent seuls — vos heures facturées restent sur le travail que les clients paient." },
        { title: "Un argumentaire en une minute", body: "L'audit gratuit montre au prospect son écart de visibilité IA à l'écran, avant même la proposition." },
        { title: "Clarté par client", body: "Chaque client suivi séparément avec ses concurrents et ses requêtes — rien ne se mélange entre les comptes." },
      ],
    },
  },
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
