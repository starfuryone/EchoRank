// /settings/memory — AI memory (src/lib/memory/). en / fr / de-CH: the dashboard's
// three locales (dashboardLocale() folds en-CA → en and fr-CA → fr).
import type { DashLocale } from "./dashboard";

export type MemoryCategoryKey =
  | "brand"
  | "competitor"
  | "market"
  | "goal"
  | "tone"
  | "product"
  | "decision"
  | "preference"
  | "general";

export interface MemoryCopy {
  title: string;
  /** The one plain-language line on what is stored. */
  whatIsStored: string;
  toggleLabel: string;
  on: string;
  off: string;
  offNote: string;
  stored: (n: string, max: string | null) => string;
  addsUsed: (used: string, limit: string | null) => string;
  listTitle: string;
  empty: string;
  from: Record<string, string>;
  categories: Record<MemoryCategoryKey, string>;
  deleteItem: string;
  showMore: string;
  deleteAllTitle: string;
  deleteAllBody: string;
  confirmLabel: string;
  deleteAllCta: string;
  deletedAll: string;
  adminsOnly: string;
  notIncluded: string;
  unavailable: string;
  errGeneric: string;
  /** The card on /settings/account that links here. */
  linkTitle: string;
  linkBody: string;
  linkCta: string;
}

