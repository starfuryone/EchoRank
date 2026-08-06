/**
 * GET /api/free/v1/serp-location/[id] — poll one free SERP check.
 *
 * The poll target while the standard queue works. Scoped to the sentinel
 * free-tools tenant, so a paid tenant's check id cannot be read through this
 * public endpoint — the anonymous namespace can only ever see its own rows.
 *
 * PUBLIC BY DESIGN — /api/free/v1/ is in publicPaths.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FREE_TOOLS_TENANT_ID } from "@/lib/free-tools/spend";
import { toPublicResults } from "@/lib/free-tools/serp-location";
import { jsonError } from "@/lib/free-tools/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await prisma.serpCheck.findFirst({
    // tenantId in the filter is what stops this reading a paid tenant's row.
    where: { id, tenantId: FREE_TOOLS_TENANT_ID },
    select: { id: true, status: true, results: true, error: true, keyword: true },
  });

  if (!row) return jsonError("Not found", "NOT_FOUND", 404);

  return NextResponse.json({
    id: row.id,
    status: row.status,
    keyword: row.keyword,
    error: row.error,
    results: row.status === "completed" ? toPublicResults(row.results) : [],
  });
}
