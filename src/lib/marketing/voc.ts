// Category 12 — voice of customer. Heuristic phrase extraction over pasted
// feedback; the corpus never leaves this process.
//
// The optional AI step receives the top 5 phrases and nothing else. That is the
// whole point of splitting it: reviews and support tickets are the most
// personal data a tenant holds, and n-gram counting does not need a model.

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "for", "from", "had", "has",
  "have", "i", "if", "in", "is", "it", "its", "me", "my", "of", "on", "or", "so", "than",
  "that", "the", "their", "them", "then", "there", "they", "this", "to", "was", "we", "were",
  "what", "when", "which", "who", "will", "with", "you", "your",
]);

/**
 * Objection buckets. Matching is on whole words against a keyword list rather
 * than substrings — "expensive" must not be found inside an unrelated word, and
 * "cost" must not match "costume".
 */
export const OBJECTION_BUCKETS = {
  price: ["price", "priced", "pricing", "expensive", "cost", "costs", "costly", "cheap", "afford", "affordable", "budget", "overpriced", "value", "money", "refund"],
  trust: ["trust", "scam", "legit", "reliable", "unreliable", "honest", "safe", "secure", "privacy", "reviews", "reputation", "sketchy"],
  time: ["slow", "delay", "delayed", "wait", "waiting", "late", "quick", "fast", "hours", "days", "weeks", "forever", "instantly"],
  complexity: ["confusing", "complicated", "complex", "difficult", "hard", "simple", "easy", "intuitive", "clunky", "learn", "setup", "onboarding"],
  support: ["support", "help", "helpful", "service", "response", "responded", "agent", "ticket", "chat", "email", "unresponsive", "ignored"],
} as const;

export type ObjectionBucket = keyof typeof OBJECTION_BUCKETS;

export interface PhraseCount {
  phrase: string;
  count: number;
  /** How many separate feedback entries it appears in. */
  documents: number;
}

export interface VocAnalysis {
  entryCount: number;
  wordCount: number;
  topPhrases: PhraseCount[];
  buckets: Array<{ bucket: ObjectionBucket; hits: number; share: number; matched: string[] }>;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter(Boolean);
}

/** One entry per line or blank-line-separated block — reviews, tickets, rows. */
export function splitEntries(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  // A single block of many lines is far more common (a pasted export), so fall
  // back to per-line splitting rather than treating it as one entry.
  if (blocks.length > 1) return blocks;
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * n-gram frequency across entries, n = 2..4.
 *
 * Document frequency is tracked alongside raw count because one furious
 * reviewer repeating a phrase eight times is not the same signal as eight
 * customers each saying it once — and only the second is worth putting in an ad.
 */
export function extractPhrases(entries: string[], limit = 10): PhraseCount[] {
  const counts = new Map<string, number>();
  const docs = new Map<string, Set<number>>();

  entries.forEach((entry, idx) => {
    const words = tokenize(entry);
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        // Drop grams that are entirely stopwords ("of the one") — they are the
        // most frequent strings in any corpus and say nothing.
        if (gram.every((w) => STOPWORDS.has(w))) continue;
        const phrase = gram.join(" ");
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
        if (!docs.has(phrase)) docs.set(phrase, new Set());
        docs.get(phrase)!.add(idx);
      }
    }
  });

  return [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count, documents: docs.get(phrase)?.size ?? 0 }))
    .filter((p) => p.documents > 1 || p.count > 2)
    // Document spread first: breadth beats one loud voice.
    .sort((a, b) => b.documents - a.documents || b.count - a.count || a.phrase.localeCompare(b.phrase))
    .slice(0, limit);
}

export function bucketObjections(entries: string[]): VocAnalysis["buckets"] {
  const words = entries.flatMap(tokenize);
  const present = new Map<string, number>();
  for (const w of words) present.set(w, (present.get(w) ?? 0) + 1);

  const rows = (Object.keys(OBJECTION_BUCKETS) as ObjectionBucket[]).map((bucket) => {
    const matched: string[] = [];
    let hits = 0;
    for (const kw of OBJECTION_BUCKETS[bucket]) {
      const n = present.get(kw) ?? 0;
      if (n > 0) {
        hits += n;
        matched.push(kw);
      }
    }
    return { bucket, hits, share: 0, matched };
  });

  const total = rows.reduce((a, r) => a + r.hits, 0);
  return rows
    .map((r) => ({ ...r, share: total ? Math.round((r.hits / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.hits - a.hits || a.bucket.localeCompare(b.bucket));
}

export function analyzeVoc(raw: string, limit = 10): VocAnalysis {
  const entries = splitEntries(raw);
  return {
    entryCount: entries.length,
    wordCount: entries.flatMap(tokenize).length,
    topPhrases: extractPhrases(entries, limit),
    buckets: bucketObjections(entries),
  };
}

/**
 * The ONLY thing the optional AI step is allowed to see: the top 5 phrases.
 * Not the entries, not the counts of anything else, not the buckets.
 */
export function topPhrasesForAi(analysis: VocAnalysis, n = 5): string[] {
  return analysis.topPhrases.slice(0, n).map((p) => p.phrase);
}
