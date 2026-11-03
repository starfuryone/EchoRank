import { doc, page, pc, rc, withRender, type RuleCase } from "../harness";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const RAW = doc("<title>Shop</title><meta name=\"description\" content=\"Raw desc\"><link rel=\"canonical\" href=\"https://example.com/page\">", `<h1>Shop</h1><p>${words(100)}</p><a href="/a">a</a>`);
const same = () => withRender(page(RAW), RAW);
const rendered = (head: string, body: string) => withRender(page(RAW), doc(head, body));
const RHEAD = "<title>Shop</title><meta name=\"description\" content=\"Raw desc\"><link rel=\"canonical\" href=\"https://example.com/page\">";
const RBODY = `<h1>Shop</h1><p>${words(100)}</p><a href="/a">a</a>`;

const SHELL = doc("<title>App</title>", '<div id="root"></div><script src="/app.js"></script>');

const cases: RuleCase[] = [
  rc("javascript.content_only_rendered", "JS adds 200 words", true, rendered(RHEAD, `<h1>Shop</h1><p>${words(300)}</p><a href="/a">a</a>`), { added: 200 }),
  rc("javascript.content_only_rendered", "same content", false, same()),
  rc("javascript.content_only_rendered", "a few words added", false, rendered(RHEAD, `<h1>Shop</h1><p>${words(120)}</p><a href="/a">a</a>`)),
  pc("javascript.content_only_rendered", "not rendered", false, page(RAW)),

  rc("javascript.links_only_rendered", "nav injected", true, rendered(RHEAD, `${RBODY}<a href="/b">b</a><a href="/c">c</a>`), { links: 2 }),
  rc("javascript.links_only_rendered", "external link added is not counted", false, rendered(RHEAD, `${RBODY}<a href="https://other.org/">x</a>`)),
  rc("javascript.links_only_rendered", "same links", false, same()),

  rc("javascript.title_changed", "rewritten", true, rendered("<title>Shop | Sale</title>", RBODY), { raw: "Shop", rendered: "Shop | Sale" }),
  rc("javascript.title_changed", "unchanged", false, same()),
  rc("javascript.title_changed", "removed by JS is not a change to judge", false, rendered("", RBODY)),

  rc("javascript.meta_description_changed", "rewritten", true, rendered('<title>Shop</title><meta name="description" content="New desc">', RBODY)),
  rc("javascript.meta_description_changed", "unchanged", false, same()),

  rc("javascript.h1_changed", "rewritten", true, rendered(RHEAD, `<h1>Big sale</h1><p>${words(100)}</p><a href="/a">a</a>`)),
  rc("javascript.h1_changed", "unchanged", false, same()),

  rc("javascript.canonical_changed", "points elsewhere", true, rendered('<title>Shop</title><link rel="canonical" href="https://example.com/other">', RBODY)),
  rc("javascript.canonical_changed", "unchanged", false, same()),

  rc("javascript.noindex_only_original", "JS lifts noindex", true,
    withRender(page(doc('<title>t</title><meta name="robots" content="noindex">', RBODY)), doc("<title>t</title>", RBODY))),
  rc("javascript.noindex_only_original", "noindex in both", false,
    withRender(page(doc('<title>t</title><meta name="robots" content="noindex">', RBODY)), doc('<title>t</title><meta name="robots" content="noindex">', RBODY))),

  rc("javascript.noindex_only_rendered", "JS adds noindex", true, rendered('<title>Shop</title><meta name="robots" content="noindex, follow">', RBODY)),
  rc("javascript.noindex_only_rendered", "indexable in both", false, same()),

  rc("javascript.js_redirect", "location.href", true, withRender(page(RAW), RAW, { jsRedirect: "https://example.com/new" }), { target: "https://example.com/new" }),
  rc("javascript.js_redirect", "meta refresh belongs to response_codes", false,
    withRender(page(doc('<meta http-equiv="refresh" content="0;url=/new">', RBODY)), RAW, { jsRedirect: "https://example.com/new" })),
  rc("javascript.js_redirect", "stays put", false, same()),

  pc("javascript.ajax_crawling_scheme", "hashbang link", true, page(doc("<title>t</title>", '<a href="/#!/products">p</a>')), { href: "/#!/products" }),
  pc("javascript.ajax_crawling_scheme", "plain fragment", false, page(doc("<title>t</title>", '<a href="#top">top</a>'))),

  rc("javascript.rendered_word_count_zero", "blank after render", true, withRender(page(SHELL), SHELL)),
  rc("javascript.rendered_word_count_zero", "has text", false, same()),

  rc("javascript.console_errors", "two errors", true, withRender(page(RAW), RAW, { consoleErrors: 2, consoleSample: "TypeError: x is undefined" }), { errors: 2 }),
  rc("javascript.console_errors", "clean", false, same()),

  pc("javascript.enable_rendering", "SPA shell, rendering off", true, page(SHELL)),
  rc("javascript.enable_rendering", "rendering on", false, page(SHELL)),
  pc("javascript.enable_rendering", "server-rendered page", false, page(RAW)),
];

export default cases;
