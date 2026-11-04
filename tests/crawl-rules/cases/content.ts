import { SECURE_HEADERS, page, pc, sc, siteCtx, stored, type RuleCase } from "../harness";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 7}`).join(" ");
/** Hand-built document so charset and lang can be left out. */
const raw = (opts: { title?: string; body?: string; lang?: string | null; head?: string }) =>
  `<!doctype html><html${opts.lang === null ? "" : ` lang="${opts.lang ?? "en"}"`}><head>${opts.head ?? '<meta charset="utf-8">'}<title>${opts.title ?? "A normal page"}</title></head><body>${opts.body ?? `<p>${words(300)}</p>`}</body></html>`;
const noCharsetHeader = { ...SECURE_HEADERS, "content-type": "text/html" };
const EASY = "The cat sat on the mat. It was a good cat. We like the cat a lot. ".repeat(12);
const HARD = "Notwithstanding considerable organisational complexity, interdepartmental communication necessitates comprehensive documentation procedures. ".repeat(12);

const semCtx = (over: Partial<{ nearestUrl: string | null; nearestScore: number | null; distance: number; offTopic: boolean }>) => ({
  ...siteCtx({ capabilities: ["semantic"] }),
  metrics: { semantic: { nearestUrl: null, nearestScore: null, distance: 0.2, offTopic: false, ...over } },
});

const cases: RuleCase[] = [
  pc("content.low_word_count", "50 words", true, page(raw({ body: `<p>${words(80)}</p>` })), { words: 80 }),
  pc("content.low_word_count", "300 words", false, page(raw({}))),
  pc("content.low_word_count", "not on a 404", false, page(raw({ body: "<p>gone</p>" }), { statusCode: 404 })),
  sc("content.exact_duplicate", "three copies", true, stored(), siteCtx({ site: { duplicateContentCount: 3 } })),
  sc("content.exact_duplicate", "unique", false, stored()),
  sc("content.near_duplicate", "one near copy", true, stored(), siteCtx({ site: { nearDuplicateCount: 1 } })),
  sc("content.near_duplicate", "none", false, stored()),
  pc("content.readability_difficult", "dense prose", true, page(raw({ body: `<p>${HARD}</p>` }))),
  pc("content.readability_difficult", "plain prose", false, page(raw({ body: `<p>${EASY}</p>` }))),
  pc("content.readability_difficult", "not English: not scored", false, page(raw({ body: `<p>${HARD}</p>`, lang: "fr" }))),
  pc("content.placeholder_text", "lorem ipsum", true, page(raw({ body: `<p>Lorem ipsum dolor ${words(250)}</p>` })), { phrase: "lorem ipsum" }),
  pc("content.placeholder_text", "real text", false, page(raw({}))),
  pc("content.soft_404", "not-found title", true, page(raw({ title: "Page not found" })), { reason: "title" }),
  pc("content.soft_404", "almost empty", true, page(raw({ body: "<p>Oops.</p>" })), { reason: "words" }),
  pc("content.soft_404", "normal page", false, page(raw({}))),
  pc("content.low_text_ratio", "script-heavy", true, page(raw({ body: `<p>${words(220)}</p><script>${"x=1;".repeat(20000)}</script>` }))),
  pc("content.low_text_ratio", "mostly text", false, page(raw({}))),
  pc("content.missing_lang", "no lang", true, page(raw({ lang: null }))),
  pc("content.missing_lang", "lang set", false, page(raw({}))),
  pc("content.charset_missing", "neither header nor meta", true, page(raw({ head: "" }), { headers: noCharsetHeader })),
  pc("content.charset_missing", "header only", false, page(raw({ head: "" }))),
  pc("content.charset_missing", "meta only", false, page(raw({}), { headers: noCharsetHeader })),
  pc("content.charset_not_utf8", "latin-1 meta", true, page(raw({ head: '<meta charset="iso-8859-1">' }), { headers: noCharsetHeader }), {
    charset: "iso-8859-1",
  }),
  pc("content.charset_not_utf8", "header wins over meta", false, page(raw({ head: '<meta charset="iso-8859-1">' }))),
  pc("content.charset_not_utf8", "utf-8", false, page(raw({}))),
  // Phase 4g: embeddings, capability "semantic" (only pages that were embedded).
  { ...sc("content.semantic_duplicate", "cosine 0.97 with another page", true, stored(), semCtx({ nearestUrl: "https://example.com/twin", nearestScore: 0.97 })), evidence: { value: "https://example.com/twin", score: 0.97 } },
  sc("content.semantic_duplicate", "exactly 0.95", true, stored(), semCtx({ nearestUrl: "https://example.com/twin", nearestScore: 0.95 })),
  sc("content.semantic_duplicate", "0.94: related, not a duplicate", false, stored(), semCtx({ nearestUrl: "https://example.com/near", nearestScore: 0.94 })),
  sc("content.semantic_duplicate", "not embedded", false, stored(), { ...siteCtx({ capabilities: [] }), metrics: { semantic: { nearestUrl: "x", nearestScore: 1, distance: 0, offTopic: false } } }),
  { ...sc("content.off_topic", "top 5 % by centroid distance", true, stored(), semCtx({ offTopic: true, distance: 0.62 })), evidence: { distance: 0.62 } },
  sc("content.off_topic", "close to the site's subject", false, stored(), semCtx({ offTopic: false, distance: 0.1 })),
];

export default cases;
