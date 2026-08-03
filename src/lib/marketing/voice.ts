// Category 08 — brand voice extraction. ZERO API calls, by design.
//
// Everything a style guide needs from a writing sample is countable: sentence
// lengths, word and bigram frequency, punctuation habits, how paragraphs open
// and close. Sending the samples to a model to be told their average sentence
// is 14 words would cost money to compute something arithmetic already knows —
// and it would ship the tenant's unpublished writing to a third party.
//
// The samples never leave this process.

/** Stopwords excluded from frequency counts. Deliberately small — this is a
 *  voice fingerprint, so distinctive verbs and nouns must survive. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "did", "do", "does",
  "for", "from", "had", "has", "have", "he", "her", "his", "i", "if", "in", "is", "it", "its",
  "me", "my", "no", "not", "of", "on", "or", "our", "out", "she", "so", "than", "that", "the",
  "their", "them", "then", "there", "these", "they", "this", "to", "up", "was", "we", "were",
  "what", "when", "which", "who", "will", "with", "would", "you", "your",
]);

/** Common words whose ABSENCE is itself a voice signal. */
const COMMON_WORDS = [
  "very", "really", "just", "actually", "basically", "literally", "simply", "obviously",
  "amazing", "incredible", "awesome", "great", "stuff", "things", "utilize", "leverage",
  "synergy", "robust", "seamless", "innovative", "cutting-edge", "world-class",
];

export interface VoiceStats {
  sentenceCount: number;
  wordCount: number;
  paragraphCount: number;
  meanSentenceLength: number;
  medianSentenceLength: number;
  /** Population variance of sentence length — rhythm, not just pace. */
  sentenceLengthVariance: number;
  shortestSentence: number;
  longestSentence: number;
  meanParagraphSentences: number;
  topWords: Array<{ word: string; count: number }>;
  topBigrams: Array<{ phrase: string; count: number }>;
  /** Common words this writer never uses. */
  absentCommonWords: string[];
  /** Per 100 sentences, so samples of different sizes stay comparable. */
  punctuation: {
    exclamationPer100: number;
    questionPer100: number;
    emDashPer100: number;
    semicolonPer100: number;
    colonPer100: number;
  };
  openingPatterns: string[];
  closingPatterns: string[];
}

/** Split on sentence-ending punctuation. Good enough for prose samples; the
 *  guide is descriptive, so an abbreviation counted as a break costs nothing. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter(Boolean);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** First three words of a sentence — how this writer opens and closes. */
function leadingWords(sentence: string, n = 3): string {
  return tokenizeWords(sentence).slice(0, n).join(" ");
}

