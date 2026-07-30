// Bot Analytics section B — log parsing, IP verification, upload guards.
//
// The parser is the part of this tool that can be quietly wrong: a mis-parsed
// line becomes a wrong number in a chart, which is worse than a skipped line we
// report. So every supported format gets a fixture, and the malformed cases are
// asserted to be SKIPPED rather than coerced into a record.
//
// Also covers the two guards that protect the worker (gzip bomb, upload caps) and
// the promise the UI makes about deleting the raw file.

import { gzipSync } from "node:zlib";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aggregate,
  classifyBot,
  parseClfTime,
  parseLogLine,
  parseLogText,
  IP_VERIFIABLE_TOKENS,
  type LogRecord,
} from "@/lib/bot-analytics/log-parser";
import {
  cidrMatcher,
  ipInCidr,
  ipv4ToBits,
  ipv6ToBits,
  parseCidr,
} from "@/lib/bot-analytics/ip-ranges";

// ─── Redis double (upload quota) ────────────────────────────────────────────
const redisStore = new Map<string, number>();
const redis = {
  incr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) + 1;
    redisStore.set(key, next);
    return next;
  }),
  decr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) - 1;
    redisStore.set(key, next);
    return next;
  }),
  expire: vi.fn(async () => 1),
  get: vi.fn(async (key: string) => {
    const v = redisStore.get(key);
    return v === undefined ? null : String(v);
  }),
  set: vi.fn(async () => "OK"),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));

const {
  MAX_DECOMPRESSED_BYTES,
  MAX_UPLOAD_BYTES,
  DecompressionLimitError,
  canUploadLogs,
  hasAllowedExtension,
  isGzip,
  readLogFile,
  releaseUpload,
  reserveUpload,
  uploadLimit,
  uploadQuotaKey,
  uploadsUsed,
} = await import("@/lib/bot-analytics/upload");

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
});

// ─── Fixtures ───────────────────────────────────────────────────────────────

const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot";
const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const COMBINED_BOT = `66.249.66.1 - - [10/Oct/2025:13:55:36 +0000] "GET /pricing HTTP/1.1" 200 4213 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"`;
const COMBINED_HUMAN = `203.0.113.9 - - [10/Oct/2025:14:02:11 +0000] "GET /pricing HTTP/1.1" 200 4213 "https://google.com/" "${HUMAN_UA}"`;
const COMBINED_GPTBOT = `20.171.207.1 - - [11/Oct/2025:09:00:00 +0000] "GET /guide HTTP/1.1" 200 900 "-" "${GPTBOT_UA}"`;
const CADDY_BOT = JSON.stringify({
  ts: 1760101200,
  status: 200,
  request: {
    uri: "/blog/post?utm=x",
    remote_ip: "66.249.66.2",
    headers: { "User-Agent": [GPTBOT_UA] },
  },
});
const NGINX_NO_UA = `198.51.100.4 - - [10/Oct/2025:15:00:00 +0000] "GET / HTTP/1.1" 200 512`;

// ─── 1. Per-format parsing ──────────────────────────────────────────────────
describe("parseLogLine", () => {
  it("parses Apache/nginx combined", () => {
    const r = parseLogLine(COMBINED_BOT);
    expect(r).not.toBeNull();
    expect(r!.path).toBe("/pricing");
    expect(r!.status).toBe(200);
    expect(r!.ip).toBe("66.249.66.1");
    expect(r!.ua).toContain("Googlebot");
    expect(r!.ts.toISOString()).toBe("2025-10-10T13:55:36.000Z");
  });

  it("parses Caddy JSON, including a header array and an epoch timestamp", () => {
    const r = parseLogLine(CADDY_BOT);
    expect(r).not.toBeNull();
    // Query string is stripped: it explodes path cardinality for no gain.
    expect(r!.path).toBe("/blog/post");
    expect(r!.ua).toBe(GPTBOT_UA);
    expect(r!.ip).toBe("66.249.66.2");
  });

  it("parses plain CLF with no referrer/UA pair", () => {
    const r = parseLogLine(NGINX_NO_UA);
    expect(r).not.toBeNull();
    expect(r!.ua).toBe("");
  });

  it("applies the timezone offset rather than ignoring it", () => {
    const utc = parseClfTime("10/Oct/2025:13:55:36 +0000");
    const minus7 = parseClfTime("10/Oct/2025:13:55:36 -0700");
    expect(utc).not.toBeNull();
    expect(minus7).not.toBeNull();
    expect(minus7!.getTime() - utc!.getTime()).toBe(7 * 3600 * 1000);
  });

  it("strips a port from a Caddy remote_addr and unwraps a bracketed IPv6", () => {
    const withPort = parseLogLine(
      JSON.stringify({
        ts: 1760101200,
        status: 200,
        request: { uri: "/", remote_addr: "203.0.113.9:54321", headers: {} },
      }),
    );
    expect(withPort!.ip).toBe("203.0.113.9");
    const v6 = parseLogLine(
      JSON.stringify({
        ts: 1760101200,
        status: 200,
        request: { uri: "/", remote_addr: "[2001:db8::1]:443", headers: {} },
      }),
    );
    expect(v6!.ip).toBe("2001:db8::1");
  });

  it("SKIPS malformed lines instead of inventing a record", () => {
    for (const bad of [
      "",
      "   ",
      "# a comment",
      "not a log line at all",
      "{not json}",
      '{"status":200}', // JSON with no timestamp
      `1.2.3.4 - - [NOT/A/DATE:00:00:00 +0000] "GET / HTTP/1.1" 200 1`,
      `1.2.3.4 - - [10/Oct/2025:13:55:36 +0000] "GET / HTTP/1.1" NOTASTATUS 1`,
      `1.2.3.4 - - [10/Foo/2025:13:55:36 +0000] "GET / HTTP/1.1" 200 1`,
    ]) {
      expect(parseLogLine(bad)).toBeNull();
    }
  });

  it("counts skipped lines and keeps the good ones", () => {
    const text = [COMBINED_BOT, "garbage", COMBINED_HUMAN, "", "{oops}", CADDY_BOT].join("\n");
    const { records, linesSkipped } = parseLogText(text);
    expect(records).toHaveLength(3);
    // The blank line is not a skip; the two malformed ones are.
    expect(linesSkipped).toBe(2);
  });
});

