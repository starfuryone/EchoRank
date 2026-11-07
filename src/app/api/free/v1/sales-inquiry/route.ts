// POST /api/free/v1/sales-inquiry — the sales contact form (/{locale}/enterprise/contact).
//
// Order: validation, honeypot, Turnstile (when TURNSTILE_SECRET_KEY is set),
// blocked country (stores nothing), then a fail-closed limit of 5 per IP per
// UTC day, then src/lib/sales/inquiries.ts stores it and sends the emails.
// Public: /api/free/v1/ is a public prefix in the proxy; the same-origin check
// on POSTs still applies.
import { NextResponse } from "next/server";
import { consumeDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { verifyTurnstile } from "@/lib/snapshot/turnstile";
import { cfCountry, isBlockedCountry } from "@/lib/geo/blocked-countries";
import { InquiryBody, submitInquiry } from "@/lib/sales/inquiries";

const INQUIRIES_PER_IP_PER_DAY = 5;

export async function POST(request: Request) {
  const parsed = InquiryBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);
    return NextResponse.json({ error: "invalid", fields }, { status: 400 });
  }
  // The honeypot is hidden from people; anything in it is a bot. Nothing stored, nothing sent.
  if (parsed.data.hp) return NextResponse.json({ error: "generic" }, { status: 400 });

  const ip = visitorIp(request);
  if (!ip) return NextResponse.json({ error: "generic" }, { status: 400 });

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (turnstile === "failed") return NextResponse.json({ error: "turnstile" }, { status: 400 });

  // A blocked country is answered before the limit is touched; submitInquiry checks again.
  const ipCountry = cfCountry(request.headers);
  if (isBlockedCountry(parsed.data.country) || isBlockedCountry(ipCountry)) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  const allowance = await consumeDailyLimit("sales-inquiry", ip, INQUIRIES_PER_IP_PER_DAY);
  if (!allowance.ok) {
    const limited = allowance.reason === "rate_limited";
    return NextResponse.json({ error: limited ? "rate_limited" : "generic" }, { status: limited ? 429 : 503 });
  }

  const out = await submitInquiry(parsed.data, { ipCountry });
  if (out.status === "blocked") return NextResponse.json({ error: "blocked" }, { status: 403 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
