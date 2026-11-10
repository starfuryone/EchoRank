// @vitest-environment jsdom
//
// The free AI Readiness Audit's result and its API (ECHORANK-AI-VISIBILITY-
// PAGES.md Phase 2, 2026-11-10): the cap line, the top 3 fixes in order of
// points, snippets that stay text whatever the audited page contains, the
// benchmark's 200-result floor, the 7-day permalink, the bridge to the AI
// Visibility Check, the email option that is never a gate, and the run's
// typed refusals (rate limit with a time, unreachable without using the
// allowance).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => ({ map: new Map<string, { v: string; exp: number | null }>(), now: () => Date.now() }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    get: async (k: string) => {
      const e = kv.map.get(k);
      if (!e || (e.exp !== null && e.exp <= kv.now())) return null;
      return e.v;
    },
    set: async (k: string, v: string, ...args: (string | number)[]) => {
      const ex = args.indexOf("EX");
      if (args.includes("NX") && kv.map.has(k)) return null;
      kv.map.set(k, { v, exp: ex >= 0 ? kv.now() + Number(args[ex + 1]) * 1000 : null });
      return "OK";
    },
    del: async (k: string) => (kv.map.delete(k) ? 1 : 0),
    incr: async (k: string) => {
      const n = Number(kv.map.get(k)?.v ?? 0) + 1;
      kv.map.set(k, { v: String(n), exp: kv.map.get(k)?.exp ?? null });
      return n;
    },
    expire: async (k: string, s: number) => {
      const e = kv.map.get(k);
      if (e) e.exp = kv.now() + s * 1000;
      return 1;
    },
    ttl: async (k: string) => {
      const e = kv.map.get(k);
      return e?.exp ? Math.ceil((e.exp - kv.now()) / 1000) : -1;
    },
  }),
}));

const db = vi.hoisted(() => ({
  scores: [] as { score: number; scoreVersion: number }[],
  leads: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    freeAuditScore: {
      create: async ({ data }: { data: { score: number; scoreVersion: number } }) => db.scores.push(data),
      groupBy: async ({ where }: { where: { scoreVersion: number } }) => {
        const counts = new Map<number, number>();
        for (const r of db.scores.filter((s) => s.scoreVersion === where.scoreVersion)) counts.set(r.score, (counts.get(r.score) ?? 0) + 1);
        return [...counts].map(([score, n]) => ({ score, _count: { _all: n } }));
      },
    },
    freeCrawlLead: { upsert: async ({ create }: { create: Record<string, unknown> }) => db.leads.push(create) },
  },
}));
const mail = vi.hoisted(() => ({ sent: [] as { to: string[]; attachments?: unknown[] }[] }));
vi.mock("@/lib/mailer", () => ({ sendMail: async (m: { to: string[] }) => (mail.sent.push(m), true) }));
vi.mock("@/lib/public-url", () => ({ guardPublicUrl: async (b: string) => ({ ok: true, url: `https://${b}` }) }));
vi.mock("@/lib/csrf-protection", () => ({ csrfProtection: () => null }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true, remaining: 1 }) }));

