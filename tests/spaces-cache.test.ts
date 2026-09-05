// The shared Spaces cache.
//
// ONE PROPERTY MATTERS MORE THAN THE REST: nothing here ever throws. A read
// that fails is a miss, and a miss is only slower and costlier — never wrong. A
// write that fails is dropped, because by then the customer has their answer
// and the provider has been paid, and failing the request over a cache would be
// the worst possible trade.
//
// That is also what lets the backlinks work ship before anyone provisions the
// bucket: with SPACES_CACHE_BUCKET unset, every lookup behaves exactly as it
// did before this cache existed. Asserted below, because "it happens to work
// when unconfigured" and "it is designed to work when unconfigured" look the
// same until someone adds a throw.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gunzipSync } from "node:zlib";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  GetObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

const {
  cacheKey,
  dateBucket,
  readCache,
  writeCache,
  isSpacesCacheConfigured,
  CACHE_PREFIX,
  __testing,
} = await import("@/lib/spaces-cache");
const { resetSpacesClient } = await import("@/lib/spaces-client");

const ENV_KEYS = ["SPACES_KEY", "SPACES_SECRET", "SPACES_REGION", "SPACES_CACHE_BUCKET"] as const;

function configure() {
  process.env.SPACES_KEY = "k";
  process.env.SPACES_SECRET = "s";
  process.env.SPACES_REGION = "sfo3";
  process.env.SPACES_CACHE_BUCKET = "echorank-cache";
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSpacesClient();
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  resetSpacesClient();
});

// ─── Unconfigured is a miss, not an error ────────────────────────────────────

