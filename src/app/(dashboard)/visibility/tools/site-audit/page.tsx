import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { SiteAuditClient } from "@/components/seo-tools/site-audit-client";

// Technical-SEO crawl via DataForSEO's OnPage API. The crawl is asynchronous
// and takes minutes: POST /api/seo/v1/site-audit/start returns a queued row,
// the site-audit worker polls it to completion, and this page polls the row.
//
// NOT the audit on /visibility — that one measures AI-engine readability and
// is a separate product. Both link to each other so the split is explicit.
// Paid gating enforced by ../layout.tsx.
export default async function SiteAuditPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <SiteAuditClient locale={locale} />;
}
