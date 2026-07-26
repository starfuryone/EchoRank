// ---------------------------------------------------------------------------
// Auth pages (login / register / shared layout) message catalog.
// Locale is resolved per-request from the echorank_locale cookie with geo
// fallback, see resolve-request-locale.ts. URLs stay unprefixed by design.
// ---------------------------------------------------------------------------

import type { Locale } from "./config";

export interface AuthContent {
  layout: { rights: string };
  login: {
    h2: string;
    sub: string;
    emailLabel: string;
    emailPh: string;
    passwordLabel: string;
    passwordPh: string;
    submit: string;
    errInvalid: string;
    errUnexpected: string;
    noAccount: string;
    startTrial: string;
  };
  register: {
    h2: string;
    sub: string;
    nameLabel: string;
    namePh: string;
    emailLabel: string;
    emailPh: string;
    businessLabel: string;
    businessPh: string;
    passwordLabel: string;
    passwordPh: string;
    submit: string;
    showPassword: string;
    hidePassword: string;
    termsLabelPre: string;
    termsLinkText: string;
    termsLabelPost: string;
    errFallback: string;
    errCreatedSigninFailed: string;
    errUnexpected: string;
    haveAccount: string;
    signIn: string;
    trialNote: string;
  };
}

const en: AuthContent = {
  layout: { rights: "All rights reserved." },
  login: {
    h2: "Welcome back",
    sub: "Sign in to your Echorank account",
    emailLabel: "Email",
    emailPh: "you@company.com",
    passwordLabel: "Password",
    passwordPh: "Enter your password",
    submit: "Sign In",
    errInvalid: "Invalid email or password",
    errUnexpected: "An unexpected error occurred",
    noAccount: "Don't have an account?",
    startTrial: "Start free trial",
  },
  register: {
    h2: "Start your free trial",
    sub: "Get more honest reviews from real customers",
    nameLabel: "Your name",
    namePh: "John Smith",
    emailLabel: "Work email",
    emailPh: "you@company.com",
    businessLabel: "Business name",
    businessPh: "Acme Plumbing",
    passwordLabel: "Password",
    passwordPh: "At least 8 characters",
    submit: "Create Account",
    showPassword: "Show password",
    hidePassword: "Hide password",
    termsLabelPre: "I agree to the ",
    termsLinkText: "Terms of Service",
    termsLabelPost: "",
    errFallback: "Registration failed",
    errCreatedSigninFailed: "Account created but sign-in failed. Please log in.",
    errUnexpected: "An unexpected error occurred",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    trialNote: "14-day free trial. No credit card required.",
  },
};

const fr: AuthContent = {
  layout: { rights: "Tous droits réservés." },
  login: {
    h2: "Heureux de vous revoir",
    sub: "Connectez-vous à votre compte Echorank",
    emailLabel: "E-mail",
    emailPh: "vous@entreprise.com",
    passwordLabel: "Mot de passe",
    passwordPh: "Saisissez votre mot de passe",
    submit: "Se connecter",
    errInvalid: "E-mail ou mot de passe invalide",
    errUnexpected: "Une erreur inattendue s'est produite",
    noAccount: "Pas encore de compte ?",
    startTrial: "Démarrer l'essai gratuit",
  },
  register: {
    h2: "Commencez votre essai gratuit",
    sub: "Obtenez des avis plus authentiques de vrais clients",
    nameLabel: "Votre nom",
    namePh: "Jean Martin",
    emailLabel: "E-mail professionnel",
    emailPh: "vous@entreprise.com",
    businessLabel: "Nom de l'entreprise",
    businessPh: "Plomberie Martin",
    passwordLabel: "Mot de passe",
    passwordPh: "Au moins 8 caractères",
    submit: "Créer mon compte",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    termsLabelPre: "J'accepte les ",
    termsLinkText: "conditions d'utilisation",
    termsLabelPost: "",
    errFallback: "Échec de l'inscription",
    errCreatedSigninFailed: "Compte créé, mais la connexion a échoué. Veuillez vous connecter.",
    errUnexpected: "Une erreur inattendue s'est produite",
    haveAccount: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
    trialNote: "Essai gratuit de 14 jours. Sans carte bancaire.",
  },
};

