import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { ContentExplorerClient } from "@/components/seo-tools/content-explorer-client";

// Real data page (replaced the FeatureScaffold): web mentions of a phrase from
// DataForSEO's Content Analysis index. Paid gating is enforced by ../layout.tsx;
// the per-plan search allowance is enforced in the route, and the client renders
// the locked card when the plan includes none.
//
// The workspace name is read here purely to prefill the "My brand" preset. It is
// a convenience, not a parameter — the search sends whatever is in the box, and
// all three presets run one code path.
export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();
  return (
    <ContentExplorerClient
      locale={locale}
      brandName={membership?.tenant.name ?? null}
    />
  );
}
