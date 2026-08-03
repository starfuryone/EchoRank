import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { findMarketingCategory, MARKETING_CATEGORIES } from "@/lib/marketing-templates";
import { buildMarketingUsage } from "@/lib/marketing/service";
import { MarketingBriefClient } from "@/components/seo-tools/marketing-brief-client";

// One page per brief template. The [category] segment is validated against
// MARKETING_CATEGORIES and 404s on anything else — the same lookup the API
// route uses, so a URL that renders a form is always a URL the route accepts.
export function generateStaticParams() {
  return MARKETING_CATEGORIES.map((c) => ({ category: c.id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categoryId } = await params;
  const category = findMarketingCategory(categoryId);
  if (!category) notFound();

  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const usage = membership
    ? await buildMarketingUsage(membership.tenantId, membership.tenant.planType)
    : null;

  return (
    <MarketingBriefClient
      locale={locale}
      categoryId={category.id}
      usage={usage}
      // The guide itself is only needed on the voice page, where it prefills
      // the editor. Every other brief just needs to say whether one is active.
      voiceGuide={category.id === "voice" ? membership?.tenant.brandVoiceGuide ?? null : null}
      hasVoiceGuide={Boolean(membership?.tenant.brandVoiceGuide)}
    />
  );
}
