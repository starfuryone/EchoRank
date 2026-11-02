/**
 * GET /api/free/v1/snapshot/prefill?domain= — brand / category / location
 * guesses for the check's form, from the homepage's title, meta and JSON-LD.
 * Free (no model call) but anonymous, so it is capped per IP and every fetch
 * hop is SSRF-checked (src/lib/snapshot/prefill.ts).
 */
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { blockReason, hashIp, takePrefillAllowance } from "@/lib/snapshot/limits";
import { normalizeDomain } from "@/lib/snapshot/match";
import { prefill } from "@/lib/snapshot/prefill";

export const dynamic = "force-dynamic";

const EMPTY = { brand: null, category: null, location: null };

export async function GET(request: Request) {
  const domain = normalizeDomain(new URL(request.url).searchParams.get("domain") ?? "");
  if (!domain || blockReason({ brand: "x", domain, category: "x" })) return NextResponse.json(EMPTY);
  if (!(await takePrefillAllowance(hashIp(getClientIp(request.headers))))) return NextResponse.json(EMPTY);
  return NextResponse.json({ domain, ...(await prefill(domain)) });
}
