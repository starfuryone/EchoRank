// Snapshot storage: dedupe by hash, the size and count caps, prune ordering,
// gzip roundtrip, object-key derivation, private ACL, and the missing-env stop.
//
// Prisma and the S3 client are stubbed; hashing, gzip, cap arithmetic, the
// prune selection and the never-prune-the-newest rule are the real code.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync, gunzipSync } from "node:zlib";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const pageSnapshot = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  deleteMany: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: { pageSnapshot } }));

const s3send = vi.fn();
class FakeS3 {
  send = s3send;
}
const commands: Array<{ name: string; input: Record<string, unknown> }> = [];
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: FakeS3,
  PutObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
      commands.push({ name: "put", input });
    }
  },
  GetObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
      commands.push({ name: "get", input });
    }
  },
  DeleteObjectCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
      commands.push({ name: "delete", input });
    }
  },
}));

const {
  storeSnapshot,
  pruneSnapshots,
  readSnapshotMarkdown,
  hashContent,
  SnapshotTooLargeError,
} = await import("@/lib/historical/snapshots");
const { snapshotObjectKey, spacesConfig, isSpacesConfigured, SpacesNotConfiguredError, resetSpacesClient } =
  await import("@/lib/historical/spaces");
const { MAX_SNAPSHOT_BYTES, MAX_SNAPSHOTS_PER_TENANT } = await import("@/lib/historical/options");

const TENANT = "tenant_a";
const URL_A = "https://echorank360.com/";

function setEnv() {
  process.env.SPACES_KEY = "DO00TESTKEY";
  process.env.SPACES_SECRET = "test-secret";
  process.env.SPACES_REGION = "sfo3";
  process.env.SPACES_BUCKET = "datacleanupbucket";
}

beforeEach(() => {
  vi.clearAllMocks();
  commands.length = 0;
  resetSpacesClient();
  setEnv();
  pageSnapshot.findFirst.mockResolvedValue(null);
  pageSnapshot.findMany.mockResolvedValue([]);
  pageSnapshot.create.mockResolvedValue({ id: "snap_1" });
  pageSnapshot.count.mockResolvedValue(1);
  pageSnapshot.deleteMany.mockResolvedValue({ count: 0 });
  s3send.mockResolvedValue({});
});

// ── Configuration ───────────────────────────────────────────────────────────

describe("configuration", () => {
  it("derives the object key as snapshots/<tenant>/<sha256>.md.gz", () => {
    const hash = hashContent("# hello");
    expect(snapshotObjectKey(TENANT, hash)).toBe(`snapshots/${TENANT}/${hash}.md.gz`);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults the endpoint from the region", () => {
    delete process.env.SPACES_ENDPOINT;
    expect(spacesConfig().endpoint).toBe("https://sfo3.digitaloceanspaces.com");
  });

  it("STOPS when an env var is missing rather than falling back", () => {
    // The whole point: no default bucket, no public-read degradation.
    for (const key of ["SPACES_KEY", "SPACES_SECRET", "SPACES_REGION", "SPACES_BUCKET"]) {
      setEnv();
      delete process.env[key];
      expect(() => spacesConfig(), key).toThrow(SpacesNotConfiguredError);
      expect(isSpacesConfigured()).toBe(false);
    }
  });

  it("names the missing variable in the error, for the operator log", () => {
    delete process.env.SPACES_BUCKET;
    expect(() => spacesConfig()).toThrow(/SPACES_BUCKET/);
  });
});

// ── Dedupe ──────────────────────────────────────────────────────────────────

describe("dedupe by content hash", () => {
  it("stores the first capture", async () => {
    const res = await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: "# Page\n\nHello.",
      source: "manual", capturedAt: new Date("2026-08-03T00:00:00Z"),
    });
    expect(res.created).toBe(true);
    expect(pageSnapshot.create).toHaveBeenCalledTimes(1);
    expect(commands.filter((c) => c.name === "put")).toHaveLength(1);
  });

  it("writes NO row and uploads NOTHING when content is unchanged", async () => {
    const markdown = "# Page\n\nHello.";
    pageSnapshot.findFirst.mockResolvedValue({ contentHash: hashContent(markdown) });

    const res = await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown,
      source: "manual", capturedAt: new Date(),
    });
    expect(res.created).toBe(false);
    expect(res.snapshotId).toBeNull();
    expect(pageSnapshot.create).not.toHaveBeenCalled();
    expect(commands.filter((c) => c.name === "put")).toHaveLength(0);
  });

  it("stores again when a single character changes", async () => {
    pageSnapshot.findFirst.mockResolvedValue({ contentHash: hashContent("# Page\n\nHello.") });
    const res = await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: "# Page\n\nHello!",
      source: "manual", capturedAt: new Date(),
    });
    expect(res.created).toBe(true);
  });

  it("compares against the LATEST snapshot only, so a revert is recorded", async () => {
    // A page that changed and changed back is a real finding; collapsing it
    // against an older identical capture would hide the round trip.
    pageSnapshot.findFirst.mockResolvedValue({ contentHash: hashContent("version B") });
    const res = await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: "version A",
      source: "manual", capturedAt: new Date(),
    });
    expect(res.created).toBe(true);
  });
});

