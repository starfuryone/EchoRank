// src/lib/reddit-threads/http.ts — one response shape for the finder's
// routes: { error, code } with the message in the visitor's language.

import { NextResponse } from "next/server";
import { REDDIT_COPY, redditLocale, type RedditErrorCode } from "./copy";

export function redditError(locale: string | null | undefined, code: RedditErrorCode, status: number): NextResponse {
  return NextResponse.json(
    { error: REDDIT_COPY[redditLocale(locale)].errors[code], code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export function redditJson(body: unknown): NextResponse {
  return NextResponse.json(body, { status: 200, headers: { "cache-control": "no-store" } });
}
