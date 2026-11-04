// @vitest-environment jsdom
//
// tests/site-crawler-schedule-ui.test.tsx — /crawler/schedules in every
// dashboard locale: the hero and two columns; the form (the plan's cadences,
// the others disabled with the plan that unlocks them; time in the
// workspace's timezone with UTC under it; export targets; the cap note; the
// POST body; editing with PATCH); the saved list (host, cadence · next run in
// local time, last health with the delta on the run before, export icons, the
// on/off switch, Run now, delete with confirmation); the empty state;
// refusal copy; axe.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.schedule": true, "crawl.reports": true, "crawl.sheets": false };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] === true };
});

import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { cadenceLabel, healthDelta, safeZone, scheduleError, timeOptions, type ScheduleDto } from "@/components/seo-tools/site-crawler-schedules";
import { CrawlSchedulesView } from "@/components/seo-tools/site-crawler-schedules-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;
const ZONE = "Europe/Zurich";
const quota = { urlCap: 5000, renderCap: 0, monthlyLimit: 20, used: 0, remaining: 20, allowed: true, locked: false, crawlsKept: 10 };
const saved: ScheduleDto = {
  id: "s1",
  host: "shop.example",
  rootUrl: "https://shop.example/",
  cadence: "weekly",
  hourUtc: 3,
  enabled: true,
  nextRunAt: "2026-11-09T03:00:00.000Z",
  exportTo: { email: true, sheets: null },
  lastHealth: 74,
  prevHealth: 70,
};
const second: ScheduleDto = {
  ...saved,
  id: "s2",
  host: "blog.example",
  rootUrl: "https://blog.example/",
  cadence: "monthly",
  enabled: false,
  exportTo: null,
  lastHealth: null,
  prevHealth: null,
};

let el: HTMLDivElement;
let root: Root;
let calls: { url: string; init?: RequestInit }[];
let schedules: ScheduleDto[];
let cap: number;
let runReply: { ok: boolean; body: unknown };
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  calls = [];
  schedules = [saved, second];
  cap = 3;
  runReply = { ok: true, body: { status: "started", crawlJobId: "c9" } };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const reply = (ok: boolean, body: unknown, status = 200) => ({ ok, status, json: async () => body });
      if (url === "/api/seo/v1/crawl") return reply(true, { crawls: [], quota });
      if (url === "/api/seo/v1/crawl/schedules" && !init?.method)
        return reply(true, { schedules, cap, cadences: ["weekly", "monthly"], cadenceUnlocks: { daily: "Agency" }, timezone: ZONE });
      if (url === "/api/seo/v1/crawl/schedules" && init?.method === "POST") {
        const b = JSON.parse(String(init.body));
        return reply(true, {
          ...saved,
          id: "s3",
          host: "new.example",
          rootUrl: b.rootUrl,
          cadence: b.cadence,
          hourUtc: b.hourUtc,
          exportTo: b.exportTo,
          lastHealth: undefined,
        });
      }
      if (url.endsWith("/run")) return reply(runReply.ok, runReply.body, runReply.ok ? 202 : 409);
      if (init?.method === "PATCH") return reply(true, { ...schedules.find((s) => url.endsWith(s.id))!, ...JSON.parse(String(init.body)) });
      if (init?.method === "DELETE") return reply(true, null, 204);
      if (url.startsWith("/api/seo/v1/crawl/sites?host=new.example"))
        return reply(true, {
          host: "new.example",
          verified: false,
          defaults: {
            maxUrls: 100,
            maxDepth: null,
            include: [],
            exclude: [],
            crawlSubdomains: false,
            followNofollow: false,
            queryStrings: "keep",
            stripParams: [],
            speed: 2,
            userAgent: "default",
            customUserAgent: null,
            headers: [],
            cookies: null,
            basicAuth: null,
            respectRobots: true,
            customRobots: null,
          },
        });
      return reply(false, null, 404);
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

