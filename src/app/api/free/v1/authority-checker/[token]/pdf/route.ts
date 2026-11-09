// GET /api/free/v1/authority-checker/{token}/pdf — GONE (2026-11-09): the free
// checker's unlocked PDF went with its email gate. 410 for every request.
// Deletable with the rest of /api/free/v1/authority-checker/.

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "Gone", code: "gone" }, { status: 410, headers: { "cache-control": "no-store" } });
}
