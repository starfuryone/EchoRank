/**
 * src/lib/dataforseo/fixtures.ts
 *
 * DATAFORSEO_FIXTURES=1 short-circuits postTask to recorded JSON so UI
 * iteration never burns live credits. Record each fixture with exactly one
 * live call (see scripts note in docs/agents/BLOCKERS.md).
 *
 * Fixture files live in fixtures/dataforseo/<path-with-dashes>.json and hold
 * the raw DataForSEO response body (the full envelope, tasks[] included), so
 * envelope/billing parsing stays on the real code path.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where fixtures live. Resolved per call, and overridable with
 * DATAFORSEO_FIXTURE_DIR so tests can write to a scratch directory — the
 * suite used to clean up by deleting <cwd>/fixtures outright, which silently
 * removed the committed envelopes and pushed the next fixtures-mode run back
 * onto the live (billed) API.
 */
function fixtureDir(): string {
  return process.env.DATAFORSEO_FIXTURE_DIR ?? join(process.cwd(), "fixtures", "dataforseo");
}

export function fixturesEnabled(): boolean {
  return process.env.DATAFORSEO_FIXTURES === "1";
}

/**
 * DATAFORSEO_RECORD=1 writes every live envelope to fixtures/ as it comes
 * back, so one live call per endpoint is enough to seed replay. Ignored when
 * DATAFORSEO_FIXTURES=1 (replay wins — recording from a replay is a no-op).
 */
export function recordingEnabled(): boolean {
  return process.env.DATAFORSEO_RECORD === "1" && !fixturesEnabled();
}

export function fixturePathFor(apiPath: string): string {
  return join(fixtureDir(), `${apiPath.replace(/\//g, "-")}.json`);
}

/** Returns the raw envelope JSON for a path, or null when no fixture exists. */
export function loadFixture(apiPath: string): unknown | null {
  const file = fixturePathFor(apiPath);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Record a live envelope for later fixture use (call once per endpoint). */
export function saveFixture(apiPath: string, envelope: unknown): void {
  mkdirSync(fixtureDir(), { recursive: true });
  writeFileSync(fixturePathFor(apiPath), JSON.stringify(envelope, null, 2));
}
