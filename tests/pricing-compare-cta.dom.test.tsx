/**
 * @vitest-environment jsdom
 */
// CompareCta in the browser: signed out it scrolls to the plan cards; once the
// session probe (useSignedIn, the top nav's) says signed in, the primary is
// "Go to dashboard" → /dashboard and the secondary stays the free tools.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompareCta } from "@/app/[locale]/pricing/CompareCta";
import { PRICING_PAGE_COPY, fill } from "@/lib/pricing-page/copy";
import { pricingBase } from "@/lib/pricing-page/format";
import { TRIAL_DAYS } from "@/lib/plan-config";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DASHBOARD: Record<string, string> = {
  en: "Go to dashboard",
  "en-CA": "Go to dashboard",
  fr: "Aller au tableau de bord",
  "fr-CA": "Aller au tableau de bord",
  "de-CH": "Zum Dashboard",
};

function mount(locale: string) {
  const c = PRICING_PAGE_COPY[pricingBase(locale)];
  return render(
    <CompareCta
      trialLabel={fill(c.compareTrialCta, { days: TRIAL_DAYS })}
      dashboardLabel={c.compareDashboardCta}
      freeToolsLabel={c.compareFreeToolsCta}
      freeToolsHref={`/${locale}/free-tools`}
    />,
  );
}

function session(user: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => (user ? { user: { id: "u1" } } : {}) })),
  );
}

describe("CompareCta", () => {
  it.each(Object.keys(DASHBOARD))("signed in (%s): Go to dashboard → /dashboard, free tools unchanged", async (locale) => {
    session(true);
    const { container } = mount(locale);
    await waitFor(() => expect(screen.getByText(DASHBOARD[locale])).toBeTruthy());
    const primary = container.querySelector('[data-cta="primary"]')!;
    const secondary = container.querySelector('[data-cta="secondary"]')!;
    expect(primary.textContent).toBe(DASHBOARD[locale]);
    expect(primary.getAttribute("href")).toBe("/dashboard");
    expect(secondary.getAttribute("href")).toBe(`/${locale}/free-tools`);
    expect(secondary.textContent).toBe(PRICING_PAGE_COPY[pricingBase(locale)].compareFreeToolsCta);
  });

  it("signed out: stays the trial button, and smooth-scrolls to the plan cards", async () => {
    session(false);
    const cards = document.createElement("section");
    cards.id = "pricing";
    const scrollIntoView = vi.fn();
    cards.scrollIntoView = scrollIntoView;
    document.body.appendChild(cards);
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));

    const { container } = mount("en");
    await Promise.resolve();
    const primary = container.querySelector('[data-cta="primary"]')!;
    expect(primary.textContent).toBe(`Start your ${TRIAL_DAYS}-day free trial`);
    expect(primary.getAttribute("href")).toBe("#pricing");

    const ev = fireEvent.click(primary);
    expect(ev).toBe(false); // default jump prevented
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(location.hash).toBe("#pricing");
    cards.remove();
  });

  it("jumps without animation under reduced motion", () => {
    session(false);
    const cards = document.createElement("section");
    cards.id = "pricing";
    const scrollIntoView = vi.fn();
    cards.scrollIntoView = scrollIntoView;
    document.body.appendChild(cards);
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));

    const { container } = mount("fr");
    fireEvent.click(container.querySelector('[data-cta="primary"]')!);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    cards.remove();
  });
});
