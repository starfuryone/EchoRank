// tests/prisma-pool-reconnect.test.ts
//
// Does the worker's Prisma client survive Postgres dropping its connections?
// The workers log showed ten "[PrismaPool] Unexpected pool error: terminating
// connection due to administrator command" lines: Postgres sends that (57P01)
// to every backend on a fast shutdown or pg_terminate_backend. The question is
// whether those dead clients are evicted, or kept and handed to the next query.
//
// Needs a real, disposable Postgres, so it is skipped unless PG_RECONNECT_URL
// is set. PG_RECONNECT_RESTART, if set, is a shell command that restarts that
// server (e.g. `pg_ctl -D <dir> -m fast restart -w`), for the full-restart case.
//
//   PG_RECONNECT_URL=postgres://test@127.0.0.1:54329/postgres \
//   PG_RECONNECT_RESTART='pg_ctl -D /tmp/pg/data -m fast restart -w' \
//   npx vitest run tests/prisma-pool-reconnect.test.ts

import { execSync } from "node:child_process";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL = process.env.PG_RECONNECT_URL;
const RESTART = process.env.PG_RECONNECT_RESTART;

type PrismaModule = typeof import("@/lib/prisma");
let db: PrismaModule;
const poolErrors: string[] = [];

async function selectOne(): Promise<number> {
  const rows = await db.prisma.$queryRaw<{ one: number }[]>`SELECT 1::int AS one`;
  return rows[0].one;
}

/** Open `n` connections at once so the pool holds n idle clients afterwards. */
async function warm(n: number): Promise<void> {
  await Promise.all(Array.from({ length: n }, () => db.prisma.$queryRaw`SELECT pg_sleep(0.2)::text AS s`));
}

/** What an administrator command does: end every backend but our own. */
async function terminateAll(): Promise<number> {
  const admin = new Client({ connectionString: URL });
  await admin.connect();
  const { rowCount } = await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend'",
  );
  await admin.end();
  return rowCount ?? 0;
}

const settle = () => new Promise((r) => setTimeout(r, 300));

describe.skipIf(!URL)("Prisma pool after Postgres drops its connections", () => {
  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("[PrismaPool]")) poolErrors.push(args.map(String).join(" "));
    });
    process.env.DATABASE_URL = URL;
    db = await import("@/lib/prisma");
    expect(await selectOne()).toBe(1);
  });

  afterAll(async () => {
    await db?.disconnectPrisma();
  });

  it("evicts idle clients that were terminated, and the next query reconnects", async () => {
    await warm(5);
    expect(db.poolStats().idle).toBeGreaterThanOrEqual(5);
    poolErrors.length = 0;

    expect(await terminateAll()).toBeGreaterThanOrEqual(5);
    await settle();

    // One log line per dead idle client: the ten lines in the workers log.
    expect(poolErrors.length).toBeGreaterThanOrEqual(5);
    expect(poolErrors[0]).toContain("terminating connection due to administrator command");
    expect(db.poolStats().total).toBe(0);
    expect(await selectOne()).toBe(1);
  });

  it("an in-flight query fails once; the client is not reused", async () => {
    const inFlight = db.prisma.$queryRaw`SELECT pg_sleep(5)::text AS s`;
    const failed = expect(inFlight).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 300));
    await terminateAll();
    await failed;
    await settle();
    for (let i = 0; i < 5; i++) expect(await selectOne()).toBe(1);
  });

  it.skipIf(!RESTART)("a full fast restart is survived without restarting the process", async () => {
    await warm(4);
    execSync(RESTART!, { stdio: "ignore" });
    await settle();
    // Some of the pool's clients died with the old server; none may be reused.
    for (let i = 0; i < 5; i++) expect(await selectOne()).toBe(1);
    expect(poolErrors.some((e) => e.includes("administrator command"))).toBe(true);
  });
});
