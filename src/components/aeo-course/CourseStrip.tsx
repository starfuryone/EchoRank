// A slim "learn how to fix it" strip pointing at the AEO course, placed below
// the audit on /free-audit and below the free tools on /ai-visibility. It sits
// beside those widgets and never inside them. Server component; en/fr chrome.

import Link from "next/link";
import { AEO_BASE } from "@/lib/aeo-course-routes";
import css from "./aeo.module.css";

const COPY = {
  en: { lead: "Learn how to fix what the audit finds:", link: "the free AEO course →" },
  fr: { lead: "Apprenez à corriger ce que l'audit révèle :", link: "le cours AEO gratuit (en anglais) →" },
} as const;

export function AeoCourseStrip({ locale }: { locale: string }) {
  const t = COPY[locale.startsWith("fr") ? "fr" : "en"];
  return (
    <p className={css.strip} data-testid="aeo-course-strip">
      <span>{t.lead}</span>
      <Link href={`/${locale}${AEO_BASE}`}>{t.link}</Link>
    </p>
  );
}
