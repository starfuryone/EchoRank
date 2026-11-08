// src/lib/i18n/echopilot.ts — the "Social posting, by EchoPilot" page in the
// SEO Tools hub (/visibility/tools/social-posting), en / fr / de-CH.
//
// Facts about EchoPilot (channels, the launch offer, the pricing URL) come
// from src/lib/echopilot.ts; nothing here types a channel, a percentage or a
// date. de-CH uses ss, never ß.

import type { DashLocale } from "./dashboard";
import {
  ECHOPILOT_LAUNCH_OFFER,
  echopilotChannelList,
  echopilotOfferLastDay,
} from "@/lib/echopilot";

export interface EchopilotCopy {
  /** Same as the hub card name (SEO_TOOLS_COPY.items.social_posting.name). */
  title: string;
  lead: string;
  whatTitle: string;
  features: string[];
  /** The launch-offer line; rendered only while the offer is open. */
  offer: string;
  cta: string;
  /** Screen-reader suffix on the CTA. */
  newTab: string;
  note: string;
}

function copyFor(locale: DashLocale): EchopilotCopy {
  const channels = echopilotChannelList(locale);
  const pct = ECHOPILOT_LAUNCH_OFFER.percentOff;
  const last = echopilotOfferLastDay(locale);
  if (locale === "fr") {
    return {
      title: "Publication sur les réseaux sociaux, par EchoPilot",
      lead: "La publication sur les réseaux sociaux se fait dans EchoPilot, notre produit frère. Echorank ne programme ni ne publie de publications.",
      whatTitle: "Ce que fait EchoPilot",
      features: [
        "Des publications rédigées par IA, dans la voix de votre entreprise.",
        "Un calendrier de contenu qui répartit les publications sur le mois.",
        "Votre approbation avant toute mise en ligne : rien ne part sans votre accord.",
        `La publication sur ${channels}.`,
      ],
      offer: `Offre de lancement d'EchoPilot : ${pct} % de rabais à vie sur les nouveaux abonnements souscrits d'ici le ${last}.`,
      cta: "Voir les forfaits EchoPilot",
      newTab: "(s'ouvre dans un nouvel onglet)",
      note: "EchoPilot a son propre compte et sa propre facturation, distincts de votre forfait Echorank.",
    };
  }
  if (locale === "de-CH") {
    return {
      title: "Social-Media-Beiträge, von EchoPilot",
      lead: "Social-Media-Beiträge erstellen und veröffentlichen Sie mit EchoPilot, unserem Schwesterprodukt. Echorank selbst plant und veröffentlicht keine Beiträge.",
      whatTitle: "Was EchoPilot macht",
      features: [
        "Von KI geschriebene Beiträge in der Stimme Ihres Unternehmens.",
        "Ein Redaktionsplan, der die Beiträge über den Monat verteilt.",
        "Ihre Freigabe vor jeder Veröffentlichung: Nichts geht ohne Ihr Okay hinaus.",
        `Veröffentlichung auf ${channels}.`,
      ],
      offer: `Lancierungsangebot von EchoPilot: ${pct} % Rabatt auf Lebenszeit für neue Abos, abgeschlossen bis ${last}.`,
      cta: "EchoPilot-Preise ansehen",
      newTab: "(öffnet in einem neuen Tab)",
      note: "EchoPilot hat ein eigenes Konto und eine eigene Abrechnung, getrennt von Ihrem Echorank-Abo.",
    };
  }
  return {
    title: "Social posting, by EchoPilot",
    lead: "Social posting lives in EchoPilot, our sister product. Echorank itself does not schedule or publish posts.",
    whatTitle: "What EchoPilot does",
    features: [
      "AI-written posts in your business's voice.",
      "A content calendar that spreads the posts across the month.",
      "Your approval before anything goes out: nothing is posted without your OK.",
      `Publishing to ${channels}.`,
    ],
    offer: `EchoPilot launch offer: ${pct}% off for life on new subscriptions started by ${last}.`,
    cta: "See EchoPilot pricing",
    newTab: "(opens in a new tab)",
    note: "EchoPilot has its own account and billing, separate from your Echorank plan.",
  };
}

export const ECHOPILOT_COPY: Record<DashLocale, EchopilotCopy> = {
  en: copyFor("en"),
  fr: copyFor("fr"),
  "de-CH": copyFor("de-CH"),
};
