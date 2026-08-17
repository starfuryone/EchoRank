// tests/assistant-pro-schema.test.ts
//
// The migration and the Prisma models, checked against each other.
//
// ── WHY THIS IS MOSTLY A FILE TEST ─────────────────────────────────────────
// This repo has exactly one configured DATABASE_URL and it points at the
// database this box serves production from — which is why every other suite
// mocks @/lib/prisma, and why the one DB-backed suite
// (ai-search-roundtrip.db.test.ts) refuses to run without an explicitly
// supplied TEST_DATABASE_URL. The same rule applies here.
//
// So the default checks are static, and they catch the failures that actually
// happen with hand-written migrations in this repo:
//
//   - the migration names the MODEL instead of the @@map name, so it creates
//     "AssistantConversation" and Prisma queries "assistant_conversations";
//   - the filename sorts BEFORE a table it references, so a fresh replay dies
//     on a missing foreign key;
//   - a column exists in the model and not in the SQL (or the reverse), which
//     surfaces at run time as "column does not exist" on the first write;
//   - a statement is unguarded, so a half-applied run cannot be re-applied.
//
// The DB-backed block at the bottom runs ONLY with TEST_DATABASE_URL set, and
// asserts the objects really landed:
//
//   createdb echorank_test
//   DATABASE_URL=<test url> npx prisma migrate deploy
//   TEST_DATABASE_URL=<test url> npx vitest run tests/assistant-pro-schema.test.ts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "prisma", "migrations");
const NAME = "20260816120000_assistant_pro";

const sql = readFileSync(join(MIGRATIONS, NAME, "migration.sql"), "utf8");
const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");

/** The body of one model block in schema.prisma. */
function modelBlock(model: string): string {
  const start = schema.indexOf(`model ${model} {`);
  expect(start, `model ${model} not found`).toBeGreaterThan(-1);
  return schema.slice(start, schema.indexOf("\n}", start));
}

// ─── Ordering ───────────────────────────────────────────────────────────────

describe("the migration applies in the right place", () => {
  it("sorts after every migration it depends on", () => {
    const all = readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    // Filenames are hand-written here and apply in lexical order, so a
    // migration can easily sort before the one that creates a table it
    // references. This one references only "tenants" (0_init).
    //
    // ASSERTS THE DEPENDENCY, NOT "IS NEWEST". It used to require this
    // migration to be the last directory in the tree, which made every
    // subsequent additive migration fail a test about assistant_pro's
    // ordering — the first one to do so was
    // 20260817060000_keyword_opportunity_finder, which references nothing
    // this migration creates. The name of this test is the contract; being
    // last was only ever a proxy for it, and a proxy that expires the next
    // time anybody ships.
    expect(all).toContain(NAME);
    const dependencies = all.filter((entry) => entry.startsWith("0_init"));
    for (const dependency of dependencies) {
      expect(NAME > dependency, `${NAME} must sort after ${dependency}`).toBe(true);
    }
  });

  it("references only tables that already exist at that point", () => {
    // The FKs point at "tenants" (0_init) and at the table this migration
    // creates itself. Nothing else.
    const references = [...sql.matchAll(/REFERENCES\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(references)).toEqual(new Set(["tenants", "assistant_conversations"]));
  });
});

// ─── Table and column names ─────────────────────────────────────────────────

describe("the SQL uses @@map names, not model names", () => {
  it("creates the mapped tables", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "assistant_conversations"/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "assistant_messages"/);
  });

  it("never creates a PascalCase table", () => {
    // The mistake this catches: `CREATE TABLE "AssistantConversation"`, which
    // applies cleanly and then makes every Prisma query fail at run time.
    expect(sql).not.toContain('"AssistantConversation"');
    expect(sql).not.toContain('"AssistantMessage"');
  });

  it("declares the @@map on both models", () => {
    expect(modelBlock("AssistantConversation")).toContain('@@map("assistant_conversations")');
    expect(modelBlock("AssistantMessage")).toContain('@@map("assistant_messages")');
  });
});