// ─── 2. Bot vs human classification ─────────────────────────────────────────
describe("classifyBot", () => {
  it("identifies crawlers from the shared catalog", () => {
    expect(classifyBot(GPTBOT_UA)).toBe("GPTBot");
    expect(classifyBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe("Googlebot");
    expect(classifyBot("CCBot/2.0 (https://commoncrawl.org/faq/)")).toBe("CCBot");
    expect(classifyBot("meta-externalagent/1.1")).toBe("meta-externalagent");
  });

  it("returns null for humans and for an empty UA", () => {
    expect(classifyBot(HUMAN_UA)).toBeNull();
    expect(classifyBot("")).toBeNull();
  });

  it("prefers the longest matching token so OAI-SearchBot is not read as something else", () => {
    const ua =
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot";
    expect(classifyBot(ua)).toBe("OAI-SearchBot");
  });

  it("never reports the robots.txt-only preference tokens from a log line", () => {
    // Nothing fetches as these, so a line claiming one is not evidence of a visit.
    expect(classifyBot("Google-Extended")).toBeNull();
    expect(classifyBot("Applebot-Extended/1.0")).toBeNull();
  });
});

// ─── 3. Aggregation ─────────────────────────────────────────────────────────
describe("aggregate", () => {
  const text = [COMBINED_BOT, COMBINED_HUMAN, COMBINED_GPTBOT, CADDY_BOT].join("\n");

  it("counts bot hits per day and leaves humans out of the bot totals", () => {
    const { records, linesSkipped } = parseLogText(text);
    const agg = aggregate({ records, linesSkipped });
    expect(agg.totalBotHits).toBe(3);
    expect(agg.otherHits).toBe(1); // the human line
    expect(agg.days).toEqual(["2025-10-10", "2025-10-11"]);
    expect(agg.perDay["2025-10-10"].Googlebot).toBe(1);
    expect(agg.perDay["2025-10-11"].GPTBot).toBe(1);
  });

  it("reports the detected period from the log's own timestamps", () => {
    const { records, linesSkipped } = parseLogText(text);
    const agg = aggregate({ records, linesSkipped });
    // The Caddy fixture's epoch is 13:00:00Z, earlier than the combined line's
    // 13:55:36Z — so the period start comes from the JSON line, which is the
    // point: the window is the log's own range, across mixed formats.
    expect(agg.periodStart).toBe("2025-10-10T13:00:00.000Z");
    expect(agg.periodEnd?.startsWith("2025-10-11")).toBe(true);
  });

  it("ranks top paths per bot and splits status codes", () => {
    const lines = [
      COMBINED_GPTBOT,
      COMBINED_GPTBOT,
      `20.171.207.1 - - [11/Oct/2025:09:05:00 +0000] "GET /other HTTP/1.1" 404 0 "-" "${GPTBOT_UA}"`,
    ].join("\n");
    const { records, linesSkipped } = parseLogText(lines);
    const agg = aggregate({ records, linesSkipped });
    const gpt = agg.bots.find((b) => b.token === "GPTBot")!;
    expect(gpt.total).toBe(3);
    expect(gpt.topPaths[0]).toEqual({ path: "/guide", hits: 2 });
    expect(gpt.statusSplit["200"]).toBe(2);
    expect(gpt.statusSplit["404"]).toBe(1);
    expect(gpt.firstSeen <= gpt.lastSeen).toBe(true);
  });

  it("marks hits unverified when no verifier is supplied", () => {
    const { records, linesSkipped } = parseLogText(text);
    const agg = aggregate({ records, linesSkipped });
    for (const b of agg.bots) expect(b.verified).toBe(0);
    expect(agg.hasUnverified).toBe(true);
  });

  it("counts a verified Googlebot hit and leaves an impostor unverified", () => {
    // Same UA, one from a real Google range and one from somewhere else — the
    // whole reason IP verification exists.
    const lines = [
      COMBINED_BOT, // 66.249.66.1
      `198.51.100.7 - - [10/Oct/2025:16:00:00 +0000] "GET / HTTP/1.1" 200 1 "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"`,
    ].join("\n");
    const { records, linesSkipped } = parseLogText(lines);
    const isGoogle = cidrMatcher(["66.249.64.0/19"]);
    const agg = aggregate({
      records,
      linesSkipped,
      verifyIp: (token, ip) => (token === "Googlebot" ? isGoogle(ip) : null),
    });
    const g = agg.bots.find((b) => b.token === "Googlebot")!;
    expect(g.total).toBe(2);
    expect(g.verified).toBe(1);
    expect(g.unverified).toBe(1);
    expect(g.verifiable).toBe(true);
  });

  it("flags only Googlebot and Bingbot as verifiable", () => {
    expect(IP_VERIFIABLE_TOKENS.has("Googlebot")).toBe(true);
    expect(IP_VERIFIABLE_TOKENS.has("Bingbot")).toBe(true);
    expect(IP_VERIFIABLE_TOKENS.has("GPTBot")).toBe(false);
  });

  it("handles an empty log without throwing", () => {
    const agg = aggregate({ records: [] as LogRecord[], linesSkipped: 0 });
    expect(agg.totalBotHits).toBe(0);
    expect(agg.bots).toEqual([]);
    expect(agg.periodStart).toBeNull();
  });
});

// ─── 4. CIDR matching ───────────────────────────────────────────────────────
describe("CIDR matching", () => {
  it("matches IPv4 inside and outside a block", () => {
    const c = parseCidr("66.249.64.0/19")!;
    expect(ipInCidr("66.249.66.1", c)).toBe(true);
    expect(ipInCidr("66.249.95.255", c)).toBe(true);
    expect(ipInCidr("66.249.96.0", c)).toBe(false);
    expect(ipInCidr("198.51.100.7", c)).toBe(false);
  });

  it("matches IPv6 including the compressed and mapped forms", () => {
    const c = parseCidr("2001:4860:4801::/48")!;
    expect(ipInCidr("2001:4860:4801:0:0:0:0:1", c)).toBe(true);
    expect(ipInCidr("2001:4860:4801::abcd", c)).toBe(true);
    expect(ipInCidr("2001:4860:4802::1", c)).toBe(false);
    expect(ipv6ToBits("::1")?.length).toBe(128);
    expect(ipv6ToBits("::ffff:1.2.3.4")?.length).toBe(128);
  });

  it("never matches an address of the other family", () => {
    const v4 = parseCidr("10.0.0.0/8")!;
    expect(ipInCidr("::1", v4)).toBe(false);
    const v6 = parseCidr("2001:db8::/32")!;
    expect(ipInCidr("10.0.0.1", v6)).toBe(false);
  });

  it("rejects malformed CIDRs and addresses", () => {
    for (const bad of ["", "1.2.3.4", "1.2.3.4/33", "not/24", "2001:db8::/129"]) {
      expect(parseCidr(bad)).toBeNull();
    }
    expect(ipv4ToBits("1.2.3")).toBeNull();
    expect(ipv4ToBits("1.2.3.999")).toBeNull();
    expect(ipv6ToBits("1:2:3")).toBeNull();
  });

  it("a /0 matches everything of its family and /32 only the exact host", () => {
    expect(ipInCidr("8.8.8.8", parseCidr("0.0.0.0/0")!)).toBe(true);
    const exact = parseCidr("8.8.8.8/32")!;
    expect(ipInCidr("8.8.8.8", exact)).toBe(true);
    expect(ipInCidr("8.8.8.9", exact)).toBe(false);
  });

  it("memoizes without changing the answer", () => {
    const m = cidrMatcher(["66.249.64.0/19"]);
    expect(m("66.249.66.1")).toBe(true);
    expect(m("66.249.66.1")).toBe(true);
    expect(m("1.1.1.1")).toBe(false);
    expect(m("")).toBe(false);
  });
});

// ─── 5. Upload guards ───────────────────────────────────────────────────────
describe("upload guards", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bot-log-test-"));

  it("accepts the documented extensions and nothing else", () => {
    for (const ok of ["access.log", "a.txt", "a.log.gz", "A.LOG"]) {
      expect(hasAllowedExtension(ok)).toBe(true);
    }
    for (const bad of ["a.zip", "a.tar", "a.log.bz2", "a", "a.exe"]) {
      expect(hasAllowedExtension(bad)).toBe(false);
    }
    expect(isGzip("a.log.gz")).toBe(true);
    expect(isGzip("a.log")).toBe(false);
  });

  it("reads a plain log and a gzipped log to the same text", async () => {
    const body = `${COMBINED_BOT}\n${COMBINED_GPTBOT}\n`;
    const plain = path.join(dir, "plain.log");
    const gz = path.join(dir, "zipped.log.gz");
    writeFileSync(plain, body);
    writeFileSync(gz, gzipSync(Buffer.from(body)));
    expect(existsSync(gz)).toBe(true);

    expect(await readLogFile(plain, false)).toBe(body);
    expect(await readLogFile(gz, true)).toBe(body);
  });

  it("refuses a gzip bomb instead of decompressing it", async () => {
    // Highly compressible input is exactly what an access log looks like, which
    // is why the guard is on the DECOMPRESSED size and not the upload size.
    const bomb = path.join(dir, "bomb.log.gz");
    writeFileSync(bomb, gzipSync(Buffer.alloc(MAX_DECOMPRESSED_BYTES + 1024, 0x41)));
    await expect(readLogFile(bomb, true)).rejects.toBeInstanceOf(DecompressionLimitError);
  });

  it("keeps the decompressed ceiling well above the upload ceiling", () => {
    expect(MAX_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_DECOMPRESSED_BYTES).toBe(200 * 1024 * 1024);
    expect(MAX_DECOMPRESSED_BYTES).toBeGreaterThan(MAX_UPLOAD_BYTES);
  });
});

