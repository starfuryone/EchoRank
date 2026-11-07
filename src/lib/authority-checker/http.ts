// src/lib/authority-checker/http.ts — one response shape for the checker's
// routes: { error, code } with the message in the visitor's language.

import { NextResponse } from "next/server";
import { AUTHORITY_COPY, authorityLocale, type AuthorityErrorCode } from "./copy";

export function authorityError(locale: string | null | undefined, code: AuthorityErrorCode, status: number): NextResponse {
  return NextResponse.json(
    { error: AUTHORITY_COPY[authorityLocale(locale)].errors[code], code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export function authorityJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse {
  return NextResponse.json(body, { status: init.status ?? 200, headers: { "cache-control": "no-store", ...init.headers } });
}
