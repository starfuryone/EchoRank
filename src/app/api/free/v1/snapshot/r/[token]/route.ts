/** GET /api/free/v1/snapshot/r/<token> — the full report behind a live share link. */
import { NextResponse } from "next/server";
import { getByShareToken } from "@/lib/snapshot/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await getByShareToken(token);
  if (!run?.report) return NextResponse.json({ error: "expired" }, { status: 404 });
  return NextResponse.json(
    { report: run.report, expiresAt: run.shareExpiresAt?.toISOString() ?? null },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
