// src/lib/site-audit/usage.ts
//
// The usage block every Site Audit route returns and the page header renders.

import type { PlanType } from "@/generated/prisma";
import { auditLimit, crawlPageLimit } from "./options";
import { siteAuditsUsed } from "./quota";
import type { SiteAuditUsage } from "./types";

export async function buildUsage(tenantId: string, plan: PlanType): Promise<SiteAuditUsage> {
  return {
    used: await siteAuditsUsed(tenantId),
    limit: auditLimit(plan),
    maxPages: crawlPageLimit(plan),
    plan,
  };
}
