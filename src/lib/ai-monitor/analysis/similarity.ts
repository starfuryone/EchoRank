// src/lib/ai-monitor/analysis/similarity.ts
//
// Fuzzy name matching, used in EXACTLY ONE PLACE: deciding whether an entity
// the extraction pass named is the monitored brand or a competitor.
//
// NOT USED ON THE ANSWER TEXT. The prose scan in ./deterministic.ts stays exact
// whole-word matching after accent folding, and that is deliberate — its
// lookarounds are what stop a brand called "Ada" matching every answer that
// says "Canada". Loosening the prose scan to a similarity threshold reintroduces
// exactly that false positive, and it is the expensive kind: a phantom mention
// raises mention rate and visibility score together, so the bug looks like
// success. Here the input is a short, deliberate label the model produced ("the
// third thing I recommended was Echorank 360"), not a haystack, so the failure
// mode is different and the tolerance is worth having.
//
// SØRENSEN–DICE OVER CHARACTER BIGRAMS OF THE COMPACTED NAME, not over tokens.
// Token-set similarity is the obvious reading of "token-level", and it scores
// the motivating case at zero: {"echorank","360"} against {"echorank360"} share
// no token at all. Compacting to "echorank360" on both sides and comparing
// character bigrams gives 1.0, which is the answer a human would give.

/** A pair is a match at or above this. */
export const NAME_MATCH_THRESHOLD = 0.9;

/**
 * Lowercase, strip diacritics, reduce anything that is not a letter or digit to
 * a single space.
 *
 * "Écho-Rank 360®" -> "echo rank 360".
 */
export function normalizeName(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** The normalized name with its separators removed: "echorank360". */
export function compactName(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value.length === 1 ? [value] : [];
  const out: string[] = [];
  for (let i = 0; i < value.length - 1; i++) out.push(value.slice(i, i + 2));
  return out;
}

/**
 * 0-1 similarity between two names.
 *
 * Multiset intersection, so "aaa" and "aab" do not score as identical the way a
 * Set-based Dice would: repeated bigrams are common in brand names ("Bookoo",
 * "Zappa") and collapsing them loses the difference.
 */
export function nameSimilarity(a: string, b: string): number {
  const left = compactName(a);
  const right = compactName(b);
  if (left === "" || right === "") return 0;
  if (left === right) return 1;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  if (leftGrams.length === 0 || rightGrams.length === 0) return 0;

  const pool = new Map<string, number>();
  for (const gram of leftGrams) pool.set(gram, (pool.get(gram) ?? 0) + 1);

  let shared = 0;
  for (const gram of rightGrams) {
    const remaining = pool.get(gram) ?? 0;
    if (remaining > 0) {
      shared += 1;
      pool.set(gram, remaining - 1);
    }
  }

  return (2 * shared) / (leftGrams.length + rightGrams.length);
}

/** The closest alias to `name`, and how close it was. */
export function bestAliasMatch(
  name: string,
  aliases: readonly string[],
): { alias: string | null; similarity: number } {
  let best: { alias: string | null; similarity: number } = { alias: null, similarity: 0 };
  for (const alias of aliases) {
    if (!alias || alias.trim() === "") continue;
    const similarity = nameSimilarity(name, alias);
    if (similarity > best.similarity) best = { alias, similarity };
  }
  return best;
}

/** Whether `name` is one of `aliases`, at or above the threshold. */
export function matchesAlias(
  name: string,
  aliases: readonly string[],
  threshold: number = NAME_MATCH_THRESHOLD,
): boolean {
  return bestAliasMatch(name, aliases).similarity >= threshold;
}
