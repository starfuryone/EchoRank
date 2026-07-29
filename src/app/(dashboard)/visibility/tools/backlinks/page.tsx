import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { BacklinksClient } from "@/components/seo-tools/backlinks-client";

// Real data page (replaced the scaffold): five live DataForSEO Backlinks calls
// behind /api/seo/v1/backlinks/analyze — summary, history, referring domains,
// anchors and most-linked pages, cached 24 h per (target, mode).
// Paid gating enforced by ../layout.tsx; plan gating (STARTER/AI_VISIBILITY see
// the locked card) is enforced server-side in the API and mirrored in the client.
export default async function BacklinksPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <BacklinksClient locale={locale} />;
}
