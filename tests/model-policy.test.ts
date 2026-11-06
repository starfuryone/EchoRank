// House policy, in both repos: claude-haiku-5-5 for every Anthropic call that
// is not a tracking answer (the owner's decision, 2026-11-06; it was Haiku 4.5
// everywhere until then). One named exception: the crawler's AI step
// (src/lib/site-crawler/ai-prompts.ts) falls back to claude-haiku-4-5 when the
// API rejects its configured model. Tracking answers — what we OBSERVE a model
// saying — are a different job with their own pin, not asserted here.
//
// Source-level assertions rather than behavioural ones, because the point is
// that NO call site anywhere can name another model — including the av-service
// Python files, which no TypeScript test would otherwise reach. A behavioural
// test can only cover the paths it happens to invoke; this covers all of them.
// The request rules that go with the model (no temperature, no prefill,
// thinking off) are tested behaviourally in tests/anthropic-request.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { HOUSE_CLAUDE_MODEL } from "@/ai/anthropic-request";

const APP = process.cwd();
const AV = "/opt/echorank/av-service";
const HOUSE = "claude-haiku-5-5";

const read = (p: string) => readFileSync(p, "utf8");
const claudeIds = (src: string) =>
  [...src.matchAll(/claude-[a-z0-9.-]+/g)].map((m) => m[0].replace(/-\d{8}$/, ""));

/** Every file that pins the model for a house (non-tracking) Anthropic call. */
const APP_CALL_SITES = [
  "src/lib/marketing-templates.ts",
  "src/ai/providers/anthropic.ts",
  "src/app/api/ai/respond/route.ts",
  "src/lib/ai-monitor/analysis/llm.ts",
  "src/lib/ai-monitor/json-call.ts",
  "src/lib/blog-agent/config.ts",
];

/** av-service files that make a house call. answer_track.py is a tracking answer. */
const AV_HOUSE_SITES: Array<[string, string]> = [
  ["remediate.py", "REMEDIATE_MODEL"],
  ["keyword_suggest.py", "KEYWORDS_MODEL"],
];

describe("the house model", () => {
  it("is Haiku 5.5", () => {
    expect(HOUSE_CLAUDE_MODEL).toBe(HOUSE);
  });
});

describe("app Anthropic call sites", () => {
  it("name claude-haiku-5-5 and no other Claude model", () => {
    for (const rel of APP_CALL_SITES) {
      const models = claudeIds(read(join(APP, rel)));
      expect(models.length, `${rel} names no model`).toBeGreaterThan(0);
      for (const m of models) expect(m, `${rel} -> ${m}`).toBe(HOUSE);
    }
  });

  it("pin each constant exactly", () => {
    const pins: Array<[string, string]> = [
      ["src/lib/marketing-templates.ts", `export const MARKETING_MODEL = "${HOUSE}"`],
      ["src/ai/providers/anthropic.ts", `const DEFAULT_MODEL = "${HOUSE}"`],
      ["src/app/api/ai/respond/route.ts", `process.env.AI_RESPOND_MODEL || "${HOUSE}"`],
      ["src/lib/ai-monitor/analysis/llm.ts", `export const ANALYSIS_MODEL = "${HOUSE}"`],
      ["src/lib/ai-monitor/json-call.ts", `export const JSON_CALL_MODEL = "${HOUSE}"`],
      ["src/lib/blog-agent/config.ts", `export const DEFAULT_BLOG_AGENT_MODEL = "${HOUSE}"`],
    ];
    for (const [rel, pin] of pins) expect(read(join(APP, rel)), rel).toContain(pin);
  });

  it("defaults the assistant's fast tier to the house model", async () => {
    const { fastModel } = await import("@/lib/assistant/config");
    const saved = process.env.AI_ASSISTANT_MODEL_FAST;
    delete process.env.AI_ASSISTANT_MODEL_FAST;
    try {
      expect(fastModel()).toBe(HOUSE);
    } finally {
      if (saved !== undefined) process.env.AI_ASSISTANT_MODEL_FAST = saved;
    }
  });

  it("prices the house model, so usage is never costed at $0", async () => {
    const { estimateCost } = await import("@/ai/config");
    const { costUsdFor } = await import("@/lib/ai-monitor/pricing");
    expect(estimateCost(HOUSE, 1000, 1000)).toBeGreaterThan(0);
    const metered = costUsdFor(
      "CLAUDE",
      HOUSE,
      { inputTokens: 1000, outputTokens: 1000, cachedInputTokens: 0 },
      {} as NodeJS.ProcessEnv,
    );
    expect(metered.priced).toBe(true);
    expect(metered.costUsd).toBeGreaterThan(0);
  });
});

describe("the crawler AI exception", () => {
  it("names exactly claude-haiku-5-5 (default) and claude-haiku-4-5 (fallback)", () => {
    const src = read(join(APP, "src/lib/site-crawler/ai-prompts.ts"));
    const models = new Set([...src.matchAll(/"(claude-[a-z0-9.-]+)"/g)].map((m) => m[1]));
    expect([...models].sort()).toEqual(["claude-haiku-4-5", "claude-haiku-5-5"]);
    expect(src).toContain('CLAUDE_CRAWL_DEFAULT_MODEL = "claude-haiku-5-5"');
    expect(src).toContain('CLAUDE_CRAWL_FALLBACK_MODEL = "claude-haiku-4-5"');
  });
});

describe("av-service Anthropic call sites", () => {
  const readAv = (file: string) => {
    const path = join(AV, file);
    if (!existsSync(path)) throw new Error(`${file} missing — av-service layout changed`);
    return read(path);
  };

  it("name claude-haiku-5-5 and no other Claude model", () => {
    for (const [file] of AV_HOUSE_SITES) {
      const models = claudeIds(readAv(file));
      expect(models.length, `${file} names no model`).toBeGreaterThan(0);
      for (const m of models) expect(m, `${file} -> ${m}`).toBe(HOUSE);
    }
  });

  it("keep the env override documented and defaulted to the house model", () => {
    for (const [file, envVar] of AV_HOUSE_SITES) {
      expect(readAv(file), `${file} ${envVar}`).toMatch(
        new RegExp(`${envVar}"?\\s*,\\s*"${HOUSE}"`),
      );
    }
  });

  it("turn thinking off and send no temperature or prefill", () => {
    for (const [file] of AV_HOUSE_SITES) {
      const src = readAv(file);
      expect(src, file).toMatch(/thinking\s*=\s*\{\s*"type"\s*:\s*"disabled"\s*\}/);
      expect(src, file).not.toMatch(/temperature\s*=/);
      expect(src, file).not.toMatch(/"role"\s*:\s*"assistant"/);
    }
  });
});

describe("no Sonnet or Opus in any live Anthropic path", () => {
  it("leaves only the price table naming other Claude models", () => {
    // config.ts is a PRICE TABLE, not a call site: it has to keep rates for
    // models we might see in historical usage rows. Everything else is clean.
    const src = read(join(APP, "src/ai/config.ts"));
    const sonnetOrOpus = [...src.matchAll(/claude-(sonnet|opus)[a-z0-9.-]*/g)];
    expect(sonnetOrOpus.length).toBeGreaterThan(0); // still priced
    for (const m of sonnetOrOpus) {
      const line = src.slice(0, m.index).split("\n").length;
      const text = src.split("\n")[line - 1];
      // Every remaining mention must be a rate entry or a comment, never a
      // `model:` assignment.
      expect(text, `config.ts:${line}`).not.toMatch(/model\s*[:=]\s*["']claude-(sonnet|opus)/);
    }
  });
});
