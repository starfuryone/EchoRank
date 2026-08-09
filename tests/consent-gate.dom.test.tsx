/**
 * @vitest-environment jsdom
 */
// The consent gate's INTERACTION, in a real DOM — driven through PricingSection
// because that is where the two checkboxes and the checkout request meet.
//
// The companion suite (consent-gate.test.ts) covers the config-driven markup and
// the server's validation. This one covers what only a document can:
//
//  - the modal's checkbox and the page's are ONE value, not two that agree by
//    luck until someone adds local state to the dialog;
//  - accepting inside the dialog checks out the plan and interval that were
//    blocked, with no second trip to the card. A regression here does not throw
//    — it quietly bills an annual buyer monthly, or checks out the first card on
//    the page — so the assertion is on the request body, not on "a fetch happened";
//  - closing the dialog never edits consent in either direction.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PricingSection, type HomePricingTier } from "@/app/[locale]/PricingSection";
import { CONSENT_COPY, HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { CONSENT_DOCUMENT_IDS, CONSENT_VERSION } from "@/lib/consent-config";

const chrome = HOME_PRICING_CHROME.en;
const copy = CONSENT_COPY.en;

/** Two paid tiers and the custom one, which must never grow a checkout button. */
const TIERS: HomePricingTier[] = [
  {
    id: "STARTER",
    name: "Starter",
    monthly: 29,
    annual: 24,
    customLabel: null,
    savePct: 17,
    features: ["a"],
    highlighted: false,
  },
  {
    id: "GROWTH",
    name: "Growth",
    monthly: 79,
    annual: 65,
    customLabel: null,
    savePct: 18,
    features: ["b"],
    highlighted: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    monthly: null,
    annual: null,
    customLabel: "Contact us",
    savePct: null,
    features: ["c"],
    highlighted: false,
  },
];

let fetchMock: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ url: "https://checkout.stripe.test/session" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  // The success path leaves the app for Stripe; jsdom cannot navigate, and an
  // unstubbed assign would throw "Not implemented" instead of failing loudly.
  assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "http://localhost/en", assign },
  });
  // jsdom implements no scrolling at all. LegalDocModal resets its body's
  // scroll offset when a document opens, which is a real call on a real
  // element — without this it throws where a browser would simply scroll.
  Element.prototype.scrollTo ??= () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPricing() {
  return render(
    <PricingSection
      locale="en"
      pricing={TIERS}
      priceChrome={chrome}
      liveToolCount={20}
      tax="Taxes may apply."
      currency="Prices in USD."
      header={<h2>Pricing</h2>}
    />,
  );
}

/** The plan cards' CTAs, in grid order: Starter, Growth. */
const cardCtas = () =>
  screen
    .getAllByRole("button", { name: chrome.checkoutCta })
    .filter((b) => !b.closest('[role="dialog"]'));

const dialog = () => screen.getByRole("dialog");
const modalBox = () => within(dialog()).getByRole("checkbox");
const modalCta = () => within(dialog()).getByRole("button", { name: chrome.checkoutCta });
const pageBox = () =>
  screen.getAllByRole("checkbox").find((b) => !b.closest('[role="dialog"]')) as HTMLInputElement;

/** The parsed body of the one checkout request that was made. */
function checkoutBody() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/billing/checkout");
  return JSON.parse(String(init.body));
}

describe("a blocked CTA opens the modal", () => {
  it("opens it unchecked, and makes no network call", () => {
    renderPricing();
    fireEvent.click(cardCtas()[1]);
    expect(dialog()).toBeInTheDocument();
    expect(modalBox()).not.toBeChecked();
    expect(pageBox()).not.toBeChecked();
    // The gate is BEFORE the request; a 400 from the route is the backstop,
    // not the mechanism.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not open when consent is already on record", () => {
    renderPricing();
    fireEvent.click(pageBox());
    fireEvent.click(cardCtas()[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(checkoutBody().tier).toBe("starter");
  });
});

describe("the two checkboxes are one value", () => {
  it("checks the page row when the dialog's is ticked", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    fireEvent.click(modalBox());
    expect(modalBox()).toBeChecked();
    expect(pageBox()).toBeChecked();
  });

  it("checks the dialog row when the page's was ticked first", () => {
    renderPricing();
    fireEvent.click(pageBox());
    // Consent is on record, so no CTA opens the dialog any more — tick it back
    // off and on to prove the dialog reads the live value rather than a copy
    // taken when it mounted.
    fireEvent.click(pageBox());
    fireEvent.click(cardCtas()[0]);
    expect(modalBox()).not.toBeChecked();
    fireEvent.click(pageBox());
    expect(modalBox()).toBeChecked();
  });

  it("unchecks both when either is cleared", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    fireEvent.click(modalBox());
    fireEvent.click(modalBox());
    expect(modalBox()).not.toBeChecked();
    expect(pageBox()).not.toBeChecked();
  });
});

