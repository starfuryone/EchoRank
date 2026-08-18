// src/lib/billing/guest-welcome.ts
//
// WHERE A CHECKOUT SESSION ID STOPS BEING A DISPLAY HINT AND BECOMES A
// CREDENTIAL.
//
// /welcome's original contract was "it confirms, it does not entitle": the id
// in the URL is user-supplied, a visitor could paste anyone's, and nothing on
// the page read or changed state. That contract still holds for flow=upgrade,
// and this module does not touch it.
//
// For flow=guest_signup it cannot hold, because the id is the ONLY thing the
// buyer has. There is no account to log into yet — that is the whole point of
// the inversion — so the id has to be what authorises setting the first
// password. Four things make that safe:
//
//   1. IT IS READ SERVER-SIDE, ALWAYS. stripe.checkout.sessions.retrieve from
//      a route handler or a server component. A client-side read would mean
//      shipping a Stripe key, and would let the caller decide what the session
//      said.
//   2. IT MUST BE COMPLETE AND IT MUST BE OURS. status === "complete" AND
//      metadata.flow === "guest_signup". An abandoned session, a session for
//      an upgrade, and a session created somewhere else all fail this.
//   3. IT IS SINGLE-USE, AND THE MARKER IS User.passwordHash ITSELF.
//      No consumedAt column, no second table. The thing the session id
//      authorises is "set the first password", and passwordHash IS the record
//      of whether that has happened — a separate marker could only ever drift
//      out of step with it, and would need its own migration to add. Consumed
//      is therefore set when the password is set, not on page view, exactly as
//      required. The write itself is a compare-and-swap on passwordHash: NULL
//      (see setGuestPassword), so two concurrent attempts cannot both win.
//   4. EVERY FAILURE LOOKS THE SAME. resolveGuestSession collapses garbage,
//      expired, incomplete, wrong-flow and unknown into one `invalid`, and the
//      route returns one opaque code for all of them. A caller learns whether
//      it may set a password and nothing else — never a Stripe error string,
//      never which of the five it was.
//
// The remaining state is the interesting one operationally: `pending`, where
// the session is valid but the webhook has not provisioned yet. The buyer can
// and does beat Stripe's delivery. That must render a wait, never a form
// against a user row that does not exist.

import "server-only";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { logger } from "@/infrastructure/observability/logger";
import { GUEST_SIGNUP_FLOW } from "@/lib/billing/guest-signup";
import { hashPassword } from "@/lib/password";
import { PLAN_HOME } from "@/lib/plan-routing";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";

const log = logger.child({ module: "guest-welcome" });

export type GuestSessionState =
  /** Provisioned, password not set yet. The only state that renders a form. */
  | { kind: "ready"; email: string; planName: string; planHome: string }
  /** Valid session, webhook has not landed yet. Poll, do not render a form. */
  | { kind: "pending" }
  /** The password has already been set. Not an error — send them to /login. */
  | { kind: "consumed" }
  /** Garbage, expired, unpaid, or somebody else's flow. One state for all. */
  | { kind: "invalid" };

/** Cheap shape check before spending a Stripe call on obvious junk. */
export function looksLikeSessionId(value: unknown): value is string {
  return typeof value === "string" && /^cs_[A-Za-z0-9_]{8,120}$/.test(value);
}

interface ValidGuestSession {
  email: string;
  planName: string;
  planHome: string;
}

/**
 * Retrieve and vet the session. Returns null for every reject reason — the
 * caller must not be able to tell them apart, and neither must its logs
 * leak a Stripe error object to the response.
 */
async function loadGuestSession(sessionId: string): Promise<ValidGuestSession | null> {
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    // Expected for a mistyped, expired or foreign id. Logged, never returned.
    log.info({ err, sessionId }, "guest session could not be retrieved");
    return null;
  }

  if (session.status !== "complete") {
    log.info({ sessionId, status: session.status }, "guest session is not complete");
    return null;
  }
  if (session.metadata?.flow !== GUEST_SIGNUP_FLOW) {
    // An upgrade session pasted in here is a real case, not an attack: the
    // success_url shape is the same. It gets the display-hint page instead.
    log.info({ sessionId, flow: session.metadata?.flow ?? null }, "session is not a guest signup");
    return null;
  }

  const email = (session.customer_details?.email ?? session.customer_email ?? "")
    .toLowerCase()
    .trim();
  if (!email) {
    log.error({ sessionId }, "complete guest session with no email");
    return null;
  }

  const tier = String(session.metadata?.tier ?? "").toUpperCase();
  const planType = PLAN_ORDER.find((p) => p === tier) ?? null;
  return {
    email,
    planName: planType ? PLAN_CONFIGS[planType].name : "Echorank",
    planHome: planType ? PLAN_HOME[planType] : "/dashboard",
  };
}

/** The page's and the poller's shared question: what should this id render? */
export async function resolveGuestSession(sessionId: string): Promise<GuestSessionState> {
  if (!looksLikeSessionId(sessionId)) return { kind: "invalid" };

  const valid = await loadGuestSession(sessionId);
  if (!valid) return { kind: "invalid" };

  const user = await prisma.user.findUnique({
    where: { email: valid.email },
    select: { passwordHash: true },
  });

  // No row yet: the buyer beat the webhook. Common, and not an error.
  if (!user) return { kind: "pending" };
  // Set already: single-use, spent. Say so plainly and point at /login.
  if (user.passwordHash) return { kind: "consumed" };

  return {
    kind: "ready",
    email: valid.email,
    planName: valid.planName,
    planHome: valid.planHome,
  };
}

export type SetPasswordResult =
  | { ok: true; email: string; planHome: string }
  | { ok: false; reason: "invalid" | "pending" | "consumed" };

/**
 * Spend the session id: set the first password, once.
 *
 * The write is `updateMany({ where: { email, passwordHash: null } })` and the
 * result is checked for a count of exactly 1. That is a compare-and-swap, not a
 * read-then-write: two requests arriving together both pass resolveGuestSession
 * above, and the database — not the ordering of two round trips — decides which
 * one is the first password. The loser is told `consumed`, which is true.
 */
export async function setGuestPassword(
  sessionId: string,
  password: string,
): Promise<SetPasswordResult> {
  if (!looksLikeSessionId(sessionId)) return { ok: false, reason: "invalid" };

  const valid = await loadGuestSession(sessionId);
  if (!valid) return { ok: false, reason: "invalid" };

  const user = await prisma.user.findUnique({
    where: { email: valid.email },
    select: { id: true, passwordHash: true },
  });
  if (!user) return { ok: false, reason: "pending" };
  if (user.passwordHash) return { ok: false, reason: "consumed" };

  const passwordHash = await hashPassword(password);
  const { count } = await prisma.user.updateMany({
    // The null in the WHERE is the lock. Dropping it turns this endpoint into
    // a password reset that anyone holding a spent session id can call.
    where: { id: user.id, passwordHash: null },
    data: { passwordHash },
  });
  if (count !== 1) {
    log.warn({ sessionId, userId: user.id }, "guest password lost the compare-and-swap");
    return { ok: false, reason: "consumed" };
  }

  log.info({ sessionId, userId: user.id }, "guest password set — session consumed");
  return { ok: true, email: valid.email, planHome: valid.planHome };
}
