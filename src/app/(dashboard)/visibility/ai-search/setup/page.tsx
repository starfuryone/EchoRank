import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { wizardEngineOptions } from "@/lib/ai-monitor/wizard/engines";
import { planConfig } from "@/lib/plan-config";
import { SetupWizard } from "./setup-wizard";

/**
 * AI Search setup.
 *
 * A NEW ROUTE, touching nothing the AI Visibility Audit owns. /visibility and
 * its children are that product; this sits beside them.
 *
 * The engine list and the prompt allowance are resolved on the SERVER and
 * handed down. Both are answers the browser must not compute: selectability
 * comes from the same predicate the runner uses (rates plus adapter plus key),
 * and a client-side guess would let someone tick an engine the runner then
 * refuses — a checkup reporting zeros for a provider nobody called.
 */
export default async function AiSearchSetupPage() {
  const membership = await requireTenant();

  // Behind the rollout flag, and a 404 rather than a 403: a surface that is not
  // ready for this tenant should not advertise that it exists.
  if (!aiSearchEnabledFor(membership.tenantId)) notFound();

  const config = planConfig(membership.tenant.planType);

  // Resolved here rather than in the wizard: the cookie is only readable on the
  // server, and the wizard is a client component. Only the explainer button's
  // copy uses it today.
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  return (
    <SetupWizard
      engines={wizardEngineOptions()}
      promptLimit={config.aiCheckup.prompts}
      planName={config.name}
      locale={locale}
    />
  );
}
