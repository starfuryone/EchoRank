import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { seoQuotaUsage } from "@/lib/seo-quota";
import { FeatureScaffold } from "@/components/scaffold/feature-scaffold";
import {
  SeoQuotaCounter,
  SeoQuotaExceededNotice,
} from "@/components/seo-tools/SeoQuotaNotice";
import { AiCitationsClient } from "@/components/seo-tools/ai-citations-client";
import { aiCitationsEnabled } from "@/lib/ai-citations/options";
import { registrableDomain } from "@/lib/registrable-domain";

// AI Citations — which pages ChatGPT and Google's AI surfaces cite when
// answering about a brand, and the brand's share of those mentions against
// competitors. Backed by DataForSEO's LLM Mentions family.
//
// ── TWO BRANCHES, AND THE SCAFFOLD IS NOT A PLACEHOLDER HERE ───────────────
// Nobody has confirmed that the connected DataForSEO account has the AI
// Optimization product. Until AI_CITATIONS_VERIFIED is set, this page renders
// FeatureScaffold — which is exactly the "not enabled yet" state the tool
// deserves, and which keeps `comingSoon: true` in seo-tools.ts HONEST: that
// flag is asserted against this file by seo-tools.test.ts, so the public
// homepage cannot advertise a tool whose data source is unverified.
//
// Flipping it live is three edits, listed in full in
// src/lib/ai-citations/options.ts: set the env, delete this branch, drop
// `comingSoon` and move the counts in seo-tools.test.ts. They move together by
// construction.
//
// Paid gating is enforced by ../layout.tsx; the plan gate (STARTER sees the
// locked state) and every spend gate live server-side in the service.
export default async function AiCitationsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  if (!aiCitationsEnabled()) {
    return <FeatureScaffold locale={locale} id="ai_citations" />;
  }

  const membership = await getCurrentTenant();
  const quota = membership
    ? await seoQuotaUsage(membership.tenantId, membership.tenant.planType)
    : null;

  // The tenant's own domain is the answer to "whose citations" almost every
  // time, so the form starts there rather than empty.
  const defaultTarget = membership?.tenant.auditDomain
    ? registrableDomain(membership.tenant.auditDomain)
    : "";

  return (
    <div className="space-y-4">
      {quota && <SeoQuotaExceededNotice usage={quota} locale={locale} />}
      {quota && <SeoQuotaCounter usage={quota} locale={locale} />}
      <AiCitationsClient locale={locale} defaultTarget={defaultTarget} />
    </div>
  );
}
