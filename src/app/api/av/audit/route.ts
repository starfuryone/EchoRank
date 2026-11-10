// src/app/api/av/audit/route.ts
// The free AI Readiness Audit: proxies the av-visibility sidecar's POST /audit.
// Per-IP limit: 1 successful free audit / 24h, in Redis (src/lib/av-free-limit.ts).
//
// Since 2026-11-10 (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2) a success also:
//   - stores the full result in Redis for 7 days → `resultId` (the permalink
//     /free-audit/r/{id}, the emailed PDF); fail-open: no id, no permalink;
//   - writes one score-only benchmark row (score, scoreVersion; no domain, no
//     IP) and answers today's `benchmark` when 200+ results exist;
//   - says whether "Email me the PDF" is offered (`emailAllowed`: not in a
//     blocked country, src/lib/geo/blocked-countries.ts).
// Refusals are typed: 429 `rate_limited` with `retryAt` (when this IP can run
// the next one) and `perDay`; 422 `unreachable` when the site did not answer
// (no allowance used); 502 `audit_failed` otherwise.
import { NextRequest, NextResponse } from 'next/server';
import { avFreeLimited, avFreeRecord, avFreeRetryAt } from '@/lib/av-free-limit';
import { guardPublicUrl } from '@/lib/public-url';
import { isBlockedCountry } from '@/lib/geo/blocked-countries';
import { benchmarkFor } from '@/lib/free-audit/benchmark';
import { FREE_AUDITS_PER_DAY } from '@/lib/free-audit/limits';
import { recordScore, saveResult } from '@/lib/free-audit/store';
import { scoreVersionOf } from '@/lib/visibility-score';

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? 'http://127.0.0.1:4500';
const SIDECAR_AUDIT_PATH = process.env.AV_SIDECAR_AUDIT_PATH ?? '/audit';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? '';

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  if (await avFreeLimited(ip)) {
    const retryAt = await avFreeRetryAt(ip);
    return NextResponse.json(
      { error: 'rate_limited', perDay: FREE_AUDITS_PER_DAY, retryAt: retryAt?.toISOString() ?? null },
      { status: 429 },
    );
  }

  let brand = '';
  try {
    const body = await req.json();
    brand = String(body?.brand ?? '').trim().slice(0, 120);
  } catch {
    /* fall through */
  }
  if (!brand || !/^[\w .,'&@:/-]+$/i.test(brand)) {
    return NextResponse.json({ error: 'invalid_brand' }, { status: 400 });
  }
  // The sidecar fetches whatever it is given, so the field is a URL in all but
  // name: refuse private, loopback and link-local hosts (as written and as
  // resolved), non-http(s) schemes and every port but 80/443 before it leaves.
  const target = await guardPublicUrl(brand);
  if (!target.ok) {
    return NextResponse.json({ error: 'invalid_url', reason: target.reason }, { status: 400 });
  }

  try {
    const res = await fetch(`${SIDECAR_URL}${SIDECAR_AUDIT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      // Sidecar /audit expects `url`; crawl=false keeps the free tier light.
      body: JSON.stringify({ url: target.url, crawl: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      // The sidecar answers 502 {"error": "Couldn't fetch …"} for a site that
      // did not respond: the visitor's problem to fix, not ours, and no
      // allowance is used.
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (res.status === 502 && typeof body?.error === 'string' && body.error.startsWith("Couldn't fetch")) {
        return NextResponse.json({ error: 'unreachable' }, { status: 422 });
      }
      return NextResponse.json({ error: 'audit_failed' }, { status: 502 });
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.score !== 'number') {
      return NextResponse.json({ error: 'audit_failed' }, { status: 502 });
    }
    await avFreeRecord(ip); // only successful audits consume quota

    const audit: Record<string, unknown> = {
      brand,
      ...data,
      mentionRate: data.mentionRate ?? data.mention_rate ?? 0,
      engines: data.engines ?? [],
      sampleAnswer: data.sampleAnswer ?? data.sample_answer,
      trustScore: data.trustScore ?? data.trust_score ?? data.score,
    };
    const version = scoreVersionOf(data);
    const score = Math.round(data.score);
    const [saved, benchmark] = await Promise.all([
      saveResult(audit),
      // Read before this run's row is written: the visitor is compared with the sites checked before them.
      benchmarkFor(score, version),
    ]);
    await recordScore(score, version);

    return NextResponse.json({
      ...audit,
      resultId: saved?.id ?? null,
      resultExpiresAt: saved?.expiresAt ?? null,
      benchmark,
      emailAllowed: !isBlockedCountry(req.headers.get('cf-ipcountry')),
    });
  } catch {
    return NextResponse.json({ error: 'sidecar_unreachable' }, { status: 502 });
  }
}
