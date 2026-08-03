// src/lib/historical/diff.ts
//
// Word-level diff between two snapshots. Pure TypeScript, no dependency.
//
// WHY NOT A LIBRARY. The job is one LCS over token arrays — the algorithm below
// is about sixty lines and has no edge cases a library would handle better at
// this size. Adding a dependency to a box that serves production from the
// working tree costs more than it saves here. If snapshots ever need character-
// level or semantic diffing, that calculus changes.
//
// WHY WORDS AND NOT LINES. Markdown reflows: a one-word edit inside a paragraph
// rewrites the whole line, so a line diff reports the entire paragraph as
// removed and re-added. That is technically true and useless — the reader wants
// the word that changed.

export type DiffOp = "equal" | "added" | "removed";

export interface DiffToken {
  op: DiffOp;
  text: string;
}

export interface WordDiff {
  tokens: DiffToken[];
  addedWords: number;
  removedWords: number;
  unchangedWords: number;
  /** True when the LCS was skipped because the inputs were too large. */
  truncated: boolean;
}

/**
 * Split into words and the whitespace between them, keeping both, so the
 * rendered diff preserves the original spacing and line breaks.
 */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

const isWord = (token: string) => !/^\s+$/.test(token);

/**
 * Quadratic in the token count, so it is bounded. 6000 tokens a side is roughly
 * a 40 KB page and costs ~36M cells — fine. Beyond that the UI falls back to a
 * whole-document replace rather than locking a request for a minute.
 */
const MAX_TOKENS = 6000;

/**
 * Longest common subsequence over tokens, then walk it back into ops.
 *
 * The table is Uint32Array rather than nested arrays: at 6000x6000 the nested
 * version allocates 6000 JS arrays and measurably drags.
 */
function lcsOps(a: string[], b: string[]): DiffToken[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "equal", text: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      out.push({ op: "removed", text: a[i] });
      i++;
    } else {
      out.push({ op: "added", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "removed", text: a[i++] });
  while (j < m) out.push({ op: "added", text: b[j++] });

  return out;
}

/** Merge runs of the same op so the UI renders spans, not one node per word. */
function coalesce(tokens: DiffToken[]): DiffToken[] {
  const out: DiffToken[] = [];
  for (const token of tokens) {
    const last = out[out.length - 1];
    if (last && last.op === token.op) last.text += token.text;
    else out.push({ ...token });
  }
  return out;
}

export function wordDiff(before: string, after: string): WordDiff {
  const a = tokenize(before);
  const b = tokenize(after);

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    const removedWords = a.filter(isWord).length;
    const addedWords = b.filter(isWord).length;
    return {
      tokens: coalesce([
        ...(before ? [{ op: "removed" as const, text: before }] : []),
        ...(after ? [{ op: "added" as const, text: after }] : []),
      ]),
      addedWords,
      removedWords,
      unchangedWords: 0,
      truncated: true,
    };
  }

  const ops = lcsOps(a, b);

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const token of ops) {
    if (!isWord(token.text)) continue;
    if (token.op === "added") added++;
    else if (token.op === "removed") removed++;
    else unchanged++;
  }

  return {
    tokens: coalesce(ops),
    addedWords: added,
    removedWords: removed,
    unchangedWords: unchanged,
    truncated: false,
  };
}
