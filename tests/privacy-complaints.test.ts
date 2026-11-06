// The data-protection complaint form: route (Turnstile, rate limit), storage, acknowledgement,
// legal@ notification, status timestamps, page registration and links.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  sendMail: vi.fn(async () => true),
  turnstile: vi.fn(async () => "ok"),
  limit: vi.fn(async (): Promise<{ ok: boolean; reason?: string }> => ({ ok: true })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { privacyComplaint: { create: m.create, update: m.update, findUnique: m.findUnique, findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail }));
vi.mock("@/lib/snapshot/turnstile", () => ({ verifyTurnstile: m.turnstile }));
vi.mock("@/lib/free-tools/limits", () => ({ visitorIp: () => "203.0.113.7", consumeDailyLimit: m.limit }));

import { complaintReference, fileComplaint, setComplaintStatus } from "@/lib/privacy/complaints";
import { COMPLAINT_PAGE_COPY, LEGAL_EMAIL, acknowledgementEmail } from "@/lib/privacy/complaint-copy";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const BODY = { name: "Sam Doe", email: "sam@example.com", details: "You emailed me after I asked to be removed.", locale: "en" };

beforeEach(() => {
  vi.clearAllMocks();
  m.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "pc1", createdAt: new Date("2026-11-06T10:00:00Z"), ...data }));
  m.sendMail.mockResolvedValue(true);
  m.turnstile.mockResolvedValue("ok");
  m.limit.mockResolvedValue({ ok: true });
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/free/v1/privacy-complaint/route");
  return POST(new Request("https://echorank360.com/api/free/v1/privacy-complaint", { method: "POST", body: JSON.stringify(body) }));
};

describe("POST /api/free/v1/privacy-complaint", () => {
  it("files it: 201 with the reference", async () => {
    const res = await post({ ...BODY, turnstileToken: "t" });
    expect(res.status).toBe(201);
    const d = await res.json();
    expect(d.reference).toMatch(/^PC-[2-9A-HJ-NP-Z]{6}$/);
    expect(d.acknowledged).toBe(true);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ name: "Sam Doe", email: "sam@example.com", locale: "en" });
  });

  it("refuses a bad body, a failed Turnstile, and a spent daily allowance — before storing anything", async () => {
    expect((await post({ ...BODY, details: "short" })).status).toBe(400);
    m.turnstile.mockResolvedValueOnce("failed");
    expect((await post(BODY)).status).toBe(400);
    m.limit.mockResolvedValueOnce({ ok: false, reason: "rate_limited" });
    expect((await post(BODY)).status).toBe(429);
    m.limit.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    expect((await post(BODY)).status).toBe(503);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("is rate-limited per IP per day (5)", () => {
    expect(read("src/app/api/free/v1/privacy-complaint/route.ts")).toMatch(/consumeDailyLimit\("privacy-complaint", ip, COMPLAINTS_PER_IP_PER_DAY\)/);
    expect(read("src/app/api/free/v1/privacy-complaint/route.ts")).toContain("const COMPLAINTS_PER_IP_PER_DAY = 5;");
  });
});

describe("fileComplaint", () => {
  it("acknowledges the complainant at once and notifies legal@", async () => {
    const out = await fileComplaint({ ...BODY, locale: "fr" });
    const calls = m.sendMail.mock.calls as unknown as [{ to: string[]; subject: string; text: string }][];
    expect(calls[0][0].to).toEqual(["sam@example.com"]);
    expect(calls[0][0].subject).toBe(acknowledgementEmail("fr", "Sam Doe", out.reference).subject);
    expect(calls[0][0].text).toContain("ico.org.uk");
    expect(m.update).toHaveBeenCalledWith({ where: { id: "pc1" }, data: { acknowledgedAt: expect.any(Date) } });
    expect(calls[1][0].to).toEqual([LEGAL_EMAIL]);
    expect(calls[1][0].text).toContain(BODY.details);
    expect(calls[1][0].text).toContain("Acknowledgement sent: yes");
  });

  it("an unsent acknowledgement is not marked as sent, and legal@ is told to do it by hand", async () => {
    m.sendMail.mockResolvedValueOnce(false);
    const out = await fileComplaint(BODY);
    expect(out.acknowledged).toBe(false);
    expect(m.update).not.toHaveBeenCalled();
    const legal = (m.sendMail.mock.calls as unknown as [{ text: string }][])[1][0];
    expect(legal.text).toContain("NO — acknowledge by hand");
  });

  it("references avoid look-alike characters", () => {
    expect(complaintReference(Buffer.from([0, 1, 2, 3, 4, 31]))).toBe("PC-23456Z");
  });
});

describe("status", () => {
  it("received → in progress → answered, each timestamp set once", async () => {
    m.findUnique.mockResolvedValueOnce({ id: "pc1", inProgressAt: null, answeredAt: null });
    m.update.mockImplementation(async ({ data }: { data: unknown }) => data);
    const a = (await setComplaintStatus("pc1", "IN_PROGRESS")) as Record<string, unknown>;
    expect(a).toMatchObject({ status: "IN_PROGRESS", inProgressAt: expect.any(Date) });
    expect(a.answeredAt).toBeUndefined();
    const earlier = new Date("2026-11-01");
    m.findUnique.mockResolvedValueOnce({ id: "pc1", inProgressAt: earlier, answeredAt: null });
    const b = (await setComplaintStatus("pc1", "ANSWERED", "Removed from list")) as Record<string, unknown>;
    expect(b).toMatchObject({ status: "ANSWERED", answeredAt: expect.any(Date), answerNote: "Removed from list" });
    expect(b.inProgressAt).toBeUndefined(); // not moved
    m.findUnique.mockResolvedValueOnce(null);
    expect(await setComplaintStatus("nope", "ANSWERED")).toBeNull();
  });

  it("the status API is staff-only", () => {
    for (const f of ["src/app/api/admin/privacy-complaints/route.ts", "src/app/api/admin/privacy-complaints/[id]/route.ts"]) {
      expect(read(f)).toContain("await requirePlatformAdminApi()");
    }
  });
});

describe("the page and its links", () => {
  it("is a registered public page, linked from the privacy policy page and the footers", () => {
    expect(LOCALIZED_ROUTES.some((r) => r.path === "/privacy/complaint")).toBe(true);
    expect(read("src/app/[locale]/legal/privacy/page.tsx")).toContain("/privacy/complaint");
    expect(read("src/components/PublicFooter.tsx")).toContain('L("/privacy/complaint")');
    expect(read("src/app/[locale]/HomeClient.tsx")).toContain('L("/privacy/complaint")');
  });

  it("copy in en / fr / de-CH, no ß", () => {
    for (const l of ["fr", "de-CH"] as const) expect(Object.keys(COMPLAINT_PAGE_COPY[l])).toEqual(Object.keys(COMPLAINT_PAGE_COPY.en));
    expect(JSON.stringify(COMPLAINT_PAGE_COPY["de-CH"])).not.toContain("ß");
    expect(acknowledgementEmail("de-CH", "X", "PC-1").text).not.toContain("ß");
  });
});