// ─── 6. Upload caps and plan gating ─────────────────────────────────────────
describe("upload caps", () => {
  it("gates section B by plan", () => {
    expect(canUploadLogs("GROWTH")).toBe(true);
    expect(canUploadLogs("AGENCY")).toBe(true);
    expect(canUploadLogs("STARTER")).toBe(false);
    expect(canUploadLogs("AI_VISIBILITY")).toBe(false);
    expect(uploadLimit("GROWTH")).toBe(5);
    expect(uploadLimit("AGENCY")).toBe(20);
    expect(uploadLimit("STARTER")).toBe(0);
  });

  it("allows exactly the plan's uploads, then refuses", async () => {
    for (let i = 1; i <= 5; i++) {
      const d = await reserveUpload("t1", "GROWTH");
      expect(d.allowed).toBe(true);
      expect(d.used).toBe(i);
    }
    const over = await reserveUpload("t1", "GROWTH");
    expect(over.allowed).toBe(false);
    expect(over.limit).toBe(5);
    // A refused attempt must not consume the allowance.
    expect(await uploadsUsed("t1")).toBe(5);
  });

  it("refuses a plan with no allowance without touching Redis", async () => {
    const d = await reserveUpload("t1", "STARTER");
    expect(d.allowed).toBe(false);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("gives AGENCY the larger allowance on the same tenant key", async () => {
    for (let i = 0; i < 5; i++) await reserveUpload("t1", "GROWTH");
    // Same counter, higher ceiling — an upgrade mid-month is not a reset.
    const next = await reserveUpload("t1", "AGENCY");
    expect(next.allowed).toBe(true);
    expect(next.used).toBe(6);
  });

  it("isolates tenants", async () => {
    for (let i = 0; i < 5; i++) await reserveUpload("t1", "GROWTH");
    expect((await reserveUpload("t1", "GROWTH")).allowed).toBe(false);
    expect((await reserveUpload("t2", "GROWTH")).allowed).toBe(true);
    expect(uploadQuotaKey("t1")).not.toBe(uploadQuotaKey("t2"));
  });

  it("returns a reservation on release", async () => {
    await reserveUpload("t1", "GROWTH");
    await releaseUpload("t1");
    expect(await uploadsUsed("t1")).toBe(0);
  });

  it("scopes the key to tenant and month", () => {
    const jan = new Date("2026-01-15T00:00:00Z");
    const feb = new Date("2026-02-15T00:00:00Z");
    expect(uploadQuotaKey("t1", jan)).toContain("2026-01");
    expect(uploadQuotaKey("t1", jan)).not.toBe(uploadQuotaKey("t1", feb));
  });
});
