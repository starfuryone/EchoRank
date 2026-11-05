// tests/site-crawler-ai-batch.test.ts — the crawler AI batch module with
// mocked providers: Claude Message Batches and the OpenAI Batch API — submit
// (the same bodies buildRequest makes, keys in headers only), poll (status
// mapping, including "not accepted yet"), results (succeeded / errored /
// refused lines, keyed by custom_id), cancel, and the clean-up that deletes
// what the provider stored.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { __resetClaudeModelFallback, buildRequest } from "@/lib/site-crawler/ai-prompts";
import {
  batchCustomId,
  batchResults,
  cancelBatch,
  parseCustomId,
  pollBatch,
  removeBatch,
  submitBatch,
  type BatchHandle,
} from "@/lib/site-crawler/ai-batch";

const KEY = "sk-test-" + "k".repeat(30);
const page = (n: number) => ({ url: `https://x.com/p${n}`, text: `Page ${n} text about oak tables.` });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const text = (body: string) => new Response(body, { status: 200 });
type Call = [string, RequestInit];
const fetchMock = (...responses: Response[]) => {
  const f = vi.fn<(u: string, i: RequestInit) => Promise<Response>>();
  for (const r of responses) f.mockResolvedValueOnce(r);
  return f;
};
const callsOf = (f: ReturnType<typeof fetchMock>) => f.mock.calls as Call[];

describe("custom ids", () => {
  it("round-trip page id and prompt index within [A-Za-z0-9_-]{1,64}", () => {
    const id = batchCustomId("cm9x2k3l40000abcdxyz12345", 2);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(parseCustomId(id)).toEqual(["cm9x2k3l40000abcdxyz12345", 2]);
    expect(parseCustomId("not ours")).toBeNull();
  });
});

