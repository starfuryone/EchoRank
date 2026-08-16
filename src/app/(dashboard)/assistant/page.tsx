import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ASSISTANT_COPY, dashboardLocale } from "@/lib/i18n/dashboard";
import { hasPaidPlan } from "@/lib/paid-plan";
import { getCurrentTenant } from "@/lib/tenant";
import { assistantEnabled, assistantLinkVisible } from "@/lib/assistant/config";
import { listConversations, toListItem } from "@/lib/assistant/pro/store";
import { buildAssistantUsage } from "@/lib/assistant/pro/quota";
import { AssistantPageClient } from "./page-client";

/**
 * /assistant — the full conversation view.
 *
 * THE GATE IS SERVER-SIDE AND IT IS THE SAME PREDICATE THE SIDEBAR USES. A
 * tenant that does not qualify is redirected rather than shown an upgrade
 * teaser: this phase ships no upsell surface, and a locked page with a buy
 * button is a surface. They see nothing, which is what "non-qualifying tenants
 * see nothing" means.
 *
 * THE REDIRECT IS PRESENTATION, NOT SECURITY. Every /api/assistant/pro/* route
 * re-checks `requirePaidPlan()` server-side on its own; this page could be
 * reached by a direct navigation with a stale session and the API would still
 * refuse. The gate here exists so the customer does not see a page that cannot
 * work, not to protect the data.
 */
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const c = ASSISTANT_COPY[dashboardLocale(cookieStore.get("echorank_locale")?.value)];
  // Bare title — the root layout's template appends "| Echorank360".
  return { title: c.metaTitle, description: c.metaDescription };
}

export default async function AssistantPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  const membership = await getCurrentTenant();
  const paid = membership ? await hasPaidPlan(membership.tenantId) : false;

  // Both switches, same as the sidebar: the runtime one is authoritative and
  // the NEXT_PUBLIC one keeps the two surfaces consistent at build time.
  if (!paid || !assistantEnabled() || !assistantLinkVisible()) {
    redirect("/dashboard");
  }

  // Fetched HERE, not from an effect on mount. Two reasons, and the second is
  // the one that matters: the history list is correct on first paint instead
  // of flashing empty, and the client needs no fetch-on-mount effect at all —
  // which is what keeps this page off the react-hooks/set-state-in-effect
  // baseline CLAUDE.md says not to grow.
  const tenantId = membership!.tenantId;
  const [conversations, usage] = await Promise.all([
    listConversations(tenantId),
    buildAssistantUsage(tenantId),
  ]);

  return (
    <AssistantPageClient
      c={ASSISTANT_COPY[locale]}
      initialConversations={conversations.map(toListItem)}
      initialUsage={usage}
    />
  );
}
