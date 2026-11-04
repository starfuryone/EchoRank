// POST /api/free/v1/site-crawler/{token}/unlock — the email gate. Body:
// {email, consent?, locale?}. Stores the lead (free_crawl_leads, kept), sends
// a consented one to Brevo by double opt-in, and sets this browser's unlock
// cookie for this result (free-result.ts). 20 unlocks per IP per day.

import { NextResponse } from "next/server";
import { z } from "zod";
import { flag } from "@/lib/flags";
import { consumeDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { freeCrawlByToken, recordLead, unlockCookie } from "@/lib/site-crawler/free-result";

const Body = z.object({
  email: z.string().trim().max(254).email(),
  consent: z.boolean().optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!flag("crawl.free")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { token } = await ctx.params;
  const row = await freeCrawlByToken(token);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ip = visitorIp(request);
  if (!ip) return NextResponse.json({ error: "no_ip" }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const cookie = unlockCookie(row);
  if (!cookie) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const allowance = await consumeDailyLimit("site-crawler-unlock", ip, 20);
  if (!allowance.ok) return NextResponse.json({ error: allowance.reason }, { status: allowance.reason === "rate_limited" ? 429 : 503 });

  const locale = parsed.data.locale?.startsWith("fr") ? "fr" : "en";
  await recordLead({ row, email: parsed.data.email, locale, consent: parsed.data.consent === true });
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": cookie, "cache-control": "no-store" } });
}