describe("the columns match the models exactly", () => {
  /** Column names inside one CREATE TABLE block. */
  function sqlColumns(table: string): string[] {
    const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS "${table}"`);
    const body = sql.slice(start, sql.indexOf(");", start));
    return [...body.matchAll(/^\s{4}"([A-Za-z]+)"\s/gm)].map((m) => m[1]);
  }

  /** Scalar field names in one Prisma model (relations and attributes skipped). */
  function modelFields(model: string): string[] {
    return modelBlock(model)
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("@@") && !line.startsWith("//") && !line.startsWith("///"))
      .map((line) => line.split(/\s+/))
      .filter(([, type]) => type && !/^(Tenant|AssistantConversation|AssistantMessage)/.test(type))
      .map(([name]) => name);
  }

  it("has the same columns as AssistantConversation", () => {
    expect(sqlColumns("assistant_conversations").sort()).toEqual(
      modelFields("AssistantConversation").sort(),
    );
  });

  it("has the same columns as AssistantMessage", () => {
    expect(sqlColumns("assistant_messages").sort()).toEqual(
      modelFields("AssistantMessage").sort(),
    );
  });

  it("stores the tool summary as JSONB and the bodies as TEXT", () => {
    expect(sql).toMatch(/"toolSummary"\s+JSONB/);
    expect(sql).toMatch(/"content"\s+TEXT NOT NULL/);
    expect(sql).toMatch(/"title"\s+TEXT NOT NULL/);
  });

  it("defaults the token counters to zero rather than leaving them null", () => {
    // A null token count reads as "unknown" and breaks any SUM over the table;
    // an old row that predates a counter should read as zero.
    expect(sql).toMatch(/"inputTokens"\s+INTEGER NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/"outputTokens"\s+INTEGER NOT NULL DEFAULT 0/);
  });
});

// ─── Indexes and keys ───────────────────────────────────────────────────────

describe("indexes and foreign keys", () => {
  it("indexes the history list's only ordering", () => {
    // (tenantId, updatedAt DESC) — leading on tenantId is what makes the tenant
    // scope an index seek rather than a filter over everybody's rows.
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "assistant_conversations_tenantId_updatedAt_idx"[\s\S]*?\("tenantId", "updatedAt" DESC\)/,
    );
    expect(modelBlock("AssistantConversation")).toMatch(
      /@@index\(\[tenantId, updatedAt\(sort: Desc\)\]\)/,
    );
  });

  it("indexes transcript replay", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "assistant_messages_conversationId_createdAt_idx"/,
    );
    expect(modelBlock("AssistantMessage")).toMatch(/@@index\(\[conversationId, createdAt\]\)/);
  });

  it("cascades both foreign keys, so a delete leaves nothing behind", () => {
    for (const constraint of [
      "assistant_conversations_tenantId_fkey",
      "assistant_messages_conversationId_fkey",
    ]) {
      const block = sql.slice(sql.indexOf(`ADD CONSTRAINT "${constraint}"`));
      expect(block.slice(0, 300), constraint).toContain("ON DELETE CASCADE");
    }
    expect(modelBlock("AssistantMessage")).toContain("onDelete: Cascade");
  });

  it("names the constraints exactly as Prisma would, so migrate diff sees no drift", () => {
    expect(sql).toContain('CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")');
    expect(sql).toContain('CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")');
  });

  it("does not make userId a foreign key", () => {
    // Deliberate: the history belongs to the TENANT. A hard FK to users would
    // cascade-delete a tenant's conversations when a seat is removed.
    const block = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS "assistant_conversations"'));
    expect(block).not.toMatch(/REFERENCES\s+"users"/);
  });
});

// ─── Re-applicability ───────────────────────────────────────────────────────

describe("a half-applied run can be re-applied", () => {
  it("guards every CREATE", () => {
    const creates = [...sql.matchAll(/^CREATE (TABLE|INDEX)([^\n]*)/gm)].map((m) => m[0]);
    expect(creates.length).toBeGreaterThan(0);
    for (const statement of creates) {
      expect(statement, statement).toContain("IF NOT EXISTS");
    }
  });

  it("guards every ADD CONSTRAINT with a catalog check", () => {
    // Postgres has no IF NOT EXISTS for ADD CONSTRAINT, so each one sits in a
    // DO block that checks pg_constraint first.
    //
    // Counted on the STATEMENTS, with `--` comments stripped: this migration's
    // own prose explains why the guards exist, and counting the prose would
    // make the test fail on its documentation.
    const statements = sql.replace(/^\s*--.*$/gm, "");
    const additions = (statements.match(/ADD CONSTRAINT/g) ?? []).length;
    const guards = (statements.match(/SELECT 1 FROM pg_constraint WHERE conname =/g) ?? [])
      .length;
    // Two FKs; the two PKs ride inside their CREATE TABLE and need no guard.
    expect(additions).toBe(2);
    expect(guards).toBe(additions);
  });

  it("drops, renames and retypes nothing", () => {
    // Additive-only is what lets `migrate deploy` run without a window.
    expect(sql).not.toMatch(/\bDROP\b/);
    expect(sql).not.toMatch(/\bRENAME\b/);
    expect(sql).not.toMatch(/ALTER COLUMN/);
  });
});

// ─── The account export ─────────────────────────────────────────────────────

describe("the tenant relation is declared", () => {
  it("hangs conversations off Tenant, so a tenant delete cascades", () => {
    const tenant = modelBlock("Tenant");
    expect(tenant).toContain("assistantConversations AssistantConversation[]");
  });
});

// ─── DB-backed, opt-in ──────────────────────────────────────────────────────
//
// Skipped unless TEST_DATABASE_URL names a database that is NOT production.
// See the header for why that is not a convenience.

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("against a real database", () => {
  it("has both tables, both indexes and both foreign keys", async () => {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: TEST_DB });
    await client.connect();
    try {
      const tables = await client.query(
        `SELECT tablename FROM pg_tables WHERE tablename = ANY($1)`,
        [["assistant_conversations", "assistant_messages"]],
      );
      expect(tables.rows.map((r) => r.tablename).sort()).toEqual([
        "assistant_conversations",
        "assistant_messages",
      ]);

      const indexes = await client.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1)`,
        [
          [
            "assistant_conversations_tenantId_updatedAt_idx",
            "assistant_messages_conversationId_createdAt_idx",
          ],
        ],
      );
      expect(indexes.rows).toHaveLength(2);

      const constraints = await client.query(
        `SELECT conname FROM pg_constraint WHERE conname = ANY($1)`,
        [
          [
            "assistant_conversations_tenantId_fkey",
            "assistant_messages_conversationId_fkey",
          ],
        ],
      );
      expect(constraints.rows).toHaveLength(2);
    } finally {
      await client.end();
    }
  });
});
