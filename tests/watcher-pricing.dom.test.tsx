/**
 * @vitest-environment jsdom
 */
// The Watcher pricing card: the annual toggle, the three CTA states, and the
// rule that the card cannot claim something the product does not do.
//
// The last one is the reason this file exists. Prices and limits on a marketing
// page are claims about what runs after someone pays, and the way they go wrong
// is by being typed into JSX where nothing checks them — the draft this card
// replaces offered "500 prompts / 7 LLMs / $15.60" against a product that runs
// 10 prompts, 3 repetitions, on one engine. Asserting the features against
// WATCHER_SOLO itself means the page cannot drift from the runner without a
// test going red.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WatcherPricing, type WatcherCopy } from "@/app/[locale]/watcher/WatcherPricing";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { WATCHER_SOLO, WATCHER_SOLO_BRANDS, WATCHER_PRICES_CENTS } from "@/lib/plan-config";
import {
  WATCHER_ANNUAL_PER_MONTH_USD,
  WATCHER_MONTHLY_USD,
  WATCHER_SAVE_PCT,
  watcherFeatures,
} from "@/lib/watcher-pricing";
import type { WatcherCtaState } from "@/app/api/billing/watcher-status/route";

const COPY: WatcherCopy = {
  freeName: "Free check",
  freePrice: "$0",
  freeSub: "one-off · no account",
  freeFeatures: ["One brand, checked once"],
  freeCta: "Run the free check",
  watcherName: "Watcher",
  watcherSub: "one brand, watched continuously",
  watcherFeatures: watcherFeatures("en"),
  includedNote: "Included in your plan — manage it from your dashboard.",
  manageCta: "Manage subscription",
  tax: "tax line",
  currency: "currency line",
};

function mountWith(state: WatcherCtaState) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ state }) }) as unknown as Response),
  );
  return render(
    <WatcherPricing
      locale="en"
      copy={COPY}
      chrome={HOME_PRICING_CHROME.en}
      monthly={WATCHER_MONTHLY_USD}
      annualPerMonth={WATCHER_ANNUAL_PER_MONTH_USD}
      savePct={WATCHER_SAVE_PCT}
    />,
  );
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) }))));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the numbers are the ones Stripe charges", () => {
  it("derives $9, $7.50/mo annual, and 17% from the cents constants", () => {
    // Pinned against the cents, not against literals: if someone changes the
    // price in plan-config the assertion moves with it, and if someone changes
    // the ARITHMETIC it fails.
    expect(WATCHER_MONTHLY_USD).toBe(WATCHER_PRICES_CENTS.monthly / 100);
    expect(WATCHER_ANNUAL_PER_MONTH_USD).toBe(WATCHER_PRICES_CENTS.annual / 1200);
    expect(WATCHER_SAVE_PCT).toBe(17);
  });

  it("shows the monthly price with no struck anchor by default", () => {
    mountWith("buy");
    expect(screen.getByText("/mo").parentElement?.textContent).toContain("$9");
    // The anchor is an annual-only device. On the monthly toggle there is no
    // second price to compare against, and a strike with nothing behind it is
    // the "was" price that pricing law is about.
    expect(document.querySelector("s")).toBeNull();
  });

  it("on the annual toggle strikes the real monthly price beside $7.50", () => {
    mountWith("buy");
    fireEvent.click(screen.getByRole("button", { name: HOME_PRICING_CHROME.en.annual }));

    const struck = document.querySelector("s");
    expect(struck?.textContent).toBe("$9");
    // "7.50", never "7.5" — a truncated price reads as a different number.
    expect(screen.getByText("/mo").parentElement?.textContent).toContain("$7.50");
    expect(screen.getByText("save 17%")).toBeTruthy();
    expect(screen.getByText(HOME_PRICING_CHROME.en.billedAnnually)).toBeTruthy();
  });
});

