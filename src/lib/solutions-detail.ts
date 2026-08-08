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
