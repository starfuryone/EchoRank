// GET  /api/auth/guest?s=cs_…  — has the webhook provisioned this yet?
// POST /api/auth/guest         — set the first password, spending the session.
//
// The credential here is the Stripe checkout session id and nothing else, which
// is why every reject collapses to ONE opaque code. A caller may learn whether
// it can set a password; it may not learn whether the id was garbage, expired,
// unpaid, an upgrade session or simply somebody else's — and it must never see
// a Stripe error string. src/lib/billing/guest-welcome.ts holds the reasoning
// and the compare-and-swap that makes the id single-use.
//
// It lives under /api/auth/ because the proxy's publicPaths already covers that
// prefix — an anonymous caller is the only kind this endpoint ever has. The
// static `guest` segment wins over NextAuth's catch-all, exactly as the
// neighbouring /api/auth/register does.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/infrastructure/observability/logger";
import { resolveGuestSession, setGuestPassword } from "@/lib/billing/guest-welcome";

const log = logger.child({ module: "guest-auth" });

/** Matches registerSchema's password rule — one bar for setting a password. */
const bodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
});

/**
 * The single reject. No reason, no detail, no Stripe.
 *
 * A FUNCTION, not a shared constant. A NextResponse body is a stream that can
 * only be read once, so a module-level instance serves its JSON to the first
 * caller and an empty body to every caller after it — which reads, from the
 * client, as a 400 with no message at all.
 */
const reject = () => NextResponse.json({ error: "invalid_session" }, { status: 400 });

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("s") ?? "";

  // Polled by the wait state every few seconds; generous, but not unbounded.
  const ip = getClientIp(req.headers);
  const limit = await rateLimit(`guest-status-ip:${ip}`, 60, 300_000);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const state = await resolveGuestSession(sessionId);
  // `kind` alone. The email and plan name on a `ready` state are already known
  // to whoever holds the session id, but there is no reason to echo them into a
  // polling response.
  return NextResponse.json({ status: state.kind });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  // Tighter than the poller: this one writes.
  const limit = await rateLimit(`guest-password-ip:${ip}`, 10, 300_000);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    // A short password and a malformed body are both just "no". The client
    // enforces the length rule itself and shows its own message.
    return reject();
  }

  const result = await setGuestPassword(parsed.sessionId, parsed.password);
  if (!result.ok) {
    log.warn({ ip, reason: result.reason }, "guest password set refused");
    // `pending` and `consumed` are distinguishable states on GET, where they
    // drive the page. On the write they are not: both mean "you may not set a
    // password with this", which is the only thing the caller needs.
    return reject();
  }

  // The client signs in from here with next-auth's own credentials call — the
  // session cookie has to be minted by NextAuth, not by this route.
  return NextResponse.json({ ok: true, email: result.email, planHome: result.planHome });
}
