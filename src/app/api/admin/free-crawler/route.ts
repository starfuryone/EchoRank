// POST /api/admin/free-crawler — staff only (PLATFORM_ADMIN_EMAILS): the free
// public crawler's opt-out list (free_crawl_blocked_hosts). Form fields:
// action=add, host, note? | action=remove, host. Same-origin form posts only.
// Answers with a redirect back to /admin/free-crawler (303), or JSON for a
// JSON request.

import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { normalizeBlockedHost } from "@/lib/site-crawler/free-crawl";

export async function POST(request: Request) {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;

  const origin = request.headers.get("origin");
  const self = new URL(request.url).origin;
  const fwd = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && origin !== self && (!fwd || new URL(origin).host !== fwd)) {
    return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  }

  const json = (request.headers.get("content-type") ?? "").includes("application/json");
  const form: Record<string, string> = json
    ? ((await request.json().catch(() => ({}))) as Record<string, string>)
    : Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
  const host = normalizeBlockedHost(String(form.host ?? ""));
  if (!host) return NextResponse.json({ error: "invalid_host" }, { status: 400 });
  const action = form.action === "remove" ? "remove" : "add";

  if (action === "add") {
    const note = String(form.note ?? "").trim().slice(0, 500) || null;
    await prisma.freeCrawlBlockedHost.upsert({ where: { host }, create: { host, note, addedBy: admin.email }, update: { note } });
  } else {
    await prisma.freeCrawlBlockedHost.deleteMany({ where: { host } });
  }
  logger.info({ host, action, by: admin.email }, "free crawler blocklist changed");

  if (json) return NextResponse.json({ host, action });
  return NextResponse.redirect(new URL(`/admin/free-crawler?saved=${action}`, request.url), 303);
}
