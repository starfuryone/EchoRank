// GET /api/free/v1/authority-checker/{token} — GONE (2026-11-09): the free
// checker's stored results are no longer served. 410 for every request.
// Keep until 2027-02-08, then delete with the rest of /api/free/v1/authority-checker/.

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "Gone", code: "gone" }, { status: 410, headers: { "cache-control": "no-store" } });
}