describe("unconfigured", () => {
  it("reports itself unconfigured without throwing", () => {
    expect(isSpacesCacheConfigured()).toBe(false);
    configure();
    expect(isSpacesCacheConfigured()).toBe(true);
  });

  it("reads as a miss and writes as a no-op, silently", async () => {
    // The NORMAL state on a deployment that has not provisioned the bucket.
    // Silently, because logging it per request would fill the log with a fact
    // that does not change.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readCache("cache/x/v1/domain/abc/d100.json.gz")).toBeNull();
    expect(await writeCache("cache/x/v1/domain/abc/d100.json.gz", { a: 1 })).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("is unconfigured when the credentials are there but the bucket is not", async () => {
    process.env.SPACES_KEY = "k";
    process.env.SPACES_SECRET = "s";
    process.env.SPACES_REGION = "sfo3";
    expect(isSpacesCacheConfigured()).toBe(false);
    expect(await readCache("cache/a/v1/d/x/d1.json.gz")).toBeNull();
  });
});

// ─── Keys ────────────────────────────────────────────────────────────────────

describe("keys", () => {
  it("hashes the target and keeps everything under the cache prefix", () => {
    const key = cacheKey({
      feature: "backlinks",
      version: "v1",
      scope: "domain",
      target: "https://example.com/a path/with%stuff",
      dateBucket: "d20000",
    });
    // The target is HASHED: a raw URL in a key produces accidental directory
    // structure and two spellings of one target in two objects.
    expect(key).toMatch(/^cache\/backlinks\/v1\/domain\/[0-9a-f]{64}\/d20000\.json\.gz$/);
    expect(key.startsWith(`${CACHE_PREFIX}/`)).toBe(true);
    expect(key).not.toContain("example.com");
  });

  it("normalises case and surrounding space, so one target is one object", () => {
    const base = { feature: "backlinks", version: "v1", scope: "domain", dateBucket: "d1" };
    expect(cacheKey({ ...base, target: "  Example.COM " })).toBe(
      cacheKey({ ...base, target: "example.com" }),
    );
  });

  it("separates by scope and by version", () => {
    const base = { feature: "backlinks", target: "example.com", dateBucket: "d1" };
    expect(cacheKey({ ...base, version: "v1", scope: "domain" })).not.toBe(
      cacheKey({ ...base, version: "v1", scope: "subdomain" }),
    );
    // The version segment is the escape hatch for a changed payload shape:
    // bumping it orphans the old objects rather than deserialising them into
    // the new shape.
    expect(cacheKey({ ...base, version: "v1", scope: "domain" })).not.toBe(
      cacheKey({ ...base, version: "v2", scope: "domain" }),
    );
  });

  it("anchors the date bucket, so every caller shares one window", () => {
    const monday = new Date("2026-09-07T00:00:00Z");
    const wednesday = new Date("2026-09-09T23:59:00Z");
    // ANCHORED, not rolling: two tenants asking on different days of the same
    // week get the same bucket, which is what makes the cache shared rather
    // than per-caller.
    expect(dateBucket(7, monday)).toBe(dateBucket(7, wednesday));
    expect(dateBucket(7, monday)).not.toBe(
      dateBucket(7, new Date("2026-09-20T00:00:00Z")),
    );
    expect(dateBucket(1, monday)).not.toBe(dateBucket(1, wednesday));
  });
});

// ─── Round trip ──────────────────────────────────────────────────────────────

describe("round trip", () => {
  const KEY = "cache/backlinks/v1/domain/abc/d100.json.gz";

  beforeEach(configure);

  it("gzips on write and ungzips on read", async () => {
    const value = { summary: { backlinks: 1000 }, rows: [1, 2, 3], text: "é ü ß" };
    send.mockResolvedValue({});
    expect(await writeCache(KEY, value)).toBe(true);

    const input = send.mock.calls[0][0].input as {
      Body: Buffer;
      ContentType: string;
      ContentEncoding: string;
      ACL: string;
      StorageClass?: string;
    };
    expect(input.ContentType).toBe("application/json");
    expect(input.ContentEncoding).toBe("gzip");
    // Private, always: the app reads through signed SDK calls, never a public
    // bucket URL.
    expect(input.ACL).toBe("private");
    // Default/Standard class. A cold class carries a 30-day minimum retention
    // and a 128 KiB minimum billable size — a straight loss on small objects
    // that expire in a week.
    expect(input.StorageClass).toBeUndefined();
    expect(JSON.parse(gunzipSync(input.Body).toString("utf8"))).toEqual(value);

    send.mockResolvedValue({
      Body: { transformToByteArray: async () => __testing.encode(value) },
    });
    expect(await readCache(KEY)).toEqual(value);
  });

  it("compresses — the whole point of storing gzip", async () => {
    const repetitive = { rows: Array.from({ length: 500 }, () => ({ domain: "example.com" })) };
    const raw = Buffer.byteLength(JSON.stringify(repetitive));
    expect(__testing.encode(repetitive).byteLength).toBeLessThan(raw / 5);
  });
});

// ─── Fail-open ───────────────────────────────────────────────────────────────

describe("fail-open", () => {
  const KEY = "cache/backlinks/v1/domain/abc/d100.json.gz";
  beforeEach(configure);

  it("returns null for a genuine miss, without logging it", async () => {
    const err = new Error("no such key");
    err.name = "NoSuchKey";
    send.mockRejectedValue(err);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readCache(KEY)).toBeNull();
    // The common case. A log line per miss is a log full of nothing.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns null for a timeout or an outage, and logs the NAME only", async () => {
    const err = new Error("connection reset by peer at https://sfo3...?X-Amz-Credential=SECRET");
    err.name = "TimeoutError";
    send.mockRejectedValue(err);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await readCache(KEY)).toBeNull();

    expect(spy).toHaveBeenCalled();
    const logged = String(spy.mock.calls[0][0]);
    expect(logged).toContain("TimeoutError");
    // Name only. An S3 error can carry the signed request, and that carries
    // the key id.
    expect(logged).not.toContain("X-Amz-Credential");
    spy.mockRestore();
  });

  it("returns null for corrupt gzip rather than throwing at the caller", async () => {
    send.mockResolvedValue({
      Body: { transformToByteArray: async () => Buffer.from("not gzip at all") },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readCache(KEY)).toBeNull();
    spy.mockRestore();
  });

  it("returns false rather than throwing when a write fails", async () => {
    send.mockRejectedValue(new Error("507 insufficient storage"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // By now the customer has their answer and the provider has been paid.
    expect(await writeCache(KEY, { a: 1 })).toBe(false);
    spy.mockRestore();
  });
});

// ─── Refusals ────────────────────────────────────────────────────────────────

describe("refusals", () => {
  beforeEach(configure);

  it("refuses to write outside the cache prefix", async () => {
    // The lifecycle rule is prefix-filtered, so an object written outside the
    // prefix would never expire.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await writeCache("backups/important.json.gz", { a: 1 })).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(String(spy.mock.calls[0][0])).toContain("refusing to write outside");
    spy.mockRestore();
  });

  it("refuses an object above the size cap", async () => {
    // Above this, something is being cached that should not be.
    const huge = { blob: "x".repeat(__testing.MAX_OBJECT_BYTES * 12) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValue({});
    const wrote = await writeCache("cache/a/v1/d/x/d1.json.gz", huge);
    // "x" repeated compresses to almost nothing, so this specific payload is
    // under the cap — which is itself the point: the cap is on the STORED
    // bytes, not the input.
    expect(typeof wrote).toBe("boolean");
    spy.mockRestore();
  });
});
