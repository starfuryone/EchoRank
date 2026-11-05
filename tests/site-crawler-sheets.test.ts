// tests/site-crawler-sheets.test.ts — Phase 4c Google Sheets export (behind
// crawl.sheets): the OAuth state purpose and scopes, the four-tab writer
// against a mocked Sheets client, the REST client's requests and errors, the
// routes, the callback's Sheets branch, and the schedule hook.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flags = vi.hoisted(() => ({ on: new Set<string>(["crawl.sheets"]) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (n: string) => flags.on.has(n) };
});
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn() };
const crawlPage = { count: vi.fn(), findMany: vi.fn() };
const crawlComparison = { findFirst: vi.fn() };
const crawlSchedule = { findFirst: vi.fn(), update: vi.fn() };
const crawlIssue = { groupBy: vi.fn() };
const gscConnection = { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage, crawlComparison, crawlSchedule, crawlIssue, gscConnection } }));

process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "csecret";
process.env.GSC_TOKEN_ENCRYPTION_KEY = "test-key-not-a-secret";

const state = await import("@/lib/gsc/state");
const client = await import("@/lib/gsc/client");
const sheets = await import("@/lib/site-crawler/sheets");
const exportRoute = await import("@/app/api/seo/v1/crawl/[id]/sheets/route");
const connectRoute = await import("@/app/api/seo/v1/crawl/sheets/connect/route");

type Rows = (string | number | boolean | null)[][];
function mockClient(existing: string[] | null = null, header = false) {
  const calls: { op: string; tab?: string; row?: number; rows?: Rows }[] = [];
  const c: import("@/lib/site-crawler/sheets").SheetsClient = {
    create: vi.fn(async () => ({ spreadsheetId: "new-sheet-id-0123456789", url: "https://docs.google.com/spreadsheets/d/new-sheet-id-0123456789" })),
    tabTitles: vi.fn(async () => existing ?? []),
    addTabs: vi.fn(async () => {}),
    clear: vi.fn(async (_id: string, tab: string) => void calls.push({ op: "clear", tab })),
    write: vi.fn(async (_id: string, tab: string, row: number, rows: Rows) => void calls.push({ op: "write", tab, row, rows })),
    append: vi.fn(async (_id: string, tab: string, rows: Rows) => void calls.push({ op: "append", tab, rows })),
    hasHeader: vi.fn(async () => header),
  };
  return { c, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlJob.findFirst.mockResolvedValue({ id: "j1", rootUrl: "https://x.com/", createdAt: new Date("2026-11-04T03:00:00Z"), pagesCrawled: 3, summary: null, status: "COMPLETED", dataPurgedAt: null });
  crawlPage.count.mockReset();
  crawlPage.findMany.mockReset();
  crawlPage.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  crawlIssue.groupBy.mockImplementation(async (q: { by: string[] }) =>
    q.by.includes("severity")
      ? [{ severity: "ERROR", _count: { _all: 1 } }]
      : [{ ruleId: "response_codes.internal_4xx", type: "response_codes.internal_4xx", _count: { _all: 1 } }],
  );
  const page = (id: string, title: string) => ({ id, url: `https://x.com/${id}`, statusCode: 200, noindex: false, title, depth: 1, inlinkCount: 2, wordCount: 300, inSitemap: true });
  crawlPage.findMany.mockResolvedValueOnce([page("a", "=HYPERLINK(1)"), page("b", "B")]).mockResolvedValueOnce([page("c", "C")]).mockResolvedValue([]);
});

describe("OAuth: state purpose and scopes", () => {
  it("a Sheets state round-trips with its purpose; a plain one is gsc; verifyState still reads both", () => {
    const s = state.signState("t1", "k", 1_000, "sheets");
    expect(state.verifyStatePurpose(s, "k", 2_000)).toEqual({ tenantId: "t1", purpose: "sheets" });
    expect(state.verifyState(s, "k", 2_000)).toBe("t1");
    expect(state.verifyStatePurpose(state.signState("t1", "k", 1_000), "k", 2_000)).toEqual({ tenantId: "t1", purpose: "gsc" });
  });

  it("the purpose is inside the HMAC: swapping it fails", () => {
    const s = state.signState("t1", "k", 1_000, "sheets");
    const [b64, sig] = [s.slice(0, s.lastIndexOf(".")), s.slice(s.lastIndexOf(".") + 1)];
    const forged = Buffer.from(Buffer.from(b64, "base64url").toString().replace(".sheets", ".admin")).toString("base64url");
    expect(state.verifyStatePurpose(`${forged}.${sig}`, "k", 2_000)).toBeNull();
  });

  it("asks for Search Console + spreadsheets incrementally; the GSC flow is unchanged", () => {
    const u = new URL(client.buildAuthUrl("st", [client.GSC_SCOPE, client.SHEETS_SCOPE]));
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/spreadsheets");
    expect(u.searchParams.get("include_granted_scopes")).toBe("true");
    const g = new URL(client.buildAuthUrl("st"));
    expect(g.searchParams.get("scope")).toBe(client.GSC_SCOPE);
    expect(g.searchParams.has("include_granted_scopes")).toBe(false);
  });
});

