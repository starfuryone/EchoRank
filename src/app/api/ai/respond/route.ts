import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/signals/auth-adapter";
import { cachedAiCall } from "@/lib/ai-cache";
// The five clauses that used to be a string literal in this file. Moved to
// src/lib/action-agent/prompts.ts when the Action Agent's review_reply
// generator needed the same instruction, and IMPORTED here rather than copied:
// two divergent copies of the paragraph that sets this product's liability
// posture on public replies is how that posture drifts.
// tests/action-agent-generate.test.ts asserts this route still reads it from
// there, and that no copy of the clauses survives in this file.
import { REVIEW_REPLY_INSTRUCTION } from "@/lib/action-agent/prompts";

// House policy: claude-haiku-4-5 for every Anthropic call.
// AI_RESPOND_MODEL still overrides; nothing sets it.
const MODEL = process.env.AI_RESPOND_MODEL || "claude-haiku-4-5";

export async function POST(req: NextRequest) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI drafting not configured (ANTHROPIC_API_KEY missing)" },
      { status: 503 },
    );
  }

  let body: {
    reviewText?: string;
    rating?: number;
    reviewerName?: string;
    businessName?: string;
    tone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reviewText = (body.reviewText || "").trim();
  if (!reviewText || reviewText.length > 5000) {
    return NextResponse.json(
      { error: "reviewText required (max 5000 chars)" },
      { status: 400 },
    );
  }

  const system = REVIEW_REPLY_INSTRUCTION;

  const user =
    `Business: ${body.businessName || "the business"}\n` +
    (body.tone ? `Tone: ${body.tone}\n` : "") +
    (typeof body.rating === "number" ? `Rating: ${body.rating}/5\n` : "") +
    (body.reviewerName ? `Reviewer: ${body.reviewerName}\n` : "") +
    `Review:\n${reviewText}`;

  // Deterministic inputs -> cacheable. Drafting a reply to the SAME review with
  // the same tone is the same request, and the obvious way to spend twice is a
  // user clicking "draft" again on a reply they already generated. `fresh: true`
  // asks for a genuinely new wording.
  let draft: string;
  let cached: boolean;
  try {
    ({ value: draft, cached } = await cachedAiCall<string>(
    {
      namespace: "respond",
      tenantId: auth.tenantId,
      inputs: {
        reviewText,
        rating: body.rating ?? null,
        reviewerName: body.reviewerName ?? null,
        businessName: body.businessName ?? null,
        tone: body.tone ?? null,
        model: MODEL,
      },
      fresh: (body as { fresh?: boolean }).fresh === true,
    },
    async () => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!r.ok) {
      // Thrown, not returned: a provider blip must not be cached for 24 hours.
      throw new ProviderError((await r.text()).slice(0, 300));
    }
    const data = (await r.json()) as { content?: { type: string; text?: string }[] };
    const draft = (data.content || [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
      .trim();
      return draft;
      },
    ));
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json(
        { error: "AI provider error", detail: err.detail },
        { status: 502 },
      );
    }
    throw err;
  }

  return NextResponse.json({ draft, model: MODEL, cached });
}

/** Carries a provider failure out past the cache without storing it. */
class ProviderError extends Error {
  constructor(readonly detail: string) {
    super("anthropic returned non-200");
    this.name = "ProviderError";
  }
}
// EOF-ai-respond