describe("claude: Message Batches", () => {
  const items = () => {
    __resetClaudeModelFallback();
    return [0, 1].map((n) => ({ customId: batchCustomId(`page${n}`, 0), req: buildRequest("claude", KEY, { preset: "summary", text: null }, page(n)) }));
  };

  it("submits requests[{custom_id, params}] with the synchronous bodies, key in a header", async () => {
    const f = fetchMock(json({ id: "msgbatch_1", processing_status: "in_progress" }));
    const its = items();
    const h = await submitBatch("claude", KEY, its, f as never);
    expect(h).toEqual({ provider: "claude", id: "msgbatch_1", inputFileId: null });
    const [url, init] = callsOf(f)[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages/batches");
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
    const sent = JSON.parse(init.body as string);
    expect(sent.requests.map((r: { custom_id: string }) => r.custom_id)).toEqual(["page0_0", "page1_0"]);
    expect(sent.requests[0].params).toEqual(its[0]!.req.body);
    // The cache marker rides along into the batch.
    expect(JSON.stringify(sent.requests[0].params)).toContain('"cache_control":{"type":"ephemeral"}');
  });

  it("a refused submission throws without the provider's body", async () => {
    const f = fetchMock(new Response(`{"error":{"message":"bad ${KEY}"}}`, { status: 400 }));
    const err = await submitBatch("claude", KEY, items(), f as never).catch((e: Error) => e);
    expect((err as Error).message).toBe("HTTP 400");
    expect(String(err)).not.toContain(KEY);
  });

  it("polls: in_progress = running, ended = results_url", async () => {
    const h: BatchHandle = { provider: "claude", id: "msgbatch_1", inputFileId: null };
    expect(await pollBatch(KEY, h, fetchMock(json({ processing_status: "in_progress" })) as never)).toEqual({ state: "running" });
    expect(await pollBatch(KEY, h, fetchMock(json({ processing_status: "canceling" })) as never)).toEqual({ state: "running" });
    const ended = await pollBatch(KEY, h, fetchMock(json({ processing_status: "ended", results_url: "https://api.anthropic.com/v1/messages/batches/msgbatch_1/results" })) as never);
    expect(ended).toEqual({ state: "ended", resultsUrl: "https://api.anthropic.com/v1/messages/batches/msgbatch_1/results", outputFileId: null, errorFileId: null });
  });

  it("reads succeeded, errored, expired and refused lines by custom_id, in any order", async () => {
    const msg = (t: string) => ({ model: "claude-haiku-5-5", content: [{ type: "thinking", thinking: "" }, { type: "text", text: t }], stop_reason: "end_turn", usage: { input_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 40 } });
    const jsonl = [
      { custom_id: "p2_0", result: { type: "errored", error: { type: "invalid_request_error" } } },
      { custom_id: "p1_0", result: { type: "succeeded", message: msg("Oak tables.") } },
      { custom_id: "p3_0", result: { type: "expired" } },
      { custom_id: "p4_0", result: { type: "succeeded", message: { ...msg(""), stop_reason: "refusal" } } },
    ].map((l) => JSON.stringify(l)).join("\n");
    const f = fetchMock(text(jsonl + "\n"));
    const h: BatchHandle = { provider: "claude", id: "msgbatch_1", inputFileId: null };
    const lines = await batchResults(KEY, h, { state: "ended", resultsUrl: "https://api.anthropic.com/r", outputFileId: null, errorFileId: null }, "claude-haiku-5-5", f as never);
    expect((callsOf(f)[0]![1].headers as Record<string, string>)["x-api-key"]).toBe(KEY);
    const by = Object.fromEntries(lines.map((l) => [l.customId, l]));
    expect(by.p1_0).toMatchObject({ ok: true, result: { text: "Oak tables.", inputTokens: 500, outputTokens: 40 } });
    expect(by.p2_0).toEqual({ customId: "p2_0", ok: false, reason: "errored" });
    expect(by.p3_0).toEqual({ customId: "p3_0", ok: false, reason: "expired" });
    expect(by.p4_0).toEqual({ customId: "p4_0", ok: false, reason: "refused" });
  });

  it("cancels and deletes the batch", async () => {
    const h: BatchHandle = { provider: "claude", id: "msgbatch_1", inputFileId: null };
    const f = fetchMock(json({}), json({}));
    await cancelBatch(KEY, h, f as never);
    await removeBatch(KEY, h, null, f as never);
    expect(callsOf(f).map(([u, i]) => `${i.method} ${u}`)).toEqual([
      "POST https://api.anthropic.com/v1/messages/batches/msgbatch_1/cancel",
      "DELETE https://api.anthropic.com/v1/messages/batches/msgbatch_1",
    ]);
  });
});

describe("openai: Batch API", () => {
  const items = () => [0, 1].map((n) => ({ customId: batchCustomId(`page${n}`, 1), req: buildRequest("openai", KEY, { preset: "intent", text: null }, page(n)) }));

  it("uploads the JSONL (purpose batch) and creates a 24h batch for /v1/responses", async () => {
    const f = fetchMock(json({ id: "file-in" }), json({ id: "batch_1", status: "validating" }));
    const its = items();
    const h = await submitBatch("openai", KEY, its, f as never);
    expect(h).toEqual({ provider: "openai", id: "batch_1", inputFileId: "file-in" });
    const [[u1, i1], [u2, i2]] = callsOf(f) as [Call, Call];
    expect(u1).toBe("https://api.openai.com/v1/files");
    const form = i1.body as FormData;
    expect(form.get("purpose")).toBe("batch");
    const lines = (await (form.get("file") as Blob).text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0]).toEqual({ custom_id: "page0_1", method: "POST", url: "/v1/responses", body: its[0]!.req.body });
    expect((i1.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(u2).toBe("https://api.openai.com/v1/batches");
    expect(JSON.parse(i2.body as string)).toEqual({ input_file_id: "file-in", endpoint: "/v1/responses", completion_window: "24h" });
  });

  it("deletes the uploaded file when the batch is not created", async () => {
    const f = fetchMock(json({ id: "file-in" }), new Response("no", { status: 429 }), json({}));
    await expect(submitBatch("openai", KEY, items(), f as never)).rejects.toThrow("HTTP 429");
    expect(callsOf(f)[2]).toEqual(["https://api.openai.com/v1/files/file-in", expect.objectContaining({ method: "DELETE" })]);
  });

  it.each([
    ["validating", { state: "validating" }],
    ["failed", { state: "failed" }],
    ["in_progress", { state: "running" }],
    ["finalizing", { state: "running" }],
    ["completed", { state: "ended", resultsUrl: null, outputFileId: "file-out", errorFileId: "file-err" }],
    ["expired", { state: "ended", resultsUrl: null, outputFileId: "file-out", errorFileId: "file-err" }],
  ])("status %s polls as %j", async (status, want) => {
    const f = fetchMock(json({ status, output_file_id: "file-out", error_file_id: "file-err" }));
    expect(await pollBatch(KEY, { provider: "openai", id: "batch_1", inputFileId: "file-in" }, f as never)).toEqual(want);
  });

  it("reads the output and error files; removes all three files", async () => {
    const ok = { custom_id: "page0_1", response: { status_code: 200, body: { output: [{ type: "message", content: [{ type: "output_text", text: "commercial" }] }], usage: { input_tokens: 700, input_tokens_details: { cached_tokens: 0 }, output_tokens: 3 } } }, error: null };
    const bad = { custom_id: "page1_1", response: { status_code: 400, body: {} }, error: null };
    const f = fetchMock(text(JSON.stringify(ok)), text(JSON.stringify(bad)), json({}), json({}), json({}));
    const h: BatchHandle = { provider: "openai", id: "batch_1", inputFileId: "file-in" };
    const ended = { state: "ended", resultsUrl: null, outputFileId: "file-out", errorFileId: "file-err" } as const;
    const lines = await batchResults(KEY, h, ended, "gpt-5-nano", f as never);
    expect(lines).toEqual([
      { customId: "page0_1", ok: true, result: { text: "commercial", inputTokens: 700, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 3, model: "gpt-5-nano" } },
      { customId: "page1_1", ok: false, reason: "HTTP 400" },
    ]);
    await removeBatch(KEY, h, ended, f as never);
    expect(callsOf(f).slice(2).map(([u, i]) => `${i.method} ${u}`)).toEqual([
      "DELETE https://api.openai.com/v1/files/file-in",
      "DELETE https://api.openai.com/v1/files/file-out",
      "DELETE https://api.openai.com/v1/files/file-err",
    ]);
  });
});