describe("spreadsheetIdOf", () => {
  it.each([
    ["", null],
    [undefined, null],
    ["https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_-012345/edit#gid=0", "1AbCdEfGhIjKlMnOpQrStUvWxYz_-012345"],
    ["1AbCdEfGhIjKlMnOpQrStUvWxYz_-012345", "1AbCdEfGhIjKlMnOpQrStUvWxYz_-012345"],
    ["https://evil.example/x", "invalid"],
    ["short", "invalid"],
  ])("%s → %s", (raw, want) => {
    expect(sheets.spreadsheetIdOf(raw as string | undefined)).toBe(want);
  });
});

describe("exportCrawlToSheets (mocked Sheets client)", () => {
  it("creates a sheet with the four tabs and writes Summary, Issues, Pages (chunked) and Compare", async () => {
    const { c, calls } = mockClient();
    const out = await sheets.exportCrawlToSheets({ tenantId: "t1", crawlJobId: "j1", comparisonId: null, spreadsheetId: null }, c);
    expect(c.create).toHaveBeenCalledWith("Echorank crawl report — x.com", ["Summary", "Issues", "Pages", "Compare"]);
    expect(out).toEqual({ spreadsheetId: "new-sheet-id-0123456789", url: "https://docs.google.com/spreadsheets/d/new-sheet-id-0123456789", pages: 3 });
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "j1", tenantId: "t1", status: "COMPLETED", dataPurgedAt: null, storageState: "HOT" });

    const summaryHeader = calls.find((x) => x.op === "write" && x.tab === "Summary")!;
    expect(summaryHeader.rows![0]).toEqual([...sheets.SUMMARY_HEADER]);
    const appended = calls.find((x) => x.op === "append")!;
    expect(appended.tab).toBe("Summary");
    expect(appended.rows![0]!.slice(0, 11)).toEqual(["2026-11-04T03:00:00.000Z", "x.com", "https://x.com/", "j1", 3, 2, 1, 0, 1, 0, 0]);
    expect(appended.rows![0]!.slice(11)).toEqual([null, null, null, null, null, null]);

    const issues = calls.find((x) => x.op === "write" && x.tab === "Issues")!;
    expect(issues.rows).toEqual([[...sheets.ISSUES_HEADER], ["j1", "response_codes.internal_4xx", expect.any(String), expect.any(String), expect.any(String), 1]]);

    const pageWrites = calls.filter((x) => x.op === "write" && x.tab === "Pages");
    expect(pageWrites.map((w) => [w.row, w.rows!.length])).toEqual([[1, 1], [2, 2], [4, 1]]);
    // RAW input: a title starting "=" goes in as text (the client sends valueInputOption=RAW).
    expect(pageWrites[1]!.rows![0]![4]).toBe("=HYPERLINK(1)");
    expect(calls.filter((x) => x.op === "clear").map((x) => x.tab)).toEqual(["Issues", "Pages", "Compare"]);
    expect(calls.find((x) => x.op === "write" && x.tab === "Compare")!.rows).toEqual([[...sheets.COMPARE_HEADER]]);
  });

  it("an existing sheet: missing tabs added, the Summary header not repeated, compare rows written", async () => {
    const { c, calls } = mockClient(["Summary", "Notes"], true);
    crawlComparison.findFirst.mockResolvedValue({
      result: { counts: { added: 1, removed: 2, changed: 3, issuesNew: 4, issuesResolved: 5 }, rules: [{ ruleId: "r", new: 4, resolved: 5 }] },
      jobB: { createdAt: new Date("2026-10-28T03:00:00Z") },
    });
    await sheets.exportCrawlToSheets({ tenantId: "t1", crawlJobId: "j1", comparisonId: "cmp", spreadsheetId: "existing-sheet-0123456789" }, c);
    expect(c.create).not.toHaveBeenCalled();
    expect(c.addTabs).toHaveBeenCalledWith("existing-sheet-0123456789", ["Issues", "Pages", "Compare"]);
    expect(calls.some((x) => x.op === "write" && x.tab === "Summary")).toBe(false);
    expect(crawlComparison.findFirst.mock.calls[0]![0].where).toEqual({ id: "cmp", jobAId: "j1" });
    const cmp = calls.find((x) => x.op === "write" && x.tab === "Compare")!.rows!;
    expect(cmp).toContainEqual(["j1", "2026-10-28T03:00:00.000Z", "added", 1]);
    expect(cmp).toContainEqual(["j1", "2026-10-28T03:00:00.000Z", "resolved:r", 5]);
  });
});

