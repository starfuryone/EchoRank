// @vitest-environment jsdom
//
// tests/site-crawler-schedule-ui.test.tsx — "Run this crawl on a schedule" in
// every dashboard locale: only the plan's cadences, the POST body, the cap,
// pause / delete, and refusal copy.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.schedule": true, "crawl.reports": true, "crawl.sheets": false };
  return { ...real, FLAGS: on, flag: (n: keyof typeof on) => on[n] };
});

import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { CrawlSchedules, cadenceLabel, scheduleError, type ScheduleDto } from "@/components/seo-tools/site-crawler-schedules";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const saved: ScheduleDto = { id: "s1", host: "x.com", rootUrl: "https://x.com/", cadence: "monthly", hourUtc: 3, enabled: true, nextRunAt: "2026-12-01T03:00:00.000Z", exportTo: { email: true } };

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

async function mount(l: DashLocale, list: ScheduleDto[], cap: number, onFetch: (url: string, init?: RequestInit) => { ok: boolean; body: unknown } = () => ({ ok: true, body: { schedules: list } })) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const r = onFetch(url, init);
    return { ok: r.ok, json: async () => r.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host!).render(
      <CrawlSchedules t={SITE_CRAWLER_COPY[l].p4c} locale={l} rootUrl="https://x.com/" renderMode="none" config={null} cap={cap} cadences={["weekly", "monthly"]} />,
    );
  });
  await act(async () => {});
  return fetchMock;
}

describe("CrawlSchedules", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: offers the plan's cadences only and lists saved schedules", async (l) => {
    await mount(l, [saved], 2);
    const t = SITE_CRAWLER_COPY[l].p4c;
    const options = [...host!.querySelectorAll("#schedule-cadence option")].map((o) => o.textContent);
    expect(options).toEqual([cadenceLabel("weekly", t), cadenceLabel("monthly", t)]);
    expect(host!.querySelectorAll("#schedule-hour option")).toHaveLength(24);
    expect(host!.textContent).toContain(t.schTitle);
    expect(host!.textContent).toContain(t.schCapNote("1", "2"));
    expect(host!.textContent).toContain(t.schEmail);
    expect(host!.textContent).not.toContain(t.schSheets);
    expect(host!.textContent).not.toMatch(/undefined|NaN/);
  });

  it("Save POSTs the URL, settings, cadence, hour and exports", async () => {
    const fetchMock = await mount("en", [], 2, (url, init) => (init?.method === "POST" ? { ok: true, body: saved } : { ok: true, body: { schedules: [] } }));
    const save = [...host!.querySelectorAll("button")].find((b) => b.textContent === SITE_CRAWLER_COPY.en.p4c.schSave)!;
    await act(async () => save.click());
    const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
      rootUrl: "https://x.com/",
      renderMode: "none",
      config: null,
      cadence: "monthly",
      hourUtc: 3,
      exportTo: { email: true, sheets: null },
    });
    expect(host!.textContent).toContain(SITE_CRAWLER_COPY.en.p4c.schSaved);
  });

  it("at the cap: no form, pause and delete still work", async () => {
    const fetchMock = await mount("en", [saved], 1, (url, init) =>
      init?.method === "PATCH" ? { ok: true, body: { ...saved, enabled: false } } : init?.method === "DELETE" ? { ok: true, body: null } : { ok: true, body: { schedules: [saved] } },
    );
    const t = SITE_CRAWLER_COPY.en.p4c;
    expect(host!.querySelector("#schedule-cadence")).toBeNull();
    const pause = [...host!.querySelectorAll("button")].find((b) => b.textContent === t.schPause)!;
    await act(async () => pause.click());
    expect(fetchMock).toHaveBeenCalledWith("/api/seo/v1/crawl/schedules/s1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: false }) }));
    expect(host!.textContent).toContain(t.schPaused);
    const del = [...host!.querySelectorAll("button")].find((b) => b.textContent === t.schDelete)!;
    await act(async () => del.click());
    expect(host!.textContent).toContain(t.schNone);
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
