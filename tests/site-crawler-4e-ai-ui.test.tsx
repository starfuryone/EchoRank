// @vitest-environment jsdom
//
// tests/site-crawler-4e-ai-ui.test.tsx — Phase 4e AI prompts in the UI: the
// start-card section and its estimate, the confirm line, the crawl status
// line, and the Integrations card (write-only keys), in every dashboard
// locale; and the keys route, which never echoes a key.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (orig) => ({ ...(await orig<typeof import("@/lib/paid-plan")>()), requirePaidPlan: () => requirePaidPlan() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
const tenantAiKey = { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { tenantAiKey } }));

import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { AiPromptsSection, aiConfirmLine, aiEstimate, aiEstimateLine, aiStatusText, defaultProvider, type AiQuota } from "@/components/seo-tools/site-crawler-ai";
import { FLAGS } from "@/lib/flags";
import { AiKeysIntegration } from "@/components/settings/ai-keys-integration";
import type { AiConfig } from "@/lib/site-crawler/ai-shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const LOCALES = ["en", "fr", "de-CH"] as const;
const quota: AiQuota = { aiPageCap: 100, aiTokensUsed: 50_000, aiTokenLimit: 500_000, aiClaude: true, aiKeys: { openai: false, gemini: true } };
const ai: AiConfig = { provider: "claude", prompts: [{ preset: "title", text: null }, { preset: "grammar", text: null }], top: { pages: 20, segment: null } };
const int = new Intl.NumberFormat("en-US");

describe("start card", () => {
  it.each(LOCALES)("%s: off by default; on, shows presets, providers and the estimate", async (l) => {
    const t = SITE_CRAWLER_COPY[l];
    const el = document.createElement("div");
    const root = createRoot(el);
    const onChange = vi.fn();
    await act(async () => root.render(<AiPromptsSection t={t.p4e} t4d={t.p4d} quota={quota} value={null} segments={["Shop"]} int={int} disabled={false} onChange={onChange} />));
    expect(el.textContent).toContain(t.p4e.aiOn);
    (el.querySelector("input[type=checkbox]") as HTMLInputElement).click();
    expect(onChange).toHaveBeenCalledWith({ provider: "claude", prompts: [{ preset: "title", text: null }], top: { pages: 10, segment: null } });
    await act(async () => root.render(<AiPromptsSection t={t.p4e} t4d={t.p4d} quota={quota} value={{ ...ai, provider: "openai" }} segments={["Shop"]} int={int} disabled={false} onChange={onChange} />));
    expect(el.textContent).toContain(t.p4e.aiKeyMissing("OpenAI"));
    // OpenAI goes through a batch: 20 pages × 2 prompts × 1,200 charged tokens (2,400 halved).
    expect(el.textContent).toContain(t.p4e.aiEstimateOwn("48,000", "OpenAI"));
    expect([...el.querySelectorAll("option")].map((o) => o.textContent)).toEqual(expect.arrayContaining([t.p4e.aiPresets.title, t.p4e.aiProviders.gemini, t.p4d.bySegment("Shop")]));
    if (l === "de-CH") expect(JSON.stringify(t.p4e)).not.toContain("ß");
    root.unmount();
  });

  it("estimates against the budget left, or unmetered; confirm and status lines", () => {
    const t = SITE_CRAWLER_COPY.en.p4e;
    expect(aiEstimateLine(t, ai, quota, int)).toBe(t.aiEstimate("48,000", "450,000"));
    expect(aiEstimateLine(t, ai, { ...quota, aiTokenLimit: null }, int)).toBe(t.aiEstimateUnmetered("48,000"));
    expect(aiConfirmLine(t, ai, int)).toBe(t.confirmAi("20", "2", "48,000"));
    // Gemini stays synchronous; with crawl.aiBatch off nothing is batched.
    expect(aiEstimate({ ...ai, provider: "gemini" })).toBe(96_000);
    expect(aiEstimate(ai, { ...FLAGS, "crawl.aiBatch": false })).toBe(96_000);
    expect(aiStatusText({ status: "stopped", stoppedReason: "token_budget" }, t, int)).toBe(t.aiStatusBudget);
    expect(aiStatusText({ status: "done", targets: 20, completed: 20, tokens: 33200 }, t, int)).toBe(t.aiStatusDone("20", "20", "33,200"));
    expect(aiStatusText(undefined, t, int)).toBeNull();
    // Batch mode: "queued in batch" while the provider works on it.
    expect(aiStatusText({ status: "queued_batch", targets: 20, completed: 0 }, t, int)).toBe(t.aiStatusBatch("0", "20"));
    expect(defaultProvider({ ...quota, aiClaude: false })).toBe("gemini");
  });
});

describe("Integrations card", () => {
  it.each(LOCALES)("%s: shows saved / not saved, never a key", async (l) => {
    const t = SITE_CRAWLER_COPY[l].p4e;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ openai: { set: true, createdAt: "2026-11-01T00:00:00Z", lastUsedAt: null }, gemini: { set: false, createdAt: null, lastUsedAt: null } }) })));
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<AiKeysIntegration t={t} locale={l} />));
    expect(el.textContent).toContain(t.keysTitle);
    expect(el.textContent).toContain(t.keyNotSet);
    expect(el.textContent).toContain(t.keyReplace);
    expect([...el.querySelectorAll("input")].every((i) => i.type === "password" && i.value === "")).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
  });
});

describe("/api/seo/v1/ai-keys", () => {
  const SECRET = "sk-live-" + "s".repeat(40);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", "test-key");
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    tenantAiKey.findMany.mockResolvedValue([{ provider: "openai", createdAt: new Date("2026-11-01"), lastUsedAt: null }]);
  });

  it("stores the key encrypted for the caller's tenant and answers without it", async () => {
    const { PUT } = await import("@/app/api/seo/v1/ai-keys/route");
    const res = await PUT(new Request("https://app.test/api/seo/v1/ai-keys", { method: "PUT", body: JSON.stringify({ provider: "openai", key: SECRET }) }));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("sk-live");
    const call = tenantAiKey.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ tenantId_provider: { tenantId: "t1", provider: "openai" } });
    expect(JSON.stringify(call)).not.toContain(SECRET);
  });

  it("refuses an implausible key without echoing it", async () => {
    const { PUT } = await import("@/app/api/seo/v1/ai-keys/route");
    const res = await PUT(new Request("https://app.test/api/seo/v1/ai-keys", { method: "PUT", body: JSON.stringify({ provider: "gemini", key: "not a key with spaces" }) }));
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("spaces");
    const bad = await PUT(new Request("https://app.test/api/seo/v1/ai-keys", { method: "PUT", body: JSON.stringify({ provider: "anthropic", key: SECRET }) }));
    expect(bad.status).toBe(400);
    expect(await bad.text()).not.toContain("sk-live");
  });

  it("deletes only the caller's tenant's key", async () => {
    const { DELETE } = await import("@/app/api/seo/v1/ai-keys/route");
    expect((await DELETE(new Request("https://app.test/api/seo/v1/ai-keys?provider=gemini", { method: "DELETE" }))).status).toBe(204);
    expect(tenantAiKey.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "t1", provider: "gemini" } });
  });
});
