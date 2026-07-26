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

const FIXTURE_DIR = join(process.cwd(), "fixtures", "dataforseo");

export function fixturesEnabled(): boolean {
  return process.env.DATAFORSEO_FIXTURES === "1";
}

export function fixturePathFor(apiPath: string): string {
  return join(FIXTURE_DIR, `${apiPath.replace(/\//g, "-")}.json`);
}

/** Returns the raw envelope JSON for a path, or null when no fixture exists. */
export function loadFixture(apiPath: string): unknown | null {
  const file = fixturePathFor(apiPath);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Record a live envelope for later fixture use (call once per endpoint). */
export function saveFixture(apiPath: string, envelope: unknown): void {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(fixturePathFor(apiPath), JSON.stringify(envelope, null, 2));
}
