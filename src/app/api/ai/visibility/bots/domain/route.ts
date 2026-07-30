// src/app/api/ai/visibility/bots/domain/route.ts
//
// Sets the domain Bot Analytics checks. This is the route that makes the tool
// standalone: before it, a workspace with no AI Visibility audit had no way to
// tell this page what site it owns, and the page could only point at /visibility.
//
// The value is stored on the tenant, so it is tenant-scoped by construction, and
// validated to a bare hostname before it is written — the SSRF guard runs again
// at check time, but storing a clean value means the guard is never the only
// thing between a typo and a fetch.

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";
import { normalizeDomainInput } from "@/lib/bot-analytics/domain";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";

export async function POST(request: Request) {
  try {
    const membership = await requirePaidPlan();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const raw = (body as { domain?: unknown })?.domain;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "Provide a domain." }, { status: 400 });
    }

    const domain = normalizeDomainInput(raw);
    if (!domain) {
      return NextResponse.json(
        { error: "Enter a domain like yourdomain.com.", code: "InvalidDomain" },
        { status: 400 },
      );
    }

    // Second gate: the value has to be something we would actually be willing to
    // fetch. Rejecting here gives the tenant the error at the moment they typed
    // it, instead of a check that saves fine and then refuses to run.
    const guard = guardCheckUrl(domain, domain);
    if (!guard.ok) {
      return NextResponse.json(
        { error: "That domain cannot be checked.", code: guard.reason },
        { status: 400 },
      );
    }

    await prisma.tenant.update({
      where: { id: membership.tenantId },
      data: { botAnalyticsDomain: domain },
    });

    return NextResponse.json({ domain, domainSource: "manual" });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[visibility/bots/domain POST]", error);
    return NextResponse.json({ error: "Could not save that domain." }, { status: 500 });
  }
}
