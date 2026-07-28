/**
 * Account settings i18n (/settings/account).
 *
 * Keyed by DashLocale, which is the dashboard's three-catalog model: the five
 * supported locale codes collapse to three catalogs (en-CA → en, fr-CA → fr,
 * de* → de-CH) via dashboardLocale(). Adding "en-CA"/"fr-CA" keys here would
 * be dead code — nothing can ever look them up.
 *
 * de-CH follows the house rule: "ss", never "ß".
 */
import type { DashLocale } from "./dashboard";

export interface AccountCopy {
  title: string;
  subtitle: string;
  profileTitle: string;
  profileHint: string;
  nameLabel: string;
  emailLabel: string;
  notSet: string;
  planTitle: string;
  planLabel: string;
  intervalLabel: string;
  currencyLabel: string;
  billingStatusLabel: string;
  noSubscription: string;
  priceUnavailable: string;
  intervalMonth: string;
  intervalYear: string;
  tenantTitle: string;
  tenantNameLabel: string;
  createdAtLabel: string;
  save: string;
  saving: string;
  saved: string;
  readOnly: string;
  errorEmpty: string;
  errorTooLong: string;
  errorGeneric: string;
}

export const ACCOUNT_COPY: Record<DashLocale, AccountCopy> = {
  en: {
    title: "Account",
    subtitle: "Your profile, plan and workspace details.",
    profileTitle: "Profile",
    profileHint: "Managed by your sign-in provider.",
    nameLabel: "Name",
    emailLabel: "Email",
    notSet: "Not set",
    planTitle: "Plan",
    planLabel: "Plan",
    intervalLabel: "Billing interval",
    currencyLabel: "Currency",
    billingStatusLabel: "Billing status",
    noSubscription: "No active subscription record",
    priceUnavailable: "Not available",
    intervalMonth: "Monthly",
    intervalYear: "Yearly",
    tenantTitle: "Workspace",
    tenantNameLabel: "Workspace name",
    createdAtLabel: "Created",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    readOnly: "Read-only",
    errorEmpty: "Name cannot be empty.",
    errorTooLong: "Name must be 200 characters or fewer.",
    errorGeneric: "Could not save. Please try again.",
  },
  fr: {
    title: "Compte",
    subtitle: "Votre profil, votre forfait et les détails de votre espace.",
    profileTitle: "Profil",
    profileHint: "Géré par votre fournisseur d'authentification.",
    nameLabel: "Nom",
    emailLabel: "Courriel",
    notSet: "Non défini",
    planTitle: "Forfait",
    planLabel: "Forfait",
    intervalLabel: "Période de facturation",
    currencyLabel: "Devise",
    billingStatusLabel: "État de facturation",
    noSubscription: "Aucun abonnement enregistré",
    priceUnavailable: "Non disponible",
    intervalMonth: "Mensuel",
    intervalYear: "Annuel",
    tenantTitle: "Espace de travail",
    tenantNameLabel: "Nom de l'espace de travail",
    createdAtLabel: "Créé le",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré",
    readOnly: "Lecture seule",
    errorEmpty: "Le nom ne peut pas être vide.",
    errorTooLong: "Le nom doit contenir au plus 200 caractères.",
    errorGeneric: "Enregistrement impossible. Veuillez réessayer.",
  },
  "de-CH": {
    title: "Konto",
    subtitle: "Ihr Profil, Ihr Abo und die Angaben zu Ihrem Arbeitsbereich.",
    profileTitle: "Profil",
    profileHint: "Wird von Ihrem Anmeldedienst verwaltet.",
    nameLabel: "Name",
    emailLabel: "E-Mail",
    notSet: "Nicht gesetzt",
    planTitle: "Abo",
    planLabel: "Abo",
    intervalLabel: "Abrechnungsintervall",
    currencyLabel: "Währung",
    billingStatusLabel: "Abrechnungsstatus",
    noSubscription: "Kein aktives Abo erfasst",
    priceUnavailable: "Nicht verfügbar",
    intervalMonth: "Monatlich",
    intervalYear: "Jährlich",
    tenantTitle: "Arbeitsbereich",
    tenantNameLabel: "Name des Arbeitsbereichs",
    createdAtLabel: "Erstellt",
    save: "Speichern",
    saving: "Wird gespeichert…",
    saved: "Gespeichert",
    readOnly: "Schreibgeschützt",
    errorEmpty: "Der Name darf nicht leer sein.",
    errorTooLong: "Der Name darf höchstens 200 Zeichen lang sein.",
    errorGeneric: "Speichern nicht möglich. Bitte versuchen Sie es erneut.",
  },
};
