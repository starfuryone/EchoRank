// The sales contact form: /api/free/v1/sales-inquiry → src/lib/sales/inquiries.ts.
// Valid inquiries are stored and both emails go out; blocked countries store
// nothing; the honeypot and the daily limit refuse; status and retention.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  salesInquiry: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  sendMail: vi.fn<(m: { to: string[]; subject: string; text?: string; html: string; replyTo?: string }) => Promise<boolean>>(async () => true),
  consumeDailyLimit: vi.fn(),
  visitorIp: vi.fn(() => "203.0.113.9"),
  verifyTurnstile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { salesInquiry: m.salesInquiry } }));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail }));
vi.mock("@/lib/free-tools/limits", () => ({ consumeDailyLimit: m.consumeDailyLimit, visitorIp: m.visitorIp }));
vi.mock("@/lib/snapshot/turnstile", () => ({ verifyTurnstile: m.verifyTurnstile }));

import { POST } from "@/app/api/free/v1/sales-inquiry/route";
import { normalizeWebsite, purgeClosedInquiries, setInquiryStatus } from "@/lib/sales/inquiries";
import { SALES_COPY } from "@/lib/sales/inquiry-copy";
import { COUNTRY_NOT_AVAILABLE } from "@/lib/geo/blocked-countries";

const VALID = {
  name: "Dana Reyes",
  email: "Dana@Agency.example",
  company: "Reyes Digital",
  website: "reyes.example/",
  country: "US",
  size: "26-100",
  needs: ["white_label", "dpa"],
  message: "We run 40 dental clinics.",
  marketingConsent: false,
  locale: "fr",
  src: "pricing-enterprise",
  referrer: "https://www.google.com/search?q=echorank",
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://echorank360.com/api/free/v1/sales-inquiry", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  m.consumeDailyLimit.mockResolvedValue({ ok: true });
  m.verifyTurnstile.mockResolvedValue("unconfigured");
  m.salesInquiry.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "si_1",
    createdAt: new Date("2026-11-07T10:00:00Z"),
    ...data,
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe("a valid inquiry", () => {
  it("is stored with every answer, the source and the referrer", async () => {
    const res = await post(VALID, { "cf-ipcountry": "US" });
    expect(res.status).toBe(201);
    expect(m.salesInquiry.create).toHaveBeenCalledWith({
      data: {
        name: "Dana Reyes",
        email: "dana@agency.example",
        company: "Reyes Digital",
        website: "https://reyes.example",
        country: "US",
        ipCountry: "US",
        size: "26-100",
        needs: ["white_label", "dpa"],
        message: "We run 40 dental clinics.",
        marketingConsent: false,
        locale: "fr",
        source: "pricing-enterprise",
        referrer: "https://www.google.com/search",
      },
    });
    expect(m.consumeDailyLimit).toHaveBeenCalledWith("sales-inquiry", "203.0.113.9", 5);
  });

  it("emails support@ every answer, reply-to the submitter, and acknowledges in their language", async () => {
    await post(VALID);
    expect(m.sendMail).toHaveBeenCalledTimes(2);
    const [toSupport, toSubmitter] = m.sendMail.mock.calls.map((c) => c[0]);
    expect(toSupport.to).toEqual(["support@echorank360.com"]);
    expect(toSupport.replyTo).toBe("dana@agency.example");
    for (const v of ["Dana Reyes", "dana@agency.example", "Reyes Digital", "https://reyes.example", "US", "26–100", "White-label", "Data Processing Agreement", "We run 40 dental clinics.", "Marketing opt-in: no", "pricing-enterprise", "https://www.google.com/search"]) {
      expect(toSupport.text, v).toContain(v);
    }
    expect(toSubmitter.to).toEqual(["dana@agency.example"]);
    expect(toSubmitter.subject).toBe(SALES_COPY.fr.ackSubject);
    expect(toSubmitter.text).toContain(SALES_COPY.fr.thanks);
    expect(m.salesInquiry.update).toHaveBeenCalledWith({
      where: { id: "si_1" },
      data: { notifiedAt: expect.any(Date), acknowledgedAt: expect.any(Date) },
    });
  });

  it("the English confirmation is the agreed sentence", () => {
    expect(SALES_COPY.en.thanks).toBe("Thanks, we've got your message. We'll reply by email within 2 business days.");
  });

  it("an optional message and marketing opt-in are optional", async () => {
    // undefined drops out of the JSON body: no message, no opt-in, no needs.
    expect((await post({ ...VALID, message: undefined, marketingConsent: undefined, needs: [] })).status).toBe(201);
    expect(m.salesInquiry.create.mock.calls[0][0].data).toMatchObject({ message: null, marketingConsent: false, needs: [] });
    m.salesInquiry.create.mockClear();
    await post({ ...VALID, marketingConsent: true });
    expect(m.salesInquiry.create.mock.calls[0][0].data.marketingConsent).toBe(true);
  });

  it("a mail failure does not fail the submission", async () => {
    m.sendMail.mockRejectedValueOnce(new Error("smtp down"));
    expect((await post(VALID)).status).toBe(201);
  });
});

describe("refusals: nothing stored, nothing sent", () => {
  const nothing = () => {
    expect(m.salesInquiry.create).not.toHaveBeenCalled();
    expect(m.sendMail).not.toHaveBeenCalled();
  };

  it.each([
    ["declared GB", { ...VALID, country: "GB" }, {}],
    ["declared FR", { ...VALID, country: "fr" }, {}],
    ["IP in DE", VALID, { "cf-ipcountry": "DE" }],
  ])("blocked country (%s)", async (_l, body, headers) => {
    const res = await post(body, headers);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "blocked" });
    expect(SALES_COPY.en.errors.blocked).toBe(COUNTRY_NOT_AVAILABLE.en);
    expect(m.consumeDailyLimit).not.toHaveBeenCalled();
    nothing();
  });

  it("Switzerland is allowed", async () => {
    expect((await post({ ...VALID, country: "CH" }, { "cf-ipcountry": "CH" })).status).toBe(201);
  });

  it("the honeypot", async () => {
    const res = await post({ ...VALID, hp: "http://spam.example" });
    expect(res.status).toBe(400);
    expect(m.consumeDailyLimit).not.toHaveBeenCalled();
    nothing();
  });

  it("the daily limit (5 per IP)", async () => {
    m.consumeDailyLimit.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const res = await post(VALID);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    nothing();
  });

  it("Turnstile, when configured and failed", async () => {
    m.verifyTurnstile.mockResolvedValue("failed");
    expect((await post({ ...VALID, turnstileToken: "x" })).status).toBe(400);
    nothing();
  });

  it.each([
    ["no company", { ...VALID, company: " " }, "company"],
    ["not a website", { ...VALID, website: "not a site" }, "website"],
    ["no country", { ...VALID, country: "" }, "country"],
    ["unknown country", { ...VALID, country: "ZZ" }, "country"],
    ["size not on the list", { ...VALID, size: "7" }, "size"],
    ["unknown need", { ...VALID, needs: ["free_lunch"] }, "needs"],
    ["bad email", { ...VALID, email: "dana@" }, "email"],
  ])("server-side validation: %s", async (_l, body, field) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toBe("invalid");
    expect(d.fields).toContain(field);
    nothing();
  });
});

