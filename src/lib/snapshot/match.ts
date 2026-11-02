// src/lib/snapshot/match.ts
//
// Deterministic scoring of one answer: is the brand mentioned, is its domain
// cited. No model call, so the two rates the page leads with cannot drift
// with a model's mood, and fixtures can pin them.
//
// MENTIONED = the brand (fuzzy) or the domain appears in the answer text.
// Fuzzy means case, accents, punctuation and spacing are ignored ("Echo Rank",
// "echo-rank" and "ECHORANK" all match "Echorank"), a legal suffix is optional
// ("Acme Ltd" matches "Acme"), and a brand of 6+ letters survives one typo.
// Short brands get no typo allowance: "Ace" one edit away is half the dictionary.
//
// CITED = the domain, or a subdomain of it, is among the answer's sources.

const LEGAL_SUFFIXES = new Set([
  "inc", "llc", "ltd", "limited", "co", "corp", "company", "gmbh", "ag", "sa", "sas", "sarl", "srl", "bv", "plc", "pty", "oy", "ab",
]);

export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "https://www.Example.co.uk/x" → "example.co.uk". Null when it is not a host. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#]/)[0].split("@").pop()!.split(":")[0];
  s = s.replace(/^www\d?\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  if (s.split(".").some((l) => !l || l.startsWith("-") || l.endsWith("-"))) return null;
  return s;
}

/** True when `host` is `domain` or a subdomain of it. */
export function sameSite(host: string, domain: string): boolean {
  const h = normalizeDomain(host);
  const d = normalizeDomain(domain);
  return !!h && !!d && (h === d || h.endsWith(`.${d}`));
}

function levenshteinAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** The brand's matchable forms, folded: full name, without legal suffix, the domain's first label. */
export function brandVariants(brand: string, domain?: string): string[] {
  const words = fold(brand).split(" ").filter(Boolean);
  const out = new Set<string>();
  if (words.length) out.add(words.join(" "));
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
  if (words.length) out.add(words.join(" "));
  const label = domain ? normalizeDomain(domain)?.split(".")[0] : undefined;
  if (label && label.length >= 4) out.add(fold(label));
  return [...out].filter((v) => v.replace(/ /g, "").length >= 2);
}

/**
 * Character offset of the first mention of any variant in `text`, or -1.
 * Compares on the folded, space-less form so "Echo Rank" finds "echorank".
 */
export function findBrand(text: string, brand: string, domain?: string): number {
  if (domain) {
    const d = normalizeDomain(domain);
    if (d) {
      const at = text.toLowerCase().indexOf(d);
      if (at >= 0) return at;
    }
  }
  // Tokenise the answer, keeping each token's offset in the original.
  const tokens: { t: string; at: number }[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  for (let m; (m = re.exec(text)); ) tokens.push({ t: fold(m[0]).replace(/ /g, ""), at: m.index });
  let best = -1;
  for (const v of brandVariants(brand, domain)) {
    const target = v.replace(/ /g, "");
    const n = v.split(" ").length;
    const typos = target.length >= 12 ? 2 : target.length >= 6 ? 1 : 0;
    // Windows of n-1..n+1 tokens: "Echo Rank" is two tokens for a one-word brand.
    for (let i = 0; i < tokens.length; i++) {
      for (let w = Math.max(1, n - 1); w <= n + 1 && i + w <= tokens.length; w++) {
        const joined = tokens.slice(i, i + w).map((x) => x.t).join("");
        const hit = typos ? levenshteinAtMost(joined, target, typos) : joined === target;
        if (hit) {
          if (best < 0 || tokens[i].at < best) best = tokens[i].at;
          break;
        }
      }
      if (best >= 0 && tokens[i].at >= best) break;
    }
  }
  return best;
}

export function isMentioned(text: string, brand: string, domain: string): boolean {
  return findBrand(text, brand, domain) >= 0;
}

/** Distinct registrable-ish domains of the source URLs, in first-seen order. */
export function domainsOf(urls: string[]): string[] {
  const out: string[] = [];
  for (const u of urls) {
    const d = normalizeDomain(u);
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

export function isCited(sourceDomains: string[], domain: string): boolean {
  return sourceDomains.some((s) => sameSite(s, domain));
}

export const EXCERPT_CHARS = 300;

/** The opening of the answer, whitespace collapsed. */
export function openingExcerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS).trimEnd()}…` : flat;
}
