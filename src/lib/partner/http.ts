// src/lib/partner/http.ts — the glue every /api/partner/v1 route shares.
import "server-only";

import { NextResponse } from "next/server";
import { authenticatePartnerRequest, type PartnerContext } from "./auth";
import type { PartnerResult } from "./service";

export function toResponse(r: PartnerResult): NextResponse {
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}

/** Auth, a JSON-object body, then `run`. Unexpected errors are a 500 with no detail. */
export async function handlePartnerPost(
  req: Request,
  label: string,
  run: (ctx: PartnerContext, body: Record<string, unknown>) => Promise<PartnerResult>,
): Promise<NextResponse> {
  try {
    const auth = await authenticatePartnerRequest(req);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    return toResponse(await run(auth.ctx, body as Record<string, unknown>));
  } catch (err) {
    console.error(`[partner ${label}]`, err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
