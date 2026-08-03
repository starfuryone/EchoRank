import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { buildMarketingUsage } from "@/lib/marketing/service";
import { MarketingStudioClient } from "@/components/seo-tools/marketing-studio-client";

// Real page (replaced the FeatureScaffold): Marketing Studio, the 12 brief
// templates. Paid gating is enforced by ../layout.tsx; the marketing_studio
// feature flag is enforced in the routes, and the client renders the locked
// card when the plan does not carry it.
//
// The card in SEO_TOOL_GROUPS is still id `ai_content_helper` and the slug is
// still ai-content-helper — that id is wired into dashNav, the homepage tool
// grid and the route table in seo-tools.test.ts. Only the page's own title
// says Marketing Studio.
//
// Usage is read here rather than through a GET route: this is a server
// component, buildMarketingUsage is one Redis read, and an endpoint whose only
// caller is this page's own first paint would be one more thing to tenant-scope
// for no gain.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const usage = membership
    ? await buildMarketingUsage(membership.tenantId, membership.tenant.planType)
    : null;

  return (
    <MarketingStudioClient
      locale={locale}
      usage={usage}
      hasVoiceGuide={Boolean(membership?.tenant.brandVoiceGuide)}
    />
  );
}
