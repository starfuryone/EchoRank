// POST /api/free/v1/site-crawler — start a free public crawl (100 pages, raw
// HTML), anonymous. Body: {url, turnstileToken, locale?}. The checks and their
// order live in startFreeCrawl (src/lib/site-crawler/free-crawl.ts): URL guard,
// opt-out list, Turnstile, the domain's 24-hour reuse, 3 starts per IP per UTC
// day, a per-domain lock. The visitor's IP is cf-connecting-ip only; a request
// without one is refused (it did not come through Cloudflare).
//
// 202 {token, reused:false} for a new crawl; 200 {token, reused:true} when the
// domain was crawled in the last 24 hours (that crawl's result). The token is
// the result link: /{locale}/free-tools/site-crawler/r/{token}.

import { NextResponse } from "next/server";
import { z } from "zod";
import { flag } from "@/lib/flags";
import { visitorIp } from "@/lib/free-tools/limits";
import { startFreeCrawl, type FreeStartError } from "@/lib/site-crawler/free-crawl";

const Body = z.object({
  url: z.string().trim().min(1).max(2048),
  turnstileToken: z.string().max(2048).optional(),
  locale: z.string().max(10).optional(),
});

const STATUS: Record<FreeStartError, number> = {
  invalid_url: 400,
  blocked: 403,
  turnstile: 403,
  unavailable: 503,
  rate_limited: 429,
  busy: 409,
};

export async function POST(request: Request) {
  if (!flag("crawl.free")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ip = visitorIp(request);
  if (!ip) return NextResponse.json({ error: "no_ip" }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const locale = parsed.data.locale?.startsWith("fr") ? "fr" : "en";
  const res = await startFreeCrawl({ url: parsed.data.url, turnstileToken: parsed.data.turnstileToken, ip, locale });
  if (!res.ok) return NextResponse.json({ error: res.error, ...(res.reason ? { reason: res.reason } : {}) }, { status: STATUS[res.error] });
  return NextResponse.json({ token: res.token, reused: res.reused }, { status: res.reused ? 200 : 202 });
}
