// src/lib/pricing-page/faq.ts
//
// "Straight answers" on /pricing, and the FAQPage JSON-LD built from the SAME
// array (ECHORANK-PRICING.md §7). Every question renders, and every question
// is in the markup.
//
// EVERY NUMBER IS READ FROM CONFIG, never typed: TRIAL_DAYS, the per-tier
// location counts, the crawl caps, the yearly saving. What the answers state:
//   - trial: TRIAL_DAYS, passed to Stripe as trial_period_days with no
//     payment_method_collection override, so the card is required
//     (api/billing/checkout) and charged when the trial ends;
//   - cancelling: the help article's short form (help-articles.ts) in en/fr,
//     the one source every "how do I cancel" surface reads; de-CH has no help
//     catalog, so its answer is a translation of that short form;
//   - plan changes: in-app upgrade/downgrade goes through our checkout and the
//     webhook retires the old subscription; the Stripe portal has
//     subscription_update disabled (scripts/seed-portal-config.ts), so a
//     monthly ↔ yearly switch is done by support, from the next renewal;
//   - limits: the search pool, crawls and domain analyses count per calendar
//     month (UTC) and stop at the cap; nothing in the app bills overage;
//   - credit packs: prospect lookups for the Agency Opportunity Scanner only;
//   - seats: /api/team invites without a plan check;
//   - refunds, taxes, what a location is: the owner's wording of 2026-11-06.
//     Checkout does not compute tax (no automatic_tax), which is what the tax
//     answer says.

import { PLAN_CONFIGS, TRIAL_DAYS } from "@/lib/plan-config";
import { helpArticleBySlug, helpArticleCopy } from "@/lib/help-articles";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { SUPPORT_EMAIL } from "@/lib/assistant/config";
import { pricingNotes } from "@/lib/i18n/content";
import { cadence, cardPlans, engineNames } from "./headlines";
import { planAllowsArea } from "@/lib/plan-access";
import { fmtNum, moneyAmount, moneyAmountCents, pricingBase, usd, usdCents, type PricingBase } from "./format";
import { NONE_LAUNCHED, type LaunchedPlans } from "@/lib/plan-launch";
import { echopilotChannelList } from "@/lib/echopilot";

/**
 * "Do you schedule social posts?" Social posting stays in our sister product
 * EchoPilot (2026-11-08); Echorank never schedules or publishes posts itself.
 * The channels come from ECHOPILOT_CHANNELS, so adding one is one line there.
 */
function socialAnswer(b: PricingBase): { q: string; a: string } {
  if (b === "de") {
    return {
      q: "Planen Sie Social-Media-Beiträge?",
      a: `Ja, mit unserem Schwesterprodukt EchoPilot, das auf ${echopilotChannelList("de-CH")} veröffentlicht.`,
    };
  }
  if (b === "fr") {
    return {
      q: "Programmez-vous des publications sur les réseaux sociaux ?",
      a: `Oui, grâce à notre produit frère EchoPilot, qui publie sur ${echopilotChannelList("fr")}.`,
    };
  }
  return {
    q: "Do you schedule social posts?",
    a: `Yes, through our sister product EchoPilot, which publishes to ${echopilotChannelList("en")}.`,
  };
}

export interface PricingFaqItem {
  id: string;
  q: string;
  /** May carry **bold** and [label](href); rendered by inline(), stripped by plainText(). */
  a: string;
}

/**
 * "1 on Starter, 5 on Growth and 25 on Agency" — each card tier's location
 * count from PLAN_CONFIGS (-1 is the config's unlimited).
 */