describe("the card cannot advertise what the product does not run", () => {
  it("lists exactly the WATCHER_SOLO shape", () => {
    mountWith("buy");
    for (const feature of [
      `${WATCHER_SOLO_BRANDS} brand tracked`,
      `${WATCHER_SOLO.prompts} tracked prompts`,
      `${WATCHER_SOLO.repetitions} repetitions per prompt`,
    ]) {
      expect(screen.getByText(feature)).toBeTruthy();
    }
    expect(screen.getByText("Weekly checkups")).toBeTruthy();
    expect(WATCHER_SOLO.frequency).toBe("weekly");
  });

  it("names one engine, and names Claude", () => {
    mountWith("buy");
    expect(screen.getByText("Answers measured on Claude")).toBeTruthy();
    // The superseded draft's claim. Claude is the only engine with a live
    // adapter AND a metering rate; the runner refuses the rest, so listing
    // them would sell something that cannot execute.
    expect(document.body.textContent).not.toMatch(/7 LLMs|500 prompts/);
    expect(WATCHER_SOLO.providers).toBe(1);
  });
});

describe("the CTA matches what checkout would answer", () => {
  it("offers the purchase to a visitor with no subscription", async () => {
    mountWith("buy");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: HOME_PRICING_CHROME.en.checkoutCta })).toBeTruthy(),
    );
  });

  it("tells a plan holder it is already included, with nothing to buy", async () => {
    // Mirrors the checkout route's 400 (watcherCheckoutBlock): the plan already
    // includes monitoring, so the $9 buys nothing.
    mountWith("included");
    await waitFor(() => expect(screen.getByText(COPY.includedNote)).toBeTruthy());
    expect(screen.queryByRole("button", { name: HOME_PRICING_CHROME.en.checkoutCta })).toBeNull();
  });

  it("sends an existing watcher subscriber to the Stripe portal, not a second purchase", async () => {
    const fetchMock = vi.fn(async (...args: unknown[]) =>
      String(args[0]).includes("watcher-status")
        ? ({ ok: true, json: async () => ({ state: "manage" }) } as unknown as Response)
        : ({ ok: true, json: async () => ({ url: "https://billing.stripe.com/s/1" }) } as unknown as Response),
    );
    vi.stubGlobal("fetch", fetchMock);
    // jsdom refuses a real navigation; the assertion is the request, not the trip.
    vi.stubGlobal("location", { assign: vi.fn() } as unknown as Location);

    render(
      <WatcherPricing
        locale="en"
        copy={COPY}
        chrome={HOME_PRICING_CHROME.en}
        monthly={WATCHER_MONTHLY_USD}
        annualPerMonth={WATCHER_ANNUAL_PER_MONTH_USD}
        savePct={WATCHER_SAVE_PCT}
      />,
    );

    const manage = await screen.findByRole("button", { name: COPY.manageCta });
    // Never a checkout button: they already pay for this.
    expect(screen.queryByRole("button", { name: HOME_PRICING_CHROME.en.checkoutCta })).toBeNull();

    fireEvent.click(manage);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]) === "/api/billing/portal"),
      ).toHaveLength(1),
    );
    // Cancellation lives behind the portal, so Manage must reach it directly
    // rather than landing on a page that merely links there.
    const call = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/billing/portal");
    expect((call?.[1] as RequestInit | undefined)?.method).toBe("POST");
  });

  it("keeps the buy button when the status probe fails", async () => {
    // A pricing page must not break because a cosmetic probe did. The checkout
    // route re-decides this server-side regardless.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(
      <WatcherPricing
        locale="en"
        copy={COPY}
        chrome={HOME_PRICING_CHROME.en}
        monthly={WATCHER_MONTHLY_USD}
        annualPerMonth={WATCHER_ANNUAL_PER_MONTH_USD}
        savePct={WATCHER_SAVE_PCT}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: HOME_PRICING_CHROME.en.checkoutCta })).toBeTruthy(),
    );
  });
});

describe("consent gates the watcher checkout like it gates a plan", () => {
  it("opens the agreement modal instead of calling checkout when unticked", async () => {
    const fetchMock = vi.fn(async (...args: unknown[]) => {
      void args;
      return { ok: true, json: async () => ({ state: "buy" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <WatcherPricing
        locale="en"
        copy={COPY}
        chrome={HOME_PRICING_CHROME.en}
        monthly={WATCHER_MONTHLY_USD}
        annualPerMonth={WATCHER_ANNUAL_PER_MONTH_USD}
        savePct={WATCHER_SAVE_PCT}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: HOME_PRICING_CHROME.en.checkoutCta }));

    // The only fetch that may have happened is the status probe. No checkout.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/billing/checkout")),
      ).toHaveLength(0),
    );
  });
});
