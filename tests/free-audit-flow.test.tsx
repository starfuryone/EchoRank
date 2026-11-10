// @vitest-environment jsdom
//
// The free AI Readiness Audit, end to end through the form (2026-11-10, "the
// free audit at /en/free-audit doesn't work for visitors"):
//
//   - the full flow (AuditRunner → POST /api/av/audit → sidecar → result card)
//     returns a score for each of the sidecar's three calibration fixtures,
//     poor / average / strong (tests/fixtures/free-audit/sidecar-audits.json);
//   - a homepage the sidecar could not read is a typed refusal with its own
//     message, and uses no audit;
//   - FREE_AUDIT_DAILY_LIMIT (3) per cf-connecting-ip per 24 h: "N of 3 audits
//     left today", the 4th refused with the time the next one is possible, a
//     burst cannot overshoot, the count survives a web restart (it lives in
//     Redis, not in the process), and no cf-connecting-ip is a 403;
//   - the copy states 3, from config, in en / fr / de-CH, on every surface
//     that names the allowance.
//
// What was broken is tested on the sidecar side (av-service
// tests/test_ai_readiness.py: the UA shape a WAF admits, the www fallback);
// here the app's half: the reason reaches the visitor, and the allowance.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Redis SERVER: outside every module, so a module reload (a web restart)
// sees the same counts and a Map inside the process would not.
const kv = vi.hoisted(() => ({ map: new Map<string, { v: string; exp: number | null }>(), now: () => Date.now() }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => {
    const live = (k: string) => {
      const e = kv.map.get(k);
      if (e && e.exp !== null && e.exp <= kv.now()) kv.map.delete(k);
      return kv.map.get(k);
    };
    const add = (k: string, d: number) => {
      const e = live(k);
      const n = Number(e?.v ?? 0) + d;
      kv.map.set(k, { v: String(n), exp: e?.exp ?? null });
      return n;
    };
    return {
      get: async (k: string) => live(k)?.v ?? null,
      set: async (k: string, v: string, ...args: (string | number)[]) => {
        const ex = args.indexOf("EX");
        if (args.includes("NX") && live(k)) return null;
        kv.map.set(k, { v, exp: ex >= 0 ? kv.now() + Number(args[ex + 1]) * 1000 : null });
        return "OK";
      },
      del: async (k: string) => (kv.map.delete(k) ? 1 : 0),
      incr: async (k: string) => add(k, 1),
      decr: async (k: string) => add(k, -1),
      expire: async (k: string, s: number) => {
        const e = live(k);
        if (e) e.exp = kv.now() + s * 1000;
        return e ? 1 : 0;
      },
      ttl: async (k: string) => {
        const e = live(k);
        if (!e) return -2;
        return e.exp ? Math.ceil((e.exp - kv.now()) / 1000) : -1;
      },
    };
  },
}));
const db = vi.hoisted(() => ({ scores: [] as { score: number; scoreVersion: number }[] }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    freeAuditScore: {
      create: async ({ data }: { data: { score: number; scoreVersion: number } }) => db.scores.push(data),
      groupBy: async () => [],
    },
  },
}));
// The real guard resolves DNS; *.example does not resolve. Same contract: a bare name is not a URL.
vi.mock("@/lib/public-url", () => ({
  guardPublicUrl: async (b: string) => (/\./.test(b) && !/\s/.test(b) ? { ok: true, url: `https://${b.replace(/^https?:\/\//, "")}` } : { ok: false, reason: "not_a_url" }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/free-audit",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));

import { AuditRunner } from "@/components/free-audit/AuditRunner";
import { AUDIT_COPY } from "@/lib/free-audit/copy";
import { resultFacts } from "@/lib/free-audit/facts";
import { FREE_AUDIT_DAILY_LIMIT, FREE_AUDIT_WINDOW_HOURS } from "@/lib/free-audit/limits";
import { AV_COPY } from "@/lib/ai-visibility-landing/copy";
import { comparisonTable } from "@/lib/pricing-page/compare";

const ROOT = join(__dirname, "..");
const FIX = JSON.parse(readFileSync(join(__dirname, "fixtures/free-audit/sidecar-audits.json"), "utf8")) as Record<
  "poor" | "average" | "strong",
  Record<string, unknown> & { score: number; grade: string }
>;
const QUALITIES = ["poor", "average", "strong"] as const;

type SidecarAnswer = (url: string) => Response;
const fromFixtures: SidecarAnswer = (url) => {
  const q = QUALITIES.find((x) => url.includes(`${x}.example`));
  return q ? Response.json(FIX[q]) : Response.json({ error: `Couldn't fetch ${url} (could not connect).`, reason: "unreachable", status: null }, { status: 502 });
};

/** The browser's fetch: /api/av/audit goes to the route (as `ip`), the sidecar URL to `sidecar`. */
function wire(ip: string | null, sidecar: SidecarAnswer = fromFixtures) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/av/audit")) {
        const route = await import("@/app/api/av/audit/route");
        const headers: Record<string, string> = { "content-type": "application/json", "cf-ipcountry": "US" };
        if (ip) headers["cf-connecting-ip"] = ip;
        const req = new Request(`https://echorank360.com${url}`, { method: init?.method ?? "GET", headers, body: init?.body });
        return (init?.method === "POST" ? route.POST : route.GET)(req as never);
      }
      if (/\/audit$/.test(url)) return sidecar(JSON.parse(String(init?.body)).url);
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

/** One POST straight to the route, as a visitor from `ip`. */
async function post(brand: string, ip: string | null = "198.51.100.20", extra: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/av/audit/route");
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (ip) headers["cf-connecting-ip"] = ip;
  return POST(new Request("https://echorank360.com/api/av/audit", { method: "POST", headers, body: JSON.stringify({ brand }) }) as never);
}
async function get(ip: string | null = "198.51.100.20", extra: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/av/audit/route");
  const headers: Record<string, string> = { ...extra };
  if (ip) headers["cf-connecting-ip"] = ip;
  return GET(new Request("https://echorank360.com/api/av/audit", { headers }) as never);
}

beforeEach(() => {
  kv.map.clear();
  kv.now = () => Date.now();
  db.scores.length = 0;
  wire("198.51.100.20");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const facts = resultFacts("en");
async function runThroughTheForm(domain: string) {
  render(<AuditRunner facts={facts} />);
  fireEvent.change(screen.getByLabelText(AUDIT_COPY.en.form.label), { target: { value: domain } });
  await act(async () => {
    fireEvent.submit(screen.getByTestId("audit-form"));
  });
}

describe("the full flow: form → API → sidecar → result", () => {
  it.each(QUALITIES)("%s fixture: the visitor gets its score", async (q) => {
    wire(`203.0.113.${QUALITIES.indexOf(q) + 1}`);
    await runThroughTheForm(`${q}.example`);
    const card = await screen.findByTestId("audit-score", {}, { timeout: 5000 });
    expect(card.textContent).toContain(String(FIX[q].score));
    expect(card.textContent).toContain(FIX[q].grade);
    expect(screen.queryByTestId("audit-error")).toBeNull();
  });

  it("the three fixtures span the scale (the flow is not returning a constant)", () => {
    expect(FIX.poor.score).toBeLessThan(FIX.average.score);
    expect(FIX.average.score).toBeLessThan(FIX.strong.score);
  });

  it("each answer reports what is left: 2, 1, 0 of 3", async () => {
    const left = [];
    for (const q of QUALITIES) left.push((await (await post(`${q}.example`)).json()).remaining);
    expect(left).toEqual([FREE_AUDIT_DAILY_LIMIT - 1, FREE_AUDIT_DAILY_LIMIT - 2, FREE_AUDIT_DAILY_LIMIT - 3]);
  });
});

describe("a homepage the sidecar could not read", () => {
  it.each([
    ["unreachable", null],
    ["blocked", 403],
    ["rate_limited", 429],
    ["server_error", 520],
    ["not_found", 404],
    ["empty", 200],
  ] as const)("%s: its own message, and no audit used", async (reason, status) => {
    wire("198.51.100.30", (url) => Response.json({ error: `Couldn't fetch ${url} (HTTP ${status}).`, reason, status }, { status: 502 }));
    await runThroughTheForm("acme.example");
    const err = await screen.findByTestId("audit-error");
    expect(err.textContent).toBe(AUDIT_COPY.en.errors.fetch[reason]);
    expect((await (await get("198.51.100.30")).json()).remaining).toBe(FREE_AUDIT_DAILY_LIMIT);
  });

  it("an older sidecar without a reason is still 'unreachable', not 'could not run'", async () => {
    wire("198.51.100.31", (url) => Response.json({ error: `Couldn't fetch ${url} (HTTP 403).` }, { status: 502 }));
    const res = await post("acme.example", "198.51.100.31");
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "unreachable", reason: "unreachable" });
  });

  it("a business name, which the old form invited, says what to enter instead", async () => {
    await runThroughTheForm("Joe's Plumbing");
    const err = await screen.findByTestId("audit-error");
    expect(err.textContent).toBe(AUDIT_COPY.en.errors.invalid);
    expect(err.textContent).toMatch(/business name/);
  });

  it("a sidecar crash is 'on our side' and uses no audit", async () => {
    wire("198.51.100.32", () => {
      throw new Error("ECONNREFUSED");
    });
    const res = await post("acme.example", "198.51.100.32");
    expect(res.status).toBe(502);
    expect((await (await get("198.51.100.32")).json()).remaining).toBe(FREE_AUDIT_DAILY_LIMIT);
  });
});

describe(`the allowance: ${FREE_AUDIT_DAILY_LIMIT} per cf-connecting-ip per ${FREE_AUDIT_WINDOW_HOURS} h`, () => {
  it("is 3", () => {
    expect(FREE_AUDIT_DAILY_LIMIT).toBe(3);
  });

  it("the 4th audit in 24 h is refused with the time of the next one, 24 h after the first", async () => {
    const t0 = Date.UTC(2026, 10, 10, 9, 0, 0);
    kv.now = () => t0;
    vi.useFakeTimers({ toFake: ["Date"], now: t0 });
    try {
      for (let i = 0; i < FREE_AUDIT_DAILY_LIMIT; i++) {
        kv.now = () => t0 + i * 3_600_000;
        vi.setSystemTime(t0 + i * 3_600_000);
        expect((await post("strong.example")).status).toBe(200);
      }
      kv.now = () => t0 + 5 * 3_600_000;
      vi.setSystemTime(t0 + 5 * 3_600_000);
      const res = await post("strong.example");
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body).toMatchObject({ error: "rate_limited", perDay: 3, remaining: 0 });
      expect(Date.parse(body.retryAt)).toBe(t0 + 24 * 3_600_000);

      // …and the window really ends then.
      kv.now = () => t0 + 24 * 3_600_000 + 1000;
      vi.setSystemTime(t0 + 24 * 3_600_000 + 1000);
      expect((await post("strong.example")).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the form shows what is left, then the retry time at the limit, and disables the button", async () => {
    render(<AuditRunner facts={facts} />);
    expect((await screen.findByTestId("audit-left")).textContent).toBe("3 of 3 audits left today");
    cleanup();
    for (let i = 0; i < FREE_AUDIT_DAILY_LIMIT; i++) await post("average.example");
    await runThroughTheForm("poor.example");
    const err = await screen.findByTestId("audit-error");
    expect(err.textContent).toMatch(/^You’ve used all 3 free audits for today \(3 per IP address every 24 hours\)\. You can run the next one on .+\.$/);
    expect((screen.getByTestId("audit-run") as HTMLButtonElement).disabled).toBe(true);
  });

  it("a burst of 6 parallel audits from one address runs exactly 3", async () => {
    const statuses = (await Promise.all(Array.from({ length: 6 }, () => post("strong.example")))).map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(3);
  });

  it("each address has its own allowance", async () => {
    for (let i = 0; i < 3; i++) await post("strong.example", "192.0.2.1");
    expect((await post("strong.example", "192.0.2.1")).status).toBe(429);
    expect((await post("strong.example", "192.0.2.2")).status).toBe(200);
  });

  it("the count survives a web restart: it is in Redis, not in the process", async () => {
    for (let i = 0; i < 3; i++) expect((await post("strong.example")).status).toBe(200);
    expect(kv.map.get("echorank:av-free-audit:198.51.100.20")?.v).toBe("3");

    vi.resetModules(); // a fresh module graph: what `pm2 restart echorank360-web` leaves
    const res = await post("strong.example");
    expect(res.status).toBe(429);
    expect((await (await get()).json()).remaining).toBe(0);
  });

  it("no cf-connecting-ip is a 403, for GET and POST, whatever x-forwarded-for says", async () => {
    for (const res of [await post("strong.example", null, { "x-forwarded-for": "198.51.100.9" }), await get(null, { "x-forwarded-for": "198.51.100.9" })]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "no_client_ip" });
    }
    expect([...kv.map.keys()]).toEqual([]);
    wire(null);
    await runThroughTheForm("strong.example");
    expect((await screen.findByTestId("audit-error")).textContent).toBe(AUDIT_COPY.en.errors.noClientIp);
  });
});

describe("the copy says 3, from config, in en / fr / de-CH", () => {
  const LOCALES = ["en", "fr", "de-CH"] as const;
  const want = { en: "3 free audits", fr: "3 audits gratuits", "de-CH": "3 free audits" } as const; // /free-audit folds de-CH to en

  it.each(LOCALES)("%s: /free-audit hero, form, FAQ, JSON-LD and meta description", async (locale) => {
    const mod = await import("@/app/[locale]/free-audit/page");
    const html = renderToStaticMarkup(await mod.default({ params: Promise.resolve({ locale }) }));
    const meta = await mod.generateMetadata({ params: Promise.resolve({ locale }) });
    const n = (s: string) => s.split(want[locale]).length - 1;
    expect(String(meta.description)).toContain(want[locale]);
    expect(n(html)).toBeGreaterThanOrEqual(4); // hero, form fine print, FAQ, FAQPage + WebPage JSON-LD
    expect(html).not.toMatch(/One (free )?audit|Un audit gratuit|1 free audit/);
  });

  it.each(LOCALES)("%s: the /ai-visibility tools tile", async (locale) => {
    const mod = await import("@/app/[locale]/ai-visibility/page");
    const html = renderToStaticMarkup(await mod.default({ params: Promise.resolve({ locale }) }));
    const tile = { en: "3 audits a day", fr: "3 audits par jour", "de-CH": "3 Audits pro Tag" }[locale];
    expect(html).toContain(tile);
    expect(AV_COPY[locale === "de-CH" ? "de" : locale].tools.audit.perDay(1)).not.toContain("1 ");
  });

  it.each(LOCALES)("%s: the /pricing compare row", (locale) => {
    const t = comparisonTable(locale);
    const row = t.groups.flatMap((g) => g.rows).find((r) => r.id === "audit")!;
    const text = { en: "3 free audits a day", fr: "3 audits gratuits par jour", "de-CH": "3 Gratis-Audits pro Tag" }[locale];
    expect(JSON.stringify(row)).toContain(text);
  });

  it("the technical-geo landing (a static payload, English) states the same number", () => {
    const src = readFileSync(join(ROOT, "src/app/[locale]/technical-geo/landing-html.ts"), "utf8");
    expect(src).toContain(`You get ${FREE_AUDIT_DAILY_LIMIT} free audits a day`);
    expect(src).not.toMatch(/one free AI visibility audit per day/i);
  });

  it.each([
    ["en", "Your website, e.g. example.com"],
    ["fr", "Votre site web, p. ex. example.com"],
    ["de-CH", "Your website, e.g. example.com"], // the page folds de-CH to en
  ] as const)("%s: the input asks for a website, never a brand", (locale, placeholder) => {
    const html = renderToStaticMarkup(<AuditRunner facts={resultFacts(locale)} />);
    expect(html).toContain(`placeholder="${placeholder}"`);
    expect(html).not.toMatch(/brand|marque|Marke/i);
  });

  it("the form's line reads '{remaining} of 3 audits left today' in en and fr", () => {
    expect(AUDIT_COPY.en.form.left(2, 3)).toBe("2 of 3 audits left today");
    expect(AUDIT_COPY.fr.form.left(2, 3)).toBe("Il vous reste 2 audits sur 3 aujourd’hui");
    expect(AUDIT_COPY.fr.form.left(1, 3)).toBe("Il vous reste 1 audit sur 3 aujourd’hui");
  });
});
