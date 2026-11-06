// The Google AI Overviews engine (runner/aio-engine.ts): a DataForSEO Live SERP
// with load_async_ai_overview, the overview as the answer, its references as
// sources, DataForSEO's billed figure as the cost, and off until switched on.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ENGINE_CATALOGUE } from "@/lib/ai-monitor/engines";
import { AIO_ENABLE_ENV, askEngine, refusalFor, runnableEngines } from "@/lib/ai-monitor/runner/providers";
import { aioTask, NO_AI_OVERVIEW, parseAiOverview, type SerpCall } from "@/lib/ai-monitor/runner/aio-engine";
import { SERP } from "@/lib/dataforseo/endpoints";

const AIO = ENGINE_CATALOGUE.find((e) => e.provider === "GOOGLE_AI_OVERVIEWS")!;
const CREDS = { DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p" };
const env = (extra: Record<string, string> = {}) => ({ ...CREDS, ...extra }) as unknown as NodeJS.ProcessEnv;

/** A live/advanced result with a loaded overview, in DataForSEO's shape. */
const WITH_OVERVIEW = {
  items: [
    {
      type: "ai_overview",
      asynchronous_ai_overview: true,
      markdown: "Popular choices include **Acme Plumbing** and Laval Drains.",
      items: [
        {
          type: "ai_overview_element",
          text: "ignored when the item has markdown",
          links: [{ url: "https://www.yelp.ca/biz/acme" }, { url: "https://acmeplumbing.ca/" }],
        },
      ],
      references: [
        { url: "https://acmeplumbing.ca/" },
        { url: "https://www.reddit.com/r/laval/x" },
        { url: "javascript:alert(1)" },
      ],
    },
    { type: "organic", url: "https://example.com" },
  ],
};

const billed = (data: unknown, costUsd: number): SerpCall =>
  vi.fn(async () => ({ data, billing: { path: SERP.organicLive.split("/"), costUsd } }));

describe("the DataForSEO task", () => {
  it("asks one SERP, loads the asynchronous overview, defaults to the US in English", () => {
    expect(aioTask("best plumber in Laval", env())).toEqual({
      keyword: "best plumber in Laval",
      location_code: 2840,
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 10,
      load_async_ai_overview: true,
    });
    expect(aioTask("q", env({ AI_AIO_LOCATION_CODE: "2124", AI_AIO_LANGUAGE_CODE: "fr" }))).toMatchObject({
      location_code: 2124,
      language_code: "fr",
    });
  });
});

describe("parsing the overview", () => {
  it("reads the overview's markdown and its sources, references first, de-duplicated", () => {
    expect(parseAiOverview(WITH_OVERVIEW)).toEqual({
      answer: "Popular choices include **Acme Plumbing** and Laval Drains.",
      sources: [
        { url: "https://acmeplumbing.ca/" },
        { url: "https://www.reddit.com/r/laval/x" },
        { url: "https://www.yelp.ca/biz/acme" },
      ],
    });
  });

  it("falls back to the elements' text when the item has no markdown", () => {
    const parsed = parseAiOverview({
      items: [{ type: "ai_overview", items: [{ text: "First." }, { markdown: "Second." }] }],
    });
    expect(parsed?.answer).toBe("First.\n\nSecond.");
  });

  it("finds nothing in the recorded SERP fetched without load_async_ai_overview", () => {
    // The real envelope: an ai_overview element with no content at all.
    const fixture = JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/dataforseo/v3-serp-google-organic-task_get-advanced.json"), "utf8"),
    );
    expect(parseAiOverview(fixture.tasks[0].result[0])).toBeNull();
    expect(parseAiOverview({ items: [{ type: "organic" }] })).toBeNull();
  });
});

describe("the engine in the runner", () => {
  it("ships off: refused until AI_ENGINE_GOOGLE_AI_OVERVIEWS=on", () => {
    const refusal = refusalFor(AIO, env());
    expect(refusal?.reason).toBe("missing_config");
    expect(refusal?.detail).toContain(AIO_ENABLE_ENV);
    expect(runnableEngines([AIO], env())).toEqual([]);
    expect(runnableEngines([AIO], env({ [AIO_ENABLE_ENV]: "on" }))).toEqual([AIO]);
  });

  it("still needs the DataForSEO credentials when switched on", () => {
    const refusal = refusalFor(AIO, { [AIO_ENABLE_ENV]: "on" } as unknown as NodeJS.ProcessEnv);
    expect(refusal?.reason).not.toBeUndefined();
  });

  it("answers with the overview and carries DataForSEO's billed cost", async () => {
    const serpCall = billed(WITH_OVERVIEW, 0.004);
    const result = await askEngine(
      { provider: "GOOGLE_AI_OVERVIEWS", model: AIO.modelName, promptText: "best plumber in Laval" },
      { serpCall, env: env() },
    );
    expect(serpCall).toHaveBeenCalledWith(SERP.organicLive, expect.objectContaining({ load_async_ai_overview: true }));
    expect(result.answer).toContain("Acme Plumbing");
    expect(result.sources).toHaveLength(3);
    expect(result.costUsd).toBe(0.004);
    expect(result.inputTokens).toBe(0);
    expect(result.emptyReason).toBeUndefined();
  });

  it("returns an empty answer with the reason when Google showed no overview, still costed", async () => {
    const result = await askEngine(
      { provider: "GOOGLE_AI_OVERVIEWS", model: AIO.modelName, promptText: "q" },
      { serpCall: billed({ items: [{ type: "organic" }] }, 0.002), env: env() },
    );
    expect(result.answer).toBe("");
    expect(result.emptyReason).toBe(NO_AI_OVERVIEW);
    expect(result.costUsd).toBe(0.002);
  });

  it("refuses to run unmetered: no tenant, no call", async () => {
    await expect(
      askEngine({ provider: "GOOGLE_AI_OVERVIEWS", model: AIO.modelName, promptText: "q" }, { env: env() }),
    ).rejects.toThrow(/tenantId/);
  });
});