import { FreeAuditResult, type ResultExtras } from "@/components/free-audit/FreeAuditResult";
import { POST as runAudit } from "@/app/api/av/audit/route";
import { POST as emailPdf } from "@/app/api/av/audit/email/route";
import { benchmarkFrom } from "@/lib/free-audit/benchmark";
import { resultFacts } from "@/lib/free-audit/facts";
import { BENCHMARK_MIN_RESULTS, FREE_AUDIT_RESULT_DAYS } from "@/lib/free-audit/limits";
import { getResult, saveResult } from "@/lib/free-audit/store";
import { crawlerRows, orgSnippet, topFixesOf } from "@/lib/free-audit/view";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HOSTILE = 'Acme </script><script>alert("x")</script> "Plumbing"';
function audit(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    brand: "acme.example",
    url: "https://acme.example/",
    score: 45,
    grade: "D",
    score_version: 3,
    head: { title: `${HOSTILE} | Home` },
    gates: [{ id: "thin-homepage", cap: 45, reason: "x", params: { words: 90 } }],
    groups: [
      { id: "access", title: "Access", points: 10, max: 17 },
      { id: "entity", title: "Entity & trust", points: 4, max: 30 },
    ],
    checks: [
      { id: "robots-answer-bots", category: "Answer bots", points: 6, max: 6, status: "", group: "access" },
      { id: "explicit-welcome", category: "Welcome", points: 0, max: 5, status: "", group: "access" },
      { id: "org-schema", category: "Org", points: 0, max: 8, status: "", group: "entity", params: { found: false } },
      { id: "llms-txt", category: "llms.txt", points: 0, max: 0, status: "", group: "access", scored: false },
      { id: "nap", category: "NAP", points: 0, max: 4, status: "", group: "entity", ran: false },
    ],
    // Deliberately out of order: the view sorts by points recoverable.
    top_fixes: [
      { id: "explicit-welcome", kind: "check", recover: 3 },
      { id: "thin-homepage", kind: "gate", recover: 12 },
      { id: "org-schema", kind: "check", recover: 7 },
      { id: "dates", kind: "check", recover: 1 },
    ],
    robots: {
      present: true,
      bots: {
        GPTBot: { status: "BLOCKED", detail: "Disallow: / (matched 'GPTBot')" },
        "OAI-SearchBot": { status: "ALLOWED", detail: "allowed (matched '*')" },
        "ChatGPT-User": { status: "ALLOWED", detail: "no matching rule (default allow)" },
      },
    },
    verdicts: [{ id: "cloudflare", key: "cloudflare.detected", pass: null }],
    ...over,
  };
}
const extras = (over: Partial<ResultExtras> = {}): ResultExtras => ({ resultId: "a".repeat(24), benchmark: null, emailAllowed: true, ...over });
const doc = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};
const render = (a = audit(), e = extras(), locale = "en") =>
  doc(renderToStaticMarkup(<FreeAuditResult audit={a} facts={resultFacts(locale)} extras={e} />));

beforeEach(() => {
  kv.map.clear();
  kv.now = () => Date.now();
  db.scores = [];
  db.leads = [];
  mail.sent = [];
  vi.unstubAllGlobals();
});

