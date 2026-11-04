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
};

export const INTEGRATIONS_COPY: Record<DashLocale, IntegrationsCopy> = { en, fr, "de-CH": deCH };
