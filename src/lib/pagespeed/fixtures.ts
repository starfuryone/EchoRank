/**
 * src/lib/pagespeed/fixtures.ts
 *
 * PAGESPEED_FIXTURES=1 short-circuits runPagespeed to a recorded response.
 *
 * Unlike the DataForSEO fixtures this is NOT about cost — PSI is free. It is
 * about time and determinism: a real run takes 10-30 s, which no test suite
 * should ever wait for, and Lighthouse scores legitimately move between runs
 * so a live call could never be asserted against.
 *
 * Files live in fixtures/pagespeed/<url-slug>-<strategy>.json and hold the raw
 * PSI response body, so parsing stays on the real code path.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Overridable so tests can write to a scratch directory instead of the
 * committed fixtures. */
function fixtureDir(): string {
  return process.env.PAGESPEED_FIXTURE_DIR ?? join(process.cwd(), "fixtures", "pagespeed");
}

export function fixturesEnabled(): boolean {
  return process.env.PAGESPEED_FIXTURES === "1";
}

/**
 * PAGESPEED_RECORD=1 writes every live response to fixtures/ as it comes back.
 * Ignored when PAGESPEED_FIXTURES=1 (replay wins — recording from a replay is
 * a no-op).
 */
export function recordingEnabled(): boolean {
  return process.env.PAGESPEED_RECORD === "1" && !fixturesEnabled();
}

export function fixturePathFor(key: string): string {
  return join(fixtureDir(), `${key}.json`);
}

/** Recorded PSI response for a key, or null when none exists. */
export function loadFixture(key: string): unknown | null {
  const file = fixturePathFor(key);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

export function saveFixture(key: string, body: unknown): void {
  mkdirSync(fixtureDir(), { recursive: true });
  writeFileSync(fixturePathFor(key), JSON.stringify(body, null, 2));
}