function locationCounts(b: PricingBase): string {
  const parts = cardPlans().map((p) => {
    const n = PLAN_CONFIGS[p].quotaDefaults.maxLocations;
    const count = n < 0 ? { en: "unlimited", fr: "illimité", de: "unbegrenzt" }[b] : fmtNum(n, b);
    const name = PLAN_CONFIGS[p].name;
    return { en: `${count} on ${name}`, fr: `${count} avec ${name}`, de: `${count} bei ${name}` }[b];
  });
  const and = { en: " and ", fr: " et ", de: " und " }[b];
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}${and}${parts[parts.length - 1]}` : parts.join("");
}

/**
 * "Which plan if I only need AI visibility?" Every figure from PLAN_CONFIGS:
 * the AI Visibility plan's price, prompts, engines (by name) and cadence, and
 * the plan everything else starts at.
 */
function aiOnlyAnswer(b: PricingBase): { q: string; a: string } {
  const ai = PLAN_CONFIGS.AI_VISIBILITY;
  const next = PLAN_CONFIGS.STARTER;
  const names = (engineNames(ai.aiCheckup) ?? []).join(", ");
  const when = cadence(ai.aiCheckup, b) ?? "";
  const p = fmtNum(ai.aiCheckup.prompts, b);
  // Monthly prices in whole dollars, the yearly per-month figure with both
  // decimals, as the cards print them (usd / usdCents in ./format.ts).
  const m = usd(ai.monthlyPrice, b);
  const y = usdCents(ai.annualPrice, b);
  const nm = usd(next.monthlyPrice, b);
  if (b === "de") {
    return {
      q: "Welches Abo, wenn ich nur KI-Sichtbarkeit brauche?",
      a: `**${ai.name}**, für ${m}/Monat (${y}/Monat bei jährlicher Zahlung): ${p} Prompts, ${when} auf ${names} geprüft, mit zitierten Quellen und Zitat-Chancen, Trendverlauf, AI Trust Score, Benachrichtigungen, Brand Radar und AI Lens. Bewertungen, SEO-Werkzeuge und der Crawler beginnen bei **${next.name}** (${nm}/Monat).`,
    };
  }
  if (b === "fr") {
    return {
      q: "Quel forfait si je n'ai besoin que de la visibilité IA ?",
      a: `**${ai.name}**, à ${moneyAmount(ai.monthlyPrice, b)} $ par mois (${moneyAmountCents(ai.annualPrice, b)} $ par mois en annuel) : suivi ${when} de ${p} requêtes sur ${names}, avec les sources citées et les occasions de citation, l'historique des tendances, le score de confiance IA, les alertes, Brand Radar et AI Lens. Les avis, les outils SEO et le robot d'exploration commencent avec **${next.name}** (${moneyAmount(next.monthlyPrice, b)} $ par mois).`,
    };
  }
  return {
    q: "Which plan if I only need AI visibility?",
    a: `**${ai.name}**, at ${m}/month (${y}/month billed yearly): ${p} prompts checked ${when} on ${names}, with cited sources and citation opportunities, trend history, AI Trust Score, alerts, Brand Radar and AI Lens. Reviews, the SEO tools and the crawler start at **${next.name}** (${nm}/month).`,
  };
}

/**
 * The crawler-only plan, once on sale: one sentence the crawler answer and the
 * AI-only answer add, so neither says the crawler "starts at Starter" while a
 * cheaper plan sells it on its own. Null while it is not on sale.
 */
function crawlerOnlySentence(b: PricingBase, launched: LaunchedPlans): string | null {
  if (!launched.has("NOSY_BAT")) return null;
  const nb = PLAN_CONFIGS.NOSY_BAT;
  const price = usd(nb.monthlyPrice, b);
  const urls = fmtNum(nb.crawlUrlCap, b);
  return {
    en: `The crawler alone is the **${nb.name}** plan (${price}/month): up to ${urls} URLs per crawl, for one user, with nothing else.`,
    fr: `Le robot seul, c'est le forfait **${nb.name}** (${price} par mois) : jusqu'à ${urls} URL par exploration, pour un utilisateur, sans le reste.`,
    de: `Nur den Crawler gibt es im Abo **${nb.name}** (${price}/Monat): bis ${urls} URLs pro Crawl, für einen Benutzer, ohne den Rest.`,
  }[b];
}

export function pricingFaq(
  locale: string,
  opts: { savePct: number; freeCrawler: boolean; launched?: LaunchedPlans },
): PricingFaqItem[] {
  const b = pricingBase(locale);
  const name = CRAWLER_BRAND.name;
  // The ladder, not the card row: the crawler range and the location counts
  // are the ladder's. The crawler-only plan gets its own sentence.
  const plans = cardPlans();
  const alone = crawlerOnlySentence(b, opts.launched ?? NONE_LAUNCHED);
  const plusAlone = alone ? ` ${alone}` : "";
  // The crawler's range starts at the first plan that has it (Starter): the
  // AI Visibility plan, first on the ladder, does not (src/lib/plan-access.ts).
  const crawlPlans = plans.filter((p) => planAllowsArea(p, "crawler") && PLAN_CONFIGS[p].crawlUrlCap > 0);
  const low = PLAN_CONFIGS[crawlPlans[0]!];
  const high = PLAN_CONFIGS[plans[plans.length - 1]!];
  const ai0 = aiOnlyAnswer(b);
  // "…and the crawler start at Starter" stays true of the ladder; once the
  // crawler-only plan is on sale the answer names it too.
  const aiOnly = { q: ai0.q, a: `${ai0.a}${plusAlone}` };
  const social = socialAnswer(b);
  const lowCap = fmtNum(low.crawlUrlCap, b);
  const highCap = fmtNum(high.crawlUrlCap, b);
  const freeCap = fmtNum(FREE_CRAWL_URL_CAP, b);
  const pct = opts.savePct;
  const locs = locationCounts(b);
  // Already locale-prefixed: resolveHref() does not prefix /credits.
  const credits = `/${locale}/credits`;

  if (b === "de") {
    return [
      { id: "ai-only", q: aiOnly.q, a: aiOnly.a },
      {
        id: "trial",
        q: "Gibt es einen Gratis-Test? Brauche ich eine Karte?",
        a: `Ja. Jedes Abo beginnt mit einem ${TRIAL_DAYS}-tägigen Gratis-Test. Beim Checkout ist eine Karte nötig; sie wird am Ende der Testphase automatisch belastet, ausser Sie kündigen vorher. Wer während der Testphase kündigt, zahlt nichts.`,
      },
      {
        id: "cancel",
        q: "Wie kündige ich mein Abo?",
        a: "Anmelden → **Abrechnung** → **Abonnement kündigen** → bestätigen. Das Abo bleibt bis zum Ende der bezahlten Periode aktiv, und Sie werden nicht erneut belastet. Bis dahin setzen Sie es mit einem Klick auf **Abonnement fortsetzen** fort. Keine Gebühren, keine Anrufe. Wer während des Gratis-Tests kündigt, zahlt nie etwas. Anleitung (Englisch): [So kündigen Sie Ihr Echorank-Abo](/help/cancel-subscription).",
      },
      {
        id: "location",
        q: "Was zählt als Standort?",
        a: `Ein Standort ist eine physische Geschäftsadresse, meist ein Google-Unternehmensprofil, deren Bewertungen und Feedback Sie in Echorank verwalten. Enthalten sind ${locs}.`,
      },
      {
        id: "limits",
        q: "Was wird gezählt, und was passiert am Limit?",
        a: `Die Kontingente jedes Abos stehen in der Tabelle oben. SEO-Suchen, Domain-Analysen und Crawls mit ${name} werden pro Kalendermonat (UTC) gezählt. Ist ein Kontingent aufgebraucht, stoppt dieses Werkzeug bis zum nächsten Monat oder bis zu einem Upgrade; zusätzlich verrechnet wird nichts. [Guthabenpakete](${credits}) sind etwas anderes: einmalige Käufe von Interessenten-Abfragen für den Opportunity Scanner im Agency-Abo, ohne Verfall.`,
      },
      {
        id: "billing",
        q: "Monatlich oder jährlich – kann ich wechseln?",
        a: `Jährlich wird einmal pro Jahr zum angezeigten Monatspreis verrechnet, ${pct}% günstiger als monatlich. In ein höheres oder tieferes Abo wechseln Sie unter **Abrechnung** im Dashboard; das neue Abo ersetzt das bisherige. Für den Wechsel zwischen monatlicher und jährlicher Abrechnung schreiben Sie an ${SUPPORT_EMAIL}; wir stellen um, und die Änderung gilt ab Ihrer nächsten Verlängerung.`,
      },
      {
        id: "crawler",
        q: `Ist ${name} inbegriffen?`,
        a: `Ja, in jedem Abo ab ${low.name}. Das Abo legt fest, wie viele URLs ein Crawl abruft – von ${lowCap} bei ${low.name} bis ${highCap} bei ${high.name} – und wie viele Crawls pro Monat möglich sind (Tabelle oben).${plusAlone}${opts.freeCrawler ? ` Der Gratis-Crawler prüft ${freeCap} Seiten ohne Konto.` : ""}`,
      },
      { id: "social", q: social.q, a: social.a },
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
      {
        id: "refunds",
        q: "Gibt es Rückerstattungen?",
        a: `Jedes Abo beginnt mit einem ${TRIAL_DAYS}-tägigen Gratis-Test. Danach können Sie jederzeit kündigen und behalten den Zugang bis zum Ende der bezahlten Periode. Angebrochene Monate oder Jahre erstatten wir nicht zurück.`,
      },
      {
        id: "tax",
        q: "Kommen Steuern oder MWST dazu?",
        a: "Die Preise sind in US-Dollar und verstehen sich ohne Steuern. Beim Checkout erheben wir derzeit weder Umsatzsteuer noch MWST; ändert sich das, informieren wir Sie vor Ihrer nächsten Verlängerung.",
      },
    ];
  }

  const fr = b === "fr";
  const cancel = helpArticleCopy(helpArticleBySlug("cancel-subscription")!, locale).faq;
  const notes = pricingNotes(fr ? "fr" : "en");
  return [
    { id: "ai-only", q: aiOnly.q, a: aiOnly.a },
    {
      id: "trial",
      q: fr ? "Y a-t-il un essai gratuit ? Faut-il une carte ?" : "Is there a free trial? Do I need a card?",
      a: fr
        ? `Oui. Chaque forfait commence par un essai gratuit de ${TRIAL_DAYS} jours. Une carte est demandée au paiement ; elle est débitée automatiquement à la fin de l'essai, sauf si vous annulez avant. En cas d'annulation pendant l'essai, vous n'êtes jamais facturé.`
        : `Yes. Every plan starts with a ${TRIAL_DAYS}-day free trial. A card is required at checkout; it is charged automatically when the trial ends unless you cancel before then. Cancel during the trial and you are never charged.`,
    },
    { id: "cancel", q: cancel.q, a: cancel.a },
    {
      id: "location",
      q: fr ? "Qu'est-ce qui compte comme un emplacement ?" : "What counts as a location?",
      a: fr
        ? `Un emplacement est une adresse physique d'entreprise, habituellement une fiche d'établissement Google, dont vous gérez les avis et la rétroaction dans Echorank. Les forfaits en comprennent ${locs}.`
        : `A location is one physical business address, usually one Google Business Profile, whose reviews and feedback you manage in Echorank. Plans include ${locs}.`,
    },
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
        ? `L'annuel est facturé une fois par an au prix mensuel affiché, ${pct} % de moins qu'au mois. Vous passez à un forfait supérieur ou inférieur depuis **Facturation** dans votre tableau de bord ; le nouveau forfait remplace l'actuel. Pour passer du mensuel à l'annuel ou l'inverse, écrivez à ${SUPPORT_EMAIL} et nous ferons le changement ; il s'applique à partir de votre prochain renouvellement.`
        : `Yearly is billed once a year at the per-month price shown, ${pct}% less than paying monthly. You move to a higher or lower plan from **Billing** in your dashboard; the new plan replaces the current one. Email ${SUPPORT_EMAIL} and we'll switch your billing between monthly and yearly; the change applies from your next renewal.`,
    },
    {
      id: "crawler",
      q: fr ? `${name} est-il inclus ?` : `Is ${name} included?`,
      a: fr
        ? `Oui, dans chaque forfait à partir de ${low.name}. Le forfait fixe le nombre d'URL qu'une exploration peut parcourir — de ${lowCap} avec ${low.name} à ${highCap} avec ${high.name} — et le nombre d'explorations par mois (tableau ci-dessus).${plusAlone}${opts.freeCrawler ? ` Le robot gratuit vérifie ${freeCap} pages sans compte.` : ""}`
        : `Yes, on every plan from ${low.name}. Each plan sets how many URLs one crawl may fetch — from ${lowCap} on ${low.name} to ${highCap} on ${high.name} — and how many crawls a month it runs (table above).${plusAlone}${opts.freeCrawler ? ` The free crawler checks ${freeCap} pages without an account.` : ""}`,
    },
    { id: "social", q: social.q, a: social.a },
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
    {
      id: "refunds",
      q: fr ? "Remboursez-vous ?" : "Do you offer refunds?",
      a: fr
        ? `Chaque forfait commence par un essai gratuit de ${TRIAL_DAYS} jours. Ensuite, vous pouvez annuler à tout moment et garder l'accès jusqu'à la fin de la période payée. Nous ne remboursons pas les mois ou les années entamés.`
        : `Every plan starts with a ${TRIAL_DAYS}-day free trial. After that you can cancel any time and keep access until the end of the period you've paid for. We don't refund partial months or years.`,
    },
    {
      id: "tax",
      q: fr ? "Des taxes ou la TVA s'ajoutent-elles ?" : "Are taxes or VAT added?",
      a: fr
        ? "Les prix sont en dollars américains, taxes en sus. Nous n'ajoutons actuellement ni taxe de vente ni TVA au paiement ; si cela change, nous vous en informerons avant votre prochain renouvellement."
        : "Prices are in US dollars and exclude taxes. We don't currently add sales tax or VAT at checkout; if that changes, we'll tell you before your next renewal.",
    },
  ];
}
