// src/app/api/av/audit/route.ts
// Proxies free audits to the av-visibility sidecar (port 4500).
// Per-IP limit: 1 free audit / 24h (in-memory — fine for single PM2 instance;
// move to Redis/BullMQ store if you cluster).

import { NextRequest, NextResponse } from 'next/server';

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? 'http://127.0.0.1:4500';
// Adjust to the sidecar's real route if different:
const SIDECAR_AUDIT_PATH = process.env.AV_SIDECAR_AUDIT_PATH ?? '/audit/basic';

const LIMIT_PER_DAY = 1;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return false;
  }
  if (rec.count >= LIMIT_PER_DAY) return true;
  rec.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('cf-connecting-ip') ?? // Cloudflare in front
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  if (rateLimited(ip)) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, tier: 'free' }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'audit_failed' }, { status: 502 });
    }
    const data = await res.json();

    // Normalize to the shape AuditWidget expects.
    return NextResponse.json({
      brand,
      mentionRate: data.mentionRate ?? data.mention_rate ?? 0,
      engines: data.engines ?? [],
      sampleAnswer: data.sampleAnswer ?? data.sample_answer,
      trustScore: data.trustScore ?? data.trust_score,
    });
  } catch {
    return NextResponse.json({ error: 'sidecar_unreachable' }, { status: 502 });
  }
}
