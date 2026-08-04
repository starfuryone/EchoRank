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

  // Team chat (Matrix). GROWTH and up.
  chatTitle: string;
  chatIntro: string;
  chatProvision: string;
  chatProvisioning: string;
  chatAccountLabel: string;
  chatPasswordLabel: string;
  chatOnceWarning: string;
  chatCopy: string;
  chatCopied: string;
  chatOpenElement: string;
  chatExisting: string;
  chatLockedTitle: string;
  chatLockedBody: string;
  chatUpgrade: string;
  chatErrExists: string;
  chatErrRate: string;
  chatErrGeneric: string;
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

    chatTitle: "Team chat",
    chatIntro:
      "A private chat account on Echorank's own server, for your team. Messages stay on our infrastructure — no third-party workspace, no per-seat fee.",
    chatProvision: "Create my chat account",
    chatProvisioning: "Creating…",
    chatAccountLabel: "Your chat address",
    chatPasswordLabel: "One-time password",
    chatOnceWarning:
      "This password is shown once and is never stored. Copy it somewhere safe before leaving this page — we cannot show it again, only reset it.",
    chatCopy: "Copy",
    chatCopied: "Copied",
    chatOpenElement: "Open chat",
    chatExisting: "Your chat account is active.",
    chatLockedTitle: "Team chat is on Growth and above",
    chatLockedBody:
      "Private chat for your team, hosted by Echorank. Included from the Growth plan up.",
    chatUpgrade: "Compare plans",
    chatErrExists: "You already have a chat account.",
    chatErrRate: "Too many attempts. Try again later.",
    chatErrGeneric: "Could not create a chat account right now. Try again in a minute.",
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
    errorGeneric: "Impossible d'enregistrer. Veuillez réessayer.",

    chatTitle: "Messagerie d'équipe",
    chatIntro:
      "Un compte de messagerie privé sur le serveur d'Echorank, pour votre équipe. Les messages restent sur notre infrastructure — aucun espace tiers, aucun coût par utilisateur.",
    chatProvision: "Créer mon compte de messagerie",
    chatProvisioning: "Création…",
    chatAccountLabel: "Votre adresse de messagerie",
    chatPasswordLabel: "Mot de passe à usage unique",
    chatOnceWarning:
      "Ce mot de passe s'affiche une seule fois et n'est jamais conservé. Copiez-le en lieu sûr avant de quitter cette page : nous ne pouvons pas le réafficher, seulement le réinitialiser.",
    chatCopy: "Copier",
    chatCopied: "Copié",
    chatOpenElement: "Ouvrir la messagerie",
    chatExisting: "Votre compte de messagerie est actif.",
    chatLockedTitle: "La messagerie d'équipe est incluse à partir de Growth",
    chatLockedBody:
      "Une messagerie privée pour votre équipe, hébergée par Echorank. Incluse à partir du forfait Growth.",
    chatUpgrade: "Comparer les forfaits",
    chatErrExists: "Vous avez déjà un compte de messagerie.",
    chatErrRate: "Trop de tentatives. Réessayez plus tard.",
    chatErrGeneric: "Impossible de créer un compte pour le moment. Réessayez dans une minute.",
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
    errorGeneric: "Konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",

    chatTitle: "Team-Chat",
    chatIntro:
      "Ein privates Chat-Konto auf dem eigenen Server von Echorank, für Ihr Team. Die Nachrichten bleiben auf unserer Infrastruktur — kein fremder Arbeitsbereich, keine Gebühr pro Person.",
    chatProvision: "Mein Chat-Konto erstellen",
    chatProvisioning: "Wird erstellt…",
    chatAccountLabel: "Ihre Chat-Adresse",
    chatPasswordLabel: "Einmal-Passwort",
    chatOnceWarning:
      "Dieses Passwort wird nur einmal angezeigt und nie gespeichert. Kopieren Sie es an einen sicheren Ort, bevor Sie die Seite verlassen — wir können es nicht erneut anzeigen, nur zurücksetzen.",
    chatCopy: "Kopieren",
    chatCopied: "Kopiert",
    chatOpenElement: "Chat öffnen",
    chatExisting: "Ihr Chat-Konto ist aktiv.",
    chatLockedTitle: "Team-Chat gibt es ab Growth",
    chatLockedBody:
      "Privater Chat für Ihr Team, von Echorank gehostet. Enthalten ab dem Growth-Abo.",
    chatUpgrade: "Abos vergleichen",
    chatErrExists: "Sie haben bereits ein Chat-Konto.",
    chatErrRate: "Zu viele Versuche. Versuchen Sie es später erneut.",
    chatErrGeneric: "Das Chat-Konto konnte gerade nicht erstellt werden. Versuchen Sie es in einer Minute erneut.",
  },
};
