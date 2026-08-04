// src/lib/historical/http.ts
//
// One error mapper for every Historical route, the shape content-explorer and
// marketing establish — so an unauthenticated request gets a 401 rather than
// falling through to an opaque 500.

import { NextResponse } from "next/server";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { SnapshotTooLargeError } from "./snapshots";
import { SpacesNotConfiguredError, SpacesUnavailableError } from "./spaces";
import { CaptureBlockedError, CaptureFailedError } from "./capture";

export function historicalRouteError(err: unknown): NextResponse {
  const enforcement = enforcementErrorResponse(err);
  if (enforcement) return enforcement;

  if (err instanceof SnapshotTooLargeError) {
    return NextResponse.json(
      { error: err.message, code: "SNAPSHOT_TOO_LARGE", sizeBytes: err.sizeBytes },
      { status: 413 },
    );
  }

  if (err instanceof SpacesNotConfiguredError) {
    // Deliberately not the operator-facing message: which env var is missing is
    // an internal detail. The server log carries the specifics.
    console.error("[historical]", err.message);
    return NextResponse.json(
      { error: "Snapshot storage is not configured on this deployment.", code: "STORAGE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (err instanceof SpacesUnavailableError) {
    return NextResponse.json(
      { error: "Snapshot storage is temporarily unavailable. Try again in a minute.", code: "STORAGE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (err instanceof CaptureBlockedError) {
    return NextResponse.json(
      { error: err.message, code: "CAPTURE_BLOCKED" },
      { status: 422 },
    );
  }

  if (err instanceof CaptureFailedError) {
    return NextResponse.json(
      { error: err.message, code: "CAPTURE_FAILED" },
      { status: err.statusCode },
    );
  }

  if (err instanceof Error && err.message.includes("Not authenticated")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  console.error("[historical] unhandled:", err instanceof Error ? err.name : typeof err);
  return NextResponse.json(
    { error: "Something went wrong.", code: "INTERNAL" },
    { status: 500 },
  );
}
