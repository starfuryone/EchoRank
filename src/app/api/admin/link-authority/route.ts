// POST /api/admin/link-authority — staff only (PLATFORM_ADMIN_EMAILS): set a
// tenant's monthly Link Authority Checker allowance above its plan's default
// (an Enterprise contract; src/lib/authority-checker/quota.ts). Form fields:
// slug, linkAuthorityChecksOverride; an empty value clears the override (the
// plan's value again). Same-origin form posts only. Answers with a redirect
// back to /admin/link-authority?slug=… (303), or JSON for a JSON request.

import { NextResponse } from "next/server";
import { logger } from "@/infrastructure/observability/logger";
import { parseLinkAuthorityOverride } from "@/lib/authority-checker/override";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;

  // A cross-site form must not be able to change allowances with a staff cookie.
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

  const parsed = parseLinkAuthorityOverride(form.linkAuthorityChecksOverride == null ? "" : String(form.linkAuthorityChecksOverride));
  if (!parsed.ok) return NextResponse.json({ error: "invalid_value", field: "linkAuthorityChecksOverride" }, { status: 400 });

  const res = await prisma.tenant.updateMany({ where: { slug }, data: { linkAuthorityChecksOverride: parsed.value } });
  if (res.count === 0) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  logger.info({ slug, linkAuthorityChecksOverride: parsed.value, by: admin.email }, "link authority override set");

  if (json) return NextResponse.json({ slug, linkAuthorityChecksOverride: parsed.value });
  return NextResponse.redirect(new URL(`/admin/link-authority?slug=${encodeURIComponent(slug)}&saved=1`, request.url), 303);
}
