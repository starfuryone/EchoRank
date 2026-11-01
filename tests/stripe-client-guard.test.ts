// tests/stripe-client-guard.test.ts
//
// THE SANDBOX BOOT GUARD. Three live-key incidents happened on this box in one
// day; the guard makes a fourth impossible on the dev instance by refusing to
// construct a client at all rather than logging and continuing.
//
// PORT=4501 IS THE WHOLE CONDITION, and that is deliberate. It is the one
// variable the sandbox is DEFINED by — .env.sandbox sets it and pm2 runs
// echorank-sandbox-web with it — so it cannot be silently inherited from the
// live config the way a NODE_ENV or a hand-rolled flag can. Production (4400)
// and every process with no PORT at all (workers, scripts, this test file) are
// unaffected: the guard is about the dev INSTANCE, not about dev intent.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = { PORT: process.env.PORT, KEY: process.env.STRIPE_SECRET_KEY };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL.PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL.PORT;
  if (ORIGINAL.KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL.KEY;
});

async function getStripeFresh() {
  // Fresh module each time: the client is cached by key, and a cached instance
  // from a previous case would hide the guard.
  const mod = await import("@/lib/stripe/client");
  return mod.getStripe;
}

describe("the sandbox guard", () => {
  it("REFUSES a live key on port 4501", async () => {
    process.env.PORT = "4501";
    process.env.STRIPE_SECRET_KEY = "sk_live_pretend";
    const getStripe = await getStripeFresh();

    expect(() => getStripe()).toThrow(/PORT=4501/);
  });

  it("refuses a restricted live key too — only sk_test_ passes", async () => {
    // rk_live_ and any other non-test prefix must not slip through a check
    // written as "does it look live?" rather than "is it test?".
    process.env.PORT = "4501";
    process.env.STRIPE_SECRET_KEY = "rk_live_pretend";
    const getStripe = await getStripeFresh();

    expect(() => getStripe()).toThrow();
  });

  it("allows a test key on port 4501", async () => {
    process.env.PORT = "4501";
    process.env.STRIPE_SECRET_KEY = "sk_test_pretend";
    const getStripe = await getStripeFresh();

    expect(() => getStripe()).not.toThrow();
  });

  it("does NOT touch production — a live key on 4400 is fine", async () => {
    // The guard failing closed everywhere would take the live site down, which
    // is a worse outage than the one it prevents.
    process.env.PORT = "4400";
    process.env.STRIPE_SECRET_KEY = "sk_live_pretend";
    const getStripe = await getStripeFresh();

    expect(() => getStripe()).not.toThrow();
  });

  it("does not touch a process with no PORT — workers, scripts, tests", async () => {
    delete process.env.PORT;
    process.env.STRIPE_SECRET_KEY = "sk_live_pretend";
    const getStripe = await getStripeFresh();

    expect(() => getStripe()).not.toThrow();
  });

  it("still reports a missing key as a missing key, not as a guard failure", async () => {
    process.env.PORT = "4501";
    delete process.env.STRIPE_SECRET_KEY;
    const getStripe = await getStripeFresh();

    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY is not configured/);
  });

  it("re-checks when the key changes, rather than trusting the cache", async () => {
    // The cached client is keyed on the secret. A process that constructed a
    // good client and then had a live key swapped in must not keep serving.
    process.env.PORT = "4501";
    process.env.STRIPE_SECRET_KEY = "sk_test_pretend";
    const getStripe = await getStripeFresh();
    expect(() => getStripe()).not.toThrow();

    process.env.STRIPE_SECRET_KEY = "sk_live_pretend";
    expect(() => getStripe()).toThrow(/PORT=4501/);
  });
});
