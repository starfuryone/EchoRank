/**
 * POST /api/seo/v1/serp/check — queue a SERP check on DataForSEO's standard
 * queue. Body: { keyword, locationCode?, languageCode?, device? }.
 * Returns { id, status: "queued" } immediately; results land asynchronously
 * (serp-checks worker) and are polled via GET /api/seo/v1/serp/check/[id].
 *
 * GET /api/seo/v1/serp/check — this tenant's check history (+ spend total).
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → request
 * rate limit → 24 h cache → monthly per-plan quota (Redis) → monthly USD cap
 * (inside seoMeteredCall) → DataForSEO → meter.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  DEFAULT_DEVICE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  submitSerpCheck,
  toSerpCheckDto,
} from "@/lib/serp/service";
import { SERP_CHECKS_PER_MONTH, serpChecksUsed } from "@/lib/serp/quota";
import { serpRouteError } from "@/lib/serp/http";

/** Submissions per tenant per minute — a floor under the monthly quota, not a
 * replacement for it (a burst of 25 would exhaust STARTER in one second). */
const SUBMIT_RATE_LIMIT = 10;
const SUBMIT_RATE_WINDOW_MS = 60_000;

const HISTORY_LIMIT = 50;

const BodySchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  locationCode: z.number().int().positive().default(DEFAULT_LOCATION_CODE),
  languageCode: z.string().trim().min(2).max(5).default(DEFAULT_LANGUAGE_CODE),
  device: z.enum(["desktop", "mobile"]).default(DEFAULT_DEVICE),
});

export async function POST(request: Request) {
  try {
    // Throws PaidPlanRequiredError when not ACTIVE; returns the membership.
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          code: "INVALID_REQUEST",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const limited = await rateLimit(
      `serp-check:${tenant.tenantId}`,
      SUBMIT_RATE_LIMIT,
      SUBMIT_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many SERP checks in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { check, cached } = await submitSerpCheck(
      tenant.tenantId,
      tenant.tenant.planType,
      parsed.data,
    );

    return NextResponse.json(
      { id: check.id, status: check.status, cached, check },
      { status: cached ? 200 : 202 },
    );
  } catch (err) {
    return serpRouteError(err);
  }
}

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

    const [rows, spend, used] = await Promise.all([
      prisma.serpCheck.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      prisma.serpCheck.aggregate({
        _sum: { costUsd: true },
        where: { tenantId: tenant.tenantId },
      }),
      serpChecksUsed(tenant.tenantId),
    ]);

    const limit = SERP_CHECKS_PER_MONTH[tenant.tenant.planType] ?? 0;

    return NextResponse.json({
      // History rows carry no `results` payload — the table only needs the
      // summary columns, and 50 × 100 organic items is a needlessly large body.
      checks: rows.map((row) => ({ ...toSerpCheckDto(row), results: null })),
      usage: { used, limit, plan: tenant.tenant.planType },
      totalCostUsd: Number(spend._sum.costUsd ?? 0),
    });
  } catch (err) {
    return serpRouteError(err);
  }
}
