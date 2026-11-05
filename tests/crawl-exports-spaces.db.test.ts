// tests/crawl-exports-spaces.db.test.ts — the sitemap zip and the PDF report
// through Spaces, end to end on a real Postgres (the generator's SQL) and the
// fake S3: the zip streams into one object and the route 302s to it; the PDF
// route renders once (the sidecar mocked) and answers JSON {url}; a second
// request reuses both. SKIPPED UNLESS TEST_DATABASE_URL IS SET.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FAKE_ARCHIVE_CONFIG, createFakeS3, type FakeS3 } from "./helpers/fake-s3";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

describe.skipIf(!TEST_DB)("sitemap zip and PDF via Spaces", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let spaces: typeof import("@/lib/spaces/client");
  let fake: FakeS3;
  const tenantId = `texp${Date.now().toString(36)}`;
  const crawlId = `${tenantId}c`;
  const ctx = { params: Promise.resolve({ id: crawlId }) };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    spaces = await import("@/lib/spaces/client");
    fake = createFakeS3();
    spaces.setArchiveStoreForTests(spaces.s3ObjectStore(spaces.buildArchiveClient(FAKE_ARCHIVE_CONFIG, { requestHandler: fake.requestHandler as never }), fake.bucket));
    process.env.EXPORTS_VIA_SPACES = "true";
    requirePaidPlan.mockResolvedValue({ tenantId, tenant: { planType: "GROWTH" } });
    await prisma.tenant.create({ data: { id: tenantId, name: "exp", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({
      data: { id: crawlId, tenantId, rootUrl: "https://exp.example.com/", urlCap: 10, status: "COMPLETED", finishedAt: new Date("2026-10-02T00:00:00Z"), summary: { totals: { ERROR: 0, WARNING: 0, NOTICE: 0 }, issues: {}, issuesByKind: { issue: 0, warning: 0, opportunity: 0 } } },
    });
    for (let i = 0; i < 4; i++) {
      await prisma.crawlPage.create({ data: { crawlJobId: crawlId, url: `https://exp.example.com/${i}`, depth: 1, statusCode: 200, contentType: "text/html", noindex: false, inSitemap: true } });
    }
  });
  afterAll(async () => {
    spaces?.setArchiveStoreForTests(undefined);
    delete process.env.EXPORTS_VIA_SPACES;
    vi.unstubAllGlobals();
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("sitemap: the zip streams into one object; 302; the same options reuse it", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/sitemap/route");
    const res = await GET(new Request(`https://app.test/api/seo/v1/crawl/${crawlId}/sitemap?lastmod=none`), ctx);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toMatch(new RegExp(`^/tenants/${tenantId}/exports/${crawlId}/sitemaps-[0-9a-f]{32}\\.zip$`));
    expect(loc.searchParams.get("response-content-disposition")).toContain("sitemaps-exp.example.com-2026-10-02.zip");
    const obj = fake.objects.get(loc.pathname.slice(1))!;
    expect(obj.body.subarray(0, 2).toString()).toBe("PK");
    expect(obj.body.toString("latin1")).toContain("sitemap");
    const uploads = fake.requests.filter((r) => r.op === "PutObject").length;
    await GET(new Request(`https://app.test/api/seo/v1/crawl/${crawlId}/sitemap?lastmod=none`), ctx);
    expect(fake.requests.filter((r) => r.op === "PutObject").length).toBe(uploads);
  });

  it("PDF: rendered once, JSON {url} with the sidecar's filename; the sidecar's error text never leaks", async () => {
    const sidecar = vi.fn(async () => new Response(new Blob(["%PDF-1.7 test"]).stream(), { headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="Echorank-360-Site-Crawl-Report-exp.example.com.pdf"' } }));
    vi.stubGlobal("fetch", sidecar);
    const { POST } = await import("@/app/api/seo/v1/crawl/[id]/report/route");
    const res = await POST(new Request(`https://app.test/api/seo/v1/crawl/${crawlId}/report`, { method: "POST" }), ctx);
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(new URL(url).searchParams.get("response-content-disposition")).toContain("Echorank-360-Site-Crawl-Report-exp.example.com.pdf");
    const again = await POST(new Request(`https://app.test/api/seo/v1/crawl/${crawlId}/report`, { method: "POST" }), ctx);
    expect(again.status).toBe(200);
    expect(sidecar).toHaveBeenCalledTimes(1);

    // A different crawl state: a failing sidecar on a fresh object → 502, generic body.
    await prisma.crawlJob.update({ where: { id: crawlId }, data: { finishedAt: new Date("2026-10-03T00:00:00Z") } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Report generation failed: secret stack" }), { status: 500, headers: { "content-type": "application/json" } })));
    const bad = await POST(new Request(`https://app.test/api/seo/v1/crawl/${crawlId}/report`, { method: "POST" }), ctx);
    expect(bad.status).toBe(502);
    expect(await bad.text()).not.toContain("secret stack");
  });
});
