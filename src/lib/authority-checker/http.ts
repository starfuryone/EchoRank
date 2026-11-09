// src/lib/authority-checker/http.ts — one response shape for the Link
// Authority Checker's route: { error, code } with the message in the user's
// language.

import { NextResponse } from "next/server";
import { AUTHORITY_COPY, authorityLocale, type AuthorityErrorCode } from "./copy";

export function authorityErrorMessage(locale: string | null | undefined, code: AuthorityErrorCode): string {
  return AUTHORITY_COPY[authorityLocale(locale)].errors[code];
}

export function authorityError(locale: string | null | undefined, code: AuthorityErrorCode, status: number): NextResponse {
  return NextResponse.json(
    { error: authorityErrorMessage(locale, code), code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export function authorityJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse {
  return NextResponse.json(body, { status: init.status ?? 200, headers: { "cache-control": "no-store", ...init.headers } });
}