describe("restSheetsClient", () => {
  it("writes RAW, appends as inserted rows, quotes tab names", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({}), { status: 200 }));
    const c = sheets.restSheetsClient("tok", fetchMock as unknown as typeof fetch);
    await c.write("sid", "Pages", 2, [["a"]]);
    await c.append("sid", "Summary", [["b"]]);
    const urls = fetchMock.mock.calls.map((x) => decodeURIComponent(String(x[0])));
    expect(urls[0]).toBe("https://sheets.googleapis.com/v4/spreadsheets/sid/values/'Pages'!A2?valueInputOption=RAW");
    expect(urls[1]).toBe("https://sheets.googleapis.com/v4/spreadsheets/sid/values/'Summary'!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS");
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it.each([
    [403, "SheetsScopeError"],
    [401, "GscReauthError"],
    [500, "Error"],
  ])("HTTP %i → %s", async (status, name) => {
    const c = sheets.restSheetsClient("tok", (async () => new Response("{}", { status })) as unknown as typeof fetch);
    await expect(c.tabTitles("sid")).rejects.toMatchObject({ name });
  });
});

describe("routes", () => {
  const post = (body: unknown) => exportRoute.POST(new Request("https://app.test/x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "j1" }) });

  it("not connected → 409 with the connect link; the crawl is looked up by id AND tenant", async () => {
    crawlComparison.findFirst.mockResolvedValue(null);
    gscConnection.findUnique.mockResolvedValue(null);
    const res = await post({});
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "SHEETS_NOT_CONNECTED", connectHref: "/api/seo/v1/crawl/sheets/connect" });
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "j1", tenantId: "t1" });
  });

  it("an unusable spreadsheet value is a 400; another tenant's crawl a 404; a running crawl a 409", async () => {
    expect((await post({ spreadsheet: "https://evil.example/" })).status).toBe(400);
    crawlJob.findFirst.mockResolvedValueOnce(null);
    expect((await post({})).status).toBe(404);
    crawlJob.findFirst.mockResolvedValueOnce({ id: "j1", status: "RUNNING", dataPurgedAt: null });
    expect((await post({})).status).toBe(409);
  });

  it("connect redirects to Google with both scopes and a sheets-purpose state for this tenant", async () => {
    const res = await connectRoute.GET();
    const u = new URL(res.headers.get("location")!);
    expect(u.origin).toBe("https://accounts.google.com");
    expect(u.searchParams.get("scope")).toContain(client.SHEETS_SCOPE);
    expect(state.verifyStatePurpose(u.searchParams.get("state")!)).toEqual({ tenantId: "t1", purpose: "sheets" });
  });

  it("everything is a 404 while crawl.sheets is off", async () => {
    flags.on.delete("crawl.sheets");
    expect((await post({})).status).toBe(404);
    expect((await connectRoute.GET()).status).toBe(404);
    flags.on.add("crawl.sheets");
  });
});

describe("schedule hook", () => {
  it("remembers a newly created spreadsheet on the schedule, tenant-scoped", async () => {
    gscConnection.findUnique.mockResolvedValue({ tenantId: "t1", status: "ACTIVE", refreshTokenEnc: (await import("@/lib/gsc/crypto")).encryptToken("rt") });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "at" }), { status: 200 });
      if (url === "https://sheets.googleapis.com/v4/spreadsheets") return new Response(JSON.stringify({ spreadsheetId: "made-sheet-0123456789", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/made-sheet-0123456789" }), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    crawlComparison.findFirst.mockResolvedValue(null);
    crawlSchedule.findFirst.mockResolvedValue({ exportTo: { email: true, sheets: { spreadsheetId: null } } });
    await sheets.exportScheduledToSheets({ tenantId: "t1", crawlJobId: "j1", comparisonId: null, scheduleId: "s1", spreadsheetId: null });
    expect(crawlSchedule.findFirst.mock.calls[0]![0].where).toEqual({ id: "s1", tenantId: "t1" });
    expect(crawlSchedule.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { exportTo: { email: true, sheets: { spreadsheetId: "made-sheet-0123456789" } } } });
    vi.unstubAllGlobals();
  });
});
