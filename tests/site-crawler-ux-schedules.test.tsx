// @vitest-environment jsdom
//
// tests/site-crawler-ux-schedules.test.tsx — /crawler/schedules (UX
// restructure): the editor and list live on their own view, run with the
// host's saved defaults, and are gone from the Start view's Configuration.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.schedule": true };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] === true };
});

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { CrawlSchedulesView } from "@/components/seo-tools/site-crawler-schedules-view";
import { SiteCrawlerClient } from "@/components/seo-tools/site-crawler-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const quota = { urlCap: 5000, renderCap: 0, monthlyLimit: 20, used: 0, remaining: 20, allowed: true, locked: false, crawlsKept: 10, scheduleCap: 2, scheduleCadences: ["weekly", "monthly"] };

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      if (u === "/api/seo/v1/crawl") return { ok: true, json: async () => ({ crawls: [], quota }) };
      if (u === "/api/seo/v1/crawl/schedules") return { ok: true, json: async () => ({ schedules: [], cap: 2, cadences: ["weekly", "monthly"], timezone: "UTC" }) };
      if (u.startsWith("/api/seo/v1/crawl/sites?host=shop.example")) return { ok: true, json: async () => ({ host: "shop.example", verified: false, defaults: null }) };
      return { ok: false, json: async () => null };
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

describe.each(["en", "fr", "de-CH"] as const)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  it("shows the editor with a labelled URL field and says which settings a schedule runs with", async () => {
    await act(async () => root.render(<CrawlSchedulesView locale={l} />));
    await vi.waitFor(() => expect(el.querySelector("#schedule-cadence")).not.toBeNull());
    expect(el.querySelector('label[for="schedule-url"]')!.textContent).toBe(t.ux.schSiteUrl);
    expect(el.querySelector('nav [aria-current="page"]')!.textContent).toBe(t.ux.navSchedules);
    const input = el.querySelector<HTMLInputElement>("#schedule-url")!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(input, "shop.example");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await vi.waitFor(() => expect(el.querySelector('[data-testid="schedule-config"]')!.textContent).toBe(t.ux.schNoDefaults("shop.example")), { timeout: 2000 });
  });
});

it("the Start view no longer carries the schedule editor", async () => {
  await act(async () => root.render(<SiteCrawlerClient locale="en" view="start" />));
  await vi.waitFor(() => expect(el.querySelector("#crawl-advanced")).not.toBeNull());
  expect(el.querySelector("#schedule-cadence")).toBeNull();
  expect(el.querySelector("#crawl-schedules-title")).toBeNull();
});
