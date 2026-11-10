// src/app/api/av/audit/route.ts
// The free AI Readiness Audit: proxies the av-visibility sidecar's POST /audit.
//
// THE ALLOWANCE (src/lib/av-free-limit.ts): FREE_AUDIT_DAILY_LIMIT audits per
// cf-connecting-ip per 24 h, in Redis, the window starting at the first audit.
// A slot is reserved before the sidecar call and refunded when no score comes
// back, so only an audit with a result counts. No cf-connecting-ip → 403: every
// visitor reaches this box through Cloudflare, which always sets it, and the
// x-forwarded-for fallback this used to have keyed everyone without it on the
// same "unknown" bucket.
//
//   GET  → { limit, remaining, retryAt }   (the form's "N of 3 audits left today")
//   POST → the audit, plus `remaining`, `perDay`, `resultId`, `benchmark`,
//          `emailAllowed`.
//
// A success also (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2):
//   - stores the full result in Redis for 7 days → `resultId` (the permalink
//     /free-audit/r/{id}, the emailed PDF); fail-open: no id, no permalink;
//   - writes one score-only benchmark row (score, scoreVersion; no domain, no
//     IP) and answers today's `benchmark` when 200+ results exist;
//   - says whether "Email me the PDF" is offered (`emailAllowed`: not in a
//     blocked country, src/lib/geo/blocked-countries.ts).
// Refusals are typed: 403 `no_client_ip`; 400 `invalid_brand` / `invalid_url`;
// 429 `rate_limited` with `retryAt` and `perDay`; 422 `unreachable` with the
// sidecar's `reason` (unreachable | blocked | rate_limited | server_error |
// not_found | empty) when the site's homepage could not be read; 502
// `audit_failed` / `sidecar_unreachable` otherwise. None but a 200 uses the allowance.
import { NextRequest, NextResponse } from 'next/server';
import { avFreeReserve, avFreeState } from '@/lib/av-free-limit';
import { guardPublicUrl } from '@/lib/public-url';
import { isBlockedCountry } from '@/lib/geo/blocked-countries';
import { benchmarkFor } from '@/lib/free-audit/benchmark';
import { FREE_AUDIT_DAILY_LIMIT } from '@/lib/free-audit/limits';
import { recordScore, saveResult } from '@/lib/free-audit/store';
import { scoreVersionOf } from '@/lib/visibility-score';

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? 'http://127.0.0.1:4500';
const SIDECAR_AUDIT_PATH = process.env.AV_SIDECAR_AUDIT_PATH ?? '/audit';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? '';

const FETCH_REASONS = new Set(['unreachable', 'blocked', 'rate_limited', 'server_error', 'not_found', 'empty']);

function clientIp(req: NextRequest): string | null {
  const ip = req.headers.get('cf-connecting-ip')?.trim();
  return ip ? ip : null;
}

const noIp = () => NextResponse.json({ error: 'no_client_ip' }, { status: 403 });

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!ip) return noIp();
  const s = await avFreeState(ip);
  return NextResponse.json(
    { limit: s.limit, remaining: s.remaining, retryAt: s.retryAt?.toISOString() ?? null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!ip) return noIp();

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

  const slot = await avFreeReserve(ip);
  if (!slot.ok) {
    return NextResponse.json(
      { error: 'rate_limited', perDay: FREE_AUDIT_DAILY_LIMIT, remaining: 0, retryAt: slot.retryAt?.toISOString() ?? null },
      { status: 429 },
    );
  }

  let scored = false;
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
      // The sidecar answers 502 {"error": "Couldn't fetch …", "reason", "status"}
      // when the homepage could not be read: the visitor's site, not our fault.
      const body = (await res.json().catch(() => null)) as { error?: unknown; reason?: unknown; status?: unknown } | null;
      if (res.status === 502 && typeof body?.error === 'string' && body.error.startsWith("Couldn't fetch")) {
        const reason = typeof body.reason === 'string' && FETCH_REASONS.has(body.reason) ? body.reason : 'unreachable';
        return NextResponse.json(
          { error: 'unreachable', reason, status: typeof body.status === 'number' ? body.status : null },
          { status: 422 },
        );
      }
      console.error('[av/audit] sidecar answered', res.status);
      return NextResponse.json({ error: 'audit_failed' }, { status: 502 });
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.score !== 'number') {
      return NextResponse.json({ error: 'audit_failed' }, { status: 502 });
    }
    scored = true;

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
      perDay: FREE_AUDIT_DAILY_LIMIT,
      remaining: slot.remaining,
      resultId: saved?.id ?? null,
      resultExpiresAt: saved?.expiresAt ?? null,
      benchmark,
      emailAllowed: !isBlockedCountry(req.headers.get('cf-ipcountry')),
    });
  } catch (err) {
    // saveResult, benchmarkFor and recordScore are fail-open, so this is the
    // sidecar call itself (timeout, refused connection, unparseable body).
    console.error('[av/audit] sidecar call failed', err);
    return NextResponse.json({ error: 'sidecar_unreachable' }, { status: 502 });
  } finally {
    if (!scored) await slot.release();
  }
}
