// src/lib/pricing-page/faq.ts
//
// "Straight answers" on /pricing, and the FAQPage JSON-LD built from the SAME
// array (ECHORANK-PRICING.md §7).
//
// EVERY ANSWER STATES WHAT THE CODE DOES, with its numbers read from config:
//   - trial: TRIAL_DAYS, passed to Stripe as trial_period_days with no
//     payment_method_collection override, so the card is required
//     (api/billing/checkout) and charged when the trial ends;
//   - cancelling: the help article's short form (help-articles.ts) in en/fr,
//     the one source every "how do I cancel" surface reads; de-CH has no help
//     catalog, so its answer is a translation of that short form;
//   - plan changes: in-app upgrade/downgrade goes through our checkout and the
//     webhook retires the old subscription; the Stripe portal has
//     subscription_update disabled (scripts/seed-portal-config.ts);
//   - limits: the search pool, crawls and domain analyses count per calendar
//     month (UTC) and stop at the cap; nothing in the app bills overage;
//   - credit packs: prospect lookups for the Agency Opportunity Scanner only;
//   - seats: /api/team invites without a plan check.
//
// PLACEHOLDERS. Refunds, taxes, the definition of a location (maxLocations is
// configured but enforced nowhere) and switching an existing subscription
// between monthly and yearly are not settled. Those answers carry
// `placeholder: true` and a visible [CONFIRM]; they render on the page and are
// LEFT OUT of the FAQPage markup, which must never publish a placeholder.

import { PLAN_CONFIGS, TRIAL_DAYS } from "@/lib/plan-config";
import { helpArticleBySlug, helpArticleCopy } from "@/lib/help-articles";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { pricingNotes } from "@/lib/i18n/content";
import { cardPlans } from "./headlines";
import { fmtNum, pricingBase } from "./format";

export interface PricingFaqItem {
  id: string;
  q: string;
  /** May carry **bold** and [label](href); rendered by inline(), stripped by plainText(). */
  a: string;
  /** True while the answer still needs the owner's wording. Never in JSON-LD. */
  placeholder?: true;
}

export const CONFIRM = "[CONFIRM]";