const render = async (l: DashLocale) => {
  await act(async () => root.render(<CrawlSchedulesView locale={l} />));
  await vi.waitFor(() => expect(el.querySelector('[data-testid="saved-schedules"]')).not.toBeNull());
};
const setValue = async (sel: string, value: string) =>
  act(async () => {
    const node = el.querySelector<HTMLInputElement | HTMLSelectElement>(sel)!;
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
const row = (id: string) => el.querySelector<HTMLLIElement>(`[data-schedule="${id}"]`)!;

describe("helpers", () => {
  it("labels the 24 UTC hours in the workspace's timezone, sorted by local time", () => {
    const winter = new Date("2026-12-01T12:00:00Z");
    const opts = timeOptions(ZONE, "en-GB", winter);
    expect(opts).toHaveLength(24);
    expect(opts[0]).toEqual({ hourUtc: 23, local: "00:00", utc: "23:00" });
    expect(opts.find((o) => o.hourUtc === 3)!.local).toBe("04:00");
    // Half-hour zones keep their minutes; an unknown zone falls back to UTC.
    expect(timeOptions("Asia/Kolkata", "en-GB", winter).find((o) => o.hourUtc === 0)!.local).toBe("05:30");
    expect(safeZone("Not/AZone")).toBe("UTC");
    expect(timeOptions("Not/AZone", "en-GB", winter)[0]).toEqual({ hourUtc: 0, local: "00:00", utc: "00:00" });
  });
  it("delta on the run before", () => {
    expect([
      healthDelta(saved),
      healthDelta({ lastHealth: 60, prevHealth: 70 }),
      healthDelta(second),
      healthDelta({ lastHealth: 50, prevHealth: null }),
    ]).toEqual([4, -10, null, null]);
  });
  it.each([
    [{ code: "SCHEDULE_REFUSED", reason: "over_plan_cap" }, "schErrCap"],
    [{ code: "SCHEDULE_REFUSED", reason: "cadence_not_in_plan" }, "schErrCadence"],
    [{ code: "INVALID_CONFIG" }, "schErrConfig"],
    [{ code: "INVALID_REQUEST" }, "schErrUrl"],
    [null, "schErrGeneric"],
  ] as const)("refusal %j → %s", (body, key) => {
    const t = SITE_CRAWLER_COPY.en.p4c;
    expect(scheduleError(body, t)).toBe(t[key]);
  });
});

describe.each(LOCALES)("%s", (l) => {
  const t = SITE_CRAWLER_COPY[l];
  const u = t.ux;
  const int = new Intl.NumberFormat(l === "en" ? "en-US" : l);

  it("hero, form and list: cadences by plan, local time with UTC, exports, cap note", async () => {
    await render(l);
    const hero = el.querySelector('[data-testid="schedules-hero"]')!;
    expect([hero.querySelector("p")!.textContent, hero.querySelector("h1")!.textContent]).toEqual([u.schEyebrow, u.schH1]);
    expect(hero.textContent).toContain(u.schSubhead);
    expect(el.querySelector("#schedule-form-title")!.textContent).toBe(u.schCreateTitle);
    const cadences = [...el.querySelectorAll<HTMLOptionElement>("#schedule-cadence option")];
    expect(cadences.map((o) => [o.value, o.disabled, o.textContent])).toEqual([
      ["daily", true, u.schCadenceLocked(t.p4c.cadenceDaily, "Agency")],
      ["weekly", false, t.p4c.cadenceWeekly],
      ["monthly", false, t.p4c.cadenceMonthly],
    ]);
    expect(el.querySelector('label[for="schedule-hour"]')!.textContent).toBe(u.schTime(ZONE));
    expect(el.querySelector('[data-testid="schedule-utc"]')!.textContent).toBe(u.schTimeUtc("03:00"));
    await setValue("#schedule-hour", "5");
    expect(el.querySelector('[data-testid="schedule-utc"]')!.textContent).toBe(u.schTimeUtc("05:00"));
    expect(el.textContent).toContain(u.schEmailOwner);
    expect(el.querySelector('[data-testid="sheets-coming"]')!.textContent).toBe(u.schSheetsComing);
    expect(el.querySelector('[data-testid="schedule-used"]')!.textContent).toBe(u.schUsed("2", "3"));
    expect(el.querySelector('[data-testid="schedule-count"]')!.textContent).toBe(int.format(2));
    if (l === "de-CH") expect(JSON.stringify(u)).not.toContain("ß");
  });

  it("each saved row: host, cadence · next run in local time, last health with the delta, export icons", async () => {
    await render(l);
    const r = row("s1");
    expect(r.textContent).toContain("shop.example");
    const local = new Intl.DateTimeFormat(l, { dateStyle: "medium", timeStyle: "short", timeZone: ZONE }).format(new Date(saved.nextRunAt));
    expect(r.querySelector("[data-next]")!.textContent).toBe(`${cadenceLabel("weekly", t.p4c)} · ${u.schNextRun(local)}`);
    expect(r.querySelector("[data-last-health]")!.textContent).toContain(u.healthScore(int.format(74)));
    expect(r.querySelector("[data-delta]")!.getAttribute("data-delta")).toBe("4");
    expect(r.querySelector("[data-delta]")!.textContent).toContain(u.schDeltaUp(int.format(4)));
    expect(r.querySelector("[data-exports]")!.textContent).toContain(u.schToEmail);
    const off = row("s2");
    expect(off.querySelector("[data-next]")!.textContent).toContain(u.schPausedLabel);
    expect(off.querySelector("[data-last-health]")!.textContent).toContain(u.schNoRunYet);
    expect(off.querySelector("[data-exports]")!.textContent).toBe(u.schToNone);
    expect(off.querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("false");
  });

  it("creates a schedule with the site's saved configuration: POST body", async () => {
    await render(l);
    await setValue("#schedule-url", "https://new.example/");
    await vi.waitFor(() => expect(el.querySelector('[data-testid="schedule-config"]')!.textContent).toContain(u.schUsesSaved), { timeout: 2000 });
    expect(el.querySelector('[data-testid="schedule-config"] a')!.getAttribute("href")).toBe("/crawler");
    await setValue("#schedule-cadence", "monthly");
    await setValue("#schedule-hour", "6");
    await act(async () => el.querySelector<HTMLFormElement>('[data-testid="schedule-form"]')!.requestSubmit());
    const post = calls.find((c) => c.init?.method === "POST")!;
    const body = JSON.parse(String(post.init!.body));
    expect(body).toMatchObject({
      rootUrl: "https://new.example/",
      renderMode: "none",
      cadence: "monthly",
      hourUtc: 6,
      exportTo: { email: true, sheets: null },
    });
    expect(body.config).toMatchObject({ maxUrls: 100 });
    await vi.waitFor(() => expect(row("s3")).not.toBeNull());
    expect(el.querySelector('[data-testid="schedule-count"]')!.textContent).toBe(int.format(3));
  });

  it("the switch and Run now call the schedule endpoints; a skipped run says why", async () => {
    await render(l);
    await act(async () => row("s1").querySelector<HTMLButtonElement>('[role="switch"]')!.click());
    expect(calls.find((c) => c.init?.method === "PATCH")).toMatchObject({
      url: "/api/seo/v1/crawl/schedules/s1",
      init: { body: JSON.stringify({ enabled: false }) },
    });
    await vi.waitFor(() => expect(row("s1").querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("false"));
    // The row keeps its health after the PATCH reply (which carries none).
    expect(row("s1").querySelector("[data-delta]")).not.toBeNull();
    const run = row("s1").querySelector<HTMLButtonElement>("[data-run-now]")!;
    expect(run.textContent!.startsWith(u.schRunNow)).toBe(true);
    await act(async () => run.click());
    expect(calls.some((c) => c.url === "/api/seo/v1/crawl/schedules/s1/run" && c.init?.method === "POST")).toBe(true);
    await vi.waitFor(() => expect(row("s1").querySelector('[role="status"]')!.textContent).toContain(u.schRunStarted));
    runReply = { ok: false, body: { code: "SCHEDULE_SKIPPED", reason: "quota_exhausted" } };
    await act(async () => run.click());
    await vi.waitFor(() => expect(row("s1").querySelector('[role="status"]')!.textContent).toBe(u.schRunSkipped.quota_exhausted));
  });

  it("edits in the form with PATCH, and deletes only after confirmation", async () => {
    await render(l);
    await act(async () =>
      row("s1")
        .querySelector<HTMLButtonElement>(`button[aria-label="${u.schEditAria("shop.example")}"]`)!
        .click(),
    );
    expect(el.querySelector("#schedule-form-title")!.textContent).toBe(u.schEditTitle);
    expect(el.querySelector<HTMLInputElement>("#schedule-url")!.readOnly).toBe(true);
    expect(el.querySelector<HTMLSelectElement>("#schedule-cadence")!.value).toBe("weekly");
    await setValue("#schedule-cadence", "monthly");
    await act(async () => el.querySelector<HTMLFormElement>('[data-testid="schedule-form"]')!.requestSubmit());
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(patch.url).toBe("/api/seo/v1/crawl/schedules/s1");
    expect(JSON.parse(String(patch.init!.body))).toEqual({ cadence: "monthly", hourUtc: 3, exportTo: { email: true, sheets: null } });
    await vi.waitFor(() => expect(el.querySelector("#schedule-form-title")!.textContent).toBe(u.schCreateTitle));
    expect(row("s1").querySelector("[data-next]")!.textContent).toContain(t.p4c.cadenceMonthly);

    await act(async () =>
      row("s2")
        .querySelector<HTMLButtonElement>(`button[aria-label="${u.schDeleteAria("blog.example")}"]`)!
        .click(),
    );
    expect(calls.some((c) => c.init?.method === "DELETE")).toBe(false);
    const confirm = row("s2").querySelector("[data-confirm]")!;
    expect(confirm.textContent).toContain(u.schDeleteConfirm("blog.example"));
    await act(async () => [...confirm.querySelectorAll("button")].find((b) => b.textContent === u.schDeleteNo)!.click());
    expect(row("s2").querySelector("[data-confirm]")).toBeNull();
    await act(async () =>
      row("s2")
        .querySelector<HTMLButtonElement>(`button[aria-label="${u.schDeleteAria("blog.example")}"]`)!
        .click(),
    );
    await act(async () => [...row("s2").querySelectorAll<HTMLButtonElement>("[data-confirm] button")].find((b) => b.textContent === u.schDeleteYes)!.click());
    expect(calls.find((c) => c.init?.method === "DELETE")!.url).toBe("/api/seo/v1/crawl/schedules/s2");
    await vi.waitFor(() => expect(el.querySelector('[data-schedule="s2"]')).toBeNull());
  });

  it("at the cap the form says so; the list still works", async () => {
    cap = 2;
    await render(l);
    expect(el.textContent).toContain(t.p4c.schErrCap);
    expect(el.querySelector<HTMLButtonElement>('[data-testid="schedule-form"] button[type="submit"]')!.disabled).toBe(true);
    expect(row("s1").querySelector('[role="switch"]')).not.toBeNull();
  });

  it("empty state: calendar, title and the line under it", async () => {
    schedules = [];
    await render(l);
    const empty = el.querySelector('[data-testid="schedules-empty"]')!;
    expect(empty.querySelector("svg")).not.toBeNull();
    expect(empty.textContent).toContain(u.schEmptyTitle);
    expect(empty.textContent).toContain(u.schEmptyBody);
  });

  it("no serious or critical axe violations; every control labelled", async () => {
    await render(l);
    await act(async () =>
      row("s2")
        .querySelector<HTMLButtonElement>(`button[aria-label="${u.schDeleteAria("blog.example")}"]`)!
        .click(),
    );
    const res = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    for (const c of el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))
      expect(
        [...(c.labels ?? [])].some((x) => x.textContent?.trim()),
        c.id || c.outerHTML.slice(0, 60),
      ).toBe(true);
  });
});
