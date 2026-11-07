// Copy for the sales contact form (/{locale}/enterprise/contact), its emails and
// the "Talk to us" links that point at it. en / fr / de-CH; en-CA and fr-CA fold
// to en and fr. Dependency-free (Client Components import it).
import { COUNTRY_NOT_AVAILABLE } from "@/lib/geo/blocked-countries";
import type { InquiryNeed, InquirySize } from "./inquiry-options";

export type SalesLocale = "en" | "fr" | "de-CH";

export function salesLocale(l: string | null | undefined): SalesLocale {
  const s = (l ?? "").toLowerCase();
  if (s.startsWith("fr")) return "fr";
  if (s.startsWith("de")) return "de-CH";
  return "en";
}

export type InquiryError = "invalid" | "blocked" | "rate_limited" | "turnstile" | "generic";

export interface SalesCopy {
  title: string;
  intro: string;
  name: string;
  email: string;
  company: string;
  website: string;
  websitePh: string;
  country: string;
  countryPh: string;
  size: string;
  sizes: Record<InquirySize, string>;
  needs: string;
  needOptions: Record<InquiryNeed, string>;
  message: string;
  optional: string;
  marketing: string;
  /** The privacy line: before, link text, after. */
  privacy: [string, string, string];
  submit: string;
  sending: string;
  /** The confirmation: on the page and in the acknowledgement email. */
  thanks: string;
  errors: Record<InquiryError, string>;
  ackSubject: string;
  ackGreeting: (name: string) => string;
  ackSignoff: string;
  /** Link texts that lead to the form. */
  links: {
    talk: string;
    enterpriseLine: string;
    agencies: string;
    higherLimits: string;
  };
}