// ── Caps ────────────────────────────────────────────────────────────────────

describe("size cap", () => {
  it("rejects a body over the limit before storing anything", async () => {
    const huge = "x".repeat(MAX_SNAPSHOT_BYTES + 1);
    await expect(
      storeSnapshot({ tenantId: TENANT, url: URL_A, markdown: huge, source: "manual", capturedAt: new Date() }),
    ).rejects.toThrow(SnapshotTooLargeError);
    expect(pageSnapshot.create).not.toHaveBeenCalled();
    expect(commands.filter((c) => c.name === "put")).toHaveLength(0);
  });

  it("accepts a body exactly at the limit", async () => {
    const exact = "x".repeat(MAX_SNAPSHOT_BYTES);
    const res = await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: exact, source: "manual", capturedAt: new Date(),
    });
    expect(res.created).toBe(true);
    expect(res.sizeBytes).toBe(MAX_SNAPSHOT_BYTES);
  });

  it("measures BYTES, not characters", async () => {
    // A multi-byte character must not let a body past the byte cap.
    const multibyte = "é".repeat(MAX_SNAPSHOT_BYTES - 10); // 2 bytes each
    await expect(
      storeSnapshot({ tenantId: TENANT, url: URL_A, markdown: multibyte, source: "manual", capturedAt: new Date() }),
    ).rejects.toThrow(SnapshotTooLargeError);
  });
});

