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
  /** BillingStatus.NONE — registered, never subscribed. Not a trial. */
  statusNone: string;
  /** Shown in the Plan row instead of a tier the tenant never bought. */
  planNone: string;
  /** Route out of the no-plan state, on the one page a NONE tenant can reach. */
  choosePlan: string;
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

  // AI revenue assumptions. Feed every figure on /visibility/tools/revenue and
  // the nightly rollup, which is why the hint says so on the settings page
  // rather than only on the tool.
  revenueTitle: string;
  revenueIntro: string;
  convRateLabel: string;
  convRateHint: string;
  avgSaleValueLabel: string;
  avgSaleValueHint: string;
  errorConvRate: string;
  errorAvgSaleValue: string;

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
    statusNone: "No plan",
    planNone: "None",
    choosePlan: "Choose a plan",
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

    revenueTitle: "AI revenue assumptions",
    revenueIntro:
      "We can see who arrives from an AI assistant. We cannot see what they buy — so these two numbers are yours to set. Every figure on the AI Revenue page is built from them, and changing them changes tonight's rollup, not the months already stored.",
    convRateLabel: "Close rate on AI-referred leads",
    convRateHint: "Between 0 and 1. 0.30 means three in ten become customers.",
    avgSaleValueLabel: "Average sale value",
    avgSaleValueHint: "What one closed sale is worth, in your billing currency.",
    errorConvRate: "Close rate must be greater than 0 and no more than 1.",
    errorAvgSaleValue: "Average sale value must be greater than 0.",

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
    statusNone: "Aucun forfait",
    planNone: "Aucun",
    choosePlan: "Choisir un forfait",
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

    revenueTitle: "Hypothèses de revenus IA",
    revenueIntro:
      "Nous voyons qui arrive depuis un assistant IA. Nous ne voyons pas ce qu'il achète : ces deux valeurs vous appartiennent donc. Tous les chiffres de la page Revenus IA en découlent, et les modifier change le calcul de cette nuit, pas les mois déjà enregistrés.",
    convRateLabel: "Taux de conversion des prospects venus d'une IA",
    convRateHint: "Entre 0 et 1. 0,30 signifie que trois sur dix deviennent clients.",
    avgSaleValueLabel: "Valeur moyenne d'une vente",
    avgSaleValueHint: "Ce que rapporte une vente conclue, dans votre devise de facturation.",
    errorConvRate: "Le taux de conversion doit être supérieur à 0 et au plus égal à 1.",
    errorAvgSaleValue: "La valeur moyenne d'une vente doit être supérieure à 0.",

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
    statusNone: "Kein Abo",
    planNone: "Keines",
    choosePlan: "Abo wählen",
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

    revenueTitle: "Annahmen zum KI-Umsatz",
    revenueIntro:
      "Wir sehen, wer über einen KI-Assistenten kommt. Was diese Person kauft, sehen wir nicht — diese beiden Werte legen deshalb Sie fest. Alle Zahlen auf der Seite KI-Umsatz beruhen darauf, und eine Änderung wirkt auf die Auswertung dieser Nacht, nicht auf bereits gespeicherte Monate.",
    convRateLabel: "Abschlussquote bei Leads aus KI-Assistenten",
    convRateHint: "Zwischen 0 und 1. 0,30 heisst: drei von zehn werden Kundschaft.",
    avgSaleValueLabel: "Durchschnittlicher Verkaufswert",
    avgSaleValueHint: "Was ein abgeschlossener Verkauf wert ist, in Ihrer Abrechnungswährung.",
    errorConvRate: "Die Abschlussquote muss grösser als 0 und höchstens 1 sein.",
    errorAvgSaleValue: "Der durchschnittliche Verkaufswert muss grösser als 0 sein.",

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