const frCA: AuthContent = {
  layout: { rights: "Tous droits réservés." },
  login: {
    h2: "Bon retour !",
    sub: "Connectez-vous à votre compte Echorank",
    emailLabel: "Courriel",
    emailPh: "vous@entreprise.com",
    passwordLabel: "Mot de passe",
    passwordPh: "Entrez votre mot de passe",
    submit: "Se connecter",
    errInvalid: "Courriel ou mot de passe invalide",
    errUnexpected: "Une erreur inattendue s'est produite",
    noAccount: "Pas encore de compte ?",
    startTrial: "Démarrer l'essai gratuit",
  },
  register: {
    h2: "Commencez votre essai gratuit",
    sub: "Obtenez des avis plus authentiques de vrais clients",
    nameLabel: "Votre nom",
    namePh: "Jean Tremblay",
    emailLabel: "Courriel professionnel",
    emailPh: "vous@entreprise.com",
    businessLabel: "Nom de l'entreprise",
    businessPh: "Plomberie Tremblay",
    passwordLabel: "Mot de passe",
    passwordPh: "Au moins 8 caractères",
    submit: "Créer mon compte",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    termsLabelPre: "J'accepte les ",
    termsLinkText: "conditions d'utilisation",
    termsLabelPost: "",
    errFallback: "Échec de l'inscription",
    errCreatedSigninFailed: "Compte créé, mais la connexion a échoué. Veuillez vous connecter.",
    errUnexpected: "Une erreur inattendue s'est produite",
    haveAccount: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
    trialNote: "Essai gratuit de 14 jours. Aucune carte de crédit requise.",
  },
};

const deCH: AuthContent = {
  layout: { rights: "Alle Rechte vorbehalten." },
  login: {
    h2: "Willkommen zurück",
    sub: "Melden Sie sich bei Ihrem Echorank-Konto an",
    emailLabel: "E-Mail",
    emailPh: "sie@firma.ch",
    passwordLabel: "Passwort",
    passwordPh: "Passwort eingeben",
    submit: "Anmelden",
    errInvalid: "E-Mail oder Passwort ungültig",
    errUnexpected: "Ein unerwarteter Fehler ist aufgetreten",
    noAccount: "Noch kein Konto?",
    startTrial: "Kostenlos testen",
  },
  register: {
    h2: "Starten Sie Ihre kostenlose Testphase",
    sub: "Mehr ehrliche Bewertungen von echten Kunden",
    nameLabel: "Ihr Name",
    namePh: "Max Muster",
    emailLabel: "Geschäftliche E-Mail",
    emailPh: "sie@firma.ch",
    businessLabel: "Firmenname",
    businessPh: "Muster Sanitär AG",
    passwordLabel: "Passwort",
    passwordPh: "Mindestens 8 Zeichen",
    submit: "Konto erstellen",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort ausblenden",
    termsLabelPre: "Ich akzeptiere die ",
    termsLinkText: "Nutzungsbedingungen",
    termsLabelPost: "",
    errFallback: "Registrierung fehlgeschlagen",
    errCreatedSigninFailed: "Konto erstellt, aber die Anmeldung ist fehlgeschlagen. Bitte melden Sie sich an.",
    errUnexpected: "Ein unerwarteter Fehler ist aufgetreten",
    haveAccount: "Sie haben bereits ein Konto?",
    signIn: "Anmelden",
    trialNote: "14 Tage kostenlos testen. Keine Kreditkarte erforderlich.",
  },
};

export const AUTH_CONTENT: Record<Locale, AuthContent> = {
  en,
  "en-CA": {
    ...en,
    register: { ...en.register, trialNote: "14-day free trial. No credit card required. Billed in Canadian dollars." },
  },
  fr,
  "fr-CA": frCA,
  "de-CH": deCH,
};
