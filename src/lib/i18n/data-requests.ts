// /settings/account — "Your data": export and deletion (src/lib/privacy/). en / fr / de-CH.
import type { DashLocale } from "./dashboard";

export interface DataRequestsCopy {
  title: string;
  lead: string;
  exportTitle: string;
  exportBody: string;
  exportCta: string;
  deleteTitle: string;
  deleteBodyOwner: string;
  deleteBodyMember: string;
  deleteKept: string;
  deleteConfirmLabel: string;
  deleteCta: string;
  pending: (date: string) => string;
  cancelCta: string;
  errGeneric: string;
}

export const DATA_REQUESTS_COPY: Record<DashLocale, DataRequestsCopy> = {
  en: {
    title: "Your data",
    lead: "Download a copy of your data, or ask us to delete it.",
    exportTitle: "Export",
    exportBody: "A JSON file with your profile and, for owners and admins, this workspace's records.",
    exportCta: "Download my data",
    deleteTitle: "Delete",
    deleteBodyOwner:
      "You own this workspace: deleting your account deletes the workspace and everything in it, for every member. It happens 14 days after you ask; until then you can cancel here, and the account keeps working.",
    deleteBodyMember:
      "Deletes your account and what is yours. The workspace and its data stay with its owner. It happens 14 days after you ask; until then you can cancel here.",
    deleteKept: "Billing records held by our payment provider are kept as the law requires.",
    deleteConfirmLabel: "Type DELETE to confirm",
    deleteCta: "Request deletion",
    pending: (date) => `Deletion is scheduled for ${date}.`,
    cancelCta: "Cancel deletion",
    errGeneric: "Something went wrong. Please try again.",
  },
  fr: {
    title: "Vos données",
    lead: "Téléchargez une copie de vos données ou demandez-nous de les supprimer.",
    exportTitle: "Exporter",
    exportBody: "Un fichier JSON avec votre profil et, pour les propriétaires et administrateurs, les données de cet espace de travail.",
    exportCta: "Télécharger mes données",
    deleteTitle: "Supprimer",
    deleteBodyOwner:
      "Vous êtes propriétaire de cet espace de travail : supprimer votre compte supprime l'espace et tout ce qu'il contient, pour tous les membres. La suppression a lieu 14 jours après votre demande ; d'ici là, vous pouvez l'annuler ici et le compte reste utilisable.",
    deleteBodyMember:
      "Supprime votre compte et ce qui vous appartient. L'espace de travail et ses données restent à son propriétaire. La suppression a lieu 14 jours après votre demande ; d'ici là, vous pouvez l'annuler ici.",
    deleteKept: "Les données de facturation conservées par notre prestataire de paiement sont gardées comme la loi l'exige.",
    deleteConfirmLabel: "Tapez DELETE pour confirmer",
    deleteCta: "Demander la suppression",
    pending: (date) => `La suppression est prévue le ${date}.`,
    cancelCta: "Annuler la suppression",
    errGeneric: "Une erreur s'est produite. Veuillez réessayer.",
  },
  "de-CH": {
    title: "Ihre Daten",
    lead: "Laden Sie eine Kopie Ihrer Daten herunter oder lassen Sie sie löschen.",
    exportTitle: "Exportieren",
    exportBody: "Eine JSON-Datei mit Ihrem Profil und, für Inhaber und Admins, den Daten dieses Arbeitsbereichs.",
    exportCta: "Meine Daten herunterladen",
    deleteTitle: "Löschen",
    deleteBodyOwner:
      "Sie sind Inhaber dieses Arbeitsbereichs: Wenn Sie Ihr Konto löschen, werden der Arbeitsbereich und alles darin für alle Mitglieder gelöscht. Das geschieht 14 Tage nach Ihrer Anfrage; bis dahin können Sie hier abbrechen, und das Konto funktioniert weiter.",
    deleteBodyMember:
      "Löscht Ihr Konto und was Ihnen gehört. Der Arbeitsbereich und seine Daten bleiben beim Inhaber. Das geschieht 14 Tage nach Ihrer Anfrage; bis dahin können Sie hier abbrechen.",
    deleteKept: "Rechnungsunterlagen bei unserem Zahlungsanbieter werden aufbewahrt, wie es das Gesetz verlangt.",
    deleteConfirmLabel: "Geben Sie DELETE ein, um zu bestätigen",
    deleteCta: "Löschung beantragen",
    pending: (date) => `Die Löschung ist für den ${date} geplant.`,
    cancelCta: "Löschung abbrechen",
    errGeneric: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
};
