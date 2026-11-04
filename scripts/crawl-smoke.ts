/**
 * Site Crawler production smoke test: one real crawl through the start
 * handler's guards and the site-crawl queue, then one PASS / FAIL / SKIP line
 * per check. Exits 1 on any FAIL, 2 on bad arguments. The checks themselves
 * live in src/lib/site-crawler/smoke.ts (tests/crawl-smoke.test.ts).
 *
 * Runs as echorank (it reads .env, like the workers), from the app directory:
 *
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run crawl:smoke -- \
 *     --tenant <slug> --url https://echorank360.com --render thin --psi 10 --backlinks 10 \
 *     --extract og --search "gtag(" --segment "/learn/*" --timeout 20
 *
 * --backlinks spends real money (DataForSEO, metered under the tenant's USD
 * cap); the estimate is printed before the crawl is enqueued. Run without
 * --tenant to list tenant slugs.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { closeAllQueues } from "@/infrastructure/queue/registry";
import { parseArgs, runSmoke, USAGE } from "@/lib/site-crawler/smoke";

async function main(): Promise<number> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(USAGE);
    return 2;
  }
  const result = await runSmoke(args, {
    fetch,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    out: (line) => console.log(line),
    env: process.env,
  });
  return result.exitCode;
}

main()
  .catch((err) => {
    // The message only: a stack or an error object can carry connection strings.
    console.error(`[smoke] crashed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    return 1;
  })
  .then(async (code) => {
    await closeAllQueues().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(code);
  });
