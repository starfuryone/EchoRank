// tests/spaces-archive-client.test.ts — src/lib/spaces/client.ts against the
// HTTP-level fake S3 (tests/helpers/fake-s3.ts): the env contract, the client
// settings the spec pins, multipart upload, head/get/list/delete batching,
// Content-MD5 on DeleteObjects, presigned GETs against the bucket endpoint,
// and the key layout's charset guard.

import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARCHIVE_ENV,
  DELETE_BATCH,
  InvalidKeySegmentError,
  archiveClientConfig,
  archiveConfig,
  archiveStore,
  attachmentDisposition,
  buildArchiveClient,
  crawlArchivePrefix,
  crawlExportPrefix,
  s3ObjectStore,
  setArchiveStoreForTests,
  spacesConfigured,
} from "@/lib/spaces/client";
import { FAKE_ARCHIVE_CONFIG, createFakeS3 } from "./helpers/fake-s3";

function storeOn(fake = createFakeS3()) {
  const client = buildArchiveClient(FAKE_ARCHIVE_CONFIG, { requestHandler: fake.requestHandler as never });
  return { fake, store: s3ObjectStore(client, fake.bucket) };
}

const fullEnv = () => Object.fromEntries(ARCHIVE_ENV.map((n) => [n, "x"])) as NodeJS.ProcessEnv;

afterEach(() => setArchiveStoreForTests(undefined));

