// src/app/api/ai/visibility/keywords/route.ts
// Dashboard keyword suggester ("Keywords Explorer" in the SEO Tools hub) —
// full sidecar response, site depth, optional AI enhancement. Gated on an
// ACTIVE paid subscription (requirePaidPlan) like the rest of the hub: every
// paid tier — including STARTER, which lacks the ai_visibility feature —
// can use it; trial/canceled tenants get 403. The anonymous landing widget
// (/api/av/keywords) is a separate, untouched public surface.
//
// v1 does not persist results: there is no keyword-shaped model in the schema
// (VisibilityAudit stores score/checks) — results are returned to the client
// only. Revisit if a KeywordScan model is added.
//
// AI-ENHANCED RUNS ARE CACHED. With ai=true the sidecar makes one Anthropic
// call (keyword_suggest.py). Cached app-side for the same reason as remediate:
// av-service has no redis client, and an in-process Python cache dies on every
// restart. Runs with ai=false are pure heuristics and are left uncached — they
// spend nothing, and caching them would only serve a stale crawl.
//
// KEY: { url, depth, ai }. The brief suggested hashing the heuristic output,
// but that is computed inside the sidecar and does not exist on this side of
// the call. url+depth IS the request identity, and the heuristic output is a
// pure function of the page it fetches, so the two are equivalent within the
// 24h TTL.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";
import { cachedAiCall } from "@/lib/ai-cache";

interface KeywordsResponse {
  seed_keywords?: unknown[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requirePaidPlan();

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Enter a URL to analyze." }, { status: 400 });
    }
    const ai = body?.ai === true;
    const fresh = body?.fresh === true;

    const call = async () =>
      sidecarPost<KeywordsResponse>("/keywords", { url, depth: "site", ai });

    // Only the AI path costs money, so only the AI path is cached.
    if (!ai) {
      const { status, data } = await call();
      return NextResponse.json(data, { status });
    }

    let upstreamStatus = 200;
    const { value, cached } = await cachedAiCall(
      {
        namespace: "keywords-ai",
        tenantId: membership.tenantId,
        inputs: { url, depth: "site", ai },
        fresh,
      },
      async () => {
        const { status, data } = await call();
        upstreamStatus = status;
        // A failed run must not be served for 24 hours.
        if (status !== 200 || data?.error) throw new SidecarFailed(status, data);
        return data;
      },
    );

    return NextResponse.json({ ...(value as object), cached }, { status: upstreamStatus });
  } catch (error) {
    if (error instanceof SidecarFailed) {
      return NextResponse.json(error.data as object, { status: error.status });
    }
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error running keyword suggestion:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Carries a non-200 sidecar response out past the cache without storing it. */
class SidecarFailed extends Error {
  constructor(readonly status: number, readonly data: unknown) {
    super("sidecar returned non-200");
    this.name = "SidecarFailed";
  }
}
