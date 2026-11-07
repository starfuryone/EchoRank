// The /enterprise sections the sub-nav links to, in page order, and the
// sub-nav's copy. A plain module (no "use client"): the server page reads the
// ids to set them on its sections, and a constant imported from a client file
// would arrive there as a client reference, not as the array.
//
// en / fr / de-CH, folded by salesLocale() like the contact form: the page
// body is English on every locale, but the chrome around it (PublicNav, this
// bar, the footer, the contact form) follows the visitor's locale.

import type { SalesLocale } from "@/lib/sales/inquiry-copy";

export const ENTERPRISE_SECTION_IDS = ["crawler", "features", "api", "security"] as const;
export type EnterpriseSectionId = (typeof ENTERPRISE_SECTION_IDS)[number];

export interface EnterpriseSubnavCopy {
  /** The bar's title, linking to the top of /enterprise. */
  title: string;
  /** The <nav>'s accessible name: it is the page's second navigation landmark. */
  aria: string;
  sections: Record<EnterpriseSectionId, string>;
}

export const ENTERPRISE_SUBNAV_COPY: Record<SalesLocale, EnterpriseSubnavCopy> = {
  en: {
    title: "Enterprise",
    aria: "Enterprise page sections",
    sections: { crawler: "Crawler", features: "Features", api: "API & MCP", security: "Data" },
  },
  fr: {
    title: "Entreprise",
    aria: "Sections de la page Entreprise",
    sections: { crawler: "Crawler", features: "Fonctionnalités", api: "API et MCP", security: "Données" },
  },
  "de-CH": {
    title: "Enterprise",
    aria: "Abschnitte der Enterprise-Seite",
    sections: { crawler: "Crawler", features: "Funktionen", api: "API & MCP", security: "Daten" },
  },
};
