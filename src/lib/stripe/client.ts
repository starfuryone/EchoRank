// Singleton Stripe client.
//
// The key is read from process.env at call time, never at module load: which
// env file is loaded (.env vs .env.sandbox) is a deploy-time decision, and
// reading at import would freeze whichever happened to be present when the
// module was first pulled in. Nothing here hardcodes a key or a mode — live
// and sandbox differ only by the value of STRIPE_SECRET_KEY.

import Stripe from "stripe";

let cached: Stripe | null = null;
let cachedKey: string | null = null;

/**
 * The shared Stripe client. Throws when STRIPE_SECRET_KEY is absent rather
 * than constructing a client that fails later inside a request — a missing
 * key is a deploy fault and should read as one.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  // Re-instantiate if the key changed (test setups swap it between cases);
  // otherwise reuse, so we keep one connection pool per process.
  if (!cached || cachedKey !== key) {
    cached = new Stripe(key);
    cachedKey = key;
  }
  return cached;
}
