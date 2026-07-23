// src/app/api/av/keywords/route.ts
// Free anonymous keyword scan — backs the KeywordWidget on the AI Visibility
// landing page. Proxies to the sidecar's POST /keywords (homepage only, no AI)
// and truncates the response for the free tier.
//
// Rate limit: Redis INCR + TTL keyed on cf-connecting-ip, 2 scans / IP / 24h.
// Requests without cf-connecting-ip are rejected (403) — there is deliberately
// NO shared "unknown" bucket. Quota is consumed only on sidecar success.
import { NextRequest, NextResponse } from "next/server";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { sidecarPost } from "@/lib/av-sidecar";

const LIMIT_PER_DAY = 2;
const WINDOW_S = 24 * 60 * 60;

interface KeywordItem {
  kw: string;
  score: number;
  difficulty: string;
  source: string;
}
interface TechnicalCheck {
  check: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}
interface KeywordsResponse {
  url?: string;
  language?: string;
  seed_keywords?: KeywordItem[];
  question_keywords?: KeywordItem[];
  content_optimization?: {
    present_terms: string[];
    missing_terms: string[];
    title_suggestion: string;
    meta_suggestion: string;
    flags: string[];
  };
  ai_visibility_prompts?: string[];
  technical?: TechnicalCheck[];
  meta?: { pages_crawled: number; ai_used: boolean; elapsed_ms: number };
  error?: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip");
  if (!ip) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let url = "";
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim().slice(0, 200);
  } catch {
    /* fall through */
  }
  if (!url || !/^[\w.,:/?'&@#=%~+-]+$/i.test(url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  // Check quota BEFORE the sidecar call, consume it only AFTER success —
  // a failed scan must not burn one of the two free slots.
  const redisKey = `kwfree:${ip}`;
  let redis;
  try {
    redis = getRedisConnection();
    const used = Number((await redis.get(redisKey)) ?? 0);
    if (used >= LIMIT_PER_DAY) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  } catch {
    // Redis down → fail closed: an unlimited anonymous crawl trigger is worse
    // than a temporarily unavailable lead magnet.
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }

  const { status, data } = await sidecarPost<KeywordsResponse>("/keywords", {
    url,
    depth: "single",
    ai: false,
  });
  if (status !== 200 || data.error || !data.seed_keywords) {
    return NextResponse.json(
      { error: data.error || "scan_failed" },
      { status: 502 },
    );
  }

  try {
    const n = await redis.incr(redisKey);
    if (n === 1) await redis.expire(redisKey, WINDOW_S);
  } catch {
    /* quota write is best-effort once the result exists */
  }

  // Free-tier truncation: enough to be genuinely useful, with locked counts
  // so the widget can show what the full plan adds.
  const seeds = data.seed_keywords ?? [];
  const questions = data.question_keywords ?? [];
  const prompts = data.ai_visibility_prompts ?? [];
  const technical = data.technical ?? [];
  return NextResponse.json({
    url: data.url ?? url,
    language: data.language,
    seed_keywords: seeds.slice(0, 10),
    seed_total: seeds.length,
    question_keywords: questions.slice(0, 3),
    question_total: questions.length,
    ai_visibility_prompts: prompts.slice(0, 3),
    prompt_total: prompts.length,
    technical_summary: {
      pass: technical.filter((c) => c.status === "pass").length,
      warn: technical.filter((c) => c.status === "warn").length,
      fail: technical.filter((c) => c.status === "fail").length,
    },
    meta: { pages_crawled: data.meta?.pages_crawled ?? 1, ai_used: false },
    upsell: true,
  });
}