describe("the Matrix alert", () => {
  it("posts one line without personal data when configured", async () => {
    vi.stubEnv("MATRIX_HOMESERVER_URL", "http://127.0.0.1:8008");
    vi.stubEnv("MATRIX_ACCESS_TOKEN", "tok");
    vi.stubEnv("MATRIX_ROOM_ALERTS", "!room:echorank");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await post(VALID);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:8008\/_matrix\/client\/v3\/rooms\/!room%3Aechorank\/send\/m\.room\.message\//);
    expect(init.method).toBe("PUT");
    const body = JSON.parse(String(init.body)).body as string;
    expect(body).toContain("Reyes Digital");
    expect(body).not.toMatch(/dana|@agency/i);
    expect(body.split("\n")).toHaveLength(1);
    fetchSpy.mockRestore();
  });

  it("is skipped silently when not configured or unreachable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect((await post(VALID)).status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.stubEnv("MATRIX_HOMESERVER_URL", "http://127.0.0.1:1");
    vi.stubEnv("MATRIX_ACCESS_TOKEN", "tok");
    vi.stubEnv("MATRIX_ROOM_ALERTS", "!r:x");
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
    expect((await post(VALID)).status).toBe(201);
    fetchSpy.mockRestore();
  });
});

describe("status and retention", () => {
  it("contacted, closed, and reopening clears closedAt", async () => {
    m.salesInquiry.update.mockImplementation(async ({ data }: { data: unknown }) => data);
    m.salesInquiry.findUnique.mockResolvedValue({ id: "si_1", contactedAt: null, closedAt: null });
    expect(await setInquiryStatus("si_1", "CONTACTED")).toEqual({ status: "CONTACTED", contactedAt: expect.any(Date), closedAt: null });
    expect(await setInquiryStatus("si_1", "CLOSED")).toEqual({ status: "CLOSED", contactedAt: expect.any(Date), closedAt: expect.any(Date) });
    const closed = new Date("2026-01-01T00:00:00Z");
    m.salesInquiry.findUnique.mockResolvedValue({ id: "si_1", contactedAt: closed, closedAt: closed });
    expect(await setInquiryStatus("si_1", "NEW")).toEqual({ status: "NEW", closedAt: null });
    m.salesInquiry.findUnique.mockResolvedValue(null);
    expect(await setInquiryStatus("nope", "CLOSED")).toBeNull();
  });

  it("deletes inquiries closed more than 24 months ago, and only those", async () => {
    m.salesInquiry.deleteMany.mockResolvedValue({ count: 2 });
    expect(await purgeClosedInquiries(new Date("2026-11-07T03:50:00Z"))).toBe(2);
    expect(m.salesInquiry.deleteMany).toHaveBeenCalledWith({
      where: { status: "CLOSED", closedAt: { lt: new Date("2024-11-07T03:50:00Z") } },
    });
  });
});

describe("website normalisation", () => {
  it.each([
    ["example.com", "https://example.com"],
    ["https://Example.com/clients/", "https://example.com/clients/"],
    ["http://shop.example.co.uk", "http://shop.example.co.uk"],
  ])("%s → %s", (raw, out) => expect(normalizeWebsite(raw)).toBe(out));
  it.each(["", "localhost", "ftp://example.com", "javascript:alert(1)", "two words.com", "https://user:pw@example.com"])("refuses %s", (raw) =>
    expect(normalizeWebsite(raw)).toBeNull(),
  );
});
