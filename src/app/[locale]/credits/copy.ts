// src/app/[locale]/credits/copy.ts
//
// The /credits page's strings, in a module with NO server imports.
//
// SPLIT OUT SO A TEST CAN READ IT. page.tsx pulls in getCurrentTenant, which
// reaches auth and then Prisma, so importing the page to assert its locale
// coverage would need a DATABASE_URL. Copy is the part worth asserting and it
// depends on nothing, so it lives here — the same reason estimate.ts was
// extracted out of places.ts and registrable-domain.ts out of ai-lens/url.ts.

type Base = "en" | "fr";
export const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

export const COPY: Record<
  Base,
  {
    metaTitle: string;
    metaDescription: string;
    label: string;
    h1: string;
    sub: string;
    whatTitle: string;
    whatBody: string;
    perLookup: string;
    lookups: string;
    buy: string;
    mostPopular: string;
    unavailable: string;
    terms: string;
    planNoticeTitle: string;
    planNoticeBody: string;
    /** BillingStatus.NONE — signed in, never subscribed. Cannot buy at all. */
    noPlanTitle: string;
    noPlanBody: string;
    noPlanCta: string;
    faqTitle: string;
    faq: { q: string; a: string }[];
  }
> = {
  en: {
    metaTitle: "Prospect lookups — prepaid credit packs",
    metaDescription:
      "Buy prospect lookups for the Echorank Agency Opportunity Scanner. One-time purchase, credits never expire, no subscription.",
    label: "PROSPECT LOOKUPS",
    h1: "Prepaid lookups for the Opportunity Scanner",
    sub: "Buy a pack once. Spend it whenever you scan.",
    whatTitle: "What a lookup does",
    whatBody:
      "A lookup adds the prospect's Google Business rating and review count to their row in the scanner — so a list of domains becomes a list of businesses you can rank by how much help they visibly need. One lookup covers one prospect, and only the prospects you scan with listings turned on use one.",
    perLookup: "per lookup",
    lookups: "lookups",
    buy: "Buy",
    mostPopular: "Most popular",
    unavailable:
      "Credit packs are temporarily unavailable. Please try again shortly, or contact support@echorank360.com.",
    terms:
      "One-time payment in US dollars. Credits never expire, are non-refundable, and need an active plan that includes the Opportunity Scanner to spend. By buying you agree to our Terms of Use and Privacy Policy.",
    planNoticeTitle: "Lookups are spent by an Agency-plan tool",
    planNoticeBody:
      "The Opportunity Scanner is included with Agency plans. You can buy lookups on any plan and they will not expire — but until your account is on Agency, there is nothing to spend them on.",
    noPlanTitle: "Lookups are for subscribers",
    noPlanBody:
      "Your account does not have a plan yet. Choose one first — lookups are an add-on to a subscription, not a way to buy one.",
    noPlanCta: "See plans",
    faqTitle: "Questions",
    faq: [
      {
        q: "Do credits expire?",
        a: "No. Lookups stay on your account until you use them, with no monthly reset and no expiry date.",
      },
      {
        q: "Is this a subscription?",
        a: "No. Each pack is a single one-time payment. Nothing renews and there is nothing to cancel.",
      },
      {
        q: "Where do I spend them?",
        a: "In the Agency Opportunity Scanner, when you tick “also look up each prospect's Google Business listing” before submitting a batch. Scans without that box ticked cost nothing.",
      },
      {
        q: "What if a prospect has no listing?",
        a: "That still uses a lookup — we are charged for the search whether or not it finds a business. Prospects in batches where the search never ran, because the scan failed first, are credited back automatically; a batch you submit with listings switched off is never charged for them at all. In all other cases, lookups are non-refundable.",
      },
    ],
  },
  fr: {
    metaTitle: "Recherches de prospects — packs prépayés",
    metaDescription:
      "Achetez des recherches de prospects pour le Scanner d'opportunités Echorank. Paiement unique, recherches sans expiration, sans abonnement.",
    label: "RECHERCHES DE PROSPECTS",
    h1: "Recherches prépayées pour le Scanner d'opportunités",
    sub: "Achetez un pack une fois. Dépensez-le quand vous analysez.",
    whatTitle: "Ce que fait une recherche",
    whatBody:
      "Une recherche ajoute la note Google Business du prospect et son nombre d'avis à sa ligne dans le scanner — une liste de domaines devient ainsi une liste d'entreprises que vous pouvez classer selon l'aide dont elles ont visiblement besoin. Une recherche couvre un prospect, et seuls les prospects analysés avec les fiches activées en consomment une.",
    perLookup: "par recherche",
    lookups: "recherches",
    buy: "Acheter",
    mostPopular: "Le plus choisi",
    unavailable:
      "Les packs sont temporairement indisponibles. Réessayez dans un instant ou écrivez à support@echorank360.com.",
    terms:
      "Paiement unique en dollars américains. Les crédits n'expirent pas, ne sont pas remboursables et nécessitent un forfait actif incluant le Scanner d'opportunités pour être utilisés. En achetant, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité.",
    planNoticeTitle: "Les recherches se dépensent dans un outil du forfait Agency",
    planNoticeBody:
      "Le Scanner d'opportunités est inclus dans les forfaits Agency. Vous pouvez acheter des recherches avec n'importe quel forfait et elles n'expirent pas — mais tant que votre compte n'est pas en Agency, vous n'aurez nulle part où les dépenser.",
    noPlanTitle: "Les recherches sont réservées aux abonnés",
    noPlanBody:
      "Votre compte n'a pas encore de forfait. Choisissez-en un d'abord — les recherches sont un complément à un abonnement, pas un moyen d'en acheter un.",
    noPlanCta: "Voir les forfaits",
    faqTitle: "Questions",
    faq: [
      {
        q: "Les recherches expirent-elles ?",
        a: "Non. Elles restent sur votre compte jusqu'à ce que vous les utilisiez, sans remise à zéro mensuelle ni date d'expiration.",
      },
      {
        q: "Est-ce un abonnement ?",
        a: "Non. Chaque pack est un paiement unique. Rien ne se renouvelle et il n'y a rien à annuler.",
      },
      {
        q: "Où les dépenser ?",
        a: "Dans le Scanner d'opportunités Agency, en cochant « rechercher aussi la fiche Google Business de chaque prospect » avant d'envoyer un lot. Les analyses sans cette case cochée ne coûtent rien.",
      },
      {
        q: "Et si un prospect n'a pas de fiche ?",
        a: "Cela consomme quand même une recherche : la recherche nous est facturée qu'elle trouve une entreprise ou non. Les prospects des lots dont la recherche n'a jamais été lancée, parce que l'analyse a échoué avant, sont recrédités automatiquement ; un lot soumis avec les fiches désactivées n'est jamais facturé pour celles-ci. Dans tous les autres cas, les recherches ne sont pas remboursables.",
      },
    ],
  },
};
