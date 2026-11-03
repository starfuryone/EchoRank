/**
 * /api/seo/v1/crawl/segments?host=… — a site's saved segments (Phase 4b).
 *
 *   GET  ?host=  → { host, segments: [{ name, rule }], cap }
 *   PUT  { host, segments } → replaces the host's segments, in order.
 *
 * Segments are per tenant + host and capped by the plan's crawlSegments.
 * A crawl copies the host's segments when it is created (service.ts), so a
 * change applies from the next crawl and never rewrites an old one.
 *
 * Tenant-scoped: every read and write filters on the caller's tenantId.
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { InvalidCrawlUrlError, crawlRouteError } from "@/lib/site-crawler/http";
import { featureCapsForPlan } from "@/lib/site-crawler/quota";
import { SegmentDefSchema, segmentRuleProblem, type SegmentDef } from "@/lib/site-crawler/segments";
import { hostOf } from "@/lib/site-crawler/site-verify";
import { validateRootUrl } from "@/lib/site-crawler/url";

/** Absolute ceiling on one request, whatever the plan. */
const MAX_SEGMENTS = 50;

function guardedHost(raw: string | null): string {
  const host = hostOf(raw ?? "");
  const checked = host ? validateRootUrl(`https://${host}/`) : null;
  if (!host || !checked?.ok) throw new InvalidCrawlUrlError(checked?.reason ?? "not_a_url");
  return host;
}

async function savedSegments(tenantId: string, host: string): Promise<SegmentDef[]> {
  const rows = await prisma.crawlSegment.findMany({
    where: { tenantId, host },
    orderBy: { position: "asc" },
    select: { name: true, rule: true },
  });
  return rows.flatMap((r) => {
    const parsed = SegmentDefSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function GET(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const host = guardedHost(new URL(request.url).searchParams.get("host"));
    return NextResponse.json({
      host,
      segments: await savedSegments(tenant.tenantId, host),
      cap: featureCapsForPlan(tenant.tenant.planType).segmentCap,
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const parsed = z
      .object({ host: z.string().max(2000), segments: z.array(SegmentDefSchema).max(MAX_SEGMENTS) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
    }
    const host = guardedHost(parsed.data.host);
    const { segments } = parsed.data;
    const cap = featureCapsForPlan(tenant.tenant.planType).segmentCap;
    if (segments.length > cap) {
      return NextResponse.json({ error: `Your plan allows ${cap} segments per site.`, code: "OVER_PLAN_CAP", limit: cap }, { status: 400 });
    }
    const problems = segments.flatMap((s, index) => {
      const reason = segmentRuleProblem(s.rule);
      return reason ? [{ index, reason }] : [];
    });
    if (problems.length) {
      return NextResponse.json({ error: "Some segment rules cannot be used.", code: "INVALID_SEGMENT", problems }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.crawlSegment.deleteMany({ where: { tenantId: tenant.tenantId, host } }),
      prisma.crawlSegment.createMany({
        data: segments.map((s, position) => ({ tenantId: tenant.tenantId, host, name: s.name, rule: s.rule, position })),
      }),
    ]);
    return NextResponse.json({ host, segments, cap });
  } catch (err) {
    return crawlRouteError(err);
  }
}
