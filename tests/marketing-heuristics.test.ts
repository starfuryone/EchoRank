// The four heuristics, against fixture inputs — plus the assertion that none of
// them reaches api.anthropic.com.
//
// That last one is the load-bearing test in this file. The cost doctrine and
// the privacy claim both rest on "the pasted corpus never leaves this process",
// and the only way that stays true is if something fails loudly when it stops
// being true.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { analyzeVoice, renderVoiceGuide, splitSentences } from "@/lib/marketing/voice";
import { analyzeVoc, extractPhrases, splitEntries, topPhrasesForAi } from "@/lib/marketing/voc";
import { parseAnalytics, parseNumber, summaryForAi } from "@/lib/marketing/analytics";
import { buildCalendar, longestPillarRun, mergeHooks, scheduleForAi } from "@/lib/marketing/calendar";

// ── Fixtures ────────────────────────────────────────────────────────────────

const VOICE_SAMPLE = [
  "We ship fast. No committees, no six-week sign-off.",
  "The work speaks first; the deck comes later — if at all.",
  "",
  "Our clients stay because the numbers move. That is the whole pitch.",
  "We do not chase logos. We chase results, and we measure them weekly.",
].join("\n");

const FEEDBACK = [
  "The setup process was confusing and took forever to figure out.",
  "Support never responded to my ticket. Waited three days.",
  "Way too expensive for what you get. The price is hard to justify.",
  "The setup process was confusing, honestly. Took me an hour.",
  "Love the product but the price is hard to justify for a small team.",
  "Support never responded. I had to chase them twice.",
].join("\n");

const CSV = [
  "metric,this_month,last_month",
  "Sessions,\"12,400\",10000",
  "Signups,320,400",
  "Revenue,$18.5k,$12k",
  "Churn,2.1%,2.0%",
  "New channel,150,0",
].join("\n");

// ── Brand voice (08) ────────────────────────────────────────────────────────

describe("voice heuristic", () => {
  it("splits sentences on terminal punctuation", () => {
    expect(splitSentences("One. Two! Three? Four")).toHaveLength(4);
  });

  it("computes rhythm stats on a known sample", () => {
    const s = analyzeVoice(VOICE_SAMPLE);
    expect(s.sentenceCount).toBeGreaterThan(5);
    expect(s.paragraphCount).toBe(2);
    expect(s.meanSentenceLength).toBeGreaterThan(0);
    expect(s.shortestSentence).toBeLessThanOrEqual(s.medianSentenceLength);
    expect(s.longestSentence).toBeGreaterThanOrEqual(s.medianSentenceLength);
    expect(s.wordCount).toBeGreaterThan(40);
  });

  it("counts punctuation per 100 sentences, not raw", () => {
    const s = analyzeVoice(VOICE_SAMPLE);
    // The sample has one em-dash and one semicolon across ~7 sentences, so the
    // normalized rate must exceed the raw count.
    expect(s.punctuation.emDashPer100).toBeGreaterThan(1);
    expect(s.punctuation.exclamationPer100).toBe(0);
  });

  it("reports common words the writer never uses", () => {
    const s = analyzeVoice(VOICE_SAMPLE);
    expect(s.absentCommonWords).toContain("very");
    expect(s.absentCommonWords).toContain("leverage");
  });

  it("excludes stopwords from top words but keeps them inside bigrams", () => {
    const s = analyzeVoice(VOICE_SAMPLE);
    expect(s.topWords.map((w) => w.word)).not.toContain("the");
    // A bigram may legitimately contain a stopword — "we chase" is voice.
    for (const b of s.topBigrams) expect(b.phrase.split(" ")).toHaveLength(2);
  });

  it("is deterministic — same input, same guide", () => {
    // Ties are broken alphabetically rather than by Map insertion order, so a
    // tenant does not get a different style guide from identical samples.
    expect(renderVoiceGuide(analyzeVoice(VOICE_SAMPLE))).toBe(
      renderVoiceGuide(analyzeVoice(VOICE_SAMPLE)),
    );
  });

  it("survives empty and whitespace input without throwing", () => {
    for (const input of ["", "   ", "\n\n"]) {
      const s = analyzeVoice(input);
      expect(s.sentenceCount).toBe(0);
      expect(s.meanSentenceLength).toBe(0);
      expect(() => renderVoiceGuide(s)).not.toThrow();
    }
  });

  it("renders a guide containing the measured numbers", () => {
    const s = analyzeVoice(VOICE_SAMPLE);
    const guide = renderVoiceGuide(s);
    expect(guide).toContain("BRAND VOICE GUIDE");
    expect(guide).toContain(String(s.meanSentenceLength));
    expect(guide).toContain(String(s.wordCount));
  });
});

// ── VoC (12) ────────────────────────────────────────────────────────────────

