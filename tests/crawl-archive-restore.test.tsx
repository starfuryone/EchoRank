// @vitest-environment jsdom
//
// tests/crawl-archive-restore.test.tsx — POST /api/seo/v1/crawl/[id]/restore
// (tenant-scoped, the state machine, one job per crawl, never the crawl
// quota) and the "Archived — Restore" UI: the button, polling until HOT, the
// toast, the failure path; the copy in en / fr / de-CH.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob } }));
const enqueueRestore = vi.fn();
vi.mock("@/lib/site-crawler/archive/queue", () => ({ enqueueRestore: (id: string) => enqueueRestore(id) }));
const configured = vi.fn(() => true);
vi.mock("@/lib/spaces/client", () => ({ spacesConfigured: () => configured() }));
const quota = vi.fn();
vi.mock("@/lib/site-crawler/quota", () => ({ consumeCrawl: quota, getCrawlQuota: quota, reserveCrawl: quota }));

const { POST } = await import("@/app/api/seo/v1/crawl/[id]/restore/route");
const call = () => POST(new Request("https://app.test/api/seo/v1/crawl/c1/restore", { method: "POST" }), { params: Promise.resolve({ id: "c1" }) });

describe("POST /crawl/[id]/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configured.mockReturnValue(true);
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    crawlJob.findFirst.mockResolvedValue({ id: "c1", storageState: "ARCHIVED", dataPurgedAt: null });
    crawlJob.updateMany.mockResolvedValue({ count: 1 });
  });

  it("ARCHIVED → RESTORING, one job, 202; tenant-scoped; no crawl row, no quota", async () => {
    const res = await call();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ storageState: "RESTORING" });
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", tenantId: "t1" });
    expect(crawlJob.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "c1", tenantId: "t1", storageState: "ARCHIVED", dataPurgedAt: null },
      data: { storageState: "RESTORING" },
    });
    expect(enqueueRestore).toHaveBeenCalledWith("c1");
    expect(crawlJob.create).not.toHaveBeenCalled();
    expect(quota).not.toHaveBeenCalled();
  });

  it("another workspace's crawl is a 404", async () => {
    crawlJob.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(enqueueRestore).not.toHaveBeenCalled();
  });

  it("a double click: the second claim loses, still 202, still one job", async () => {
    crawlJob.updateMany.mockResolvedValue({ count: 0 });
    expect((await call()).status).toBe(202);
    expect(enqueueRestore).not.toHaveBeenCalled();
  });

  it("states: HOT 200, RESTORING 202, ARCHIVING 409, purged 409, no Spaces 503", async () => {
    crawlJob.findFirst.mockResolvedValue({ id: "c1", storageState: "HOT", dataPurgedAt: null });
    expect((await call()).status).toBe(200);
    crawlJob.findFirst.mockResolvedValue({ id: "c1", storageState: "RESTORING", dataPurgedAt: null });
    expect((await call()).status).toBe(202);
    crawlJob.findFirst.mockResolvedValue({ id: "c1", storageState: "ARCHIVING", dataPurgedAt: null });
    expect((await (await call()).json()).code).toBe("ARCHIVING");
    crawlJob.findFirst.mockResolvedValue({ id: "c1", storageState: "ARCHIVED", dataPurgedAt: new Date() });
    expect((await (await call()).json()).code).toBe("PURGED");
    crawlJob.findFirst.mockResolvedValue({ id: "c1", storageState: "ARCHIVED", dataPurgedAt: null });
    configured.mockReturnValue(false);
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("ARCHIVE_UNAVAILABLE");
    expect(enqueueRestore).not.toHaveBeenCalled();
  });

  it("enqueue fails → back to ARCHIVED, 503", async () => {
    enqueueRestore.mockRejectedValueOnce(new Error("redis down"));
    const res = await call();
    expect(res.status).toBe(503);
    expect(crawlJob.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { storageState: "ARCHIVED" } });
  });
});

