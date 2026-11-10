// POST /api/free/v1/authority-checker — GONE (2026-11-09).
//
// The checker is a paid tool now: POST /api/seo/v1/link-authority, behind the
// session and the plan. This anonymous endpoint answers 410 and buys nothing.
// KEEP UNTIL 2027-02-08 (90 days from 2026-11-10, the owner's call), so
// search engines see the old URLs answer 410; then delete it with the three
// under [token]/.

import { NextResponse } from "next/server";
import { LINK_AUTHORITY_API } from "@/lib/authority-checker/config";

export function POST() {
  return NextResponse.json(
    { error: "The Link Authority Checker is included in every Echorank plan.", code: "gone", api: LINK_AUTHORITY_API },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
