import { cookies } from "next/headers";
import { SEO_TOOLS_COPY, dashboardLocale } from "@/lib/i18n/dashboard";
import { PLAN_ACCESS_COPY } from "@/lib/i18n/plan-access";
import { getCurrentTenant } from "@/lib/tenant";
import { apiAccessPlan, planIncludesApi } from "@/lib/api-access";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { ApiAccessClient } from "@/components/seo-tools/api-access-client";
import { ToolLockedCard } from "@/components/seo-tools/tool-locked-card";

// Tenant API keys for /api/public/v1/*. Paid gating enforced by ../layout.tsx;
// the plan (Agency and up, src/lib/api-access.ts) here: below it the page is
// the locked card and the key list is never fetched.
export default async function ApiAccessPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  if (!planIncludesApi(membership?.tenant.planType)) {
    const c = PLAN_ACCESS_COPY[locale];
    return (
      <ToolLockedCard
        name={SEO_TOOLS_COPY[locale].items.api_access.name}
        title={c.apiLockedTitle(PLAN_CONFIGS[apiAccessPlan()].name)}
        body={c.apiLockedBody}
        cta={c.cta}
      />
    );
  }
  return <ApiAccessClient locale={locale} />;
}
