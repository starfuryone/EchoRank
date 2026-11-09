// POST /api/free/v1/authority-checker — GONE (2026-11-09).
//
// The checker is a paid tool now: POST /api/seo/v1/link-authority, behind the
// session and the plan. This anonymous endpoint answers 410 and buys nothing.
// The file can be deleted (with the three under [token]/) once nothing still
// calls it; it is kept only because files are not deleted from this box.

import { NextResponse } from "next/server";
import { LINK_AUTHORITY_API } from "@/lib/authority-checker/config";

export function POST() {
  return NextResponse.json(
    { error: "The Link Authority Checker is included in every Echorank plan.", code: "gone", api: LINK_AUTHORITY_API },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
