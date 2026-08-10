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
  "saas-b2b": {
    en: {
      prose: [
        {
          h2: "The eval list is written before you're contacted",
          paras: [
            "B2B buying starts long before a demo request: someone on the committee asks an assistant for 'alternatives to <incumbent>' or 'best <category> for mid-market', reads the three names that come back, and the shortlist hardens from there. By the time a form is filled, most of the market has already been excluded — and the excluded vendors never see the question in any funnel report. It's the dark part of the dark funnel: no referrer, no intent signal, no second chance.",
            "Being on that list is winnable, because the answers aren't oracular — they're assembled from sources you can influence: review platforms, comparison content, documentation, community threads. The vendors who treat those answers as a surface to manage are quietly taking evaluation slots from the ones still optimizing only for the SERP.",
          ],
        },
        {
          h2: "How you're framed decides which deals you see",
          paras: [
            "Assistants don't just name vendors — they characterize them: 'best for enterprises', 'cheaper but limited', 'strong for developers'. That framing routes buyers before positioning decks ever load. If the answers call you the budget option while you're moving upmarket, your pipeline will keep telling you the same story, and no one on the team will know why.",
            "Echorank records how each assistant describes you and your competitors across the prompts that matter — categories, alternatives, comparisons, 'is <product> good' — with sentiment, position and the exact framing language, tracked over time. When the description shifts, or a competitor's framing improves after a content push, you see it the week it happens and can trace it to the sources that caused it.",
          ],
          image: {
            src: "/solutions/saasb2b-en.svg",
            alt: "A buyer asks for alternatives to an incumbent; the assistant's shortlist, with framing, assembled from reviews and comparison content",
          },
        },
        {
          h2: "The sources are a backlog, not a mystery",
          paras: [
            "Citation analysis shows which sources put each vendor into each answer: the G2 profile with 400 recent reviews, the '<competitor> vs <competitor>' page you never wrote, the migration guide that gets quoted verbatim. Each is a concrete work item with an owner — reviews to product marketing, comparison pages to content, docs structure to DevRel — and an expected effect on a named prompt.",
            "The rhythm fits how SaaS teams already ship: pick the highest-value losing prompt, snapshot the baseline, land the intervention, watch the repeated daily runs. Wins are attributable ('the comparison hub took us from absent to #2 on alternatives prompts'), which makes the next quarter's investment case write itself.",
          ],
        },
      ],
      eyebrow: "SAAS & B2B",
      h2: "Built for the dark part of the funnel",
      cards: [
        { title: "In the eval list", body: "Category, alternatives and comparison prompts tracked across assistants — presence measured, not assumed." },
        { title: "Framing, recorded", body: "How each assistant describes you and every competitor — sentiment and positioning language over time." },
        { title: "Source-level backlog", body: "The reviews, pages and docs behind each answer, turned into owned work items with expected impact." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "La liste d'évaluation s'écrit avant qu'on vous contacte",
          paras: [
            "L'achat B2B commence bien avant une demande de démo : quelqu'un du comité demande à un assistant des « alternatives à <leader> » ou « meilleur <catégorie> pour le mid-market », lit les trois noms qui reviennent, et la liste restreinte se fige à partir de là. Quand un formulaire est rempli, l'essentiel du marché a déjà été écarté — et les écartés ne voient jamais la question dans aucun rapport de funnel. C'est la part sombre du dark funnel : pas de référent, pas de signal d'intention, pas de seconde chance.",
            "Figurer sur cette liste se gagne, car les réponses n'ont rien d'oraculaire — elles sont assemblées depuis des sources que vous pouvez travailler : plateformes d'avis, contenus comparatifs, documentation, fils communautaires. Les éditeurs qui traitent ces réponses comme une surface à gérer prennent en silence des places d'évaluation à ceux qui n'optimisent encore que la SERP.",
          ],
        },
        {
          h2: "Votre cadrage décide des affaires que vous voyez",
          paras: [
            "Les assistants ne se contentent pas de nommer des éditeurs — ils les caractérisent : « idéal grandes entreprises », « moins cher mais limité », « fort côté développeurs ». Ce cadrage oriente les acheteurs avant que vos slides de positionnement ne se chargent. Si les réponses font de vous l'option économique alors que vous montez en gamme, votre pipeline continuera de raconter la même histoire, et personne dans l'équipe ne saura pourquoi.",
            "Echorank enregistre la façon dont chaque assistant vous décrit, vous et vos concurrents, sur les requêtes qui comptent — catégories, alternatives, comparaisons, « <produit>, c'est bien ? » — avec sentiment, position et les termes exacts du cadrage, suivis dans le temps. Quand la description bascule, ou que le cadrage d'un concurrent s'améliore après une offensive de contenu, vous le voyez la semaine même et pouvez remonter aux sources qui l'ont causé.",
          ],
          image: {
            src: "/solutions/saasb2b-fr.svg",
            alt: "Un acheteur demande des alternatives à un leader ; la liste de l'assistant, avec cadrage, assemblée depuis avis et contenus comparatifs",
          },
        },
        {
          h2: "Les sources sont un backlog, pas un mystère",
          paras: [
            "L'analyse des citations montre quelles sources placent chaque éditeur dans chaque réponse : le profil G2 aux 400 avis récents, la page « <concurrent> vs <concurrent> » que vous n'avez jamais écrite, le guide de migration cité mot pour mot. Chacune est une tâche concrète avec un responsable — les avis au product marketing, les pages comparatives au contenu, la structure des docs au DevRel — et un effet attendu sur une requête nommée.",
            "Le rythme épouse la façon dont les équipes SaaS livrent déjà : choisir la requête perdue à plus forte valeur, figer la référence, livrer l'intervention, regarder les exécutions quotidiennes répétées. Les gains sont attribuables (« le hub comparatif nous a fait passer d'absents à #2 sur les requêtes d'alternatives »), et le dossier d'investissement du trimestre suivant s'écrit tout seul.",
          ],
        },
      ],
      eyebrow: "SAAS ET B2B",
      h2: "Conçu pour la part sombre du funnel",
      cards: [
        { title: "Dans la liste d'évaluation", body: "Requêtes de catégorie, d'alternatives et de comparaison suivies sur les assistants — une présence mesurée, pas supposée." },
        { title: "Le cadrage, enregistré", body: "Comment chaque assistant vous décrit, vous et chaque concurrent — sentiment et termes de positionnement dans le temps." },
        { title: "Un backlog par source", body: "Les avis, pages et docs derrière chaque réponse, transformés en tâches attribuées avec impact attendu." },
      ],
    },
  },
  "marketing-agencies": {
    en: {
      prose: [
        {
          h2: "You sell visibility. Are you visible?",
          paras: [
            "Every agency faces the cobbler's-children test, and it has moved: prospects now ask ChatGPT and Perplexity for 'the best marketing agency in <city>' or 'top B2B SaaS agencies' — and the answer is a pre-made shortlist you're either on or not. An agency that pitches search and AI expertise while being absent from those answers is making its competitors' argument for them; one that shows up is closing before the first call.",
            "Track the prompts your own prospects ask, the way you would for a client. The gaps — the directory you're not on, the comparison article that skips you, the thin review profile the assistants read — are the same fixes you sell, applied to yourself. Nothing demonstrates the craft like being its best case study.",
          ],
        },
        {
          h2: "The service line your clients are about to ask for",
          paras: [
            "Your clients are hearing about AI search from their boards, their peers and their inboxes — and they'll ask someone to handle it. The agencies that answer first with a concrete offer will take that budget; the rest will watch it go to whoever did. Reputation and AI visibility management is a natural extension of what you already sell: same clients, same retainer motion, new deliverable.",
            "Echorank productizes it for you: tracked prompts, review management, visibility scores and citation analysis per client, delivered under your brand through the white-label dashboard. The free audit is the sales tool — run it live on a prospect's brand and their competitor's, and the gap on screen writes the proposal. Pricing the line is yours; the platform cost is one subscription across the roster.",
          ],
          image: {
            src: "/solutions/marketingagencies-en.svg",
            alt: "A buyer asks an assistant for the best agency; the answer shortlists three, and the absent agency never learns it was skipped",
          },
        },
        {
          h2: "Retainers that renew on evidence",
          paras: [
            "Marketing retainers churn where results feel abstract. Visibility work has the opposite property when it's measured: the client can watch their brand enter answers it was absent from, their rating climb, their share of voice move against named competitors. Those are numbers a CFO accepts, attached to work you did.",
            "Each client runs in its own workspace with its own prompts, competitors and baselines; your team spans all of them from one login, and month-end reporting assembles itself from the data that accumulated. The result is the agency math that matters: services sold at agency rates, delivered on platform time.",
          ],
        },
      ],
      eyebrow: "MARKETING AGENCIES",
      h2: "Built to be sold twice",
      cards: [
        { title: "Practice it on yourself", body: "Track the prompts your prospects ask — and be the agency the assistants name." },
        { title: "A productized new line", body: "Reputation + AI visibility as a white-label service: your brand, your pricing, one platform cost." },
        { title: "Evidence-backed renewals", body: "Per-client baselines and visible movement — retainers defended with numbers, not narratives." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Vous vendez de la visibilité. Êtes-vous visible ?",
          paras: [
            "Chaque agence affronte le test du cordonnier mal chaussé, et il a changé de terrain : les prospects demandent désormais à ChatGPT et Perplexity « la meilleure agence marketing à <ville> » ou « les meilleures agences B2B SaaS » — et la réponse est une liste restreinte toute faite, sur laquelle vous êtes ou non. Une agence qui vend une expertise recherche et IA tout en étant absente de ces réponses plaide pour ses concurrents ; celle qui y figure a conclu avant le premier appel.",
            "Suivez les requêtes que posent vos propres prospects, comme vous le feriez pour un client. Les manques — l'annuaire où vous n'êtes pas, l'article comparatif qui vous oublie, le profil d'avis mince que lisent les assistants — sont les corrections mêmes que vous vendez, appliquées à vous. Rien ne démontre le métier comme en être la meilleure étude de cas.",
          ],
        },
        {
          h2: "La ligne de service que vos clients vont réclamer",
          paras: [
            "Vos clients entendent parler de recherche IA par leurs conseils d'administration, leurs pairs et leurs boîtes mail — et ils demanderont à quelqu'un de s'en charger. Les agences qui répondront les premières avec une offre concrète prendront ce budget ; les autres le regarderont partir. La gestion de réputation et de visibilité IA prolonge naturellement ce que vous vendez déjà : mêmes clients, même mécanique de contrat, nouveau livrable.",
            "Echorank la productise pour vous : requêtes suivies, gestion des avis, scores de visibilité et analyse de citations par client, livrés sous votre marque via le tableau de bord en marque blanche. L'audit gratuit est l'outil de vente — lancez-le en direct sur la marque d'un prospect et celle de son concurrent : l'écart à l'écran écrit la proposition. Le prix de la ligne vous appartient ; le coût plateforme est un abonnement pour tout le portefeuille.",
          ],
          image: {
            src: "/solutions/marketingagencies-fr.svg",
            alt: "Un acheteur demande à un assistant la meilleure agence ; la réponse en retient trois, et l'agence absente ne l'apprend jamais",
          },
        },
        {
          h2: "Des contrats qui se renouvellent sur des preuves",
          paras: [
            "Les contrats marketing se perdent là où les résultats semblent abstraits. Le travail de visibilité a la propriété inverse quand il est mesuré : le client peut voir sa marque entrer dans des réponses dont elle était absente, sa note monter, sa part de voix progresser contre des concurrents nommés. Ce sont des chiffres qu'un directeur financier accepte, rattachés à un travail que vous avez fait.",
            "Chaque client tourne dans son espace propre avec ses requêtes, ses concurrents et ses références ; votre équipe couvre l'ensemble depuis une seule connexion, et le reporting de fin de mois s'assemble depuis les données accumulées. Il en sort l'équation d'agence qui compte : des services vendus au tarif agence, livrés au temps plateforme.",
          ],
        },
      ],
      eyebrow: "AGENCES MARKETING",
      h2: "Conçu pour être vendu deux fois",
      cards: [
        { title: "Appliquez-le à vous-même", body: "Suivez les requêtes de vos prospects — et soyez l'agence que les assistants nomment." },
        { title: "Une nouvelle ligne productisée", body: "Réputation + visibilité IA en marque blanche : votre marque, vos prix, un seul coût plateforme." },
        { title: "Des renouvellements étayés", body: "Références par client et progression visible — des contrats défendus par des chiffres, pas des récits." },
      ],
    },
  },
  "ecommerce-retail": {
    en: {
      prose: [
        {
          h2: "Trust is the last field in the checkout",
          paras: [
            "Every store loses buyers at the same invisible moment: card in hand, a flicker of doubt, a new tab — 'is this store legit', '<brand> reviews', '<brand> reddit'. What that tab returns decides whether the order completes. A thin review profile, an unanswered complaint thread, or an AI answer that hedges about you is a conversion leak no amount of ad spend patches, because the doubt happens after the click you paid for.",
            "The leak is measurable and fixable. Growing review volume, recent positives, and visible responses to complaints are exactly what that verification tab wants to find — and they compound: the store that passes the check converts the traffic it already has, which beats buying more of it.",
          ],
        },
        {
          h2: "Reviews are operations, not vibes",
          paras: [
            "Post-purchase review requests run on delivery timing, not memory — the ask lands when the product has arrived and the experience is fresh, which is when happy customers actually convert into reviewers. Volume and recency stop depending on whoever remembered to send a campaign.",
            "Every review gets answered in your brand's voice: thanks that don't read templated for the good ones, and calm, concrete resolution for the bad ones — because the response to a one-star review is read by a hundred hesitating shoppers for every one reviewer. Sudden rating drift or a spike of negatives raises an alert the same day, while the pattern is still one bad batch or one courier problem, not a reputation.",
          ],
          image: {
            src: "/solutions/ecommerce-en.svg",
            alt: "A shopper pauses at checkout to verify the store; reviews, answered complaints and an AI recommendation confirm the order",
          },
        },
        {
          h2: "Be in the answer when nobody names a store",
          paras: [
            "A growing slice of purchases starts brandless: 'best running headphones under $100', 'where should I buy ceramic cookware'. Assistants answer with specific brands and stores, assembled from reviews, comparison content and the sources they trust. Whoever is in that answer gets the visit; everyone else never learns the question was asked.",
            "Echorank tracks the buying prompts for your categories across the major assistants, records when your store or products are named and which sources put them there, and turns absences into a fix list — the comparison page missing for your hero product, the review platform the assistants cite where your profile is thin, the inconsistent brand description that keeps you out of clean answers. One weekly read tells you whether the answers are moving your way.",
          ],
        },
      ],
      eyebrow: "ECOMMERCE & RETAIL",
      h2: "Built for stores that convert on trust",
      cards: [
        { title: "Pass the checkout check", body: "Volume, recency and answered complaints — the profile a hesitating buyer verifies before paying." },
        { title: "Review ops on autopilot", body: "Delivery-timed requests and on-brand responses at ecommerce volume, with same-day drift alerts." },
        { title: "Named in buying answers", body: "Category prompts tracked across assistants — with the sources that decide which stores get named." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "La confiance est le dernier champ du paiement",
          paras: [
            "Chaque boutique perd des acheteurs au même moment invisible : carte en main, un doute, un nouvel onglet — « cette boutique est-elle fiable », « avis <marque> », « <marque> reddit ». Ce que renvoie cet onglet décide si la commande aboutit. Un profil d'avis mince, un fil de réclamations sans réponse ou une réponse IA qui hésite à votre sujet est une fuite de conversion qu'aucun budget publicitaire ne colmate, car le doute survient après le clic que vous avez payé.",
            "Cette fuite se mesure et se répare. Un volume d'avis qui croît, des avis récents positifs et des réponses visibles aux réclamations sont exactement ce que cet onglet de vérification cherche — et l'effet se cumule : la boutique qui passe le contrôle convertit le trafic qu'elle a déjà, ce qui vaut mieux que d'en acheter davantage.",
          ],
        },
        {
          h2: "Les avis sont de l'exploitation, pas de l'ambiance",
          paras: [
            "Les demandes d'avis post-achat se calent sur la livraison, pas sur la mémoire — la sollicitation arrive quand le produit est reçu et l'expérience fraîche, c'est-à-dire quand les clients satisfaits deviennent réellement des auteurs d'avis. Volume et fraîcheur cessent de dépendre de qui a pensé à lancer une campagne.",
            "Chaque avis reçoit une réponse dans la voix de votre marque : des remerciements qui ne sentent pas le gabarit pour les bons, une résolution calme et concrète pour les mauvais — car la réponse à un avis une étoile est lue par cent acheteurs hésitants pour un seul auteur. Une dérive soudaine de la note ou une pointe de négatifs déclenche une alerte le jour même, tant que le motif est encore un lot défectueux ou un problème de transporteur, pas une réputation.",
          ],
          image: {
            src: "/solutions/ecommerce-fr.svg",
            alt: "Un acheteur s'arrête au paiement pour vérifier la boutique ; avis, réclamations traitées et recommandation IA confirment la commande",
          },
        },
        {
          h2: "Être dans la réponse quand personne ne nomme de boutique",
          paras: [
            "Une part croissante des achats démarre sans marque : « meilleur casque de course à moins de 100 € », « où acheter des ustensiles en céramique ». Les assistants répondent avec des marques et des boutiques précises, assemblées depuis les avis, les contenus comparatifs et les sources qu'ils jugent fiables. Qui figure dans cette réponse reçoit la visite ; les autres n'apprennent jamais que la question a été posée.",
            "Echorank suit les requêtes d'achat de vos catégories sur les principaux assistants, enregistre quand votre boutique ou vos produits sont nommés et quelles sources les y ont mis, et transforme les absences en liste de corrections — la page comparative manquante pour votre produit phare, la plateforme d'avis citée par les assistants où votre profil est mince, la description de marque incohérente qui vous tient hors des réponses nettes. Une lecture hebdomadaire vous dit si les réponses tournent en votre faveur.",
          ],
        },
      ],
      eyebrow: "E-COMMERCE ET COMMERCE",
      h2: "Conçu pour les boutiques qui convertissent sur la confiance",
      cards: [
        { title: "Passer le contrôle du paiement", body: "Volume, fraîcheur et réclamations traitées — le profil qu'un acheteur hésitant vérifie avant de payer." },
        { title: "Des avis en pilote automatique", body: "Demandes calées sur la livraison et réponses à la voix de la marque, au volume e-commerce, avec alertes de dérive le jour même." },
        { title: "Nommé dans les réponses d'achat", body: "Les requêtes de catégorie suivies sur les assistants — avec les sources qui décident quelles boutiques sont nommées." },
      ],
    },
  },
  "professional-services": {
    en: {
      prose: [
        {
          h2: "The referral still comes — but now it gets checked",
          paras: [
            "Professional services grew on word of mouth, and word of mouth still starts the journey. What changed is the second step: before calling the firm a colleague recommended, the prospect checks. They read the reviews, scan the rating, and increasingly ask an AI assistant to confirm the choice — 'best employment lawyer in Denver', 'is <firm> reputable'. A warm referral with a thin or mixed online profile quietly dies between the recommendation and the call, and you never learn it happened.",
            "For a firm, that check is high stakes precisely because the purchase is high trust: nobody hires an accountant or a law firm the way they order lunch. The profile the prospect finds either confirms the referral or contradicts it — there is no neutral outcome.",
          ],
        },
        {
          h2: "Reputation as evidence of expertise",
          paras: [
            "Clients can't evaluate your work product before hiring you, so they evaluate proxies: what past clients say, how the firm responds to criticism, how consistently it's described across the sources they check. A review corpus that names specific matters — responsiveness, clarity on fees, outcomes — reads as evidence in a way a website's own claims never can.",
            "Echorank builds that corpus deliberately. Review requests go out after matters close, timed and worded for a professional context; every review receives a response in the firm's voice — measured, specific, and mindful that confidentiality limits what can be said publicly. A calm, factual reply to an unfair review is read by every prospect who finds it, and it does more for the firm than the review did against it.",
          ],
          image: {
            src: "/solutions/professionalservices-en.svg",
            alt: "A word-of-mouth referral verified online: rating, reviews and an AI answer deciding whether the call happens",
          },
        },
        {
          h2: "Be the name the assistants give",
          paras: [
            "The newest referrer isn't a person. When someone with no network in your specialty asks ChatGPT or Perplexity who to engage, the answer names two or three firms — assembled from directories, review profiles, rankings and the firm's own site. Being in that answer is a referral at scale; being absent from it is invisible, because no one tells you they asked.",
            "The platform tracks the prompts that matter for your practice areas and locations, records when your firm is named, how it's described, and which sources the assistants lean on — then turns the gaps into a fix list: the directory entry that's inconsistent, the practice-area page that doesn't exist, the review profile that's strong but unclaimed. Ten minutes a week for the partner who owns the firm's name; the watching runs by itself.",
          ],
        },
      ],
      eyebrow: "PROFESSIONAL SERVICES",
      h2: "Built for firms that live on trust",
      cards: [
        { title: "Referral-proof profile", body: "Reviews, rating and responses that confirm the recommendation a prospect arrived with." },
        { title: "Discreet by design", body: "Requests and responses worded for professional contexts — specific without breaching confidentiality." },
        { title: "Named by assistants", body: "Practice-area prompts tracked across the AI assistants — with the source gaps that decide who gets named." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "La recommandation arrive toujours — mais elle est désormais vérifiée",
          paras: [
            "Les services professionnels ont grandi sur le bouche-à-oreille, et le bouche-à-oreille amorce toujours le parcours. Ce qui a changé, c'est la deuxième étape : avant d'appeler le cabinet qu'un collègue recommande, le prospect vérifie. Il lit les avis, regarde la note, et demande de plus en plus à un assistant IA de confirmer le choix — « meilleur avocat en droit du travail à Lyon », « le cabinet <nom> est-il sérieux ». Une recommandation chaleureuse doublée d'un profil en ligne mince ou mitigé meurt en silence entre la recommandation et l'appel — et vous ne l'apprenez jamais.",
            "Pour un cabinet, cette vérification pèse lourd précisément parce que l'achat repose sur la confiance : personne n'engage un expert-comptable ou un cabinet d'avocats comme on commande un déjeuner. Le profil que trouve le prospect confirme la recommandation ou la contredit — il n'y a pas d'issue neutre.",
          ],
        },
        {
          h2: "La réputation comme preuve d'expertise",
          paras: [
            "Les clients ne peuvent pas évaluer votre travail avant de vous engager ; ils évaluent donc des indices : ce que disent les anciens clients, la façon dont le cabinet répond à la critique, la cohérence de sa description sur les sources qu'ils consultent. Un corpus d'avis qui nomme des choses précises — réactivité, clarté des honoraires, résultats — se lit comme une preuve, ce que les affirmations d'un site ne seront jamais.",
            "Echorank construit ce corpus méthodiquement. Les demandes d'avis partent après la clôture des dossiers, au bon moment et dans des termes adaptés au contexte professionnel ; chaque avis reçoit une réponse dans la voix du cabinet — mesurée, précise, et attentive à ce que la confidentialité limite ce qui peut se dire publiquement. Une réponse calme et factuelle à un avis injuste est lue par chaque prospect qui la trouve, et elle sert davantage le cabinet que l'avis ne l'a desservi.",
          ],
          image: {
            src: "/solutions/professionalservices-fr.svg",
            alt: "Une recommandation de bouche-à-oreille vérifiée en ligne : note, avis et réponse IA décident si l'appel a lieu",
          },
        },
        {
          h2: "Être le nom que donnent les assistants",
          paras: [
            "Le plus récent des prescripteurs n'est pas une personne. Quand quelqu'un sans réseau dans votre spécialité demande à ChatGPT ou Perplexity qui engager, la réponse nomme deux ou trois cabinets — assemblés depuis des annuaires, des profils d'avis, des classements et le site du cabinet lui-même. Figurer dans cette réponse, c'est une recommandation à grande échelle ; en être absent, c'est être invisible, car personne ne vous dit qu'il a posé la question.",
            "La plateforme suit les requêtes qui comptent pour vos domaines et vos implantations, enregistre quand votre cabinet est nommé, comment il est décrit, et sur quelles sources s'appuient les assistants — puis transforme les manques en liste de corrections : l'entrée d'annuaire incohérente, la page de domaine d'expertise qui n'existe pas, le profil d'avis solide mais non revendiqué. Dix minutes par semaine pour l'associé qui répond du nom du cabinet ; la surveillance tourne seule.",
          ],
        },
      ],
      eyebrow: "SERVICES PROFESSIONNELS",
      h2: "Conçu pour les cabinets qui vivent de la confiance",
      cards: [
        { title: "Un profil à l'épreuve de la recommandation", body: "Avis, note et réponses qui confirment la recommandation avec laquelle le prospect arrive." },
        { title: "Discret par conception", body: "Des demandes et réponses formulées pour le contexte professionnel — précises sans rompre la confidentialité." },
        { title: "Nommé par les assistants", body: "Les requêtes par domaine d'expertise suivies sur les assistants IA — avec les manques de sources qui décident des noms cités." },
      ],
    },
  },
  "growth-marketers": {
    en: {
      prose: [
        {
          h2: "There's a channel missing from your dashboard",
          paras: [
            "Your reporting covers paid, organic, social, email — every channel with a pixel. Meanwhile a growing share of buyers ask ChatGPT or Perplexity what to use and go straight to whatever the answer names. No referrer, no UTM, often no click at all: it shows up in your numbers as 'direct' or as brand searches you can't explain, which means a channel is growing or shrinking under your targets without a row in the sheet.",
            "Echorank gives it the row. The prompts your buyers ask are executed across the major assistants on schedule; mentions, positions and recommendations are recorded per answer; and the result is a visibility trend and share-of-voice you can put next to every other channel — the same way you'd never run paid without impression data.",
          ],
        },
        {
          h2: "Share of voice you can act against",
          paras: [
            "Growth work starts from relative position: who's winning the demand you want, and where. The competitor matrix scores every rival on the prompts that matter — visibility, average position, citation frequency, sentiment — and shows where they're strong, where they're absent, and which sources earned them their slots.",
            "That turns fuzzy 'AI strategy' into targeting. A prompt where a competitor dominates on the strength of two publisher citations is an outreach target. One where nobody is consistently recommended is open ground. The opportunity score ranks them by commercial value times gap, so the backlog orders itself.",
          ],
          image: {
            src: "/solutions/growthmarketers-en.svg",
            alt: "An acquisition channel dashboard with AI answers added as a measured channel alongside paid, organic and social",
          },
        },
        {
          h2: "Run it like the experiments you already run",
          paras: [
            "You don't ship landing pages without a control, and AI visibility shouldn't be different. Pick a high-value losing prompt, snapshot the baseline, ship one intervention — the comparison page, the entity fixes, the review push — and let daily tracking record what happens against the baseline.",
            "Because the assistants are probabilistic, single checks lie; repeated runs and volatility tracking separate a real shift from noise. When the lift is real you have an attributable win — 'this page took us from 12% to 31% visibility on this prompt' — which is the kind of sentence that survives a growth review.",
          ],
          image: {
            src: "/solutions/growthmarketers-loop-en.svg",
            alt: "An experiment loop: snapshotted baseline, one shipped intervention, daily tracking showing attributable lift",
          },
        },
        {
          h2: "Compounding, not campaigns",
          paras: [
            "Paid stops when the budget stops. AI visibility behaves more like SEO with a steeper compounding curve: a page that earns its way into an answer keeps getting served for every phrasing of the question, and each citation makes the next one more likely. Early position is cheap; displacing an incumbent later is not.",
            "The operating rhythm fits a growth team as it is: alerts when a competitor takes a top recommendation or your visibility drops past threshold, weekly movement reads, monthly share-of-voice against targets. One more channel in the review — except this one most of your competitors aren't measuring yet.",
          ],
        },
      ],
      eyebrow: "FOR GROWTH TEAMS",
      h2: "A channel, treated like one",
      cards: [
        { title: "Measured like a channel", body: "Visibility, share of voice and trend per prompt — AI answers get a row next to paid and organic." },
        { title: "Experiments with baselines", body: "Snapshot, intervene, track daily — lifts are attributable, not anecdotal." },
        { title: "Targets from the matrix", body: "Competitor strength and open prompts scored by opportunity — the backlog orders itself." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Il manque un canal à votre tableau de bord",
          paras: [
            "Votre reporting couvre le paid, l'organique, le social, l'email — tous les canaux à pixel. Pendant ce temps, une part croissante d'acheteurs demande à ChatGPT ou Perplexity quoi utiliser et va directement vers ce que la réponse nomme. Pas de référent, pas d'UTM, souvent pas de clic du tout : cela apparaît dans vos chiffres en « direct » ou en recherches de marque inexpliquées — un canal grandit ou rétrécit sous vos objectifs sans ligne dans le tableau.",
            "Echorank lui donne sa ligne. Les requêtes de vos acheteurs sont exécutées sur les principaux assistants selon un calendrier ; mentions, positions et recommandations sont enregistrées par réponse ; il en sort une tendance de visibilité et une part de voix à poser à côté de chaque autre canal — comme vous ne piloteriez jamais le paid sans données d'impressions.",
          ],
        },
        {
          h2: "Une part de voix sur laquelle agir",
          paras: [
            "Le travail de croissance part de la position relative : qui gagne la demande que vous visez, et où. La matrice concurrentielle note chaque rival sur les requêtes qui comptent — visibilité, position moyenne, fréquence de citation, sentiment — et montre où il est fort, où il est absent, et quelles sources lui ont valu ses places.",
            "La « stratégie IA » floue devient du ciblage. Une requête qu'un concurrent domine grâce à deux citations d'éditeurs est une cible de relations presse. Une requête où personne n'est recommandé de façon constante est un terrain libre. Le score d'opportunité les classe par valeur commerciale multipliée par l'écart : le backlog s'ordonne tout seul.",
          ],
          image: {
            src: "/solutions/growthmarketers-fr.svg",
            alt: "Un tableau de bord des canaux d'acquisition avec les réponses IA ajoutées comme canal mesuré aux côtés du paid, de l'organique et du social",
          },
        },
        {
          h2: "Pilotez-le comme vos expérimentations",
          paras: [
            "Vous ne lancez pas de landing page sans témoin ; la visibilité IA ne devrait pas faire exception. Choisissez une requête à forte valeur que vous perdez, figez la référence, livrez une seule intervention — la page comparative, les corrections d'entités, la campagne d'avis — et laissez le suivi quotidien enregistrer l'écart à la référence.",
            "Les assistants étant probabilistes, les vérifications isolées mentent ; les exécutions répétées et le suivi de volatilité séparent un vrai déplacement du bruit. Quand le gain est réel, vous tenez une victoire attribuable — « cette page nous a fait passer de 12 % à 31 % de visibilité sur cette requête » — le genre de phrase qui survit à une revue growth.",
          ],
          image: {
            src: "/solutions/growthmarketers-loop-fr.svg",
            alt: "Une boucle d'expérimentation : référence figée, une intervention livrée, suivi quotidien montrant un gain attribuable",
          },
        },
        {
          h2: "Du cumul, pas des campagnes",
          paras: [
            "Le paid s'arrête quand le budget s'arrête. La visibilité IA se comporte plutôt comme le SEO avec une courbe de cumul plus raide : une page qui gagne sa place dans une réponse est resservie pour chaque formulation de la question, et chaque citation rend la suivante plus probable. La position précoce coûte peu ; déloger un installé plus tard, non.",
            "Le rythme opérationnel s'insère dans une équipe growth telle quelle : alertes quand un concurrent prend une recommandation de tête ou que votre visibilité franchit un seuil, lectures hebdomadaires des mouvements, part de voix mensuelle contre objectifs. Un canal de plus dans la revue — sauf que celui-ci, la plupart de vos concurrents ne le mesurent pas encore.",
          ],
        },
      ],
      eyebrow: "POUR LES ÉQUIPES GROWTH",
      h2: "Un canal, traité comme tel",
      cards: [
        { title: "Mesuré comme un canal", body: "Visibilité, part de voix et tendance par requête — les réponses IA ont leur ligne à côté du paid et de l'organique." },
        { title: "Des expérimentations avec référence", body: "Figer, intervenir, suivre au quotidien — les gains sont attribuables, pas anecdotiques." },
        { title: "Des cibles issues de la matrice", body: "Forces concurrentes et requêtes libres notées par opportunité — le backlog s'ordonne tout seul." },
      ],
    },
  },
  "content-marketers": {
    en: {
      prose: [
        {
          h2: "Write what two audiences will quote",
          paras: [
            "Every piece you publish now performs for two readers: the buyer skimming for an answer, and the AI assistant deciding whether your page is worth quoting when someone asks it the same question. They reward the same things — a direct answer near the top, specifics instead of throat-clearing, structure a machine can parse, claims a citation can hang on — but almost no content calendar is built with the second reader in mind.",
            "That second reader is worth planning for, because its output is compounding: a page an assistant starts citing gets surfaced for every variant of the question, indefinitely, without another dollar of distribution. The skill isn't new writing; it's knowing which questions are being asked of the assistants and what their current answers are missing.",
          ],
        },
        {
          h2: "Briefs from evidence, not brainstorms",
          paras: [
            "The weakest link in most content operations is how topics get chosen: a keyword list, a competitor's blog, a brainstorm. Echorank replaces that with observed demand. Content gap analysis starts from the prompts where competitors get named and you don't, pulls the pages that earned their citations, and itemizes the topics those pages cover that yours don't.",
            "What lands in your queue is a brief with its justification attached: the prompt at stake, the missing topics, the sources currently winning it, and the search demand behind it. Prioritization stops being taste — it's the size of the prompt times the size of the gap.",
          ],
          image: {
            src: "/solutions/contentmarketers-en.svg",
            alt: "A losing prompt broken into itemized topic gaps, producing an evidence-backed content brief",
          },
        },
        {
          h2: "Measure pieces where they actually perform",
          paras: [
            "Traffic is a lagging, partial measure — a piece can drive zero clicks and still be doing its best work as the source an assistant quotes. Every published piece gets tracked on three surfaces: its rank in classic results, whether it's cited in AI answers on the prompts it targets, and what it contributes to how assistants describe your brand.",
            "That changes retrospectives. Instead of 'this post got 400 visits,' you can say 'this comparison page is now cited in four of the six answers where we used to be absent' — which is a sentence budget owners understand, and a much better guide to what to write next.",
          ],
          image: {
            src: "/solutions/contentmarketers-quoted-en.svg",
            alt: "One published piece tracked across three surfaces: SERP rank, AI answer quotes, and source citations",
          },
        },
        {
          h2: "A calendar that closes its own loop",
          paras: [
            "The rhythm becomes circular: tracked prompts reveal gaps, gaps become briefs, published pieces get measured on the prompts that motivated them, and the results reorder the queue. New prompt discovery keeps the pool fresh — questions pulled from search data, People-Also-Ask and the assistants themselves, so the calendar tracks what the market is asking this quarter, not last year.",
            "None of it requires more writing than you're doing now. It requires aiming the same output at questions with evidence behind them — and being able to show, piece by piece, that the aim was right.",
          ],
        },
      ],
      eyebrow: "FOR CONTENT TEAMS",
      h2: "Content strategy with receipts",
      cards: [
        { title: "Gap-driven briefs", body: "Topics chosen from prompts you're losing, with the winning sources and missing subjects itemized." },
        { title: "Per-piece tracking", body: "Every piece measured on rank, AI citations and brand contribution — not traffic alone." },
        { title: "Fresh demand", body: "New prompts discovered continuously from search data and the assistants — the calendar follows the market." },
      ],
    },
    fr: {
      prose: [
        {
          h2: "Écrire ce que deux publics vont citer",
          paras: [
            "Chaque contenu publié joue désormais devant deux lecteurs : l'acheteur qui survole en cherchant une réponse, et l'assistant IA qui décide si votre page mérite d'être reprise quand on lui pose la même question. Les deux récompensent les mêmes choses — une réponse directe dès le haut de page, du concret plutôt que des préambules, une structure qu'une machine peut analyser, des affirmations auxquelles accrocher une citation — mais presque aucun calendrier éditorial n'est construit pour le second lecteur.",
            "Ce second lecteur mérite pourtant qu'on planifie pour lui, car son effet se compose : une page qu'un assistant se met à citer ressort pour chaque variante de la question, indéfiniment, sans un euro de diffusion supplémentaire. La compétence n'est pas une nouvelle écriture ; c'est savoir quelles questions sont posées aux assistants et ce qui manque à leurs réponses actuelles.",
          ],
        },
        {
          h2: "Des briefs issus de preuves, pas de brainstormings",
          paras: [
            "Le maillon faible de la plupart des équipes contenu, c'est le choix des sujets : une liste de mots-clés, le blog d'un concurrent, un brainstorming. Echorank y substitue la demande observée. L'analyse des manques part des requêtes où les concurrents sont nommés et pas vous, récupère les pages qui leur ont valu leurs citations, et détaille les sujets couverts par ces pages que les vôtres ignorent.",
            "Ce qui arrive dans votre file, c'est un brief avec sa justification jointe : la requête en jeu, les sujets manquants, les sources qui la gagnent actuellement, et la demande de recherche derrière. La priorisation cesse d'être une affaire de goût — c'est la taille de la requête multipliée par la taille du manque.",
          ],
          image: {
            src: "/solutions/contentmarketers-fr.svg",
            alt: "Une requête perdue décomposée en manques de sujets détaillés, produisant un brief étayé par des preuves",
          },
        },
        {
          h2: "Mesurer les contenus là où ils performent vraiment",
          paras: [
            "Le trafic est une mesure tardive et partielle — un contenu peut générer zéro clic et faire pourtant son meilleur travail comme source citée par un assistant. Chaque contenu publié est suivi sur trois surfaces : sa position dans les résultats classiques, sa présence dans les réponses IA sur les requêtes qu'il vise, et sa contribution à la façon dont les assistants décrivent votre marque.",
            "Cela change les bilans. Au lieu de « cet article a fait 400 visites », vous pouvez dire « cette page comparative est désormais citée dans quatre des six réponses où nous étions absents » — une phrase que les détenteurs de budget comprennent, et un bien meilleur guide pour la suite.",
          ],
          image: {
            src: "/solutions/contentmarketers-quoted-fr.svg",
            alt: "Un contenu publié suivi sur trois surfaces : position SERP, reprises dans les réponses IA et citations comme source",
          },
        },
        {
          h2: "Un calendrier qui boucle sa propre boucle",
          paras: [
            "Le rythme devient circulaire : les requêtes suivies révèlent des manques, les manques deviennent des briefs, les contenus publiés sont mesurés sur les requêtes qui les ont motivés, et les résultats réordonnent la file. La découverte continue de requêtes garde le vivier frais — questions tirées des données de recherche, des People Also Ask et des assistants eux-mêmes, pour que le calendrier suive ce que le marché demande ce trimestre, pas l'an dernier.",
            "Rien de tout cela n'exige d'écrire plus qu'aujourd'hui. Cela exige de viser, avec la même production, des questions étayées par des preuves — et de pouvoir montrer, contenu par contenu, que la visée était juste.",
          ],
        },
      ],
      eyebrow: "POUR LES ÉQUIPES CONTENU",
      h2: "Une stratégie de contenu avec pièces à l'appui",
      cards: [
        { title: "Briefs pilotés par les manques", body: "Des sujets choisis à partir des requêtes que vous perdez, avec sources gagnantes et sujets absents détaillés." },
        { title: "Suivi par contenu", body: "Chaque contenu mesuré sur position, citations IA et contribution à la marque — pas seulement le trafic." },
        { title: "Demande fraîche", body: "De nouvelles requêtes découvertes en continu depuis les données de recherche et les assistants — le calendrier suit le marché." },
      ],
    },
  },
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
