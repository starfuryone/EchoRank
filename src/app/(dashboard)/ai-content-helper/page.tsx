import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";

// INTEGRATION POINT: AI content generation. Existing adjacent surfaces:
// message templates (/templates) and the sidecar's Anthropic remediation
// (av-service remediate.py) show the established AI-call pattern.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <FeatureScaffold locale={locale} id="ai_content_helper" />;
}