function topN<T extends string>(counts: Map<T, number>, n: number): Array<[T, number]> {
  return [...counts.entries()]
    // Count first, then alphabetical — ties must not depend on Map insertion
    // order, or the same samples produce a different guide each run.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

export function analyzeVoice(samples: string): VoiceStats {
  const text = samples.replace(/\r\n/g, "\n").trim();
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sentences = splitSentences(text);
  const words = tokenizeWords(text);

  const lengths = sentences.map((s) => tokenizeWords(s).length).filter((n) => n > 0);
  const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const variance = lengths.length
    ? lengths.reduce((acc, n) => acc + (n - mean) ** 2, 0) / lengths.length
    : 0;

  const wordCounts = new Map<string, number>();
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }

  // Bigrams are computed over the FULL token stream including stopwords, then
  // filtered: "get it done" is a voice marker, and dropping stopwords first
  // would silently fuse non-adjacent words into phrases nobody wrote.
  const bigramCounts = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const [a, b] = [words[i], words[i + 1]];
    if (STOPWORDS.has(a) && STOPWORDS.has(b)) continue;
    bigramCounts.set(`${a} ${b}`, (bigramCounts.get(`${a} ${b}`) ?? 0) + 1);
  }

  const present = new Set(words);
  const per100 = (n: number) => (sentences.length ? round((n / sentences.length) * 100, 1) : 0);
  const count = (re: RegExp) => (text.match(re) ?? []).length;

  return {
    sentenceCount: sentences.length,
    wordCount: words.length,
    paragraphCount: paragraphs.length,
    meanSentenceLength: round(mean),
    medianSentenceLength: round(median(lengths)),
    sentenceLengthVariance: round(variance),
    shortestSentence: lengths.length ? Math.min(...lengths) : 0,
    longestSentence: lengths.length ? Math.max(...lengths) : 0,
    meanParagraphSentences: paragraphs.length
      ? round(sentences.length / paragraphs.length)
      : 0,
    topWords: topN(wordCounts, 15).map(([word, c]) => ({ word, count: c })),
    topBigrams: topN(bigramCounts, 10)
      .filter(([, c]) => c > 1)
      .map(([phrase, c]) => ({ phrase, count: c })),
    absentCommonWords: COMMON_WORDS.filter((w) => !present.has(w)),
    punctuation: {
      exclamationPer100: per100(count(/!/g)),
      questionPer100: per100(count(/\?/g)),
      emDashPer100: per100(count(/—|--/g)),
      semicolonPer100: per100(count(/;/g)),
      colonPer100: per100(count(/:/g)),
    },
    openingPatterns: paragraphs
      .map((p) => leadingWords(splitSentences(p)[0] ?? ""))
      .filter(Boolean)
      .slice(0, 8),
    closingPatterns: paragraphs
      .map((p) => {
        const s = splitSentences(p);
        return leadingWords(s[s.length - 1] ?? "");
      })
      .filter(Boolean)
      .slice(0, 8),
  };
}

/** Render the stats as the reusable guide shown in the output panel and saved
 *  to Tenant.brandVoiceGuide. Plain text: it is prepended to a system prompt. */
export function renderVoiceGuide(stats: VoiceStats): string {
  const p = stats.punctuation;
  const lines: string[] = [
    "BRAND VOICE GUIDE",
    "",
    "Rhythm",
    `- Sentences average ${stats.meanSentenceLength} words (median ${stats.medianSentenceLength}).`,
    `- Range ${stats.shortestSentence}-${stats.longestSentence} words; variance ${stats.sentenceLengthVariance}.`,
    stats.sentenceLengthVariance > 40
      ? "- Length varies sharply. Mix short punches with long sentences; do not even them out."
      : "- Length is consistent. Keep sentences close to the average rather than alternating extremes.",
    `- Paragraphs run about ${stats.meanParagraphSentences} sentences.`,
    "",
    "Vocabulary",
    `- Recurring words: ${stats.topWords.map((w) => w.word).slice(0, 10).join(", ") || "(none)"}.`,
  ];

  if (stats.topBigrams.length) {
    lines.push(`- Recurring phrases: ${stats.topBigrams.map((b) => b.phrase).join(", ")}.`);
  }
  if (stats.absentCommonWords.length) {
    lines.push(`- Never uses: ${stats.absentCommonWords.join(", ")}. Do not introduce them.`);
  }

  lines.push(
    "",
    "Punctuation (per 100 sentences)",
    `- Exclamation ${p.exclamationPer100} · question ${p.questionPer100} · em-dash ${p.emDashPer100} · semicolon ${p.semicolonPer100} · colon ${p.colonPer100}.`,
    p.exclamationPer100 < 5
      ? "- Exclamation marks are rare. Avoid them."
      : "- Exclamation marks are used. Keep them sparing rather than stacked.",
    "",
    "Openings and closings",
    `- Paragraphs tend to open: ${stats.openingPatterns.slice(0, 4).join(" / ") || "(no pattern)"}.`,
    `- And to close: ${stats.closingPatterns.slice(0, 4).join(" / ") || "(no pattern)"}.`,
    "",
    `Based on ${stats.wordCount} words across ${stats.sentenceCount} sentences.`,
  );

  return lines.join("\n");
}
