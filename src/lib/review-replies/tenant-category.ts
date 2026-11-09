// src/lib/review-replies/tenant-category.ts
//
// Is this tenant a healthcare practice? Decides whether the healthcare reply
// guardrail (healthcare-guardrail.ts) applies to its review replies.
//
// THE TENANT HAS NO CATEGORY COLUMN, so the answer is read from every signal
// that names what the business is: the workspace name, and for each brand
// profile its name, its industry (typed by the user or inferred at
// onboarding) and the onboarding crawl's detectedIndustry. Any one of them
// naming a dental, medical or clinical category is enough.
//
// NO OVERRIDE. Nothing a tenant can set turns it off. And it FAILS CLOSED: if
// the lookup throws, the guardrail applies — a generic reply for a plumber on a
// bad database day is the cheap side of that trade.

import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { isHealthcareCategory } from "./healthcare-guardrail";

export async function isHealthcareTenant(tenantId: string): Promise<boolean> {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        name: true,
        brandProfiles: { select: { name: true, industry: true, onboardingEvidence: true } },
      },
    });
    if (!tenant) return true;
    const signals: Array<string | null | undefined> = [tenant.name];
    for (const p of tenant.brandProfiles ?? []) {
      const evidence = p.onboardingEvidence as { detectedIndustry?: unknown } | null;
      signals.push(
        p.name,
        p.industry,
        typeof evidence?.detectedIndustry === "string" ? evidence.detectedIndustry : null,
      );
    }
    return isHealthcareCategory(...signals);
  } catch (err) {
    logger.error({ tenantId, err }, "healthcare category lookup failed; applying the reply guardrail");
    return true;
  }
}
