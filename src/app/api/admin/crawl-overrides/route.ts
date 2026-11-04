// POST /api/admin/crawl-overrides — staff only (PLATFORM_ADMIN_EMAILS): set a
// tenant's site crawler overrides (Phase 3d-A, src/lib/site-crawler/tenant-caps.ts).
// Form fields: slug, crawlConcurrencyOverride, crawlsKeptOverride,
// crawlUrlCapOverride; an empty value clears the override (the plan's value
// again). Same-origin form posts only. Answers with a redirect back to
// /admin/crawl-overrides?slug=… (303), or JSON for a JSON request.

import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { OVERRIDE_FIELDS, parseOverride, type CrawlOverrides } from "@/lib/site-crawler/tenant-caps";

export async function POST(request: Request) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;

  // A cross-site form must not be able to change caps with a staff cookie.
  const origin = request.headers.get("origin");
  const self = new URL(request.url).origin;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && origin !== self && (!host || new URL(origin).host !== host)) {
    return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  }

  const json = (request.headers.get("content-type") ?? "").includes("application/json");
  const form: Record<string, string> = json
    ? ((await request.json().catch(() => ({}))) as Record<string, string>)
    : Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
  const slug = String(form.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "slug_required" }, { status: 400 });

  const data = {} as CrawlOverrides;
  for (const field of OVERRIDE_FIELDS) {
    const parsed = parseOverride(field, form[field] == null ? "" : String(form[field]));
    if (!parsed.ok) return NextResponse.json({ error: "invalid_value", field }, { status: 400 });
    data[field] = parsed.value;
  }
  const res = await prisma.tenant.updateMany({ where: { slug }, data });
  if (res.count === 0) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  logger.info({ slug, ...data, by: admin.email }, "crawl overrides set");

  if (json) return NextResponse.json({ slug, ...data });
  return NextResponse.redirect(new URL(`/admin/crawl-overrides?slug=${encodeURIComponent(slug)}&saved=1`, request.url), 303);
}