export const MEMORY_COPY: Record<DashLocale, MemoryCopy> = {
  en: {
    title: "AI memory",
    whatIsStored:
      "Echorank remembers business facts you share in Marketing Studio and through the MCP server (brand, competitors, markets, goals, tone and decisions) so you don't have to repeat them. It never keeps people's names, emails or phone numbers, passwords or payment details.",
    toggleLabel: "Remember business facts",
    on: "On",
    off: "Off",
    offNote: "Memory is off: nothing new is saved, and nothing saved is used.",
    stored: (n, max) => (max ? `${n} of ${max} facts saved` : `${n} facts saved`),
    addsUsed: (used, limit) => (limit ? `${used} of ${limit} memory adds used this month` : `${used} memory adds this month`),
    listTitle: "What Echorank remembers",
    empty: "Nothing remembered yet.",
    from: { mcp: "MCP", marketing_studio: "Marketing Studio" },
    categories: {
      brand: "Brand",
      competitor: "Competitor",
      market: "Market",
      goal: "Goal",
      tone: "Tone",
      product: "Product",
      decision: "Decision",
      preference: "Preference",
      general: "General",
    },
    deleteItem: "Delete this memory",
    showMore: "Show more",
    deleteAllTitle: "Delete all memories",
    deleteAllBody:
      "Removes every saved fact for this workspace now. This cannot be undone. Whether memory is on or off stays as it is.",
    confirmLabel: "Type DELETE to confirm",
    deleteAllCta: "Delete all memories",
    deletedAll: "All memories deleted.",
    adminsOnly: "Only owners and admins can switch memory off or delete every memory.",
    notIncluded: "AI memory comes with the plans that include Marketing Studio and the MCP server.",
    unavailable: "AI memory is unavailable right now. Please try again later.",
    errGeneric: "Something went wrong. Please try again.",
    linkTitle: "AI memory",
    linkBody: "See and delete what Echorank remembers about your business.",
    linkCta: "Manage AI memory",
  },
  fr: {
    title: "Mémoire IA",
    whatIsStored:
      "Echorank retient les faits sur votre entreprise que vous partagez dans le Marketing Studio et via le serveur MCP (marque, concurrents, marchés, objectifs, ton et décisions) pour que vous n'ayez pas à les répéter. Il ne conserve jamais de noms de personnes, d'adresses e-mail ou de numéros de téléphone, de mots de passe ni de données de paiement.",
    toggleLabel: "Retenir les faits sur l'entreprise",
    on: "Activée",
    off: "Désactivée",
    offNote: "La mémoire est désactivée : rien de nouveau n'est enregistré et rien d'enregistré n'est utilisé.",
    stored: (n, max) => (max ? `${n} faits enregistrés sur ${max}` : `${n} faits enregistrés`),
    addsUsed: (used, limit) =>
      limit ? `${used} ajouts de mémoire utilisés sur ${limit} ce mois-ci` : `${used} ajouts de mémoire ce mois-ci`,
    listTitle: "Ce qu'Echorank a retenu",
    empty: "Rien n'a encore été retenu.",
    from: { mcp: "MCP", marketing_studio: "Marketing Studio" },
    categories: {
      brand: "Marque",
      competitor: "Concurrent",
      market: "Marché",
      goal: "Objectif",
      tone: "Ton",
      product: "Produit",
      decision: "Décision",
      preference: "Préférence",
      general: "Général",
    },
    deleteItem: "Supprimer ce souvenir",
    showMore: "Afficher plus",
    deleteAllTitle: "Supprimer toute la mémoire",
    deleteAllBody:
      "Supprime dès maintenant tous les faits enregistrés pour cet espace de travail. Cette action est irréversible. L'activation de la mémoire reste telle quelle.",
    confirmLabel: "Tapez DELETE pour confirmer",
    deleteAllCta: "Supprimer toute la mémoire",
    deletedAll: "Toute la mémoire a été supprimée.",
    adminsOnly: "Seuls les propriétaires et les administrateurs peuvent désactiver la mémoire ou tout supprimer.",
    notIncluded: "La mémoire IA est incluse dans les forfaits qui comprennent le Marketing Studio et le serveur MCP.",
    unavailable: "La mémoire IA est indisponible pour le moment. Veuillez réessayer plus tard.",
    errGeneric: "Une erreur est survenue. Veuillez réessayer.",
    linkTitle: "Mémoire IA",
    linkBody: "Consultez et supprimez ce qu'Echorank a retenu sur votre entreprise.",
    linkCta: "Gérer la mémoire IA",
  },
  "de-CH": {
    title: "KI-Gedächtnis",
    whatIsStored:
      "Echorank merkt sich Fakten über Ihr Unternehmen, die Sie im Marketing Studio und über den MCP-Server teilen (Marke, Mitbewerber, Märkte, Ziele, Tonalität und Entscheidungen), damit Sie sie nicht wiederholen müssen. Namen von Personen, E-Mail-Adressen, Telefonnummern, Passwörter und Zahlungsdaten speichert es nie.",
    toggleLabel: "Fakten über das Unternehmen merken",
    on: "Ein",
    off: "Aus",
    offNote: "Das Gedächtnis ist aus: Es wird nichts Neues gespeichert und nichts Gespeichertes verwendet.",
    stored: (n, max) => (max ? `${n} von ${max} Fakten gespeichert` : `${n} Fakten gespeichert`),
    addsUsed: (used, limit) =>
      limit ? `${used} von ${limit} Speichervorgängen in diesem Monat verwendet` : `${used} Speichervorgänge in diesem Monat`,
    listTitle: "Was sich Echorank merkt",
    empty: "Noch nichts gespeichert.",
    from: { mcp: "MCP", marketing_studio: "Marketing Studio" },
    categories: {
      brand: "Marke",
      competitor: "Mitbewerber",
      market: "Markt",
      goal: "Ziel",
      tone: "Tonalität",
      product: "Produkt",
      decision: "Entscheidung",
      preference: "Vorliebe",
      general: "Allgemein",
    },
    deleteItem: "Diesen Eintrag löschen",
    showMore: "Mehr anzeigen",
    deleteAllTitle: "Gesamtes Gedächtnis löschen",
    deleteAllBody:
      "Löscht sofort alle gespeicherten Fakten dieses Arbeitsbereichs. Das lässt sich nicht rückgängig machen. Ob das Gedächtnis ein- oder ausgeschaltet ist, bleibt unverändert.",
    confirmLabel: "Geben Sie DELETE ein, um zu bestätigen",
    deleteAllCta: "Gesamtes Gedächtnis löschen",
    deletedAll: "Das gesamte Gedächtnis wurde gelöscht.",
    adminsOnly: "Nur Inhaber und Administratoren können das Gedächtnis ausschalten oder alles löschen.",
    notIncluded: "Das KI-Gedächtnis ist in den Abos enthalten, die das Marketing Studio und den MCP-Server umfassen.",
    unavailable: "Das KI-Gedächtnis ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.",
    errGeneric: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    linkTitle: "KI-Gedächtnis",
    linkBody: "Sehen und löschen Sie, was sich Echorank über Ihr Unternehmen merkt.",
    linkCta: "KI-Gedächtnis verwalten",
  },
};
