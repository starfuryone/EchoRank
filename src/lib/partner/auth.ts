// src/lib/partner/auth.ts
//
// Auth pipeline for /api/partner/v1/*: Bearer key → scope "partner" →
// x-partner-subject → the subject's hourly limit. No paid-plan check: the key
// belongs to an internal partner tenant, and the allowances in limits.ts are
// the contract instead.
import "server-only";

import { NextResponse } from "next/server";
import { bearerKey, verifyApiKey } from "@/lib/api-keys";
import { PARTNER_SUBJECT_RE } from "./limits";
import { PartnerQuotaUnavailableError, reserveSubjectHour } from "./quota";

export interface PartnerContext {
  keyId: string;
  tenantId: string;
  subject: string;
}

export type PartnerAuthResult = { ok: true; ctx: PartnerContext } | { ok: false; response: NextResponse };

export function rateLimited(retryAfter: number, scope: string): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", scope, retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function quotaUnavailable(): NextResponse {
  return NextResponse.json({ error: "quota_unavailable" }, { status: 503, headers: { "Retry-After": "30" } });
}

export async function authenticatePartnerRequest(req: Request): Promise<PartnerAuthResult> {
  const key = bearerKey(req);
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing_bearer_key" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      ),
    };
  }
  const verified = await verifyApiKey(key);
  if (!verified) {
    return { ok: false, response: NextResponse.json({ error: "invalid_or_revoked_key" }, { status: 401 }) };
  }
  if (!verified.scopes.includes("partner")) {
    return { ok: false, response: NextResponse.json({ error: "wrong_scope" }, { status: 403 }) };
  }
  const subject = (req.headers.get("x-partner-subject") ?? "").trim();
  if (!PARTNER_SUBJECT_RE.test(subject)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: subject ? "invalid_partner_subject" : "missing_partner_subject" },
        { status: 400 },
      ),
    };
  }
  try {
    const hour = await reserveSubjectHour(verified.keyId, subject);
    if (!hour.allowed) return { ok: false, response: rateLimited(hour.retryAfter ?? 3600, "subject_hour") };
  } catch (err) {
    if (err instanceof PartnerQuotaUnavailableError) return { ok: false, response: quotaUnavailable() };
    throw err;
  }
  return { ok: true, ctx: { keyId: verified.keyId, tenantId: verified.tenantId, subject } };
}