describe("configuration", () => {
  it("all five SPACES_ARCHIVE_* variables, or not configured", () => {
    expect(spacesConfigured(fullEnv())).toBe(true);
    for (const n of ARCHIVE_ENV) {
      const env = fullEnv();
      delete env[n];
      expect(spacesConfigured(env)).toBe(false);
      expect(archiveConfig({ ...fullEnv(), [n]: "  " })).toBeNull();
    }
    // The other Spaces key (spaces-client.ts) does not count.
    expect(spacesConfigured({ SPACES_KEY: "k", SPACES_SECRET: "s", SPACES_REGION: "sfo3" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("unset → archiveStore() is null (the fallback path)", () => {
    const saved = ARCHIVE_ENV.map((n) => [n, process.env[n]] as const);
    for (const n of ARCHIVE_ENV) delete process.env[n];
    try {
      expect(archiveStore()).toBeNull();
      expect(spacesConfigured()).toBe(false);
    } finally {
      for (const [n, v] of saved) if (v !== undefined) process.env[n] = v;
    }
  });

  it("the client settings the spec pins", () => {
    const c = archiveClientConfig(FAKE_ARCHIVE_CONFIG);
    expect(c).toMatchObject({
      forcePathStyle: false,
      maxAttempts: 5,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      endpoint: FAKE_ARCHIVE_CONFIG.endpoint,
      region: FAKE_ARCHIVE_CONFIG.region,
    });
  });
});

describe("keys", () => {
  it("tenant-scoped layout", () => {
    expect(crawlArchivePrefix("tA", "c1")).toBe("tenants/tA/crawls/c1/");
    expect(crawlExportPrefix("tA", "c1")).toBe("tenants/tA/exports/c1/");
  });
  it("an id that could escape its prefix is refused", () => {
    for (const bad of ["../tB", "a/b", "", "x".repeat(65), "t A", "t%2F"]) {
      expect(() => crawlArchivePrefix(bad, "c1")).toThrow(InvalidKeySegmentError);
      expect(() => crawlExportPrefix("tA", bad)).toThrow(InvalidKeySegmentError);
    }
  });
});

describe("the store", () => {
  it("put → head → get, metadata as x-amz-meta-*, no CRC32 checksum headers", async () => {
    const { fake, store } = storeOn();
    await store.put("tenants/t/crawls/c/a.ndjson.gz", Buffer.from("hello"), { contentType: "application/gzip", contentLength: 5, metadata: { sha256: "abc" } });
    const head = await store.head("tenants/t/crawls/c/a.ndjson.gz");
    expect(head).toMatchObject({ contentLength: 5, metadata: { sha256: "abc" } });
    const body = await store.get("tenants/t/crawls/c/a.ndjson.gz");
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe("hello");
    const put = fake.requests.find((r) => r.op === "PutObject")!;
    expect(Object.keys(put.headers).some((h) => h.toLowerCase().startsWith("x-amz-checksum-"))).toBe(false);
    expect(put.headers.authorization ?? put.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(await store.head("missing")).toBeNull();
  });

  it("a body over the part size goes multipart, from a stream", async () => {
    const { fake, store } = storeOn();
    const big = Buffer.alloc(17 * 1024 * 1024, 7);
    await store.put("big.bin", Readable.from([big.subarray(0, 9_000_000), big.subarray(9_000_000)]), { metadata: { sha256: "s" } });
    const ops = fake.requests.map((r) => r.op);
    expect(ops).toContain("CreateMultipartUpload");
    expect(ops.filter((o) => o === "UploadPart").length).toBe(3);
    expect(ops).toContain("CompleteMultipartUpload");
    expect(fake.objects.get("big.bin")!.body.equals(big)).toBe(true);
    expect(fake.objects.get("big.bin")!.metadata.sha256).toBe("s");
  });

  it("a failed part aborts the multipart upload (no orphan parts)", async () => {
    const { fake, store } = storeOn();
    fake.failNext("UploadPart", 5);
    await expect(store.put("big.bin", Readable.from([Buffer.alloc(17 * 1024 * 1024)]))).rejects.toThrow();
    expect(fake.requests.map((r) => r.op)).toContain("AbortMultipartUpload");
    expect(fake.uploads.size).toBe(0);
    expect(fake.objects.has("big.bin")).toBe(false);
  });

  it("list paginates; listPrefixes returns one level", async () => {
    const { fake, store } = storeOn();
    fake.setListPage(2);
    for (const k of ["tenants/a/exports/c/1", "tenants/a/exports/c/2", "tenants/a/crawls/c/m", "tenants/b/exports/d/1", "tenants/b/exports/d/2"]) {
      await store.put(k, "x");
    }
    const listed: string[] = [];
    for await (const o of store.list("tenants/")) listed.push(o.key);
    expect(listed.sort()).toEqual(fake.keys("tenants/"));
    expect((await store.listPrefixes("tenants/")).sort()).toEqual(["tenants/a/", "tenants/b/"]);
  });

  it("deleteKeys batches by 1,000 and sends Content-MD5, not CRC32", async () => {
    const { fake, store } = storeOn();
    const keys = Array.from({ length: DELETE_BATCH + 5 }, (_, i) => `k/${i}`);
    for (const k of keys.slice(0, 3)) await store.put(k, "x");
    expect(await store.deleteKeys(keys)).toBe(keys.length);
    const dels = fake.requests.filter((r) => r.op === "DeleteObjects");
    expect(dels).toHaveLength(2);
    for (const d of dels) {
      const h = Object.fromEntries(Object.entries(d.headers).map(([k, v]) => [k.toLowerCase(), v]));
      expect(h["content-md5"]).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(Object.keys(h).some((k) => k.startsWith("x-amz-checksum-"))).toBe(false);
    }
    expect(fake.keys("k/")).toEqual([]);
  });

  it("presigned GET: the bucket endpoint (never the CDN), the filename, the expiry", async () => {
    const { store } = storeOn();
    const url = new URL(await store.presignGet("tenants/t/exports/c/pages-ab.csv", { filename: "pages-example.com.csv", expiresIn: 900, contentType: "text/csv" }));
    expect(url.hostname).toBe("test-bucket.sfo3.digitaloceanspaces.com");
    expect(url.hostname).not.toContain("cdn");
    expect(url.pathname).toBe("/tenants/t/exports/c/pages-ab.csv");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("response-content-disposition")).toBe(attachmentDisposition("pages-example.com.csv"));
    expect(url.searchParams.get("response-content-type")).toBe("text/csv");
    // The secret never appears in the URL.
    expect(url.toString()).not.toContain(FAKE_ARCHIVE_CONFIG.secret);
  });

  it("attachment filename: ASCII fallback + UTF-8", () => {
    expect(attachmentDisposition('rapport "été".pdf')).toBe(`attachment; filename="rapport _t_.pdf"; filename*=UTF-8''rapport%20%22%C3%A9t%C3%A9%22.pdf`);
  });
});
