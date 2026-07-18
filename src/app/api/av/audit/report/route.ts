// src/app/api/av/audit/report/route.ts
// Renders a PDF for the *client-held* free-audit result. It does NOT re-run the
// audit and is NOT rate-limited (the rate limiter lives on POST /api/av/audit,
// which is what actually consumes the sidecar). We validate the body shape,
// cap its size, then forward it to the sidecar's POST /audit/report and stream
// the PDF straight back. CSRF (same-origin) guard stays.
import { NextRequest, NextResponse } from 'next/server';
import { csrfProtection } from '@/lib/csrf-protection';

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? 'http://127.0.0.1:4500';
const REPORT_PATH = process.env.AV_SIDECAR_REPORT_PATH ?? '/audit/report';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? '';
const MAX_BODY_BYTES = 100 * 1024; // 100KB — this renders data the client holds

export async function POST(req: NextRequest) {
  const csrf = csrfProtection(req);
  if (csrf) return csrf;

  // Size cap before parsing: prefer the declared length, but also guard the
  // actual payload so a lying Content-Length can't slip a huge body through.
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let audit: unknown;
  try {
    audit = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Must be an audit object with a numeric score and a checks array.
  const a = audit as Record<string, unknown>;
  if (
    !a ||
    typeof a !== 'object' ||
    Array.isArray(a) ||
    typeof a.score !== 'number' ||
    !Array.isArray(a.checks)
  ) {
    return NextResponse.json({ error: 'invalid_audit' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${SIDECAR_URL}${REPORT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      body: raw,
      signal: AbortSignal.timeout(35_000),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'report_unavailable' }, { status: 502 });
  }

  if (!res.ok) {
    // Surface the sidecar's 504 timeout distinctly so the UI can message it.
    const status = res.status === 504 ? 504 : 502;
    return NextResponse.json({ error: 'report_failed' }, { status });
  }

  const pdf = new Uint8Array(await res.arrayBuffer());
  const disposition =
    res.headers.get('content-disposition') ??
    'attachment; filename="Echorank-360-AI-Visibility-Report.pdf"';

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Cache-Control': 'no-store',
    },
  });
}
