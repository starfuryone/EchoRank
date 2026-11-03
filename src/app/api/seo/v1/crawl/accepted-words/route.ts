/**
 * GET /api/seo/v1/crawl/accepted-words — the workspace's accepted words.
 * PUT /api/seo/v1/crawl/accepted-words — replace them. Body: {words: string[]}.
 *
 * Words the Site Crawler's spell check (Phase 3c) never reports: brand,
 * product and people's names. Workspace-wide, read by every later crawl; a
 * crawl already running keeps the list it started with.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import {
  MAX_ACCEPTED_WORDS,
  MAX_ACCEPTED_WORD_LENGTH,
  normalizeAcceptedWords,
} from "@/lib/site-crawler/accepted-words";

const BodySchema = z.object({
  words: z.array(z.string().max(MAX_ACCEPTED_WORD_LENGTH)).max(MAX_ACCEPTED_WORDS * 2),
});

export async function GET() {
  try {
    const tenant = await requirePaidPlan();
    const row = await prisma.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { spellingAcceptedWords: true },
    });
    return NextResponse.json({ words: row?.spellingAcceptedWords ?? [], max: MAX_ACCEPTED_WORDS });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const words = normalizeAcceptedWords(parsed.data.words);
    await prisma.tenant.update({
      where: { id: tenant.tenantId },
      data: { spellingAcceptedWords: words },
    });
    return NextResponse.json({ words, max: MAX_ACCEPTED_WORDS });
  } catch (err) {
    return crawlRouteError(err);
  }
}