export const SALES_COPY: Record<SalesLocale, SalesCopy> = {
  en: {
    title: "Talk to us",
    intro: "Tell us about your clients or locations and what you need. We'll reply by email within 2 business days.",
    name: "Name",
    email: "Work email",
    company: "Company",
    website: "Website",
    websitePh: "example.com",
    country: "Country",
    countryPh: "Choose your country",
    size: "How many clients or locations?",
    sizes: { "1-5": "1–5", "6-25": "6–25", "26-100": "26–100", "100+": "100+" },
    needs: "What do you need?",
    needOptions: {
      higher_limits: "Higher limits",
      white_label: "White-label",
      api_mcp: "API & MCP",
      annual_billing: "Annual billing",
      dpa: "Data Processing Agreement",
      other: "Other",
    },
    message: "Message",
    optional: "optional",
    marketing: "Send me tips and product news from Echorank (optional, unsubscribe anytime).",
    privacy: ["We use your answers to reply to you. See our ", "privacy notice", "."],
    submit: "Send",
    sending: "Sending…",
    thanks: "Thanks, we've got your message. We'll reply by email within 2 business days.",
    errors: {
      invalid: "Please fill in every required field with a valid value.",
      blocked: COUNTRY_NOT_AVAILABLE.en,
      rate_limited: "Too many messages from this connection today. Please try again tomorrow.",
      turnstile: "Please complete the check above the button.",
      generic: "Something went wrong. Please try again.",
    },
    ackSubject: "We've got your message",
    ackGreeting: (n) => `Hi ${n},`,
    ackSignoff: "The Echorank team",
    links: {
      talk: "Talk to us",
      enterpriseLine: "Enterprise: custom limits — talk to us",
      agencies: "Agencies and multi-location brands: talk to us",
      higherLimits: "Need higher limits? Talk to us",
    },
  },
  fr: {
    title: "Parlons-en",
    intro: "Parlez-nous de vos clients ou établissements et de vos besoins. Nous vous répondons par e-mail sous 2 jours ouvrés.",
    name: "Nom",
    email: "E-mail professionnel",
    company: "Entreprise",
    website: "Site web",
    websitePh: "exemple.com",
    country: "Pays",
    countryPh: "Choisissez votre pays",
    size: "Combien de clients ou d'établissements ?",
    sizes: { "1-5": "1–5", "6-25": "6–25", "26-100": "26–100", "100+": "100+" },
    needs: "De quoi avez-vous besoin ?",
    needOptions: {
      higher_limits: "Des limites plus élevées",
      white_label: "Marque blanche",
      api_mcp: "API et MCP",
      annual_billing: "Facturation annuelle",
      dpa: "Accord de traitement des données (DPA)",
      other: "Autre",
    },
    message: "Message",
    optional: "facultatif",
    marketing: "Envoyez-moi les conseils et nouveautés d'Echorank (facultatif, désabonnement à tout moment).",
    privacy: ["Nous utilisons vos réponses pour vous répondre. Consultez notre ", "politique de confidentialité", "."],
    submit: "Envoyer",
    sending: "Envoi…",
    thanks: "Merci, nous avons bien reçu votre message. Nous vous répondrons par e-mail sous 2 jours ouvrés.",
    errors: {
      invalid: "Veuillez remplir chaque champ obligatoire avec une valeur valide.",
      blocked: COUNTRY_NOT_AVAILABLE.fr,
      rate_limited: "Trop de messages depuis cette connexion aujourd'hui. Réessayez demain.",
      turnstile: "Veuillez valider la vérification au-dessus du bouton.",
      generic: "Une erreur s'est produite. Veuillez réessayer.",
    },
    ackSubject: "Nous avons bien reçu votre message",
    ackGreeting: (n) => `Bonjour ${n},`,
    ackSignoff: "L'équipe Echorank",
    links: {
      talk: "Parlons-en",
      enterpriseLine: "Entreprise : limites sur mesure — parlons-en",
      agencies: "Agences et marques multi-établissements : parlons-en",
      higherLimits: "Besoin de limites plus élevées ? Parlons-en",
    },
  },
  "de-CH": {
    title: "Kontakt aufnehmen",
    intro: "Erzählen Sie uns von Ihren Kunden oder Standorten und was Sie brauchen. Wir antworten innert 2 Arbeitstagen per E-Mail.",
    name: "Name",
    email: "Geschäftliche E-Mail",
    company: "Unternehmen",
    website: "Website",
    websitePh: "beispiel.ch",
    country: "Land",
    countryPh: "Wählen Sie Ihr Land",
    size: "Wie viele Kunden oder Standorte?",
    sizes: { "1-5": "1–5", "6-25": "6–25", "26-100": "26–100", "100+": "100+" },
    needs: "Was brauchen Sie?",
    needOptions: {
      higher_limits: "Höhere Limits",
      white_label: "White-Label",
      api_mcp: "API und MCP",
      annual_billing: "Jährliche Abrechnung",
      dpa: "Auftragsverarbeitungsvertrag (AVV)",
      other: "Anderes",
    },
    message: "Nachricht",
    optional: "freiwillig",
    marketing: "Senden Sie mir Tipps und Produktneuigkeiten von Echorank (freiwillig, jederzeit abbestellbar).",
    privacy: ["Wir verwenden Ihre Angaben, um Ihnen zu antworten. Siehe unsere ", "Datenschutzerklärung", "."],
    submit: "Senden",
    sending: "Wird gesendet…",
    thanks: "Danke, wir haben Ihre Nachricht erhalten. Wir antworten innert 2 Arbeitstagen per E-Mail.",
    errors: {
      invalid: "Bitte füllen Sie jedes Pflichtfeld mit einem gültigen Wert aus.",
      blocked: COUNTRY_NOT_AVAILABLE["de-CH"],
      rate_limited: "Zu viele Nachrichten von dieser Verbindung heute. Bitte versuchen Sie es morgen wieder.",
      turnstile: "Bitte bestätigen Sie die Prüfung über der Schaltfläche.",
      generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es nochmals.",
    },
    ackSubject: "Wir haben Ihre Nachricht erhalten",
    ackGreeting: (n) => `Guten Tag ${n}`,
    ackSignoff: "Das Echorank-Team",
    links: {
      talk: "Kontakt aufnehmen",
      enterpriseLine: "Enterprise: individuelle Limits — Kontakt aufnehmen",
      agencies: "Agenturen und Marken mit mehreren Standorten: Kontakt aufnehmen",
      higherLimits: "Höhere Limits nötig? Kontakt aufnehmen",
    },
  },
};

/** The acknowledgement email to the submitter, in their language. */
export function inquiryAcknowledgement(locale: SalesLocale, name: string): { subject: string; text: string } {
  const c = SALES_COPY[locale];
  return { subject: c.ackSubject, text: `${c.ackGreeting(name)}\n\n${c.thanks}\n\n${c.ackSignoff}` };
}
