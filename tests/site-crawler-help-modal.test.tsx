// @vitest-environment jsdom
//
// tests/site-crawler-help-modal.test.tsx — the crawler's in-app help: the
// Help button (now a <button>) opens <CrawlerHelpModal>, a role="dialog"
// labelled by its title; the capability cards are the public page's, gated by
// the same flags and families; Escape closes it and focus returns to the
// button; ?help=1 opens it on load; the plan tab reads the tenant's quota;
// the footer opens the /learn guide in a new tab, and all the crawler guides
// beside it. In every dashboard locale.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlerHeader } from "@/components/seo-tools/site-crawler-client";
import { helpCapabilities } from "@/components/seo-tools/site-crawler-help";
import { REGISTRY_FAMILIES } from "@/lib/crawl-rules-meta";
import { FLAGS } from "@/lib/flags";
import { CRAWL_CAPABILITIES, visibleCapabilities } from "@/lib/site-crawler/marketing-copy";
import { pageHelp } from "@/lib/help-content";
import type { CrawlQuotaDto } from "@/lib/site-crawler/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;
const quota = {
  urlCap: 5000, monthlyLimit: 20, renderCap: 500, extractorCap: 5, scheduleCap: 2, crawlsKept: 10, aiPageCap: 100, psiCap: 50, backlinkCap: 50,
} as unknown as CrawlQuotaDto;

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  search = "";
  vi.unstubAllGlobals();
});

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const waitForDialog = () => vi.waitFor(() => expect(dialog()).not.toBeNull(), { timeout: 3000 });

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];

  it("the Help button is a button that opens the labelled dialog; Escape closes it and focus returns to the button", async () => {
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={quota} />));
    const button = el.querySelector<HTMLButtonElement>(`button[aria-label="${t.helpAria}"]`)!;
    expect(button).not.toBeNull();
    // The only new-tab link in the header is Guides (the crawler guides on the Knowledge Hub).
    expect([...el.querySelectorAll("a[target=_blank]")].map((a) => a.getAttribute("data-testid"))).toEqual(["guides-link"]);
    expect(dialog()).toBeNull();
    await act(async () => {
      button.focus();
      button.click();
    });
    await waitForDialog();
    const d = dialog()!;
    const labelledBy = d.getAttribute("aria-labelledby");
    expect(labelledBy && document.getElementById(labelledBy)?.textContent).toBe(t.helpModal.title);
    expect([...d.querySelectorAll('[role="tab"]')].map((x) => x.textContent)).toEqual([
      t.helpModal.tabChecks, t.helpModal.tabReading, t.helpModal.tabConfig, t.helpModal.tabPlan,
    ]);
    const guide = [...d.querySelectorAll("a")].find((a) => a.textContent === t.helpModal.guide)!;
    expect(guide.getAttribute("href")).toBe(`/${l}/learn/guides/what-nosy-bat-checks`);
    expect(guide.getAttribute("target")).toBe("_blank");
    // The footer keeps "Open the full guide" and adds every crawler guide.
    const all = [...d.querySelectorAll("a")].find((a) => a.textContent === t.helpModal.allGuides)!;
    expect(all.getAttribute("href")).toBe(`/${l}/learn/guides#nosy-bat`);
    expect(all.getAttribute("target")).toBe("_blank");
    await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await vi.waitFor(() => expect(dialog()).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("shows the public page's capability cards, gated the same way, and the tenant's plan", async () => {
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={quota} />));
    await act(async () => el.querySelector<HTMLButtonElement>(`button[aria-label="${t.helpAria}"]`)!.click());
    await waitForDialog();
    const shown = [...dialog()!.querySelectorAll("[data-cap]")].map((x) => x.getAttribute("data-cap"));
    expect(shown).toEqual(visibleCapabilities({ families: REGISTRY_FAMILIES, flags: FLAGS }).map((c) => c.id));
    const planTab = [...dialog()!.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((x) => x.textContent === t.helpModal.tabPlan)!;
    await act(async () => planTab.click());
    const text = dialog()!.textContent!;
    expect(text).toContain(t.helpModal.plan.urls);
    expect(text).toContain(new Intl.NumberFormat(l).format(5000));
    const configTab = [...dialog()!.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((x) => x.textContent === t.helpModal.tabConfig)!;
    await act(async () => configTab.click());
    expect(dialog()!.textContent).toContain(t.helpModal.verifiedTitle);
    expect(t.helpModal.verifiedWays).toHaveLength(3);
    if (l === "de-CH") expect(JSON.stringify(t.helpModal)).not.toContain("ß");
  });

  it("?help=1 opens it on load", async () => {
    search = "help=1";
    await act(async () => root.render(<CrawlerHeader t={t} locale={l} quota={quota} />));
    await waitForDialog();
  });
});

describe("gating and routing", () => {
  it("a flag turned off removes its card, exactly as on the public page", () => {
    const off = { ...FLAGS, "crawl.semantic": false };
    const ids = visibleCapabilities({ families: REGISTRY_FAMILIES, flags: off }).map((c) => c.id);
    expect(ids).not.toContain("semantic-duplicates");
    expect(helpCapabilities().map((c) => c.id)).toContain("semantic-duplicates");
    expect(helpCapabilities().length).toBeLessThanOrEqual(CRAWL_CAPABILITIES.length);
  });

  it("pageHelp points /crawler at the modal; the help hub keeps the guide card", async () => {
    expect(pageHelp["/crawler"]).toEqual({ modal: "crawler", guide: "/learn/guides/what-nosy-bat-checks" });
    const { HELP_GROUPS } = await import("@/lib/help-content");
    expect(HELP_GROUPS.flatMap((g) => g.cards).some((c) => c.kind === "guide" && c.slug === "what-nosy-bat-checks")).toBe(true);
  });
});
