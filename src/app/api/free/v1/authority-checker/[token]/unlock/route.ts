// POST /api/free/v1/authority-checker/{token}/unlock — GONE (2026-11-09): the
// email gate is removed. 410 for every request; no lead is stored. The leads
// already collected stay in free_crawl_leads (source "authority-checker").
// Keep until 2027-02-08, then delete with the rest of /api/free/v1/authority-checker/.

import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ error: "Gone", code: "gone" }, { status: 410, headers: { "cache-control": "no-store" } });
}
