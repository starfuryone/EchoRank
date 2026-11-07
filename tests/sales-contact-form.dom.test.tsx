// @vitest-environment jsdom
// The sales contact form in the browser: fields, the unticked opt-in, the
// privacy line, the hidden honeypot, and the empty / error / success states.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/app/[locale]/enterprise/contact/contact-form";
import { SALES_COPY } from "@/lib/sales/inquiry-copy";
import { COUNTRY_NOT_AVAILABLE } from "@/lib/geo/blocked-countries";

let host: HTMLDivElement;
let root: Root;

async function mount(locale = "en", src: string | null = "pricing-enterprise") {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(ContactForm, { locale, src })));
}

function fill(name: string, value: string) {
  const el = host.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

async function fillValid(country = "US") {
  await act(async () => {
    fill("name", "Dana");
    fill("email", "dana@agency.example");
    fill("company", "Reyes Digital");
    fill("website", "reyes.example");
    fill("country", country);
    fill("size", "6-25");
  });
}

const submit = () => act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the sales contact form", () => {
  it("has the required fields, the size choices, the six needs, an unticked opt-in and the privacy link", async () => {
    await mount("de-CH");
    const c = SALES_COPY["de-CH"];
    for (const n of ["name", "email", "company", "website", "country", "size"]) {
      expect(host.querySelector(`[name="${n}"]`)!.hasAttribute("required"), n).toBe(true);
    }
    expect(host.querySelector('[name="message"]')!.hasAttribute("required")).toBe(false);
    const sizes = [...host.querySelectorAll('[name="size"] option')].map((o) => o.textContent).filter(Boolean);
    expect(sizes).toEqual(["1–5", "6–25", "26–100", "100+"]);
    expect(host.querySelectorAll('[name="needs"]')).toHaveLength(6);
    const optIn = host.querySelector('[name="marketingConsent"]') as HTMLInputElement;
    expect(optIn.checked).toBe(false);
    expect(optIn.hasAttribute("required")).toBe(false);
    const privacy = [...host.querySelectorAll("a")].find((a) => a.textContent === c.privacy[1])!;
    expect(privacy.getAttribute("href")).toBe("/de-CH/legal/privacy");
    expect(host.querySelector('[name="fax"]')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect((host.querySelector('[name="fax"]') as HTMLInputElement).tabIndex).toBe(-1);
  });

  it("success: posts every answer with ?src= and the referrer, then shows the confirmation instead of the form", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"ok":true}', { status: 201 }));
    await mount("fr");
    await fillValid();
    await act(async () => (host.querySelector('[name="needs"][value="api_mcp"]') as HTMLInputElement).click());
    await submit();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/free/v1/sales-inquiry");
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "Dana", company: "Reyes Digital", website: "reyes.example", country: "US", size: "6-25",
      needs: ["api_mcp"], marketingConsent: false, locale: "fr", src: "pricing-enterprise", hp: "",
    });
    expect(host.querySelector("form")).toBeNull();
    expect(host.querySelector('[data-testid="inquiry-sent"]')!.textContent).toBe(SALES_COPY.fr.thanks);
  });

  it("blocked country: the message, and nothing is sent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await mount("en");
    await fillValid("GB");
    await submit();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="inquiry-error"]')!.textContent).toBe(COUNTRY_NOT_AVAILABLE.en);
  });

  it("a server refusal shows its message and keeps the form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":"rate_limited"}', { status: 429 }));
    await mount("en");
    await fillValid();
    await submit();
    expect(host.querySelector('[data-testid="inquiry-error"]')!.textContent).toBe(SALES_COPY.en.errors.rate_limited);
    expect(host.querySelector("form")).not.toBeNull();
  });
});