describe("the result view", () => {
  it("shows the cap when a gate applies, and none when none does", () => {
    const el = render();
    expect(el.querySelector('[data-testid="audit-gate"]')!.textContent).toBe("Capped at 45: homepage has under 150 words");
    expect(render(audit({ gates: [] })).querySelector('[data-testid="audit-gate"]')).toBeNull();
  });

  it("lists the top 3 fixes sorted by points recoverable, with why, effort and the fix", () => {
    const el = render();
    const ids = [...el.querySelectorAll("[data-fix]")].map((n) => n.getAttribute("data-fix"));
    expect(ids).toEqual(["thin-homepage", "org-schema", "explicit-welcome"]);
    expect(topFixesOf(audit()).map((f) => f.id)).toEqual(ids);
    const first = el.querySelector('[data-fix="thin-homepage"]')!.textContent!;
    expect(first).toMatch(/Why it matters:/);
    expect(first).toMatch(/The fix:/);
    expect(first).toMatch(/Effort: a few hours/);
  });

  it("snippets stay text: a hostile site name with </script> and quotes is escaped, never markup", () => {
    const html = renderToStaticMarkup(<FreeAuditResult audit={audit()} facts={resultFacts("en")} extras={extras()} />);
    // No script element came from the audited page.
    expect(doc(html).querySelectorAll("script")).toHaveLength(0);
    expect(html).not.toContain('<script>alert("x")</script>');
    const org = doc(html).querySelector('[data-testid="audit-snippet"][data-kind="org"] pre')!.textContent!;
    // The JSON-LD the visitor copies cannot close its own <script> tag.
    const inner = org.slice(org.indexOf("\n") + 1, org.lastIndexOf("</script>"));
    expect(inner).not.toContain("</script>");
    expect(inner).not.toContain("<");
    const json = JSON.parse(inner);
    expect(json.name).toBe(HOSTILE);
    expect(json.url).toBe("https://acme.example/");
    expect(orgSnippet(audit())).toMatch(/^<script type="application\/ld\+json">\n/);
    const robots = doc(html).querySelector('[data-kind="robots"] pre')!.textContent!;
    expect(robots).toContain("User-agent: OAI-SearchBot\nAllow: /");
  });

  it("the crawler table: status, the deciding robots.txt line and what it means, plus Cloudflare", () => {
    const el = render();
    const gpt = el.querySelector('[data-bot="GPTBot"]')!;
    expect(gpt.getAttribute("data-status")).toBe("blocked");
    expect(gpt.textContent).toContain("User-agent: GPTBot");
    expect(gpt.textContent).toContain("Disallow: /");
    expect(gpt.textContent).toContain("ChatGPT search is not affected");
    expect(el.querySelector('[data-bot="OAI-SearchBot"]')!.textContent).toContain("ChatGPT search can read your site.");
    expect(el.querySelector('[data-bot="ChatGPT-User"]')!.textContent).toContain("No rule (allowed by default)");
    expect(el.querySelectorAll('[data-testid="audit-crawlers"] tbody tr')).toHaveLength(7);
    expect(el.querySelector('[data-testid="audit-cloudflare"]')).not.toBeNull();
    // A bot challenge is a finding: every row says so.
    const ch = crawlerRows(audit({ gates: [{ id: "challenge", cap: 30 }] }));
    expect(new Set(ch.map((r) => r.status))).toEqual(new Set(["challenged"]));
  });

  it("all checks by group: points / max and pass, fail, not assessable, not scored", () => {
    const el = render();
    expect(el.querySelector('[data-check="robots-answer-bots"]')!.getAttribute("data-state")).toBe("pass");
    expect(el.querySelector('[data-check="explicit-welcome"]')!.textContent).toContain("0 / 5 · Fail");
    expect(el.querySelector('[data-check="nap"]')!.textContent).toContain("Not assessable");
    expect(el.querySelector('[data-check="llms-txt"]')!.textContent).toContain("not scored: no AI engine confirms using it");
    // Collapsed in the server render (a phone's default); a wider screen opens it after mount.
    expect(el.querySelector('[data-testid="audit-checks"] details')!.hasAttribute("open")).toBe(false);
  });

  it("the benchmark shows only with a benchmark, and the API's floor is 200 results", () => {
    expect(render().querySelector('[data-testid="audit-benchmark"]')).toBeNull();
    const el = render(audit(), extras({ benchmark: { higherThanPct: 62, n: 250 } }));
    expect(el.querySelector('[data-testid="audit-benchmark"]')!.textContent).toBe("Higher than 62% of sites checked.");
    const counts = Array.from({ length: 101 }, () => 0);
    counts[10] = BENCHMARK_MIN_RESULTS - 1;
    expect(benchmarkFrom({ n: BENCHMARK_MIN_RESULTS - 1, counts }, 50)).toBeNull();
    counts[10] = BENCHMARK_MIN_RESULTS;
    expect(benchmarkFrom({ n: BENCHMARK_MIN_RESULTS, counts }, 50)).toEqual({ higherThanPct: 100, n: BENCHMARK_MIN_RESULTS });
    expect(benchmarkFrom({ n: BENCHMARK_MIN_RESULTS, counts }, 10)).toEqual({ higherThanPct: 0, n: BENCHMARK_MIN_RESULTS });
  });

  it("the bridge opens the AI Visibility Check with the domain, and the check reads it to prefill", () => {
    const a = render().querySelector('[data-testid="audit-bridge-link"]')!;
    expect(a.getAttribute("href")).toBe("/en/ai-visibility-check?domain=acme.example");
    const src = readFileSync(join(__dirname, "../src/components/snapshot/SnapshotCheck.tsx"), "utf8");
    expect(src).toContain('params.get("domain")');
    expect(src).toContain("prefillFrom(domain)");
  });

  it("the upsell is built from config: the AI Visibility card, Link Authority's from-price, the free crawl", () => {
    const el = render();
    const up = el.querySelector('[data-testid="audit-upsell"]')!;
    expect(up.querySelector('[data-testid="audit-upsell-cta"]')!.getAttribute("href")).toBe("/en/pricing?plan=ai_visibility&src=free-audit-result");
    expect(up.textContent).toContain("Track this score daily and get an alert when it drops.");
    expect(up.textContent).toMatch(/Link Authority Checker: included in every plan from \$\d+\./);
    expect(up.textContent).toMatch(/Crawl 100 pages free with Nosy Bat\./);
  });

  it("the email option is never a gate: the PDF and the link are there without it, the consent box starts unticked", () => {
    const el = render();
    expect(el.querySelector('[data-testid="audit-pdf"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="audit-permalink"]')!.textContent).toContain(`/en/free-audit/r/${"a".repeat(24)}`);
    const consent = el.querySelector<HTMLInputElement>('[data-testid="audit-consent"]')!;
    expect(consent.checked).toBe(false);
    expect(consent.hasAttribute("required")).toBe(false);
    // Blocked country: no email form, the PDF and the link stay.
    const blocked = render(audit(), extras({ emailAllowed: false }));
    expect(blocked.querySelector('[data-testid="audit-email"]')).toBeNull();
    expect(blocked.querySelector('[data-testid="audit-pdf"]')).not.toBeNull();
  });
});

