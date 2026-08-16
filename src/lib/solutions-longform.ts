// src/lib/solutions-longform.ts
//
// Optional long-form prose for Solutions landing pages, keyed by item slug.
//
// A SIBLING MODULE, NOT A FIELD ON THE TAXONOMY. solutions-taxonomy.ts is
// imported by PublicNav — a client component that renders on every marketing
// page — so eight essays in two languages living there would ship to the
// browser on every page load to power a menu that shows none of it. The page
// imports this; the nav does not.
//
// OPTIONAL BY CONSTRUCTION. An item with no entry renders exactly as before:
// the template skips the whole section rather than emitting an empty one.
//
// en/fr only, matching the taxonomy's own model — solutionBase() folds de-CH
// and the regional locales onto those two. Adding German prose here alone
// would put it under English headings, which is worse than English throughout.

import type { SolutionBase } from "./solutions-taxonomy";

export interface LongformSection {
  h2: string;
  paras: string[];
}

export interface Longform {
  sections: LongformSection[];
}

const LONGFORM: Record<string, Record<SolutionBase, Longform>> = {
  "boost-search-rankings": {
    en: {
      sections: [
        {
          h2: "Rankings are an output, not a tactic",
          paras: [
            "Pages don't rank because you want them to — they rank because they answer a query better than the alternatives, load cleanly, and carry enough authority to be trusted. That's why chasing positions directly rarely works. The work that moves rankings is almost always upstream: choosing terms you can realistically win, closing the content gaps competitors left open, and fixing the technical problems that quietly hold pages back.",
            "Echorank360 organizes that upstream work in one place. Keyword research shows you the demand and how hard each term is to win. Rank tracking turns positions into a trend you can act on rather than a number you check when you remember. Site audits surface the crawl, speed and structure issues that cost positions you'd already earned.",
          ],
        },
        {
          h2: "A weekly rhythm that compounds",
          paras: [
            "The teams that climb do a small set of things on repeat: review movement weekly, pick one or two terms to push, publish or improve one page against them, and clear a handful of technical issues. None of it is dramatic. Over a quarter it compounds into rankings that competitors have to work to take back.",
            "Start with the audit to find what's broken, add your core terms to the rank tracker, and let the weekly movement tell you where to spend effort. When a page jumps or slips, you'll know the same week — and you'll know why.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Le positionnement est un résultat, pas une tactique",
          paras: [
            "Une page ne se positionne pas parce que vous le souhaitez : elle se positionne parce qu'elle répond mieux que les autres à une requête, se charge proprement et bénéficie d'assez d'autorité pour inspirer confiance. C'est pourquoi courir après les positions fonctionne rarement. Le travail qui fait bouger les classements se situe presque toujours en amont : choisir des termes que vous pouvez réellement gagner, combler les manques de contenu que vos concurrents ont laissés, et corriger les problèmes techniques qui freinent discrètement vos pages.",
            "Echorank360 rassemble ce travail amont au même endroit. La recherche de mots-clés vous montre la demande et la difficulté de chaque terme. Le suivi de positions transforme un classement en tendance exploitable plutôt qu'en chiffre consulté quand on y pense. Les audits de site font remonter les problèmes d'exploration, de vitesse et de structure qui vous coûtent des positions déjà acquises.",
          ],
        },
        {
          h2: "Un rythme hebdomadaire qui compose",
          paras: [
            "Les équipes qui progressent répètent un petit nombre de gestes : passer en revue les mouvements chaque semaine, choisir un ou deux termes à pousser, publier ou améliorer une page pour ces termes, et régler quelques anomalies techniques. Rien de spectaculaire. Sur un trimestre, cela compose en positions que vos concurrents devront travailler pour reprendre.",
            "Commencez par l'audit pour repérer ce qui ne va pas, ajoutez vos termes principaux au suivi de positions, et laissez les mouvements hebdomadaires vous dire où porter l'effort. Quand une page grimpe ou décroche, vous le saurez la semaine même — et vous saurez pourquoi.",
          ],
        },
      ],
    },
  },

  "get-cited-by-ai": {
    en: {
      sections: [
        {
          h2: "AI assistants are the new front page",
          paras: [
            "A growing share of buying research never reaches a results page. People ask ChatGPT, Gemini, Perplexity or Google's AI Overviews, get a synthesized answer with a handful of sources, and stop there. If your brand isn't in that answer, you weren't considered — and unlike a ranking, you can't see the miss happen.",
            "Being cited isn't luck. Assistants favor content that states facts plainly, answers real questions in full, carries consistent brand information across the web, and renders completely without a browser executing scripts. Each of those is checkable — and fixable.",
          ],
        },
        {
          h2: "Measure it, then move it",
          paras: [
            "Echorank360 treats AI visibility like rankings: something you measure on a schedule, not guess at. The visibility audit scores how quotable your site is today. Monitoring asks the assistants real buyer questions on a schedule and records whether you appear, what's said, and who's cited instead of you.",
            "From there the work is concrete: fix the pages the audit flags, publish answers to the questions you're absent from, and watch mention rates move month over month — the same way you'd watch rankings.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Les assistants IA sont la nouvelle page d'accueil",
          paras: [
            "Une part croissante des recherches d'achat n'atteint jamais une page de résultats. Les gens interrogent ChatGPT, Gemini, Perplexity ou les AI Overviews de Google, obtiennent une réponse synthétisée avec quelques sources, et s'arrêtent là. Si votre marque n'est pas dans cette réponse, vous n'avez pas été envisagé — et contrairement à une position, vous ne voyez pas l'occasion manquée.",
            "Être cité ne tient pas à la chance. Les assistants privilégient un contenu qui énonce les faits clairement, répond entièrement à de vraies questions, présente des informations de marque cohérentes sur tout le web, et s'affiche complètement sans qu'un navigateur exécute des scripts. Chacun de ces points se vérifie — et se corrige.",
          ],
        },
        {
          h2: "Mesurer, puis faire bouger",
          paras: [
            "Echorank360 traite la visibilité IA comme le référencement : quelque chose qui se mesure régulièrement, pas qui se devine. L'audit de visibilité évalue à quel point votre site est citable aujourd'hui. La surveillance pose aux assistants de vraies questions d'acheteurs selon un calendrier et enregistre si vous apparaissez, ce qui est dit, et qui est cité à votre place.",
            "Ensuite le travail est concret : corriger les pages signalées par l'audit, publier des réponses aux questions où vous êtes absent, et suivre l'évolution du taux de mention mois après mois — exactement comme vous suivriez des positions.",
          ],
        },
      ],
    },
  },

  "understand-your-market": {
    en: {
      sections: [
        {
          h2: "Your market is telling you what it wants",
          paras: [
            "Every search query, review, and Reddit thread in your category is demand data. The brands that grow read it deliberately: which problems people phrase again and again, which competitors get named in recommendations, where sentiment is drifting before it shows up in revenue.",
            "Doing that manually means twenty open tabs and a spreadsheet nobody updates. Echorank360 pulls the signals into one place — search demand and keyword trends, competitor visibility in both classic search and AI answers, and the review streams where customers say what they actually think.",
          ],
        },
        {
          h2: "From signal to decision",
          paras: [
            "Market understanding pays off when it changes what you do next: the feature you talk about first, the segment you stop ignoring, the competitor weakness you move on while it's still open. Share-of-search shows who's gaining demand in your category. Competitor intelligence shows where rivals are visible and where they're absent. Review analysis shows why customers choose — in their own words.",
            "Check the dashboard weekly, and the market stops surprising you.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Votre marché vous dit ce qu'il veut",
          paras: [
            "Chaque requête, chaque avis et chaque fil de discussion de votre catégorie est une donnée de demande. Les marques qui progressent les lisent délibérément : quels problèmes reviennent sans cesse, quels concurrents sont nommés dans les recommandations, où le sentiment dérive avant que cela n'apparaisse dans le chiffre d'affaires.",
            "Le faire manuellement, c'est vingt onglets ouverts et un tableur que personne ne met à jour. Echorank360 réunit ces signaux au même endroit : demande de recherche et tendances de mots-clés, visibilité des concurrents dans la recherche classique comme dans les réponses IA, et les flux d'avis où les clients disent ce qu'ils pensent vraiment.",
          ],
        },
        {
          h2: "Du signal à la décision",
          paras: [
            "Comprendre son marché sert quand cela change la suite : la fonctionnalité que vous mettez en avant, le segment que vous cessez d'ignorer, la faiblesse d'un concurrent que vous exploitez tant qu'elle est ouverte. La part de recherche montre qui gagne de la demande dans votre catégorie. L'intelligence concurrentielle montre où vos rivaux sont visibles et où ils sont absents. L'analyse des avis montre pourquoi les clients choisissent — avec leurs propres mots.",
            "Consultez le tableau de bord chaque semaine, et le marché cesse de vous surprendre.",
          ],
        },
      ],
    },
  },

  "win-local-customers": {
    en: {
      sections: [
        {
          h2: "Local buyers decide before they ever call",
          paras: [
            "For a local business, the buying decision happens on a map pin, a review score, and an AI answer to 'best <service> near me'. Most of it is settled before anyone visits your site. Winning locally means showing up in those three places with a rating worth choosing and information that's consistent everywhere it appears.",
            "The inputs are unglamorous: a steady stream of recent reviews, replies that show someone's home, business details that match across every listing, and pages that name the places you actually serve. Local rankings and AI recommendations both lean on exactly these signals.",
          ],
        },
        {
          h2: "Make review flow a system, not a favor",
          paras: [
            "Echorank360 turns review collection into a campaign you schedule instead of a favor you remember to ask: email and SMS requests after the job, routed to the platforms that matter, with AI-assisted replies so nothing sits unanswered. Monitoring watches your profiles and warns you when a rating dips or a bad review lands.",
            "Run the free audit to see how assistants describe you to your neighbors today, then put review requests on a schedule. Sixty days of steady flow usually does more for local visibility than any single optimization.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Les clients locaux décident avant même d'appeler",
          paras: [
            "Pour un commerce de proximité, la décision d'achat se joue sur un point de carte, une note d'avis et une réponse d'IA à « meilleur <service> près de chez moi ». L'essentiel est réglé avant que quiconque visite votre site. Gagner localement, c'est apparaître à ces trois endroits avec une note qui donne envie et des informations cohérentes partout où elles figurent.",
            "Les ingrédients sont peu glamour : un flux régulier d'avis récents, des réponses qui montrent que quelqu'un est présent, des informations d'établissement identiques sur toutes les fiches, et des pages qui nomment les lieux que vous desservez réellement. Le référencement local et les recommandations d'IA s'appuient exactement sur ces signaux.",
          ],
        },
        {
          h2: "Faire du flux d'avis un système, pas une faveur",
          paras: [
            "Echorank360 transforme la collecte d'avis en campagne programmée plutôt qu'en faveur dont on se souvient : demandes par courriel et SMS après la prestation, dirigées vers les plateformes qui comptent, avec des réponses assistées par IA pour que rien ne reste sans suite. La surveillance suit vos fiches et vous alerte quand une note baisse ou qu'un avis négatif arrive.",
            "Lancez l'audit gratuit pour voir comment les assistants vous décrivent aujourd'hui à vos voisins, puis programmez vos demandes d'avis. Soixante jours de flux régulier font généralement plus pour la visibilité locale que n'importe quelle optimisation isolée.",
          ],
        },
      ],
    },
  },

  "content-that-converts": {
    en: {
      sections: [
        {
          h2: "Content that ranks isn't always content that sells",
          paras: [
            "Traffic is only the first half. Content converts when it lands on a question a buyer is actually asking, answers it credibly, and makes the next step obvious. Publishing more without knowing which questions those are just raises your hosting bill.",
            "That's a research problem before it's a writing problem: which queries carry intent, which pages competitors convert with, what your existing pages rank for that they don't quite deliver on.",
          ],
        },
        {
          h2: "Research, draft, score, publish",
          paras: [
            "Echorank360 covers the loop. Keyword research separates buyer terms from trivia traffic. The content optimizer scores a draft against its target term before you publish. Marketing Studio drafts briefs, posts and campaigns in your brand voice when volume matters more than craft.",
            "One good page against a term you can win, every week, beats a content calendar you abandon in March. The tools keep the loop short enough to sustain.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Le contenu qui se positionne n'est pas toujours celui qui vend",
          paras: [
            "Le trafic n'est que la première moitié. Un contenu convertit quand il tombe sur une question que se pose vraiment un acheteur, y répond de façon crédible et rend l'étape suivante évidente. Publier davantage sans savoir quelles sont ces questions ne fait qu'augmenter votre facture d'hébergement.",
            "C'est un problème de recherche avant d'être un problème d'écriture : quelles requêtes portent une intention, avec quelles pages vos concurrents convertissent, et sur quoi vos pages existantes se positionnent sans tout à fait tenir la promesse.",
          ],
        },
        {
          h2: "Chercher, rédiger, évaluer, publier",
          paras: [
            "Echorank360 couvre la boucle. La recherche de mots-clés sépare les termes d'acheteurs du trafic anecdotique. L'optimiseur de contenu évalue un brouillon face à son terme cible avant publication. Marketing Studio rédige briefs, publications et campagnes dans votre voix de marque quand le volume compte plus que la ciselure.",
            "Une bonne page par semaine sur un terme que vous pouvez gagner vaut mieux qu'un calendrier éditorial abandonné en mars. Les outils gardent la boucle assez courte pour tenir dans la durée.",
          ],
        },
      ],
    },
  },

  "clean-up-technical-seo": {
    en: {
      sections: [
        {
          h2: "Technical debt taxes every page you publish",
          paras: [
            "Broken links, redirect chains, orphaned pages, duplicate titles, thin sections, slow templates — none of them looks urgent alone. Together they decide how much of your crawl budget gets wasted and how much authority leaks between pages. Great content on a broken site underperforms mediocre content on a clean one.",
            "And increasingly there's a second reader: AI assistants fetch your pages without executing scripts. If your content only exists after JavaScript runs, you can be invisible to the systems people ask about you — while your own browser shows you a perfect page.",
          ],
        },
        {
          h2: "Crawl it like the machines do",
          paras: [
            "The site crawler walks your site the way search engines do and turns what it finds into a prioritized issue list: redirect chains to flatten, orphans to link, duplicates to merge. AI Lens compares the raw and rendered versions of a page and shows exactly what assistant crawlers can't see. Lighthouse covers speed and core web vitals.",
            "Crawl, fix the top of the list, recrawl. The issue count becomes a number you drive down — and keep down with scheduled checks.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "La dette technique taxe chaque page que vous publiez",
          paras: [
            "Liens cassés, chaînes de redirections, pages orphelines, titres en double, sections trop maigres, gabarits lents : aucun ne paraît urgent isolément. Ensemble, ils déterminent la part de votre budget d'exploration gaspillée et l'autorité qui fuit entre vos pages. Un excellent contenu sur un site cassé fait moins bien qu'un contenu moyen sur un site propre.",
            "Et il y a de plus en plus un second lecteur : les assistants IA récupèrent vos pages sans exécuter de scripts. Si votre contenu n'existe qu'une fois le JavaScript exécuté, vous pouvez être invisible pour les systèmes que l'on interroge à votre sujet — alors que votre propre navigateur vous montre une page parfaite.",
          ],
        },
        {
          h2: "Explorez votre site comme le font les machines",
          paras: [
            "Le crawler parcourt votre site comme le font les moteurs et transforme ses trouvailles en liste d'anomalies priorisée : chaînes de redirections à aplatir, orphelines à relier, doublons à fusionner. AI Lens compare les versions brute et rendue d'une page et montre exactement ce que les robots d'assistants ne voient pas. Lighthouse couvre la vitesse et les Core Web Vitals.",
            "Explorez, corrigez le haut de la liste, réexplorez. Le nombre d'anomalies devient un chiffre que vous faites baisser — et que vous maintenez bas grâce aux contrôles programmés.",
          ],
        },
      ],
    },
  },

  "build-offsite-authority": {
    en: {
      sections: [
        {
          h2: "What the web says about you decides what you can rank for",
          paras: [
            "Search engines and AI assistants both ask the same question about your brand: do credible third parties vouch for it? Backlinks, reviews, press mentions and community discussions are that vouching. Without them, even technically perfect content stalls on competitive terms.",
            "Authority building fails when it's random outreach. It works when you know your current link profile, see who links to competitors but not you, and show up in the conversations where your category is already being discussed.",
          ],
        },
        {
          h2: "Find the gaps, join the conversations",
          paras: [
            "The backlinks tool maps your profile and your competitors' — every referring domain they earned that you haven't is a qualified prospect list. Brand monitoring watches the forums, communities and review sites where your category is already discussed, so a thread worth a genuinely useful answer reaches you while it is still live — visibility earned that way outlasts any ad.",
            "One earned mention a week from a domain that matters compounds faster than a hundred directory submissions. The tools point you at the ones worth earning.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Ce que le web dit de vous décide de ce sur quoi vous pouvez vous positionner",
          paras: [
            "Les moteurs de recherche et les assistants IA posent la même question sur votre marque : des tiers crédibles se portent-ils garants ? Les liens entrants, les avis, les mentions presse et les discussions communautaires sont cette caution. Sans eux, même un contenu techniquement parfait plafonne sur les termes concurrentiels.",
            "La construction d'autorité échoue quand la prospection est aléatoire. Elle fonctionne quand vous connaissez votre profil de liens actuel, voyez qui cite vos concurrents sans vous citer, et participez aux conversations où votre catégorie se discute déjà.",
          ],
        },
        {
          h2: "Repérer les écarts, rejoindre les conversations",
          paras: [
            "L'outil de backlinks cartographie votre profil et celui de vos concurrents : chaque domaine référent qu'ils ont obtenu et pas vous constitue une liste de prospects qualifiés. La surveillance de marque suit les forums, les communautés et les sites d'avis où votre catégorie se discute déjà : un fil qui mérite une réponse réellement utile vous parvient pendant qu'il est encore actif, et la visibilité gagnée ainsi survit à n'importe quelle publicité.",
            "Une mention méritée par semaine sur un domaine qui compte se cumule plus vite que cent inscriptions en annuaire. Les outils vous indiquent celles qui valent l'effort.",
          ],
        },
      ],
    },
  },

  "client-strategies": {
    en: {
      sections: [
        {
          h2: "Clients don't buy hours — they buy a defensible plan",
          paras: [
            "Agency work wins or dies on the strategy conversation: what we found, what we'll do, what it changed. That takes evidence at three moments — a baseline audit that frames the engagement, a plan grounded in data the client can't argue with, and reporting that shows movement in terms they care about.",
            "Assembling that from six tools and a screenshot folder eats the margin the retainer was supposed to have.",
          ],
        },
        {
          h2: "One platform, every client, your brand on the report",
          paras: [
            "Echorank360's agency tier runs multiple client brands from one account: each client's rankings, reviews, AI visibility and site health in its own workspace, portfolios to see every account at a glance, and white-label reports on your domain so the deliverable carries your name.",
            "Baseline every new client with the audit on day one, set the tools watching, and walk into each monthly call with the report already written. The strategy conversation gets easier when the evidence is a login away.",
          ],
        },
      ],
    },
    fr: {
      sections: [
        {
          h2: "Les clients n'achètent pas des heures, ils achètent un plan défendable",
          paras: [
            "Le travail d'agence se gagne ou se perd sur la conversation stratégique : ce que nous avons trouvé, ce que nous allons faire, ce que cela a changé. Cela demande des preuves à trois moments : un audit de référence qui cadre la mission, un plan fondé sur des données que le client ne peut pas contester, et un reporting qui montre le mouvement dans les termes qui l'intéressent.",
            "Assembler tout cela à partir de six outils et d'un dossier de captures d'écran ronge la marge que le forfait était censé dégager.",
          ],
        },
        {
          h2: "Une plateforme, tous vos clients, votre marque sur le rapport",
          paras: [
            "L'offre Agency d'Echorank360 gère plusieurs marques clientes depuis un seul compte : positions, avis, visibilité IA et santé technique de chaque client dans son propre espace, des portfolios pour voir tous les comptes d'un coup d'œil, et des rapports en marque blanche sur votre domaine pour que le livrable porte votre nom.",
            "Établissez la référence de chaque nouveau client dès le premier jour avec l'audit, mettez les outils en surveillance, et arrivez à chaque point mensuel avec le rapport déjà rédigé. La conversation stratégique devient plus simple quand la preuve est à un login de distance.",
          ],
        },
      ],
    },
  },
};

/** The long-form block for an item, or null when it has none. */
export function longformFor(slug: string, base: SolutionBase): Longform | null {
  return LONGFORM[slug]?.[base] ?? null;
}

/** Slugs that carry long-form prose — for tests and for reporting coverage. */
export function longformSlugs(): string[] {
  return Object.keys(LONGFORM);
}