describe("count cap and pruning", () => {
  /** n snapshots across `urls`, oldest first. */
  function makeRows(n: number, urls: string[]) {
    return Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      url: urls[i % urls.length],
      capturedAt: new Date(Date.UTC(2026, 0, 1 + i)),
      objectKey: `snapshots/${TENANT}/h${i}.md.gz`,
      contentHash: `h${i}`,
    }));
  }

  it("does nothing while under the cap", async () => {
    pageSnapshot.count.mockResolvedValue(MAX_SNAPSHOTS_PER_TENANT);
    expect(await pruneSnapshots(TENANT)).toBe(0);
    expect(pageSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes oldest-first once over", async () => {
    const total = MAX_SNAPSHOTS_PER_TENANT + 3;
    pageSnapshot.count.mockResolvedValue(total);
    pageSnapshot.findMany.mockResolvedValue(makeRows(total, ["u1", "u2", "u3", "u4"]));
    // No row still references a pruned hash.
    pageSnapshot.count.mockResolvedValueOnce(total).mockResolvedValue(0);

    const pruned = await pruneSnapshots(TENANT);
    expect(pruned).toBe(3);
    const deleted = pageSnapshot.deleteMany.mock.calls[0][0].where.id.in as string[];
    expect(deleted).toEqual(["s0", "s1", "s2"]);
  });

  it("NEVER prunes the newest snapshot of a url", async () => {
    // 4 urls, one snapshot each, wildly over the cap. Every row is the newest
    // of its url, so nothing is eligible — the alternative silently deletes the
    // only history of three urls.
    const rows = makeRows(4, ["u1", "u2", "u3", "u4"]);
    pageSnapshot.count.mockResolvedValue(MAX_SNAPSHOTS_PER_TENANT + 4);
    pageSnapshot.findMany.mockResolvedValue(rows);

    expect(await pruneSnapshots(TENANT)).toBe(0);
    expect(pageSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("prunes older rows of a url while keeping that url's newest", async () => {
    const total = MAX_SNAPSHOTS_PER_TENANT + 2;
    const rows = makeRows(total, ["u1"]); // all one url
    pageSnapshot.count.mockResolvedValue(total);
    pageSnapshot.findMany.mockResolvedValue(rows);
    pageSnapshot.count.mockResolvedValueOnce(total).mockResolvedValue(0);

    const pruned = await pruneSnapshots(TENANT);
    expect(pruned).toBe(2);
    const deleted = pageSnapshot.deleteMany.mock.calls[0][0].where.id.in as string[];
    // The newest (last, highest index) must survive.
    expect(deleted).not.toContain(rows[rows.length - 1].id);
    expect(deleted).toEqual(["s0", "s1"]);
  });

  it("deletes the Spaces object for a pruned snapshot", async () => {
    const total = MAX_SNAPSHOTS_PER_TENANT + 1;
    pageSnapshot.count.mockResolvedValue(total);
    pageSnapshot.findMany.mockResolvedValue(makeRows(total, ["u1", "u2"]));
    pageSnapshot.count.mockResolvedValueOnce(total).mockResolvedValue(0);

    await pruneSnapshots(TENANT);
    const deletes = commands.filter((c) => c.name === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].input.Key).toBe(snapshotObjectKey(TENANT, "h0"));
  });

  it("keeps the object when another row still points at that content", async () => {
    // Content-addressed objects are shared; deleting one out from under a live
    // row would break a snapshot that was never pruned.
    const total = MAX_SNAPSHOTS_PER_TENANT + 1;
    pageSnapshot.count.mockResolvedValue(total);
    pageSnapshot.findMany.mockResolvedValue(makeRows(total, ["u1", "u2"]));
    pageSnapshot.count.mockResolvedValueOnce(total).mockResolvedValue(2); // still referenced

    await pruneSnapshots(TENANT);
    expect(commands.filter((c) => c.name === "delete")).toHaveLength(0);
  });
});

// ── Storage mechanics ───────────────────────────────────────────────────────

describe("object storage", () => {
  it("uploads gzipped bytes with a PRIVATE acl", async () => {
    await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: "# Private page",
      source: "manual", capturedAt: new Date(),
    });
    const put = commands.find((c) => c.name === "put")!;
    expect(put.input.ACL).toBe("private");
    expect(put.input.ACL).not.toBe("public-read");
    expect(put.input.Bucket).toBe("datacleanupbucket");
    expect(String(put.input.Key)).toMatch(new RegExp(`^snapshots/${TENANT}/[0-9a-f]{64}\\.md\\.gz$`));
  });

  it("roundtrips markdown through gzip without loss", async () => {
    const markdown = "# Titre\n\nAccents: é à ü ß. Emoji: 🚀\n\n- one\n- two\n";
    await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown, source: "manual", capturedAt: new Date(),
    });
    const put = commands.find((c) => c.name === "put")!;
    expect(gunzipSync(put.input.Body as Buffer).toString("utf8")).toBe(markdown);
  });

  it("reads a snapshot back, tenant-scoped", async () => {
    const markdown = "# Stored\n\nBody.";
    pageSnapshot.findFirst.mockResolvedValue({ objectKey: "snapshots/t/h.md.gz" });
    s3send.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array(gzipSync(Buffer.from(markdown, "utf8"))) },
    });
    expect(await readSnapshotMarkdown(TENANT, "snap_1")).toBe(markdown);
    // findFirst on BOTH keys — never findUnique by id alone.
    expect(pageSnapshot.findFirst.mock.calls[0][0].where).toEqual({ id: "snap_1", tenantId: TENANT });
  });

  it("returns null for another tenant's snapshot", async () => {
    pageSnapshot.findFirst.mockResolvedValue(null);
    expect(await readSnapshotMarkdown(TENANT, "someone_elses")).toBeNull();
    expect(commands.filter((c) => c.name === "get")).toHaveLength(0);
  });

  it("retries a transient put before giving up", async () => {
    s3send.mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValue({});
    const res = await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: "# retry", source: "manual", capturedAt: new Date(),
    });
    expect(res.created).toBe(true);
    expect(s3send).toHaveBeenCalledTimes(2);
  });

  it("surfaces a storage outage as 503, not a 500", async () => {
    const { SpacesUnavailableError } = await import("@/lib/historical/spaces");
    s3send.mockRejectedValue(new Error("503 Slow Down"));
    await expect(
      storeSnapshot({ tenantId: TENANT, url: URL_A, markdown: "# x", source: "manual", capturedAt: new Date() }),
    ).rejects.toThrow(SpacesUnavailableError);
  });
});

// ── capturedAt ──────────────────────────────────────────────────────────────

describe("capturedAt is content time", () => {
  it("stores the date it is given, not now()", async () => {
    const archived = new Date("2019-04-12T03:15:45Z");
    await storeSnapshot({
      tenantId: TENANT, url: URL_A, markdown: "# 2019 page",
      source: "wayback", capturedAt: archived,
    });
    const data = pageSnapshot.create.mock.calls[0][0].data;
    expect(data.capturedAt).toEqual(archived);
    expect(data.source).toBe("wayback");
  });
});