export function pricingFaq(
  locale: string,
  opts: { savePct: number; freeCrawler: boolean },
): PricingFaqItem[] {
  const b = pricingBase(locale);
  const name = CRAWLER_BRAND.name;
  const plans = cardPlans();
  const low = PLAN_CONFIGS[plans[0]!];
  const high = PLAN_CONFIGS[plans[plans.length - 1]!];
  const lowCap = fmtNum(low.crawlUrlCap, b);
  const highCap = fmtNum(high.crawlUrlCap, b);
  const freeCap = fmtNum(FREE_CRAWL_URL_CAP, b);
  const pct = opts.savePct;
  // Already locale-prefixed: resolveHref() does not prefix /credits.
  const credits = `/${locale}/credits`;

  if (b === "de") {
    return [
      {
        id: "trial",
        q: "Gibt es einen Gratis-Test? Brauche ich eine Karte?",
        a: `Ja. Jedes Abo beginnt mit einem ${TRIAL_DAYS}-tägigen Gratis-Test. Beim Checkout ist eine Karte nötig; sie wird am Ende der Testphase automatisch belastet, ausser Sie kündigen vorher. Wer während der Testphase kündigt, zahlt nichts.`,
      },
      {
        id: "cancel",
        q: "Wie kündige ich mein Abo?",
        a: "Anmelden → **Abrechnung** → **Abonnement verwalten** → Ihr Abo anklicken → **Abonnement kündigen**. Das Abo bleibt bis zum Ende der bezahlten Periode aktiv, und Sie werden nicht erneut belastet. Keine Gebühren, keine Anrufe. Wer während des Gratis-Tests kündigt, zahlt nie etwas. Anleitung (Englisch): [So kündigen Sie Ihr Echorank-Abo](/help/cancel-subscription).",
      },
      { id: "location", q: "Was zählt als Standort?", a: CONFIRM, placeholder: true },
      {
        id: "limits",
        q: "Was wird gezählt, und was passiert am Limit?",
        a: `Die Kontingente jedes Abos stehen in der Tabelle oben. SEO-Suchen, Domain-Analysen und Crawls mit ${name} werden pro Kalendermonat (UTC) gezählt. Ist ein Kontingent aufgebraucht, stoppt dieses Werkzeug bis zum nächsten Monat oder bis zu einem Upgrade; zusätzlich verrechnet wird nichts. [Guthabenpakete](${credits}) sind etwas anderes: einmalige Käufe von Interessenten-Abfragen für den Opportunity Scanner im Agency-Abo, ohne Verfall.`,
      },
      {
        id: "billing",
        q: "Monatlich oder jährlich – kann ich wechseln?",
        a: `Jährlich wird einmal pro Jahr zum angezeigten Monatspreis verrechnet, ${pct}% günstiger als monatlich. In ein höheres oder tieferes Abo wechseln Sie unter **Abrechnung** im Dashboard; das neue Abo ersetzt das bisherige. ${CONFIRM} Wechsel eines laufenden Abos zwischen monatlich und jährlich.`,
        placeholder: true,
      },
      {
        id: "crawler",
        q: `Ist ${name} inbegriffen?`,
        a: `Ja, in jedem bezahlten Abo. Das Abo legt fest, wie viele URLs ein Crawl abruft – von ${lowCap} bei ${low.name} bis ${highCap} bei ${high.name} – und wie viele Crawls pro Monat möglich sind (Tabelle oben).${opts.freeCrawler ? ` Der Gratis-Crawler prüft ${freeCap} Seiten ohne Konto.` : ""}`,
      },
      {
        id: "seats",
        q: "Kostet jedes Teammitglied extra?",
        a: "Nein. Die Abos gelten pro Arbeitsbereich, nicht pro Platz. Laden Sie Ihr Team unter **Team** im Dashboard ohne Aufpreis ein.",
      },
      {
        id: "payment",
        q: "Wie bezahle ich, und in welcher Währung?",
        a: `Per Karte über den sicheren Checkout von Stripe. ${pricingNotes("de").currency}`,
      },
      { id: "refunds", q: "Gibt es Rückerstattungen?", a: CONFIRM, placeholder: true },
      { id: "tax", q: "Kommen Steuern oder MWST dazu?", a: CONFIRM, placeholder: true },
    ];
  }

  const fr = b === "fr";
  const cancel = helpArticleCopy(helpArticleBySlug("cancel-subscription")!, locale).faq;
  const notes = pricingNotes(fr ? "fr" : "en");
  return [
    {
      id: "trial",
      q: fr ? "Y a-t-il un essai gratuit ? Faut-il une carte ?" : "Is there a free trial? Do I need a card?",
      a: fr
        ? `Oui. Chaque forfait commence par un essai gratuit de ${TRIAL_DAYS} jours. Une carte est demandée au paiement ; elle est débitée automatiquement à la fin de l'essai, sauf si vous annulez avant. En cas d'annulation pendant l'essai, vous n'êtes jamais facturé.`
        : `Yes. Every plan starts with a ${TRIAL_DAYS}-day free trial. A card is required at checkout; it is charged automatically when the trial ends unless you cancel before then. Cancel during the trial and you are never charged.`,
    },
    { id: "cancel", q: cancel.q, a: cancel.a },
    { id: "location", q: fr ? "Qu'est-ce qui compte comme un emplacement ?" : "What counts as a location?", a: CONFIRM, placeholder: true },
    {
      id: "limits",
      q: fr ? "Qu'est-ce qui est compté, et que se passe-t-il à la limite ?" : "What is metered, and what happens at a limit?",
      a: fr
        ? `Les quotas de chaque forfait figurent dans le tableau ci-dessus. Les recherches SEO, les analyses de domaine et les explorations ${name} sont comptées par mois civil (UTC). Une fois un quota atteint, l'outil concerné s'arrête jusqu'au mois suivant ou jusqu'à un changement de forfait ; rien n'est facturé en plus. Les [packs de crédits](${credits}) sont distincts : des achats ponctuels de recherches de prospects pour le Détecteur d'occasions du forfait Agency, sans expiration.`
        : `Each plan's allowances are in the table above. SEO searches, domain analyses and ${name} crawls are counted per calendar month (UTC). When you reach one, that tool stops until the next month or until you upgrade; nothing is billed on top. [Credit packs](${credits}) are separate: one-time purchases of prospect lookups for the Agency plan's Opportunity Scanner, and they never expire.`,
    },
    {
      id: "billing",
      q: fr ? "Mensuel ou annuel : puis-je changer ?" : "Monthly or yearly — can I switch?",
      a: fr
        ? `L'annuel est facturé une fois par an au prix mensuel affiché, ${pct} % de moins qu'au mois. Vous passez à un forfait supérieur ou inférieur depuis **Facturation** dans votre tableau de bord ; le nouveau forfait remplace l'actuel. ${CONFIRM} Passage d'un abonnement en cours du mensuel à l'annuel, ou l'inverse.`
        : `Yearly is billed once a year at the per-month price shown, ${pct}% less than paying monthly. You move to a higher or lower plan from **Billing** in your dashboard; the new plan replaces the current one. ${CONFIRM} Switching an existing subscription between monthly and yearly.`,
      placeholder: true,
    },
    {
      id: "crawler",
      q: fr ? `${name} est-il inclus ?` : `Is ${name} included?`,
      a: fr
        ? `Oui, dans chaque forfait payant. Le forfait fixe le nombre d'URL qu'une exploration peut parcourir — de ${lowCap} avec ${low.name} à ${highCap} avec ${high.name} — et le nombre d'explorations par mois (tableau ci-dessus).${opts.freeCrawler ? ` Le robot gratuit vérifie ${freeCap} pages sans compte.` : ""}`
        : `Yes, on every paid plan. Each plan sets how many URLs one crawl may fetch — from ${lowCap} on ${low.name} to ${highCap} on ${high.name} — and how many crawls a month it runs (table above).${opts.freeCrawler ? ` The free crawler checks ${freeCap} pages without an account.` : ""}`,
    },
    {
      id: "seats",
      q: fr ? "Payez-vous par utilisateur ?" : "Do you charge per seat?",
      a: fr
        ? "Non. Les forfaits sont tarifés par espace de travail, pas par utilisateur. Invitez votre équipe depuis **Équipe** dans votre tableau de bord, sans frais supplémentaires."
        : "No. Plans are priced per workspace, not per seat. Invite your teammates from **Team** in your dashboard at no extra cost.",
    },
    {
      id: "payment",
      q: fr ? "Comment payer, et dans quelle devise ?" : "How do I pay, and in which currency?",
      a: fr ? `Par carte, via le paiement sécurisé de Stripe. ${notes.currency}` : `By card, through Stripe's secure checkout. ${notes.currency}`,
    },
    { id: "refunds", q: fr ? "Remboursez-vous ?" : "Do you offer refunds?", a: CONFIRM, placeholder: true },
    { id: "tax", q: fr ? "Des taxes ou la TVA s'ajoutent-elles ?" : "Are taxes or VAT added?", a: CONFIRM, placeholder: true },
  ];
}

/** The FAQPage entries: every answer that is final, none that is a placeholder. */
export function faqJsonLdItems(items: PricingFaqItem[]): PricingFaqItem[] {
  return items.filter((i) => !i.placeholder);
}
