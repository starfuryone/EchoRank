// House policy: claude-haiku-4-5 for every Anthropic call, in both repos.
//
// Source-level assertions rather than behavioural ones, because the point is
// that NO call site anywhere can name another model — including the av-service
// Python files, which no TypeScript test would otherwise reach. A behavioural
// test can only cover the paths it happens to invoke; this covers all of them.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP = process.cwd();
const AV = "/opt/echorank/av-service";

const read = (p: string) => readFileSync(p, "utf8");

/** Every file that selects a model for an Anthropic call. */
const APP_CALL_SITES = [
  "src/lib/marketing-templates.ts",
  "src/ai/providers/anthropic.ts",
  "src/app/api/ai/respond/route.ts",
];

const AV_CALL_SITES = ["remediate.py", "answer_track.py", "keyword_suggest.py"];

describe("app Anthropic call sites", () => {
  it("names claude-haiku-4-5 and no other Claude model", () => {
    for (const rel of APP_CALL_SITES) {
      const src = read(join(APP, rel));
      const models = [...src.matchAll(/claude-[a-z0-9.-]+/g)].map((m) => m[0]);
      expect(models.length, `${rel} names no model`).toBeGreaterThan(0);
      for (const m of models) {
        // Allow the dated snapshot form of the same model.
        expect(m.replace(/-\d{8}$/, ""), `${rel} -> ${m}`).toBe("claude-haiku-4-5");
      }
    }
  });

  it("pins the marketing constant exactly", () => {
    expect(read(join(APP, "src/lib/marketing-templates.ts"))).toContain(
      'export const MARKETING_MODEL = "claude-haiku-4-5"',
    );
  });

  it("defaults the shared provider to Haiku", () => {
    expect(read(join(APP, "src/ai/providers/anthropic.ts"))).toContain(
      'const DEFAULT_MODEL = "claude-haiku-4-5"',
    );
  });

  it("defaults the respond route to Haiku", () => {
    expect(read(join(APP, "src/app/api/ai/respond/route.ts"))).toContain(
      '"claude-haiku-4-5"',
    );
  });

  it("prices the undated Haiku id, so usage is never costed at $0", async () => {
    const { COST_PER_1K_TOKENS, estimateCost } = await import("@/ai/config");
    expect(COST_PER_1K_TOKENS["claude-haiku-4-5"]).toBeDefined();
    expect(estimateCost("claude-haiku-4-5", 1000, 1000)).toBeGreaterThan(0);
    // And the dated form still resolves through the suffix-stripping fallback.
    expect(estimateCost("claude-haiku-4-5-20251001", 1000, 1000)).toBeGreaterThan(0);
  });
});

describe("av-service Anthropic call sites", () => {
  it("names claude-haiku-4-5 and no other Claude model", () => {
    for (const file of AV_CALL_SITES) {
      const path = join(AV, file);
      if (!existsSync(path)) {
        throw new Error(`${file} missing — av-service layout changed`);
      }
      const src = read(path);
      const models = [...src.matchAll(/claude-[a-z0-9.-]+/g)].map((m) => m[0]);
      expect(models.length, `${file} names no model`).toBeGreaterThan(0);
      for (const m of models) {
        expect(m.replace(/-\d{8}$/, ""), `${file} -> ${m}`).toBe("claude-haiku-4-5");
      }
    }
  });

  it("keeps the env override documented and defaulted to Haiku", () => {
    const cases: Array<[string, string]> = [
      ["remediate.py", "REMEDIATE_MODEL"],
      ["answer_track.py", "TRACK_MODEL"],
      ["keyword_suggest.py", "KEYWORDS_MODEL"],
    ];
    for (const [file, envVar] of cases) {
      const src = read(join(AV, file));
      expect(src, `${file} ${envVar}`).toMatch(
        new RegExp(`${envVar}"?\\s*,\\s*"claude-haiku-4-5"`),
      );
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
