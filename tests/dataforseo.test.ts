import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  pathToFeature,
  postTask,
  meteredCall,
  DataforseoError,
} from "../src/lib/dataforseo/client";
import { fixturePathFor } from "../src/lib/dataforseo/fixtures";

const OK_ENVELOPE = (cost: number, result: unknown[] = [{ ok: 1 }]) => ({
  status_code: 20000,
  tasks: [
    {
      status_code: 20000,
      status_message: "Ok.",
      path: ["v3", "dataforseo_labs", "google", "keyword_overview", "live"],
      cost,
      result,
    },
  ],
});

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

beforeEach(() => {
  process.env.DATAFORSEO_LOGIN = "test";
  process.env.DATAFORSEO_PASSWORD = "test";
  delete process.env.DATAFORSEO_FIXTURES;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe("pathToFeature", () => {
  const cases: [string[], string][] = [
    [["v3", "on_page", "lighthouse", "live", "json"], "site_audit"],
    [["v3", "backlinks", "summary", "live"], "backlinks"],
    [["v3", "serp", "google", "organic", "live", "advanced"], "keyword_research"],
    [["v3", "serp", "google", "maps", "live", "advanced"], "local_seo"],
    [["v3", "serp", "google", "local_finder", "live", "advanced"], "local_seo"],
    [["v3", "business_data", "google", "questions_and_answers", "live"], "local_seo"],
    [["v3", "keywords_data", "google_ads", "search_volume", "live"], "keyword_research"],
    [["v3", "dataforseo_labs", "google", "domain_rank_overview", "live"], "domain_overview"],
    [["v3", "dataforseo_labs", "google", "ranked_keywords", "live"], "domain_overview"],
    [["v3", "dataforseo_labs", "google", "relevant_pages", "live"], "domain_overview"],
    [["v3", "dataforseo_labs", "google", "keyword_suggestions", "live"], "keyword_research"],
    [["v3", "dataforseo_labs", "google", "serp_competitors", "live"], "keyword_research"],
  ];
  it.each(cases)("%j → %s", (path, feature) => {
    expect(pathToFeature(path)).toBe(feature);
  });

  it("normalizes paths missing the v3 prefix", () => {
    expect(pathToFeature(["backlinks", "summary", "live"])).toBe("backlinks");
  });
});

// ---------------------------------------------------------------------------
describe("postTask envelope + billing", () => {
  it("returns data and per-task cost on success", async () => {
    mockFetchOnce(200, OK_ENVELOPE(0.0125, [{ items: [] }]));
    const res = await postTask("v3/dataforseo_labs/google/keyword_overview/live", {});
    expect(res.billing.costUsd).toBe(0.0125);
    expect(res.data).toEqual([{ items: [] }]);
  });

  it("classifies HTTP 401 as AUTH_FAILED", async () => {
    mockFetchOnce(401, { error: "nope" });
    await expect(postTask("v3/x", {})).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });

  it("classifies HTTP 429 as RATE_LIMITED", async () => {
    mockFetchOnce(429, {});
    await expect(postTask("v3/x", {})).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws AUTH_FAILED without creds before any fetch", async () => {
    delete process.env.DATAFORSEO_LOGIN;
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(postTask("v3/x", {})).rejects.toMatchObject({ code: "AUTH_FAILED" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("marks Invalid Field task failures as INVALID_FIELD with no billing when uncharged", async () => {
    mockFetchOnce(200, {
      status_code: 20000,
      tasks: [{ status_code: 40501, status_message: "Invalid Field: 'target'.", cost: 0 }],
    });
    try {
      await postTask("v3/x", {});
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DataforseoError);
      expect((err as DataforseoError).code).toBe("INVALID_FIELD");
      expect((err as DataforseoError).billing).toBeUndefined();
    }
  });

  it("surfaces billing on charged-but-failed tasks", async () => {
    mockFetchOnce(200, {
      status_code: 20000,
      tasks: [
        {
          status_code: 40000,
          status_message: "Internal upstream error",
          cost: 0.01,
          path: ["v3", "backlinks", "summary", "live"],
        },
      ],
    });
    try {
      await postTask("v3/backlinks/summary/live", {});
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as DataforseoError;
      expect(e.code).toBe("TASK_FAILED");
      expect(e.billing?.costUsd).toBe(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
describe("meteredCall cap + recording", () => {
  const deps = () => {
    const rows: unknown[] = [];
    return {
      rows,
      spentThisMonth: vi.fn(async () => 0),
      record: vi.fn(async (row: unknown) => {
        rows.push(row);
      }),
    };
  };

  it("blocks BEFORE the fetch when spend >= cap", async () => {
    const d = deps();
    d.spentThisMonth = vi.fn(async () => 25);
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(
      meteredCall({ tenantId: "t1", monthlyCapUsd: 25 }, "v3/x", {}, d),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(spy).not.toHaveBeenCalled();
    expect(d.record).not.toHaveBeenCalled();
  });

  it("records a row with the response cost on success", async () => {
    const d = deps();
    mockFetchOnce(200, OK_ENVELOPE(0.02));
    await meteredCall(
      { tenantId: "t1", monthlyCapUsd: 25 },
      "v3/dataforseo_labs/google/keyword_overview/live",
      {},
      d,
    );
    expect(d.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        feature: "keyword_research",
        costUsd: 0.02,
        ok: true,
      }),
    );
  });

  it("records charged failures, skips uncharged ones", async () => {
    const d = deps();
    mockFetchOnce(200, {
      status_code: 20000,
      tasks: [
        {
          status_code: 40000,
          status_message: "boom",
          cost: 0.01,
          path: ["v3", "backlinks", "summary", "live"],
        },
      ],
    });
    await expect(
      meteredCall({ tenantId: "t1", monthlyCapUsd: 25 }, "v3/backlinks/summary/live", {}, d),
    ).rejects.toBeInstanceOf(DataforseoError);
    expect(d.record).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, costUsd: 0.01, feature: "backlinks" }),
    );

    const d2 = deps();
    mockFetchOnce(200, {
      status_code: 20000,
      tasks: [{ status_code: 40501, status_message: "Invalid Field: 'x'.", cost: 0 }],
    });
    await expect(
      meteredCall({ tenantId: "t1", monthlyCapUsd: 25 }, "v3/x", {}, d2),
    ).rejects.toBeInstanceOf(DataforseoError);
    expect(d2.record).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("fixtures", () => {
  const path = "v3/dataforseo_labs/google/keyword_overview/live";

  afterEach(() => {
    rmSync(join(process.cwd(), "fixtures"), { recursive: true, force: true });
  });

  it("serves recorded envelopes with zero fetches", async () => {
    const file = fixturePathFor(path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify(OK_ENVELOPE(0.0125, [{ items: [1, 2] }])));

    process.env.DATAFORSEO_FIXTURES = "1";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    const res = await postTask(path, {});
    expect(res.data).toEqual([{ items: [1, 2] }]);
    expect(res.billing.costUsd).toBe(0.0125);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails loudly when a fixture is missing (no silent live spend)", async () => {
    process.env.DATAFORSEO_FIXTURES = "1";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(postTask("v3/never/recorded", {})).rejects.toMatchObject({
      code: "INTERNAL",
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
