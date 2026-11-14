"use client";

// The tenant's plan, for client components that name a plan in a locked
// message (src/lib/locked-plan.ts). Provided once by the dashboard shell from
// the (dashboard) layout's server-side read. Presentation only: every route
// re-checks the plan, and a component outside the shell (no provider) names
// the cheapest plan that clears the lock.

import { createContext, useContext } from "react";
import type { PlanType } from "@/generated/prisma";
import { lockedPlanName, type LockId } from "@/lib/locked-plan";

const PlanContext = createContext<PlanType | null>(null);

export function PlanProvider({ plan, children }: { plan: PlanType | null | undefined; children: React.ReactNode }) {
  return <PlanContext.Provider value={plan ?? null}>{children}</PlanContext.Provider>;
}

/** The tenant's plan, or null outside the dashboard shell. */
export function useTenantPlan(): PlanType | null {
  return useContext(PlanContext);
}

/** The plan name a locked message shows for `id`, for this tenant. */
export function useLockedPlanName(id: LockId): string {
  return lockedPlanName(useContext(PlanContext), id);
}
