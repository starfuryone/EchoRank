// tests/migrations-baseline.test.ts
//
// `prisma migrate deploy` must work on an EMPTY database — that is how this
// box is rebuilt from git, and how a test database is made (gotchas.md).
//
// 0_init is the baseline: the whole database as it stood on 2026-08-14, after
// 20260811210000_subscription_product_kind, including forty tables that were
// db push'd and never in any migration. It sorts first, so every migration
// dated before that cut re-created something 0_init had already made, and the
// replay died on the first one ("extension_tokens" already exists). Those 37
// directories were removed on 2026-11-03; production keeps their
// _prisma_migrations rows, which deploy and status ignore.
//
// Static checks only — the real replay needs a superuser for createdb. Run it
// by hand on a throwaway database:
//   DATABASE_URL=<empty db> npx prisma migrate deploy && npx prisma migrate status

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "prisma/migrations");
const BASELINE = "0_init";
/** The first migration NOT contained in 0_init. */
const FIRST_AFTER_BASELINE = "20260813210000_notifications";

const migrations = readdirSync(DIR)
  .filter((f) => statSync(join(DIR, f)).isDirectory())
  .sort();

describe("migration history replays from empty", () => {
  it("the baseline applies first", () => {
    expect(migrations[0]).toBe(BASELINE);
  });

  it("nothing but the baseline sorts before the first post-baseline migration", () => {
    // A directory here would run AFTER 0_init and re-create what it holds.
    // A new migration needs a timestamp later than every existing one.
    expect(migrations.filter((m) => m !== BASELINE && m < FIRST_AFTER_BASELINE)).toEqual([]);
    expect(migrations).toContain(FIRST_AFTER_BASELINE);
  });

  it("every other directory is timestamp-named, so lexical order is date order", () => {
    for (const m of migrations.filter((x) => x !== BASELINE)) expect(m).toMatch(/^\d{8,14}_[a-z0-9_]+$/);
  });
});
