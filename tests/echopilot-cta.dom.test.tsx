// @vitest-environment jsdom
// The CTA on "Social posting, by EchoPilot": a real link to EchoPilot's
// pricing (UTM-tagged) in a new tab, and a click recorded on the side.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EchopilotCta, ECHOPILOT_CLICK_ENDPOINT } from "@/components/seo-tools/echopilot-cta";
import { ECHOPILOT_COPY } from "@/lib/i18n/echopilot";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EchopilotCta", () => {
  it("links to the UTM-tagged pricing page in a new tab", () => {
    render(<EchopilotCta label={ECHOPILOT_COPY.en.cta} newTab={ECHOPILOT_COPY.en.newTab} />);
    const a = screen.getByRole("link", { name: /See EchoPilot pricing/ });
    expect(a.getAttribute("href")).toBe(
      "https://echopilotlabs.com/pricing?utm_source=echorank&utm_medium=app&utm_campaign=social",
    );
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a.textContent).toContain("(opens in a new tab)");
  });

  it("a click POSTs one click event, keepalive, same-origin", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<EchopilotCta label="Go" newTab="(new tab)" />);
    fireEvent.click(screen.getByRole("link", { name: /Go/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(ECHOPILOT_CLICK_ENDPOINT, { method: "POST", keepalive: true, credentials: "same-origin" });
  });

  it("a failing record never throws into the click", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<EchopilotCta label="Go" newTab="(new tab)" />);
    expect(() => fireEvent.click(screen.getByRole("link", { name: /Go/ }))).not.toThrow();
  });
});
