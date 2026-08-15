// src/app/api/intelligence/explain/report/route.ts
//
// PDF export of a stored "why are they winning?" report. Mirrors the
// /api/monitoring/report pattern exactly: requireTenant() + a plan gate, data
// assembled here server-side and scoped to membership.tenantId, then POSTed to
// the secret-gated sidecar which renders and returns the PDF. Nothing is
// written to disk and no tenant id is ever accepted from the client.
//
//   GET  → probe: { available } (drives button visibility)
//   POST → { rivalDomain } → assemble + render + stream application/pdf
//
// ── This route never generates a report ────────────────────────────────────
// It renders one that already exists. Exporting is free; gathering costs money,
// and a PDF endpoint that could silently spend $0.09 because someone clicked
// "download" would be a bad surprise. A rival with no stored report 404s, and
// the customer runs the report first.

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requirePlan, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { csrfProtection } from "@/lib/csrf-protection";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { latestReport, normalizeRivalDomain } from "@/lib/explain/store";
import { FACTOR_LABEL_EN, FACTOR_UNIT, fixLabelEn } from "@/lib/explain/labels";
import type { ExplainReportView } from "@/lib/explain/types";

export const dynamic = "force-dynamic";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

function unauthorized(error: unknown): NextResponse | null {
  const enforcement = enforcementErrorResponse(error);
  if (enforcement) return enforcement;
  if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * The sidecar's payload.
 *
 * Display strings are resolved HERE, not there: the sidecar has no i18n and no
 * knowledge of the factor vocabulary, so build_explain_report renders what it
 * is given and does no scoring of its own. That is what keeps the PDF's
 * ranking identical to the dashboard's — there is only one ranking, and it was
 * computed once when the report was stored.
 *
 * English, like every other report this sidecar builds. See the note at the
 * top of src/lib/explain/labels.ts.
 */
function toPayload(report: ExplainReportView, brandName: string) {
  return {
    brand: brandName,
    rival: { name: report.rivalName, domain: report.rivalDomain },
    generated: report.createdAt,
    cost_usd: report.costUsd,
    factors: report.factors.map((factor) => ({
      key: factor.factor,
      label: FACTOR_LABEL_EN[factor.factor] ?? factor.factor,
      unit: FACTOR_UNIT[factor.factor] ?? "count",
      them: factor.them,
      you: factor.you,
      gap: factor.gap,
      severity: factor.severity,
      unavailable: factor.unavailable ?? null,
      detail: factor.detail,
      // A fix with no label is omitted rather than sent as an empty string —
      // the builder keys the Fix line's presence on truthiness.
      fix: { label: fixLabelEn(factor.linkedFix) },
    })),
  };
}

export async function GET() {
  try {
    const membership = await requireTenant();
    await requirePlan("GROWTH");
    const stored = await prisma.explainReport.count({
      where: { tenantId: membership.tenantId },
    });
    return NextResponse.json({ available: stored > 0 });
  } catch (error) {
    const handled = unauthorized(error);
    if (handled) return handled;
    return NextResponse.json({ available: false });
  }
}

export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  try {
    const membership = await requireTenant();
    await requirePlan("GROWTH");

    let body: { rivalDomain?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const rivalDomain = normalizeRivalDomain(String(body.rivalDomain ?? ""));
    if (!rivalDomain) {
      return NextResponse.json({ error: "rival_domain_required" }, { status: 400 });
    }

    // Tenant-scoped by construction: latestReport filters on tenantId, so a
    // rival domain another tenant has a report for reads as "no report" here.
    const report = await latestReport(membership.tenantId, rivalDomain);
    if (!report) {
      return NextResponse.json({ error: "no_report" }, { status: 404 });
    }

    const profile = await prisma.brandProfile.findFirst({
      where: { id: report.brandProfileId, tenantId: membership.tenantId },
      select: { name: true },
    });

    let res: Response;
    try {
      res = await fetch(`${SIDECAR_URL}/explain-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": INTERNAL_SECRET,
        },
        body: JSON.stringify(toPayload(report, profile?.name ?? membership.tenant.name)),
        signal: AbortSignal.timeout(35_000),
        cache: "no-store",
      });
    } catch {
      return NextResponse.json({ error: "report_unavailable" }, { status: 502 });
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: "report_failed" },
        { status: res.status === 504 ? 504 : 502 },
      );
    }

    const pdf = new Uint8Array(await res.arrayBuffer());
    const disposition =
      res.headers.get("content-disposition") ??
      `attachment; filename="Echorank-360-Competitor-Reverse-Engineering-Report-${rivalDomain}.pdf"`;

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const handled = unauthorized(error);
    if (handled) return handled;
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "explain: PDF export failed",
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