describe("the dialog's checkout button", () => {
  it("is disabled until the box is ticked, and enables with it", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    expect(modalCta()).toBeDisabled();
    fireEvent.click(modalBox());
    expect(modalCta()).toBeEnabled();
    fireEvent.click(modalBox());
    expect(modalCta()).toBeDisabled();
  });

  it("wears the cards' own label, not a second one", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    expect(modalCta()).toHaveTextContent(chrome.checkoutCta);
  });

  it("checks out the plan and interval that were blocked, in one click", async () => {
    renderPricing();
    // Annual, and the SECOND card — the two things a resumed checkout most
    // easily loses.
    fireEvent.click(screen.getByRole("button", { name: chrome.annual }));
    fireEvent.click(cardCtas()[1]);
    fireEvent.click(modalBox());
    await act(async () => {
      fireEvent.click(modalCta());
    });

    const body = checkoutBody();
    expect(body.tier).toBe("growth");
    expect(body.interval).toBe("year");
    expect(body.locale).toBe("en");
    // The same payload shape the route validates, built at click time.
    expect(body.consent.accepted).toBe(true);
    expect(body.consent.version).toBe(CONSENT_VERSION);
    expect([...body.consent.documents].sort()).toEqual([...CONSENT_DOCUMENT_IDS].sort());
    expect(Date.parse(body.consent.timestamp)).not.toBeNaN();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.test/session"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the monthly interval when the toggle was never moved", async () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    fireEvent.click(modalBox());
    await act(async () => {
      fireEvent.click(modalCta());
    });
    expect(checkoutBody().interval).toBe("month");
    expect(checkoutBody().tier).toBe("starter");
  });
});

describe("closing the dialog leaves consent alone", () => {
  it("keeps a box ticked in the dialog ticked, and checks nothing out", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    fireEvent.click(modalBox());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pageBox()).toBeChecked();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves an untouched box unticked on Esc and on Close", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(pageBox()).not.toBeChecked();

    fireEvent.click(cardCtas()[0]);
    fireEvent.click(within(dialog()).getByRole("button", { name: copy.modalClose }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pageBox()).not.toBeChecked();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forgets the pending plan, so the next card is the one that checks out", async () => {
    renderPricing();
    fireEvent.click(cardCtas()[1]);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(cardCtas()[0]);
    fireEvent.click(modalBox());
    await act(async () => {
      fireEvent.click(modalCta());
    });
    expect(checkoutBody().tier).toBe("starter");
  });
});

describe("keyboard and focus", () => {
  it("moves focus to the dialog's checkbox on open", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    expect(modalBox()).toHaveFocus();
  });

  it("returns focus to the button that opened it", () => {
    renderPricing();
    const trigger = cardCtas()[1];
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
  });

  it("keeps the reminder open when Esc dismisses a document read from inside it", async () => {
    renderPricing();
    fireEvent.click(cardCtas()[1]);
    fireEvent.click(within(dialog()).getAllByRole("link")[0]);
    // The document dialog is a dynamic import; wait for its chunk.
    const doc = await screen.findByRole("dialog", { name: copy.subscriptionAgreement });

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    // BOTH listeners sit on `document`, where stopPropagation does not separate
    // them. One Esc closing both would drop the plan the buyer had picked and
    // send them back to the grid to start over.
    expect(doc).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: copy.modalTitle })).toBeInTheDocument();

    fireEvent.click(modalBox());
    await act(async () => {
      fireEvent.click(modalCta());
    });
    expect(checkoutBody().tier).toBe("growth");
  });

  it("traps Tab inside the dialog", () => {
    renderPricing();
    fireEvent.click(cardCtas()[0]);
    const focusables = [
      ...dialog().querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])',
      ),
    ];
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // Wrapped to the first focusable rather than escaping to the pricing cards.
    expect(focusables[0]).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
