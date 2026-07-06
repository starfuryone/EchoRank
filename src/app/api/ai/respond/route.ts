import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/signals/auth-adapter";

const MODEL = process.env.AI_RESPOND_MODEL || "claude-sonnet-4-6";

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

  const system =
    "You draft public replies to customer reviews for a local business. " +
    "Write in the business's voice: professional, warm, specific to what the reviewer said, 2 to 5 sentences. " +
    "Thank positive reviewers concretely. For negative reviews: acknowledge, never argue, never admit legal fault, " +
    "offer to make it right and invite offline contact. No emojis unless the tone asks. " +
    "Never fabricate facts, discounts or promises. Output only the reply text.";

  const user =
    `Business: ${body.businessName || "the business"}\n` +
    (body.tone ? `Tone: ${body.tone}\n` : "") +
    (typeof body.rating === "number" ? `Rating: ${body.rating}/5\n` : "") +
    (body.reviewerName ? `Reviewer: ${body.reviewerName}\n` : "") +
    `Review:\n${reviewText}`;

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
    const detail = await r.text();
    return NextResponse.json(
      { error: "AI provider error", detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }
  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  const draft = (data.content || [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();

  return NextResponse.json({ draft, model: MODEL });
}
// EOF-ai-respond
