/**
 * GET /api/account/export — the signed-in user's data as a JSON download
 * (src/lib/privacy/export.ts). Rate-limited: it reads a lot.
 *
 * AUTHENTICATED — do not add /api/account/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { buildAccountExport } from "@/lib/privacy/export";

export async function GET() {
  let m;
  try {
    m = await requireTenant();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = await rateLimit(`account-export:${m.userId}`, 5, 3_600_000);
  if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const data = await buildAccountExport(m.userId, m.tenantId, m.role);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="echorank-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
