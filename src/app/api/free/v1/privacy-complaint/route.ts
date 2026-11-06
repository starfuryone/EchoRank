// POST /api/free/v1/privacy-complaint { name, email, details, locale, turnstileToken }
//
// The public data-protection complaint form (/{locale}/privacy/complaint).
// Turnstile when configured, then a fail-closed per-IP daily limit, then the
// complaint is stored, acknowledged by email and copied to legal@
// (src/lib/privacy/complaints.ts). Public: /api/free/v1/ is a public prefix in
// the proxy; the same-origin check on POSTs still applies.

import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { verifyTurnstile } from "@/lib/snapshot/turnstile";
import { fileComplaint } from "@/lib/privacy/complaints";

const COMPLAINTS_PER_IP_PER_DAY = 5;

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(254).email(),
  details: z.string().trim().min(20).max(10_000),
  locale: z.string().max(10).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const ip = visitorIp(request);
  if (!ip) return NextResponse.json({ error: "generic" }, { status: 400 });

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (turnstile === "failed") return NextResponse.json({ error: "turnstile" }, { status: 400 });

  const allowance = await consumeDailyLimit("privacy-complaint", ip, COMPLAINTS_PER_IP_PER_DAY);
  if (!allowance.ok) {
    return NextResponse.json({ error: allowance.reason === "rate_limited" ? "rate_limited" : "generic" }, {
      status: allowance.reason === "rate_limited" ? 429 : 503,
    });
  }

  const { name, email, details, locale } = parsed.data;
  const filed = await fileComplaint({ name, email, details, locale: locale ?? "en" });
  return NextResponse.json({ reference: filed.reference, acknowledged: filed.acknowledged }, { status: 201 });
}
