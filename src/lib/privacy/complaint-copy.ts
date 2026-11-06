// src/lib/privacy/complaint-copy.ts — the data-protection complaint form, its
// footer link and its emails, in en / fr / de-CH (marketing locales fold:
// fr* → fr, de* → de-CH, else en). No React and no server imports.

export type ComplaintLocale = "en" | "fr" | "de-CH";
export const complaintLocale = (l: string | null | undefined): ComplaintLocale =>
  l?.startsWith("fr") ? "fr" : l?.startsWith("de") ? "de-CH" : "en";

/** Where complaints are copied for handling. */
export const LEGAL_EMAIL = "legal@echorank360.com";

export const COMPLAINT_LINK: Record<ComplaintLocale, string> = {
  en: "Privacy complaint",
  fr: "Réclamation (données personnelles)",
  "de-CH": "Datenschutzbeschwerde",
};

export const COMPLAINT_PAGE_COPY: Record<
  ComplaintLocale,
  {
    title: string;
    intro: string;
    ico: string;
    nameLabel: string;
    emailLabel: string;
    detailsLabel: string;
    detailsHint: string;
    submit: string;
    sent: (ref: string) => string;
    errors: Record<"invalid" | "turnstile" | "rate_limited" | "generic", string>;
  }
> = {
  en: {
    title: "Make a data-protection complaint",
    intro:
      "Tell us what happened with your personal data. We acknowledge every complaint by email straight away and answer within 30 days.",
    ico: "You can also complain to the Information Commissioner's Office (ico.org.uk). We'd like the chance to put it right first.",
    nameLabel: "Your name",
    emailLabel: "Email for our reply",
    detailsLabel: "Your complaint",
    detailsHint: "What happened, when, and what you would like us to do.",
    submit: "Send complaint",
    sent: (ref) => `Thank you. Your complaint is recorded as ${ref} and an acknowledgement is on its way to your inbox.`,
    errors: {
      invalid: "Please fill in your name, a valid email and your complaint (at least 20 characters).",
      turnstile: "Please complete the check above and try again.",
      rate_limited: "Too many complaints from this connection today. Email legal@echorank360.com instead.",
      generic: "Something went wrong. Please email legal@echorank360.com instead.",
    },
  },
  fr: {
    title: "Déposer une réclamation sur vos données personnelles",
    intro:
      "Dites-nous ce qui s'est passé avec vos données personnelles. Nous accusons réception de chaque réclamation par e-mail immédiatement et répondons sous 30 jours.",
    ico: "Vous pouvez aussi saisir l'Information Commissioner's Office (ico.org.uk). Nous aimerions d'abord avoir l'occasion de corriger la situation.",
    nameLabel: "Votre nom",
    emailLabel: "E-mail pour notre réponse",
    detailsLabel: "Votre réclamation",
    detailsHint: "Ce qui s'est passé, quand, et ce que vous attendez de nous.",
    submit: "Envoyer la réclamation",
    sent: (ref) => `Merci. Votre réclamation est enregistrée sous la référence ${ref} et un accusé de réception vous a été envoyé.`,
    errors: {
      invalid: "Indiquez votre nom, un e-mail valide et votre réclamation (au moins 20 caractères).",
      turnstile: "Veuillez compléter la vérification ci-dessus et réessayer.",
      rate_limited: "Trop de réclamations depuis cette connexion aujourd'hui. Écrivez plutôt à legal@echorank360.com.",
      generic: "Une erreur s'est produite. Écrivez plutôt à legal@echorank360.com.",
    },
  },
  "de-CH": {
    title: "Datenschutzbeschwerde einreichen",
    intro:
      "Schildern Sie uns, was mit Ihren Personendaten geschehen ist. Wir bestätigen jede Beschwerde sofort per E-Mail und antworten innert 30 Tagen.",
    ico: "Sie können sich auch an das Information Commissioner's Office (ico.org.uk) wenden. Wir möchten die Sache aber zuerst selbst in Ordnung bringen.",
    nameLabel: "Ihr Name",
    emailLabel: "E-Mail für unsere Antwort",
    detailsLabel: "Ihre Beschwerde",
    detailsHint: "Was ist passiert, wann, und was erwarten Sie von uns?",
    submit: "Beschwerde senden",
    sent: (ref) => `Vielen Dank. Ihre Beschwerde ist unter ${ref} erfasst, und eine Bestätigung ist unterwegs in Ihr Postfach.`,
    errors: {
      invalid: "Bitte geben Sie Ihren Namen, eine gültige E-Mail und Ihre Beschwerde (mindestens 20 Zeichen) an.",
      turnstile: "Bitte schliessen Sie die Prüfung oben ab und versuchen Sie es erneut.",
      rate_limited: "Zu viele Beschwerden von dieser Verbindung heute. Schreiben Sie bitte an legal@echorank360.com.",
      generic: "Etwas ist schiefgelaufen. Schreiben Sie bitte an legal@echorank360.com.",
    },
  },
};

/** The acknowledgement the complainant receives at once. */
export function acknowledgementEmail(locale: ComplaintLocale, name: string, reference: string): { subject: string; text: string } {
  if (locale === "fr") {
    return {
      subject: `Réclamation reçue — ${reference}`,
      text:
        `Bonjour ${name},\n\nNous avons bien reçu votre réclamation relative à vos données personnelles (référence ${reference}). ` +
        `Nous l'examinons et vous répondrons dans un délai de 30 jours. Pour toute précision, répondez à ce message ou écrivez à ${LEGAL_EMAIL} en indiquant la référence.\n\n` +
        `Vous pouvez également saisir l'Information Commissioner's Office (ico.org.uk).\n\nChatLogic Insights Ltd (Echorank)`,
    };
  }
  if (locale === "de-CH") {
    return {
      subject: `Beschwerde erhalten — ${reference}`,
      text:
        `Guten Tag ${name}\n\nWir haben Ihre Datenschutzbeschwerde erhalten (Referenz ${reference}). ` +
        `Wir prüfen sie und antworten Ihnen innert 30 Tagen. Für Ergänzungen antworten Sie auf diese E-Mail oder schreiben Sie unter Angabe der Referenz an ${LEGAL_EMAIL}.\n\n` +
        `Sie können sich auch an das Information Commissioner's Office (ico.org.uk) wenden.\n\nChatLogic Insights Ltd (Echorank)`,
    };
  }
  return {
    subject: `Complaint received — ${reference}`,
    text:
      `Hello ${name},\n\nWe have received your data-protection complaint (reference ${reference}). ` +
      `We are looking into it and will reply within 30 days. To add anything, reply to this email or write to ${LEGAL_EMAIL} quoting the reference.\n\n` +
      `You can also complain to the Information Commissioner's Office (ico.org.uk).\n\nChatLogic Insights Ltd (Echorank)`,
  };
}
