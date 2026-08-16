// AI Action Agent — the review queue for AI-generated fixes.
//
// ── Gating: TWO gates, both server-side ─────────────────────────────────────
// 1. PAID, from ../layout.tsx, which wraps every /visibility/tools/* route.
// 2. marketing_studio (STARTER and up), here, via hasFeature.
//
// THAT KEY AND NOT ANOTHER. This tool spends the Marketing Studio monthly
// output-token budget — same Redis counter, same `ai_api_calls` table, same
// reset date — so it is gated by the feature that owns that budget. The
// alternative was `ai_visibility` (GROWTH+), which is what the /visibility
// Fixes card this tool succeeds is gated on, and that would have produced a
// tenant who can be refused a generation for exhausting an allowance they were
// never entitled to spend. Tier consistency with the budget beats surface
// consistency with the page it replaces.
//
// hasFeature() rather than requireFeature(): requireFeature throws, which is
// the right shape for the API routes and the wrong one for a page, where a
// tenant below the line should read what the tool does and how to get it.
//
// NOTHING IS SPENT BY A PAGE LOAD. Generation happens on the queue, behind a
// button. This renders rows a worker already wrote plus one Redis read for the
// meter, which is what makes it safe to leave open on a second monitor.

import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { getCurrentTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import { buildActionAgentUsage, type ActionAgentUsage } from "@/lib/action-agent/generate";
import { countByStatus, listActionItems } from "@/lib/action-agent/store";
import type { ActionItemDto, ActionItemStatus } from "@/lib/action-agent/types";
import { ActionAgentClient } from "@/components/seo-tools/action-agent-client";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const membership = await getCurrentTenant();

  const unlocked =
    membership !== null && hasFeature(membership.tenant.planType, "marketing_studio");

  const emptyCounts: Record<ActionItemStatus, number> = {
    draft: 0,
    approved: 0,
    applied: 0,
    rejected: 0,
  };

  // The reads are skipped entirely when locked — not fetched and hidden. A
  // locked page that still runs the queries leaks nothing visually and
  // everything in the query log.
  let items: ActionItemDto[] = [];
  let counts = emptyCounts;
  let usage: ActionAgentUsage | null = null;

  if (unlocked && membership) {
    [items, counts, usage] = await Promise.all([
      listActionItems({ tenantId: membership.tenantId, status: "draft" }),
      countByStatus(membership.tenantId),
      buildActionAgentUsage(membership.tenantId, membership.tenant.planType),
    ]);
  }

  return (
    <ActionAgentClient
      locale={locale}
      locked={!unlocked}
      initialItems={items}
      initialCounts={counts}
      usage={usage}
    />
  );
}
