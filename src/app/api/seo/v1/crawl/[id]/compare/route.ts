/**
 * GET  /api/seo/v1/crawl/[id]/compare — crawls this one can be compared with
 *      (completed, kept, same tenant, same mode), the default baseline (the
 *      previous crawl of the same host) and this crawl's recent comparisons.
 * POST /api/seo/v1/crawl/[id]/compare { baselineId, mapping?, segment? } —
 *      compare (SQL set operations, src/lib/site-crawler/compare.ts) and store
 *      the result; the same pair, mapping and segment returns the stored row.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";
import { compareCandidates, defaultBaseline, resolveCompare, runComparison } from "@/lib/site-crawler/compare";
import { MappingSchema, mappingProblems } from "@/lib/site-crawler/compare-mapping";
import { readStoredConfig } from "@/lib/site-crawler/crawl-config";

const BodySchema = z.object({
  baselineId: z.string().min(1).max(64),
  mapping: MappingSchema.default([]),
  segment: z.number().int().min(0).nullable().default(null),
});

async function crawlA(id: string, tenantId: string) {
  return prisma.crawlJob.findFirst({
    where: { id, tenantId },
    select: { id: true, tenantId: true, rootUrl: true, mode: true, config: true, createdAt: true, status: true, ...DATA_STATE_SELECT },
  });
}

const notFound = () => NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
const notReady = () => NextResponse.json({ error: "Only a completed crawl with its pages kept can be compared.", code: "COMPARE_ERROR", reason: "not_comparable" }, { status: 409 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const a = await crawlA(id, tenant.tenantId);
    if (!a) return notFound();
    const archived = archivedGuard(a);
    if (archived) return archived;
    if (a.status !== "COMPLETED" || a.dataPurgedAt) return notReady();
    const candidates = await compareCandidates(a);
    const comparisons = await prisma.crawlComparison.findMany({
      where: { jobAId: a.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, jobBId: true, segmentId: true, mapping: true, createdAt: true, result: true },
    });
    return NextResponse.json({ candidates, defaultBaselineId: defaultBaseline(a, candidates), comparisons });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
    }
    const problems = mappingProblems(parsed.data.mapping);
    if (problems.length) {
      return NextResponse.json({ error: "Some URL mapping patterns cannot be used.", code: "INVALID_MAPPING", problems }, { status: 400 });
    }
    const a = await crawlA(id, tenant.tenantId);
    if (!a) return notFound();
    const archived = archivedGuard(a);
    if (archived) return archived;
    if (a.status !== "COMPLETED" || a.dataPurgedAt) return notReady();
    const { segment } = parsed.data;
    if (segment !== null && segment >= (readStoredConfig(a.config)?.segments?.length ?? 0)) {
      return NextResponse.json({ error: "Unknown segment", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const input = await resolveCompare(a, parsed.data.baselineId, segment, parsed.data.mapping);
    const row = await runComparison(input);
    return NextResponse.json(row);
  } catch (err) {
    return crawlRouteError(err);
  }
}
