// @vitest-environment jsdom
//
// ReportDownloadButton (shared): a route that stores its PDF answers JSON
// { url }; the button opens that link (a navigation, no CORS on the bucket)
// instead of reading a blob. The blob path is unchanged.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportDownloadButton } from "@/components/reports/ReportDownloadButton";

const assign = vi.fn();
const realLocation = window.location;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  assign.mockReset();
});

async function clickWith(post: () => Response) {
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } });
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => (init?.method === "POST" ? post() : new Response(JSON.stringify({ available: true })))));
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(createElement(ReportDownloadButton, { endpoint: "/api/seo/v1/crawl/c1/report" })));
  await act(async () => el.querySelector("button")!.click());
  const text = el.textContent;
  act(() => root.unmount());
  el.remove();
  return text;
}

describe("ReportDownloadButton", () => {
  it("JSON {url}: opens the presigned link", async () => {
    const url = "https://bucket.sfo3.digitaloceanspaces.com/tenants/t/exports/c1/report-x.pdf?X-Amz-Signature=s";
    await clickWith(() => new Response(JSON.stringify({ url, expiresIn: 900 }), { headers: { "content-type": "application/json" } }));
    expect(assign).toHaveBeenCalledWith(url);
  });

  it("JSON without an https url: the retry state, no navigation", async () => {
    const text = await clickWith(() => new Response(JSON.stringify({ url: "javascript:alert(1)" }), { headers: { "content-type": "application/json" } }));
    expect(assign).not.toHaveBeenCalled();
    expect(text).toContain("Report failed");
  });

  it("a PDF body: the blob download as before", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    await clickWith(() => new Response("%PDF", { headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="r.pdf"' } }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });
});
