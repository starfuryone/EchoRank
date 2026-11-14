// The build-progress switches for one tenant, read on the server (they are env
// reads plus tenant allowlists a browser cannot see), in the shape
// src/lib/upgrade-target.ts's pageState() takes. A page behind a switch that
// is off for the tenant is HIDDEN wherever it is linked, never shown locked:
// no plan unlocks it.
import "server-only";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { kofEnabledFor } from "@/lib/keyword-opportunity/rollout";
import { assistantEnabled, assistantLinkVisible } from "@/lib/assistant/config";
import type { RolloutState } from "@/lib/upgrade-target";

export function tenantRollouts(tenantId: string | null | undefined): RolloutState {
  return {
    ai_search: aiSearchEnabledFor(tenantId),
    kof: kofEnabledFor(tenantId),
    // Both switches, as the (dashboard) layout reads them for the sidebar row.
    assistant: assistantEnabled() && assistantLinkVisible(),
  };
}
