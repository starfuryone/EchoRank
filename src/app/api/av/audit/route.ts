// src/app/api/av/audit/route.ts
// Proxies free audits to the av-visibility sidecar's POST /audit.
// Per-IP limit: 1 successful free audit / 24h (in-memory — single instance).
import { NextRequest, NextResponse } from 'next/server';

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? 'http://127.0.0.1:4500';
const SIDECAR_AUDIT_PATH = process.env.AV_SIDECAR_AUDIT_PATH ?? '/audit';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? '';
const LIMIT_PER_DAY = 1;

const hits = new Map<string, { count: number; resetAt: number }>();

function isLimited(ip: string): boolean {
  const rec = hits.get(ip);
  if (!rec || Date.now() > rec.resetAt) return false;
  return rec.count >= LIMIT_PER_DAY;
}

function recordHit(ip: string): void {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  } else {
    rec.count += 1;
  }
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  if (isLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
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

  try {
    const res = await fetch(`${SIDECAR_URL}${SIDECAR_AUDIT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      // Sidecar /audit expects `url`; crawl=false keeps the free tier light.
      body: JSON.stringify({ url: brand, crawl: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'audit_failed' }, { status: 502 });
    }
    const data = await res.json();
    recordHit(ip); // only successful audits consume quota

    // Pass the audit through plus normalized fields AuditWidget reads.
    return NextResponse.json({
      brand,
      ...data,
      mentionRate: data.mentionRate ?? data.mention_rate ?? 0,
      engines: data.engines ?? [],
      sampleAnswer: data.sampleAnswer ?? data.sample_answer,
      trustScore: data.trustScore ?? data.trust_score ?? data.score,
    });
  } catch {
    return NextResponse.json({ error: 'sidecar_unreachable' }, { status: 502 });
  }
}