describe("the permalink", () => {
  it("lives 7 days under an unguessable id, then reads as expired", async () => {
    const t0 = Date.parse("2026-11-10T12:00:00Z");
    kv.now = () => t0;
    vi.setSystemTime(t0);
    const saved = (await saveResult(audit(), new Date(t0)))!;
    expect(saved.id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(Date.parse(saved.expiresAt) - t0).toBe(FREE_AUDIT_RESULT_DAYS * 86_400_000);
    expect((await getResult(saved.id))!.audit.score).toBe(45);
    kv.now = () => t0 + FREE_AUDIT_RESULT_DAYS * 86_400_000 + 1000;
    vi.setSystemTime(kv.now());
    expect(await getResult(saved.id)).toBeNull();
    expect(await getResult("../../etc/passwd")).toBeNull();
    vi.useRealTimers();
  });

  it("the permalink page is never indexed", async () => {
    const { generateMetadata } = await import("@/app/[locale]/free-audit/r/[id]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en", id: "x" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("the run's API", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    runAudit(new Request("https://echorank360.com/api/av/audit", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4", ...headers }, body: JSON.stringify(body) }) as never);

  it("a success stores the result, writes a score-only row and says whether email is offered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(audit()), { status: 200 })));
    const res = await post({ brand: "acme.example" }, { "cf-ipcountry": "US" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.resultId).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(body.emailAllowed).toBe(true);
    expect(body.benchmark).toBeNull();
    expect(db.scores).toEqual([{ score: 45, scoreVersion: 3 }]);
    expect(Object.keys(db.scores[0]).sort()).toEqual(["score", "scoreVersion"]);
    const fr = await (await post({ brand: "acme.example" }, { "cf-ipcountry": "FR", "cf-connecting-ip": "5.6.7.8" })).json();
    expect(fr.emailAllowed).toBe(false);
  });

  it("rate-limited: 429 with the time the next audit is possible and the per-day rule", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(audit()), { status: 200 })));
    await post({ brand: "acme.example" });
    const res = await post({ brand: "acme.example" });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "rate_limited", perDay: 1 });
    expect(Date.parse(body.retryAt) - Date.now()).toBeGreaterThan(23 * 3_600_000);
  });

  it("a site that does not answer is a friendly 422 and uses no allowance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Couldn't fetch https://x (timeout)." }), { status: 502 })));
    const res = await post({ brand: "down.example" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("unreachable");
    expect(kv.map.has("echorank:av-free-audit:1.2.3.4")).toBe(false);
  });
});

describe("Email me the PDF", () => {
  const send = (body: unknown, country = "US") =>
    emailPdf(new Request("https://echorank360.com/api/av/audit/email", { method: "POST", headers: { "content-type": "application/json", "cf-ipcountry": country, "cf-connecting-ip": "1.2.3.4" }, body: JSON.stringify(body) }) as never);

  it("sends once per result with the PDF attached; stores nobody without the separate consent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0x25, 0x50]), { status: 200 })));
    const saved = (await saveResult(audit()))!;
    const res = await send({ resultId: saved.id, email: "Me@Example.com" });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toEqual(["me@example.com"]);
    expect(mail.sent[0].attachments).toHaveLength(1);
    expect(db.leads).toEqual([]);
    expect((await send({ resultId: saved.id, email: "me@example.com" })).status).toBe(409);
  });

  it("with the consent box ticked, one lead row, source free-audit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0x25]), { status: 200 })));
    const saved = (await saveResult(audit()))!;
    await send({ resultId: saved.id, email: "me@example.com", marketingConsent: true });
    expect(db.leads).toEqual([expect.objectContaining({ email: "me@example.com", source: "free-audit", marketingConsent: true, domain: "acme.example" })]);
  });

  it("blocked country → 403 and nothing sent; an expired result → 410", async () => {
    const saved = (await saveResult(audit()))!;
    expect((await send({ resultId: saved.id, email: "me@example.com" }, "DE")).status).toBe(403);
    expect(mail.sent).toEqual([]);
    expect((await send({ resultId: "b".repeat(24), email: "me@example.com" })).status).toBe(410);
  });
});
