// tests/helpers/fake-s3.ts
//
// An in-memory S3 at the HTTP layer: a requestHandler for a real S3Client, so
// every call goes through the SDK's own serializers, checksum and signing
// middleware, @aws-sdk/lib-storage's Upload and the presigner — only the
// network is fake. Speaks the virtual-hosted style the archive client uses
// (<bucket>.<endpoint host>/<key>).
//
// Covers what src/lib/spaces/client.ts calls: PutObject, the multipart trio
// (+ abort), HeadObject, GetObject, DeleteObjects, ListObjectsV2 (prefix,
// delimiter, pagination). `failNext(op)` makes the next call of one operation
// answer 403 (not retried by the SDK, so a test does not sit through backoff).
// `requests` records every call's operation, headers and query.

import { Readable } from "node:stream";

export type FakeOp =
  | "PutObject"
  | "CreateMultipartUpload"
  | "UploadPart"
  | "CompleteMultipartUpload"
  | "AbortMultipartUpload"
  | "HeadObject"
  | "GetObject"
  | "DeleteObjects"
  | "ListObjectsV2";

export interface FakeObject {
  body: Buffer;
  metadata: Record<string, string>;
  contentType?: string;
  contentDisposition?: string;
  lastModified: Date;
}

interface HttpReq {
  method: string;
  hostname: string;
  path: string;
  query?: Record<string, string | string[] | null>;
  headers: Record<string, string>;
  body?: unknown;
}

