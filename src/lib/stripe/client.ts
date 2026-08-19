// Singleton Stripe client.
//
// The key is read from process.env at call time, never at module load: which
// env file is loaded (.env vs .env.sandbox) is a deploy-time decision, and
// reading at import would freeze whichever happened to be present when the
// module was first pulled in. Nothing here hardcodes a key or a mode — live
// and sandbox differ only by the value of STRIPE_SECRET_KEY.
//
// EVERY Stripe call in this app comes through here, including the webhook
// route's signature verification. That route used to construct its own client
// from the same env var, which was not a second key so much as a second place
// for the boot guard below to not apply — the whole point of the guard is that
// there is nowhere left to bypass it.
//
// No apiVersion is pinned, deliberately and unchanged. The SDK defaults to the
// version its types were generated against, so pinning a string here can only
// disagree with those types; the one place a version actually matters —
// subscription period dates moving onto the item — is already handled by
// reading `items.data[0].current_period_*` in the webhook.

import Stripe from "stripe";

let cached: Stripe | null = null;
let cachedKey: string | null = null;

/**
 * The dev instance runs on 4501. A live key there is not a configuration
 * mistake to be logged, it is real money moving against real customers, and it
 * has happened three times in one day. So the process refuses to construct a
 * client at all rather than trusting whoever loaded the env.
 *
 * The check is on PORT alone. That is the one variable the sandbox is
 * *defined* by (`.env.sandbox` sets it, pm2 runs `echorank-sandbox-web` with
 * it), and it cannot be silently inherited from the live config the way a
 * NODE_ENV or a custom flag can. Production sets PORT=4400 and is unaffected;
 * a process with no PORT at all — a worker, a test, a script — is unaffected
 * too, because this guard is about the dev *instance*, not about dev intent.
 */
function assertKeyAllowedForPort(key: string): void {
  if (process.env.PORT !== "4501") return;
  if (key.startsWith("sk_test_")) return;
  throw new Error(
    "Refusing to construct a Stripe client: PORT=4501 is the sandbox instance " +
      "and STRIPE_SECRET_KEY is not a sk_test_ key. Point .env.sandbox at the " +
      "Stripe test mode key. (Three live-key incidents in one day is why this " +
      "throws instead of warning.)",
  );
}

/**
 * The shared Stripe client. Throws when STRIPE_SECRET_KEY is absent rather
 * than constructing a client that fails later inside a request — a missing
 * key is a deploy fault and should read as one. Throws for the same reason
 * when the sandbox has been handed a live key; see assertKeyAllowedForPort.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  // Before the cache, not after: a cached client from an earlier key must not
  // let a subsequent bad key through unchecked.
  assertKeyAllowedForPort(key);
  // Re-instantiate if the key changed (test setups swap it between cases);
  // otherwise reuse, so we keep one connection pool per process.
  if (!cached || cachedKey !== key) {
    cached = new Stripe(key);
    cachedKey = key;
  }
  return cached;
}
