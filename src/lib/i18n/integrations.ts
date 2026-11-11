// src/lib/i18n/integrations.ts — Settings → Integrations (Phase 4d: Google
// Analytics for the Site Crawler). Dependency-free; de-CH uses ss, never ß.

import type { DashLocale } from "./dashboard";

const en = {
  title: "Integrations",
  ga4Title: "Google Analytics 4",
  ga4Help: "Pick the GA4 property the Site Crawler reads. Each crawl then joins sessions, users, engagement rate and key events per landing page for the last 28 days.",
  ga4Connect: "Connect Google Analytics",
  ga4NotConnected: "Echorank asks Google for read-only access to Analytics, on the same Google connection as Search Console.",
  ga4Property: "Property",
  ga4None: "No property (no GA4 data in crawls)",
  ga4Save: "Save",
  ga4Saved: "Saved.",
  ga4Error: "The property could not be saved. Try again.",
  ga4Empty: "This Google account has no GA4 property it can read.",
  ga4Loading: "Loading…",
  // Search Console, for a plan without the GSC tool page (the crawler-only plan).
  gscTitle: "Google Search Console",
  gscHelp: "Pick the Search Console property the Site Crawler reads. Each crawl then joins clicks, impressions, CTR and position per page, and can check index status.",
  gscConnect: "Connect Search Console",
  gscNotConnected: "Echorank asks Google for read-only access to Search Console.",
  gscReauth: "Google needs you to connect again.",
  gscConnected: (property: string) => `Connected: ${property}`,
  gscDisconnect: "Disconnect",
  gscError: "That did not work. Try again.",
};
export type IntegrationsCopy = typeof en;

const fr: IntegrationsCopy = {
  title: "Intégrations",
  ga4Title: "Google Analytics 4",
  ga4Help: "Choisissez la propriété GA4 que lit l'Explorateur de site. Chaque exploration y joint ensuite les sessions, utilisateurs, taux d'engagement et événements clés par page d'arrivée sur les 28 derniers jours.",
  ga4Connect: "Connecter Google Analytics",
  ga4NotConnected: "Echorank demande à Google un accès en lecture seule à Analytics, sur la même connexion Google que la Search Console.",
  ga4Property: "Propriété",
  ga4None: "Aucune propriété (pas de données GA4 dans les explorations)",
  ga4Save: "Enregistrer",
  ga4Saved: "Enregistré.",
  ga4Error: "La propriété n'a pas pu être enregistrée. Réessayez.",
  ga4Empty: "Ce compte Google n'a accès à aucune propriété GA4.",
  ga4Loading: "Chargement…",
  gscTitle: "Google Search Console",
  gscHelp: "Choisissez la propriété Search Console que lit l'Explorateur de site. Chaque exploration y joint ensuite les clics, impressions, taux de clics et positions par page, et peut vérifier l'état d'indexation.",
  gscConnect: "Connecter la Search Console",
  gscNotConnected: "Echorank demande à Google un accès en lecture seule à la Search Console.",
  gscReauth: "Google vous demande de vous reconnecter.",
  gscConnected: (property: string) => `Connectée : ${property}`,
  gscDisconnect: "Déconnecter",
  gscError: "Cela n'a pas fonctionné. Réessayez.",
};

const deCH: IntegrationsCopy = {
  title: "Integrationen",
  ga4Title: "Google Analytics 4",
  ga4Help: "Wählen Sie die GA4-Property, die der Site Crawler liest. Jeder Crawl verknüpft dann Sitzungen, Nutzer, Engagement-Rate und Schlüsselereignisse pro Landingpage der letzten 28 Tage.",
  ga4Connect: "Google Analytics verbinden",
  ga4NotConnected: "Echorank bittet Google um Lesezugriff auf Analytics, über dieselbe Google-Verbindung wie die Search Console.",
  ga4Property: "Property",
  ga4None: "Keine Property (keine GA4-Daten in Crawls)",
  ga4Save: "Speichern",
  ga4Saved: "Gespeichert.",
  ga4Error: "Die Property konnte nicht gespeichert werden. Bitte erneut versuchen.",
  ga4Empty: "Dieses Google-Konto kann keine GA4-Property lesen.",
  ga4Loading: "Wird geladen…",
  gscTitle: "Google Search Console",
  gscHelp: "Wählen Sie die Search-Console-Property, die der Site Crawler liest. Jeder Crawl verknüpft dann Klicks, Impressionen, CTR und Position pro Seite und kann den Indexierungsstatus prüfen.",
  gscConnect: "Search Console verbinden",
  gscNotConnected: "Echorank bittet Google um Lesezugriff auf die Search Console.",
  gscReauth: "Google verlangt eine neue Verbindung.",
  gscConnected: (property: string) => `Verbunden: ${property}`,
  gscDisconnect: "Trennen",
  gscError: "Das hat nicht geklappt. Bitte erneut versuchen.",
};

export const INTEGRATIONS_COPY: Record<DashLocale, IntegrationsCopy> = { en, fr, "de-CH": deCH };
