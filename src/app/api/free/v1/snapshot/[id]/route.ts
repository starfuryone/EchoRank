/**
 * GET /api/free/v1/snapshot/<id> — status, and once done the PRE-EMAIL
 * preview only (rates, competitor names). The full report is reachable only
 * through the share token an email unlock returns: a run id is handed to
 * every visitor who checks the same domain within 7 days, so it must not be
 * a key to the report.
 */
import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshot/store";
import { previewOf } from "@/lib/snapshot/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = /^[a-z0-9]{20,40}$/.test(id) ? await getSnapshot(id) : null;
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    {
      id: run.id,
      status: run.status,
      brand: run.brand,
      domain: run.domain,
      prompts: run.prompts.map((p) => p.text),
      preview: run.status === "done" && run.report ? previewOf(run.report) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