describe("voc heuristic", () => {
  it("splits one entry per line when there are no blank-line blocks", () => {
    expect(splitEntries(FEEDBACK)).toHaveLength(6);
  });

  it("prefers blank-line blocks when present", () => {
    expect(splitEntries("a one\nstill a one\n\nb two")).toHaveLength(2);
  });

  it("counts repeated phrases across entries", () => {
    const phrases = extractPhrases(splitEntries(FEEDBACK), 30).map((p) => p.phrase);
    expect(phrases).toContain("setup process was confusing");
    expect(phrases).toContain("support never responded");
    // n tops out at 4, so the longest form of the pricing complaint that can
    // surface is a 4-gram, not the full "price is hard to justify".
    expect(phrases).not.toContain("price is hard to justify");
    expect(phrases.some((p) => p.includes("hard to justify"))).toBe(true);
  });

  it("returns one phrase per complaint, not every window over it", () => {
    // Each of these is a slice of "the setup process was confusing" and appears
    // in exactly the same entries, so all of them are the same complaint. Only
    // the longest survives — the AI step is asked for N distinct headlines and
    // cannot produce them from N slices of one sentence.
    const phrases = extractPhrases(splitEntries(FEEDBACK), 30).map((p) => p.phrase);
    for (const fragment of ["setup process", "setup process was", "the setup process", "process was confusing"]) {
      expect(phrases, `${fragment} should have been deduped`).not.toContain(fragment);
    }
    expect(phrases.filter((p) => p.includes("setup")).length).toBe(1);
  });

  it("ranks by document spread, not raw repetition", () => {
    // One shouty entry repeating a phrase 5x must not outrank a phrase two
    // separate customers used — breadth is the signal worth acting on.
    const shouty = ["red flag red flag red flag red flag red flag", "slow support here", "slow support here"];
    const top = extractPhrases(shouty, 5);
    const slow = top.find((p) => p.phrase.includes("slow support"));
    const red = top.find((p) => p.phrase.includes("red flag"));
    expect(slow?.documents).toBe(2);
    expect(red?.documents).toBe(1);
    expect(top.indexOf(slow!)).toBeLessThan(top.indexOf(red!));
  });

  it("buckets objections and shares sum to ~100", () => {
    const a = analyzeVoc(FEEDBACK);
    const names = a.buckets.map((b) => b.bucket);
    expect(names.sort()).toEqual(["complexity", "price", "support", "time", "trust"]);
    const total = a.buckets.reduce((s, b) => s + b.share, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  it("finds the buckets this fixture actually contains", () => {
    const a = analyzeVoc(FEEDBACK);
    const hits = Object.fromEntries(a.buckets.map((b) => [b.bucket, b.hits]));
    expect(hits.price).toBeGreaterThan(0);
    expect(hits.support).toBeGreaterThan(0);
    expect(hits.complexity).toBeGreaterThan(0);
  });

  it("hands the AI step at most 5 phrases and nothing else", () => {
    const a = analyzeVoc(FEEDBACK);
    const forAi = topPhrasesForAi(a);
    expect(forAi.length).toBeLessThanOrEqual(5);
    for (const p of forAi) expect(typeof p).toBe("string");
    // The corpus must not be reachable through the payload.
    expect(JSON.stringify(forAi)).not.toContain("Waited three days");
  });

  it("handles empty input", () => {
    const a = analyzeVoc("");
    expect(a.entryCount).toBe(0);
    expect(a.topPhrases).toEqual([]);
  });
});

// ── Analytics (09) ──────────────────────────────────────────────────────────

describe("analytics heuristic", () => {
  it("parses the number formats analytics tools actually emit", () => {
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("$18.5k")).toBe(18500);
    expect(parseNumber("2.1%")).toBe(2.1);
    expect(parseNumber("(320)")).toBe(-320);
    expect(parseNumber("-45")).toBe(-45);
    expect(parseNumber("1.2M")).toBe(1_200_000);
    expect(parseNumber("n/a")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("Sessions")).toBeNull();
  });

  it("honours quoted fields containing the delimiter", () => {
    const s = parseAnalytics(CSV);
    const sessions = s.rows.find((r) => r.label === "Sessions");
    expect(sessions?.current).toBe(12400);
  });

  it("computes deltas and percent change", () => {
    const s = parseAnalytics(CSV);
    const signups = s.rows.find((r) => r.label === "Signups")!;
    expect(signups.delta).toBe(-80);
    expect(signups.percentChange).toBe(-20);

    const revenue = s.rows.find((r) => r.label === "Revenue")!;
    expect(revenue.delta).toBe(6500);
    expect(revenue.percentChange).toBeCloseTo(54.2, 1);
  });

  it("separates rows with no usable baseline instead of dropping them", () => {
    // 0 -> 150 has no percentage. Hiding it would bury the most interesting row.
    const s = parseAnalytics(CSV);
    expect(s.unbaselined.map((r) => r.label)).toContain("New channel");
    expect(s.rows.find((r) => r.label === "New channel")!.percentChange).toBeNull();
  });

  it("ranks top and bottom movers", () => {
    const s = parseAnalytics(CSV);
    expect(s.topMovers[0].label).toBe("Revenue");
    expect(s.bottomMovers[0].label).toBe("Signups");
  });

  it("handles headerless and tab-separated input", () => {
    const tsv = "Sessions\t100\t50\nSignups\t10\t20";
    const s = parseAnalytics(tsv);
    expect(s.rowCount).toBe(2);
    expect(s.rows[0].percentChange).toBe(100);
  });

  it("summarises for the AI step without leaking the table", () => {
    const s = parseAnalytics(CSV);
    const summary = summaryForAi(s);
    expect(summary).toContain("Revenue");
    expect(summary).toContain("Biggest increases");
    // Row count is reported, but the raw pasted CSV is not echoed.
    expect(summary).not.toContain("this_month");
    expect(summary).not.toContain("12,400");
  });

  it("returns an empty summary for empty input", () => {
    const s = parseAnalytics("");
    expect(s.rowCount).toBe(0);
    expect(() => summaryForAi(s)).not.toThrow();
  });
});

// ── Calendar (05) ───────────────────────────────────────────────────────────

describe("calendar heuristic", () => {
  const base = { startDate: "2026-03-01", days: 30, pillars: ["Product", "Proof", "Point of view"] };

  it("builds one slot per day with sequential ISO dates", () => {
    const slots = buildCalendar({ ...base, maxConsecutive: 2 });
    expect(slots).toHaveLength(30);
    expect(slots[0].date).toBe("2026-03-01");
    expect(slots[29].date).toBe("2026-03-30");
  });

  it("never runs a pillar longer than maxConsecutive", () => {
    // The constraint that justifies doing this in code: a model asked to "vary
    // the pillars" will happily emit four of the same in a row.
    for (const cap of [1, 2, 3]) {
      const slots = buildCalendar({ ...base, maxConsecutive: cap });
      expect(longestPillarRun(slots), `cap ${cap}`).toBeLessThanOrEqual(cap);
    }
  });

  it("uses every pillar", () => {
    const slots = buildCalendar({ ...base, maxConsecutive: 2 });
    expect(new Set(slots.map((s) => s.pillar)).size).toBe(3);
  });

  it("cycles formats independently of pillars", () => {
    const slots = buildCalendar({ ...base, maxConsecutive: 2 });
    expect(new Set(slots.map((s) => s.format)).size).toBe(4);
    // If format were tied to pillar, every Product post would share a format.
    const productFormats = new Set(slots.filter((s) => s.pillar === "Product").map((s) => s.format));
    expect(productFormats.size).toBeGreaterThan(1);
  });

  it("crosses month boundaries correctly", () => {
    const slots = buildCalendar({ ...base, startDate: "2026-02-26", days: 5, maxConsecutive: 2 });
    expect(slots.map((s) => s.date)).toEqual([
      "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02",
    ]);
  });

  it("tolerates a single pillar rather than looping forever", () => {
    const slots = buildCalendar({ ...base, pillars: ["Only"], days: 5, maxConsecutive: 2 });
    expect(slots).toHaveLength(5);
    expect(longestPillarRun(slots)).toBe(5);
  });

  it("rejects a missing pillar list and a bad start date", () => {
    expect(() => buildCalendar({ ...base, pillars: [], maxConsecutive: 2 })).toThrow();
    expect(() => buildCalendar({ ...base, startDate: "01/03/2026", maxConsecutive: 2 })).toThrow();
  });

  it("merges hooks by date and leaves skipped slots null", () => {
    const slots = buildCalendar({ ...base, days: 3, maxConsecutive: 2 });
    const merged = mergeHooks(slots, [
      { date: "2026-03-01", hook: "First" },
      { date: "2026-03-03", hook: "Third" },
      { date: "not-a-date", hook: "ignored" },
    ]);
    expect(merged.map((m) => m.hook)).toEqual(["First", null, "Third"]);
  });

  it("sends the model the schedule and nothing else", () => {
    const slots = buildCalendar({ ...base, days: 2, maxConsecutive: 2 });
    const payload = JSON.parse(scheduleForAi(slots)) as Array<Record<string, unknown>>;
    for (const slot of payload) {
      expect(Object.keys(slot).sort()).toEqual(["date", "format", "pillar"]);
    }
  });
});

// ── The doctrine test ───────────────────────────────────────────────────────

describe("heuristics never call the Anthropic API", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Any fetch at all fails the test — not just one to Anthropic. A heuristic
    // has no business making a network call of any kind.
    fetchSpy = vi.fn(async (input: unknown) => {
      throw new Error(`heuristic made a network call to ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs all four heuristics with zero fetches", () => {
    const guide = renderVoiceGuide(analyzeVoice(VOICE_SAMPLE));
    const voc = analyzeVoc(FEEDBACK);
    const analytics = parseAnalytics(CSV);
    const slots = buildCalendar({
      startDate: "2026-03-01",
      days: 14,
      pillars: ["A", "B", "C"],
      maxConsecutive: 2,
    });

    // Sanity: they actually produced output, so a no-op cannot pass this test.
    expect(guide.length).toBeGreaterThan(100);
    expect(voc.topPhrases.length).toBeGreaterThan(0);
    expect(analytics.rowCount).toBeGreaterThan(0);
    expect(slots).toHaveLength(14);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("also makes no call while preparing the hybrid AI payloads", () => {
    // Building what the AI step will receive is still local work.
    topPhrasesForAi(analyzeVoc(FEEDBACK));
    summaryForAi(parseAnalytics(CSV));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
