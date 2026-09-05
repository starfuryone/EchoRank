// src/lib/agent-skills/frontmatter.ts
//
// A deliberately small YAML-frontmatter reader for SKILL.md files.
//
// ── WHY NOT A YAML LIBRARY ─────────────────────────────────────────────────
// The app takes no new npm dependencies, and the grammar this has to handle is
// three lines of `key: value` between two `---` fences. A YAML parser would be
// several hundred kilobytes to read two strings, and would additionally accept
// a great deal of YAML that a SKILL.md must not contain — anchors, merge keys,
// multi-document streams. Refusing to parse those is a feature here.
//
// ── WHAT IT ACCEPTS ────────────────────────────────────────────────────────
// A `---` fence on the first line, `key: value` pairs until the closing `---`,
// and nothing else. Values may be bare, single-quoted or double-quoted; a
// quoted value may contain a colon, which is why the quotes are handled at all
// (every description in the pack has one). Blank lines and `#` comments inside
// the block are skipped. Anything more elaborate is a file the author should
// simplify rather than a parser this should grow.
//
// PURE — no fs, no zod, no server imports. That is what lets the parser be
// tested against literals, and the loader be tested against the filesystem,
// separately.

export interface Frontmatter {
  data: Record<string, string>;
  /** Everything after the closing fence, with leading blank lines trimmed. */
  body: string;
}

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontmatterError";
  }
}

const FENCE = "---";

/** Strip one layer of matching quotes, if present. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function parseFrontmatter(source: string): Frontmatter {
  // A BOM ahead of the fence is invisible in an editor and would otherwise
  // make the first line fail to match, producing "must start with ---" for a
  // file that plainly does.
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  if (lines[0]?.trim() !== FENCE) {
    throw new FrontmatterError("File must start with a `---` frontmatter fence.");
  }

  const data: Record<string, string> = {};
  let closed = -1;

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === FENCE) {
      closed = i;
      break;
    }
    if (line === "" || line.startsWith("#")) continue;

    const colon = line.indexOf(":");
    if (colon <= 0) {
      throw new FrontmatterError(`Frontmatter line ${i + 1} is not \`key: value\`: ${line}`);
    }
    const key = line.slice(0, colon).trim();
    const value = unquote(line.slice(colon + 1).trim());
    if (key in data) {
      throw new FrontmatterError(`Duplicate frontmatter key: ${key}`);
    }
    data[key] = value;
  }

  if (closed === -1) {
    throw new FrontmatterError("Frontmatter is not closed by a second `---`.");
  }

  return { data, body: lines.slice(closed + 1).join("\n").replace(/^\n+/, "") };
}
