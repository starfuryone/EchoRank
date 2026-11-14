// Copy for the unsubscribe page (/api/email/unsubscribe): `ask` for the
// marketing list, `askOnboarding` for the getting-started emails.
export type UnsubscribeLocale = "en" | "fr" | "de-CH";

export const UNSUBSCRIBE_COPY: Record<
  UnsubscribeLocale,
  { title: string; ask: string; askOnboarding: string; button: string; done: string; doneNote: string; invalid: string }
> = {
  en: {
    title: "Unsubscribe",
    ask: "Stop receiving Echorank tips and product news?",
    askOnboarding: "Stop receiving the Echorank getting-started emails?",
    button: "Unsubscribe",
    done: "You're unsubscribed.",
    doneNote: "You'll still get emails about your account and billing.",
    invalid: "This unsubscribe link isn't valid. Write to legal@echorank360.com and we'll take you off the list.",
  },
  fr: {
    title: "Se désabonner",
    ask: "Ne plus recevoir les conseils et nouveautés d'Echorank ?",
    askOnboarding: "Ne plus recevoir les e-mails de prise en main d'Echorank ?",
    button: "Me désabonner",
    done: "Vous êtes désabonné.",
    doneNote: "Vous recevrez toujours les e-mails liés à votre compte et à la facturation.",
    invalid: "Ce lien de désabonnement n'est pas valide. Écrivez à legal@echorank360.com et nous vous retirerons de la liste.",
  },
  "de-CH": {
    title: "Abmelden",
    ask: "Keine Tipps und Produktneuigkeiten von Echorank mehr erhalten?",
    askOnboarding: "Keine Einstiegs-E-Mails von Echorank mehr erhalten?",
    button: "Abmelden",
    done: "Sie sind abgemeldet.",
    doneNote: "E-Mails zu Ihrem Konto und zur Abrechnung erhalten Sie weiterhin.",
    invalid: "Dieser Abmeldelink ist ungültig. Schreiben Sie an legal@echorank360.com, und wir nehmen Sie von der Liste.",
  },
};

export function unsubscribeLocale(lang: string | null | undefined): UnsubscribeLocale {
  const l = (lang ?? "").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de-CH";
  return "en";
}