describe("the Restore UI", () => {
  let el: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount(kind: "panel" | "badge", locale: "en" | "fr" | "de-CH" = "en", onRestored = vi.fn()) {
    const { ArchivedPanel, ArchivedBadge } = await import("@/components/seo-tools/site-crawler-archived");
    const { SITE_CRAWLER_COPY } = await import("@/lib/i18n/dashboard");
    const C = kind === "panel" ? ArchivedPanel : ArchivedBadge;
    await act(async () => root.render(createElement(C, { crawlId: "c1", storageState: "ARCHIVED", host: "ex.com", a: SITE_CRAWLER_COPY[locale].archive, onRestored })));
    return { onRestored, a: SITE_CRAWLER_COPY[locale].archive };
  }
  const button = () => el.querySelector("button")!;

  it("click → POST restore → Restoring… → polls GET until HOT → toast + onRestored", async () => {
    const calls: string[] = [];
    let polls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (init?.method === "POST") return new Response(JSON.stringify({ storageState: "RESTORING" }), { status: 202 });
      polls++;
      return new Response(JSON.stringify({ storageState: polls < 2 ? "RESTORING" : "HOT" }));
    }));
    const { onRestored, a } = await mount("panel");
    expect(el.querySelector('[data-testid="archived-panel"]')!.getAttribute("data-state")).toBe("ARCHIVED");
    expect(el.textContent).toContain(a.panelTitle);
    expect(button().getAttribute("aria-label")).toBe(a.restoreAria("ex.com"));
    await act(async () => button().click());
    expect(calls).toEqual(["POST /api/seo/v1/crawl/c1/restore"]);
    expect(el.textContent).toContain(a.restoring);
    await act(async () => void vi.advanceTimersByTime(5_000));
    await act(async () => void vi.advanceTimersByTime(5_000));
    expect(calls.filter((c) => c === "GET /api/seo/v1/crawl/c1")).toHaveLength(2);
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="restore-toast"]')!.textContent).toBe(a.restored("ex.com"));
    expect(el.querySelector('[data-testid="archived-panel"]')).toBeNull();
    // No more polling once settled.
    await act(async () => void vi.advanceTimersByTime(20_000));
    expect(calls.filter((c) => c.startsWith("GET"))).toHaveLength(2);
  });

  it("a failed restore comes back ARCHIVED: error toast, the button again", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? new Response(JSON.stringify({ storageState: "RESTORING" }), { status: 202 }) : new Response(JSON.stringify({ storageState: "ARCHIVED" })),
    ));
    const { onRestored, a } = await mount("badge");
    await act(async () => button().click());
    await act(async () => void vi.advanceTimersByTime(5_000));
    expect(onRestored).not.toHaveBeenCalled();
    const toast = el.querySelector('[data-testid="restore-toast"]')!;
    expect(toast.getAttribute("data-kind")).toBe("error");
    expect(toast.textContent).toBe(a.failed);
    expect(el.querySelector('[data-testid="archived-badge"]')!.getAttribute("data-state")).toBe("ARCHIVED");
  });

  it("archive unavailable (503): the unavailable toast", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "ARCHIVE_UNAVAILABLE" }), { status: 503 })));
    const { a } = await mount("badge");
    await act(async () => button().click());
    expect(el.querySelector('[data-testid="restore-toast"]')!.textContent).toBe(a.unavailable);
  });

  it.each(["en", "fr", "de-CH"] as const)("%s: the label, button and panel copy (de-CH without ß)", async (locale) => {
    const { a } = await mount("panel", locale);
    expect(el.textContent).toContain(a.panelTitle);
    expect(button().textContent).toBe({ en: "Restore", fr: "Restaurer", "de-CH": "Wiederherstellen" }[locale]);
    const all = JSON.stringify(a) + a.restored("x") + a.restoreAria("x");
    if (locale === "de-CH") expect(all).not.toContain("ß");
  });
});