async function readBody(body: unknown): Promise<Buffer> {
  if (body === undefined || body === null) return Buffer.alloc(0);
  if (typeof body === "string") return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof (body as Readable).on === "function" || Symbol.asyncIterator in (body as object)) {
    const chunks: Buffer[] = [];
    for await (const c of body as AsyncIterable<Buffer | string>) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    return Buffer.concat(chunks);
  }
  throw new Error(`fake-s3: unreadable body ${typeof body}`);
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function createFakeS3(bucket = "test-bucket") {
  const objects = new Map<string, FakeObject>();
  const uploads = new Map<string, { key: string; parts: Map<number, Buffer>; metadata: Record<string, string>; contentType?: string; contentDisposition?: string }>();
  const failing = new Map<FakeOp, number>();
  const requests: { op: FakeOp; key: string; headers: Record<string, string>; query: Record<string, unknown> }[] = [];
  let seq = 0;
  /** Page size for ListObjectsV2 (small, so pagination is exercised). */
  let listPage = 1000;
  let clock = () => new Date();

  const res = (statusCode: number, headers: Record<string, string> = {}, body: Buffer | string = "") => ({
    response: { statusCode, headers, body: Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(body)]) },
  });
  const xml = (body: string) => res(200, { "content-type": "application/xml" }, `<?xml version="1.0" encoding="UTF-8"?>${body}`);
  const err = (status: number, code: string) =>
    res(status, { "content-type": "application/xml" }, `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`);

  function metaOf(headers: Record<string, string>): Record<string, string> {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase().startsWith("x-amz-meta-")) m[k.toLowerCase().slice(11)] = v;
    return m;
  }
  const header = (h: Record<string, string>, name: string) => Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1];

  function classify(req: HttpReq): FakeOp {
    const q = req.query ?? {};
    const key = decodeURIComponent(req.path.replace(/^\//, ""));
    if (req.method === "GET" && !key && q["list-type"] === "2") return "ListObjectsV2";
    if (req.method === "POST" && "delete" in q) return "DeleteObjects";
    if (req.method === "POST" && "uploads" in q) return "CreateMultipartUpload";
    if (req.method === "POST" && q.uploadId) return "CompleteMultipartUpload";
    if (req.method === "PUT" && q.uploadId) return "UploadPart";
    if (req.method === "DELETE" && q.uploadId) return "AbortMultipartUpload";
    if (req.method === "PUT") return "PutObject";
    if (req.method === "HEAD") return "HeadObject";
    if (req.method === "GET") return "GetObject";
    throw new Error(`fake-s3: unsupported ${req.method} ${req.path}`);
  }

  async function handle(req: HttpReq) {
    if (!req.hostname.startsWith(`${bucket}.`)) return err(404, "NoSuchBucket");
    const op = classify(req);
    const key = decodeURIComponent(req.path.replace(/^\//, ""));
    const q = (req.query ?? {}) as Record<string, string>;
    requests.push({ op, key, headers: { ...req.headers }, query: { ...q } });
    const left = failing.get(op);
    if (left) {
      failing.set(op, left - 1);
      await readBody(req.body).catch(() => undefined);
      return err(403, "AccessDenied");
    }
    switch (op) {
      case "PutObject": {
        objects.set(key, {
          body: await readBody(req.body),
          metadata: metaOf(req.headers),
          contentType: header(req.headers, "content-type"),
          contentDisposition: header(req.headers, "content-disposition"),
          lastModified: clock(),
        });
        return res(200, { etag: `"${++seq}"` });
      }
      case "CreateMultipartUpload": {
        const id = `up-${++seq}`;
        uploads.set(id, { key, parts: new Map(), metadata: metaOf(req.headers), contentType: header(req.headers, "content-type"), contentDisposition: header(req.headers, "content-disposition") });
        return xml(`<InitiateMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${xmlEsc(key)}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
      }
      case "UploadPart": {
        const up = uploads.get(q.uploadId!);
        if (!up) return err(404, "NoSuchUpload");
        up.parts.set(Number(q.partNumber), await readBody(req.body));
        return res(200, { etag: `"p${q.partNumber}"` });
      }
      case "CompleteMultipartUpload": {
        const up = uploads.get(q.uploadId!);
        if (!up) return err(404, "NoSuchUpload");
        await readBody(req.body);
        const body = Buffer.concat([...up.parts.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b));
        objects.set(up.key, { body, metadata: up.metadata, contentType: up.contentType, contentDisposition: up.contentDisposition, lastModified: clock() });
        uploads.delete(q.uploadId!);
        return xml(`<CompleteMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${xmlEsc(key)}</Key><ETag>"m${seq}"</ETag></CompleteMultipartUploadResult>`);
      }
      case "AbortMultipartUpload":
        uploads.delete(q.uploadId!);
        return res(204);
      case "HeadObject": {
        const o = objects.get(key);
        if (!o) return res(404);
        const h: Record<string, string> = { "content-length": String(o.body.length), "last-modified": o.lastModified.toUTCString() };
        for (const [k, v] of Object.entries(o.metadata)) h[`x-amz-meta-${k}`] = v;
        return res(200, h);
      }
      case "GetObject": {
        const o = objects.get(key);
        if (!o) return err(404, "NoSuchKey");
        return res(200, { "content-length": String(o.body.length) }, o.body);
      }
      case "DeleteObjects": {
        const body = (await readBody(req.body)).toString("utf8");
        const keys = [...body.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => m[1]!.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
        for (const k of keys) objects.delete(k);
        return xml(`<DeleteResult>${keys.map((k) => `<Deleted><Key>${xmlEsc(k)}</Key></Deleted>`).join("")}</DeleteResult>`);
      }
      case "ListObjectsV2": {
        const prefix = q.prefix ?? "";
        const delimiter = q.delimiter;
        const all = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
        const contents: string[] = [];
        const prefixes = new Set<string>();
        for (const k of all) {
          const rest = k.slice(prefix.length);
          const at = delimiter ? rest.indexOf(delimiter) : -1;
          if (delimiter && at >= 0) prefixes.add(prefix + rest.slice(0, at + 1));
          else contents.push(k);
        }
        const entries = [...contents.map((k) => ({ k, p: false })), ...[...prefixes].map((k) => ({ k, p: true }))].sort((a, b) => (a.k < b.k ? -1 : 1));
        const start = q["continuation-token"] ? Number(q["continuation-token"]) : 0;
        const page = entries.slice(start, start + listPage);
        const truncated = start + listPage < entries.length;
        const body =
          `<ListBucketResult><Name>${bucket}</Name><Prefix>${xmlEsc(prefix)}</Prefix><KeyCount>${page.length}</KeyCount><IsTruncated>${truncated}</IsTruncated>` +
          (truncated ? `<NextContinuationToken>${start + listPage}</NextContinuationToken>` : "") +
          page
            .map((e) =>
              e.p
                ? `<CommonPrefixes><Prefix>${xmlEsc(e.k)}</Prefix></CommonPrefixes>`
                : `<Contents><Key>${xmlEsc(e.k)}</Key><Size>${objects.get(e.k)!.body.length}</Size><LastModified>${objects.get(e.k)!.lastModified.toISOString()}</LastModified></Contents>`,
            )
            .join("") +
          `</ListBucketResult>`;
        return xml(body);
      }
    }
  }

  return {
    bucket,
    objects,
    uploads,
    requests,
    requestHandler: { handle: (req: HttpReq) => handle(req) },
    failNext(op: FakeOp, times = 1) {
      failing.set(op, times);
    },
    setListPage(n: number) {
      listPage = n;
    },
    setClock(fn: () => Date) {
      clock = fn;
    },
    keys(prefix = "") {
      return [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
  };
}

export type FakeS3 = ReturnType<typeof createFakeS3>;

/** A config the client accepts; nothing here is a real credential. */
export const FAKE_ARCHIVE_CONFIG = {
  endpoint: "https://sfo3.digitaloceanspaces.com",
  region: "sfo3",
  bucket: "test-bucket",
  key: "TESTKEY000000000000",
  secret: "test-secret-not-real",
};
