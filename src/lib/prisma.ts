import "server-only";
// A CLIENT COMPONENT IMPORTING THIS IS A BUILD ERROR, BY DESIGN.
// This module reaches the database driver / the Node filesystem, and a
// value import of it from a Client Component pulls pg (dns, net, tls) or
// node:fs into the browser bundle. That took production down on
// 2026-08-18: eight Turbopack errors, a failed build, and a cleared
// .next serving nothing. `server-only` turns the same mistake into a
// compile error naming this file instead. Use `import type` for types.

import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Connection Pool Configuration
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  _pool = new Pool({
    connectionString: url,
    max: parseInt(process.env.DB_POOL_MAX ?? "20", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Log pool errors to prevent unhandled rejections
  _pool.on("error", (err) => {
    console.error("[PrismaPool] Unexpected pool error:", err.message);
  });

  return _pool;
}

// ---------------------------------------------------------------------------
// Prisma Client with pooled adapter
// ---------------------------------------------------------------------------

function makePrisma(): PrismaClient {
  const pool = getPool();
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

/**
 * Disconnect Prisma and drain the underlying connection pool.
 * Call this during graceful shutdown (e.g. SIGTERM handler).
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("[PrismaPool] Error disconnecting Prisma:", err);
  }

  if (_pool) {
    try {
      await _pool.end();
      _pool = null;
    } catch (err) {
      console.error("[PrismaPool] Error draining pool:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Pool Health Check
// ---------------------------------------------------------------------------

/**
 * Check the health of the database connection pool.
 * Returns true if a simple query succeeds within 5 seconds.
 */
export async function checkPoolHealth(): Promise<boolean> {
  const pool = getPool();
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}
