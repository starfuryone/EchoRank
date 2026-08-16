/**
 * Dump the AI Assistant's Phase 8 counters.
 *
 *   npx tsx scripts/assistant-metrics.ts               # last 7 days
 *   npx tsx scripts/assistant-metrics.ts --days 30
 *   npx tsx scripts/assistant-metrics.ts --json
 *
 * MUST RUN AS `echorank` OR root. It reads REDIS_URL out of .env, and .env is
 * 600 echorank — see CLAUDE.md. As `deploy` it comes up env-less and talks to
 * the wrong Redis (the default instance on 6379, which is not ours).
 *
 * ── WHY A SCRIPT AND NOT AN HTTP ENDPOINT ──────────────────────────────────
 * These are PLATFORM totals across every tenant and both tiers, so they must
 * not be reachable from a customer's session. The alternative — an endpoint
 * behind INTERNAL_API_SECRET — would have to be added to the proxy's
 * `publicExactPaths` to be reachable at all, because everything else 307s to
 * /login. That list is the app's anonymous-access surface, and the Phase 1-5
 * comment above it says in as many words that a later admin view must not join
 * it by accident. Opening it for a counter dump an operator can read from a
 * shell would be trading a real security boundary for a convenience.
 *
 * READS ONLY. No writes, no deletes, no expiry changes. Safe to run any number
 * of times, safe to run in production, and it cannot perturb the counters it
 * is reporting.
 */

import "dotenv/config";
import { readWindow, METRIC_NAMES } from "../src/lib/assistant/pro/metrics";
import { getRedisConnection } from "../src/infrastructure/redis/connection";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Fixed counters first, then tools, then models — stable, readable order. */
function sortFields(fields: Record<string, number>): [string, number][] {
  const rank = (key: string) => {
    const fixed = (METRIC_NAMES as readonly string[]).indexOf(key);
    if (fixed >= 0) return fixed;
    if (key.startsWith("tool.")) return 100;
    if (key.startsWith("tokens.")) return 200;
    return 300;
  };
  return Object.entries(fields).sort(
    (a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]),
  );
}

async function main(): Promise<void> {
  const days = Number(arg("days"));
  const window = await readWindow(Number.isFinite(days) && days > 0 ? days : 7);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(window, null, 2));
    return;
  }

  for (const day of window.days) {
    const empty =
      Object.keys(day.public).length === 0 && Object.keys(day.pro).length === 0;
    console.log(`\n${day.day}${empty ? "  (no activity)" : ""}`);
    for (const tier of ["public", "pro"] as const) {
      const fields = day[tier];
      if (Object.keys(fields).length === 0) continue;
      console.log(`  ${tier}`);
      for (const [key, value] of sortFields(fields)) {
        console.log(`    ${key.padEnd(34)} ${value.toLocaleString()}`);
      }
    }
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("[assistant-metrics]", err);
    process.exitCode = 1;
  })
  .finally(() => {
    // The Redis client is lazy but keeps the event loop alive once connected.
    void getRedisConnection().quit();
  });
