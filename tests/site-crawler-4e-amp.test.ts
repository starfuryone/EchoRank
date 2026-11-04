// tests/site-crawler-4e-amp.test.ts — the AMP validator loader (weekly cache,
// never dependent on the CDN), the validator verdict shape, and AMP facts.
import { existsSync, mkdtempSync, readFileSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AMP_REFRESH_MS, loadValidatorScript, validateAmp, ampValidator, resetAmpValidator } from "@/lib/site-crawler/amp-validator";
import { extractHtmlFacts } from "@/lib/site-crawler/facts";

const DAY = 24 * 60 * 60 * 1000;
const dir = () => path.join(mkdtempSync(path.join(tmpdir(), "amp-")), "cache", "validator_wasm.js");

describe("loadValidatorScript: weekly cache, CDN optional", () => {
  it("downloads and caches when there is no copy", async () => {
    const file = dir();
    const download = vi.fn(async () => "amp script v2");
    expect(await loadValidatorScript({ file, now: Date.now, download, instantiate: vi.fn() })).toBe("amp script v2");
    expect(readFileSync(file, "utf8")).toBe("amp script v2");
    expect(statSync(file).mode & 0o777).toBe(0o644);
  });

  it("uses a copy younger than a week without touching the network", async () => {
    const file = dir();
    await loadValidatorScript({ file, now: Date.now, download: async () => "cached", instantiate: vi.fn() });
    const download = vi.fn(async () => "new");
    expect(await loadValidatorScript({ file, now: () => Date.now() + 6 * DAY, download, instantiate: vi.fn() })).toBe("cached");
    expect(download).not.toHaveBeenCalled();
  });

  it("refreshes a copy older than a week", async () => {
    const file = dir();
    await loadValidatorScript({ file, now: Date.now, download: async () => "old", instantiate: vi.fn() });
    expect(await loadValidatorScript({ file, now: () => Date.now() + AMP_REFRESH_MS + 1, download: async () => "new", instantiate: vi.fn() })).toBe("new");
  });

  it("falls back to the stale copy when the CDN is unreachable", async () => {
    const file = dir();
    await loadValidatorScript({ file, now: Date.now, download: async () => "stale", instantiate: vi.fn() });
    const old = (Date.now() - 30 * DAY) / 1000;
    utimesSync(file, old, old);
    const down = async () => {
      throw new Error("ENOTFOUND cdn.ampproject.org");
    };
    expect(await loadValidatorScript({ file, now: Date.now, download: down, instantiate: vi.fn() })).toBe("stale");
  });

  it("is null with no copy and no CDN, and the process validator is null too", async () => {
    const file = dir();
    const down = async () => {
      throw new Error("offline");
    };
    expect(await loadValidatorScript({ file, now: Date.now, download: down, instantiate: vi.fn() })).toBeNull();
    expect(existsSync(file)).toBe(false);
    resetAmpValidator();
    expect(await ampValidator({ file, download: down })).toBeNull();
    resetAmpValidator();
  });
});

describe("validateAmp", () => {
  const fake = (status: "PASS" | "FAIL", n: number) => ({
    init: async () => {},
    validateString: () => ({
      status,
      errors: [
        ...Array.from({ length: n }, (_, i) => ({ severity: "ERROR" as const, line: i + 1, col: 1, message: `bad ${i} ${"x".repeat(300)}`, code: "X" })),
        { severity: "WARNING" as const, line: 9, col: 9, message: "warn", code: "W" },
      ],
    }),
  });
  it("counts errors, keeps three messages, truncated", () => {
    const r = validateAmp(fake("FAIL", 5), "<html>");
    expect(r.status).toBe("FAIL");
    expect(r.errorCount).toBe(5);
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0]!.startsWith("1:1 bad 0")).toBe(true);
    expect(r.messages[0]!.length).toBe(200);
  });
  it("PASS has no messages", () => {
    expect(validateAmp(fake("PASS", 0), "<html>")).toEqual({ status: "PASS", errorCount: 0, messages: [] });
  });

  // The real validator, when a copy is available locally (AMP_VALIDATOR_SCRIPT=…/validator_wasm.js).
  const script = process.env.AMP_VALIDATOR_SCRIPT;
  it.skipIf(!script)("the official validator fails a broken AMP page", async () => {
    const file = dir();
    resetAmpValidator();
    const v = await ampValidator({ file, download: async () => readFileSync(script!, "utf8") });
    resetAmpValidator();
    const r = validateAmp(v!, "<!doctype html><html amp><head><title>x</title></head><body><img src=a.png></body></html>");
    expect(r.status).toBe("FAIL");
    expect(r.errorCount).toBeGreaterThan(0);
  });
});

describe("AMP facts", () => {
  it("finds rel=amphtml and <html amp> / <html ⚡>", () => {
    const facts = extractHtmlFacts('<html><head><link rel="amphtml" href="/a/amp"></head><body></body></html>', "https://x.com/a", "https://x.com/", null);
    expect(facts.amphtml).toEqual(["https://x.com/a/amp"]);
    expect(facts.isAmp).toBe(false);
    expect(extractHtmlFacts("<html ⚡><head></head><body></body></html>", "https://x.com/a/amp", "https://x.com/", null).isAmp).toBe(true);
    expect(extractHtmlFacts("<html amp lang=en><head></head><body></body></html>", "https://x.com/a/amp", "https://x.com/", null).isAmp).toBe(true);
  });
});
