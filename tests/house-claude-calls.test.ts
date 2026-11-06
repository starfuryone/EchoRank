// The house call sites that build their own Messages request on Haiku 5.5:
// the blog agent (which used to prefill) and the assistant (which used to drop
// thinking blocks on a tool turn). The shared provider is covered in
// tests/anthropic-request.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callDraftModel } from "@/lib/blog-agent/client";
import { callAssistantModelRaw, type ChatTurn } from "@/lib/assistant/model";

type Body = Record<string, unknown> & { messages: Array<{ role: string; content: unknown }> };

let bodies: Body[] = [];
let reply: unknown;

beforeEach(() => {
  bodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(reply), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  vi.stubEnv("BLOG_AGENT_ANTHROPIC_KEY", "test-blog-key");
  vi.stubEnv("BLOG_AGENT_MODEL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("blog agent request", () => {
  it("ends on the user's turn (no prefill), with thinking off and the cap restated", async () => {
    reply = {
      content: [{ type: "text", text: "---\ntitle: x\n---\nbody" }],
      usage: { input_tokens: 12_000, output_tokens: 2_500 },
      stop_reason: "end_turn",
    };
    const result = await callDraftModel({ system: "s", userMessage: "write" });

    expect(bodies[0].model).toBe("claude-haiku-5-5");
    expect(bodies[0].messages.map((m) => m.role)).toEqual(["user"]);
    expect(bodies[0].thinking).toEqual({ type: "disabled" });
    expect(bodies[0]).not.toHaveProperty("temperature");
    // 4,096 Haiku 4.5 tokens x 1.3.
    expect(bodies[0].max_tokens).toBe(5325);
    // The reply is handed on as it came: nothing is prepended any more.
    expect(result.text).toBe("---\ntitle: x\n---\nbody");
    // Metered at Haiku 5.5's short-prompt card: 12k x $0.10 + 2.5k x $0.50 per MTok.
    expect(result.costUsd).toBeCloseTo(0.00245, 9);
  });
});

describe("assistant request", () => {
  const system = [{ type: "text" as const, text: "s" }];
  const messages: ChatTurn[] = [{ role: "user", content: "hi" }];

  it("turns thinking off on the fast tier", async () => {
    reply = { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: {} };
    await callAssistantModelRaw({ model: "claude-haiku-5-5", system, messages, maxTokens: 1000 });
    expect(bodies[0].thinking).toEqual({ type: "disabled" });
    expect(bodies[0].max_tokens).toBe(1300);
    expect(bodies[0]).not.toHaveProperty("temperature");
  });

  it("leaves the reasoning tier its own thinking and the cap as given", async () => {
    reply = { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: {} };
    await callAssistantModelRaw({
      model: "claude-sonnet-5",
      system,
      messages,
      maxTokens: 4000,
      reasoning: true,
    });
    expect(bodies[0]).not.toHaveProperty("thinking");
    expect(bodies[0].max_tokens).toBe(4000);
  });

  it("keeps thinking blocks, unmodified, so a tool turn can echo them back", async () => {
    reply = {
      content: [
        { type: "thinking", thinking: "", signature: "sig-1" },
        { type: "redacted_thinking", data: "opaque" },
        { type: "tool_use", id: "tu_1", name: "lookup", input: { q: 1 } },
      ],
      stop_reason: "tool_use",
      usage: {},
    };
    const result = await callAssistantModelRaw({
      model: "claude-sonnet-5",
      system,
      messages,
      maxTokens: 4000,
      reasoning: true,
    });
    expect(result.blocks).toEqual([
      { type: "thinking", thinking: "", signature: "sig-1" },
      { type: "redacted_thinking", data: "opaque" },
      { type: "tool_use", id: "tu_1", name: "lookup", input: { q: 1 } },
    ]);

    // The next request carries the assistant turn exactly as it came.
    reply = { content: [{ type: "text", text: "done" }], stop_reason: "end_turn", usage: {} };
    await callAssistantModelRaw({
      model: "claude-sonnet-5",
      system,
      messages: [
        ...messages,
        { role: "assistant", content: result.blocks },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1", content: "42" }] },
      ],
      maxTokens: 4000,
      reasoning: true,
    });
    expect(bodies[1].messages[1].content).toEqual(result.blocks);
  });

  it("refuses to send a prefill", async () => {
    await expect(
      callAssistantModelRaw({
        model: "claude-haiku-5-5",
        system,
        messages: [...messages, { role: "assistant", content: "Sure" }],
        maxTokens: 100,
      }),
    ).rejects.toThrow(/prefill/);
    expect(bodies).toHaveLength(0);
  });
});
