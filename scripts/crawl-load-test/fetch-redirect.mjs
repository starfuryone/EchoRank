// scripts/crawl-load-test/fetch-redirect.mjs — LOAD TEST ONLY, loaded with --import.
//
// The crawler refuses IP literals, odd ports and reserved names like .test
// (url-guard.ts), which is right, and the load test must not touch a site on
// the internet. So the test sites are named lt<N>.crawl-loadtest.zz — "zz" is
// an ISO 3166 user-assigned code, never a TLD, so the name resolves nowhere —
// and this preload rewrites a fetch to one of those names to its local origin,
// 127.0.0.1:47000+N (origins.mjs). Every other fetch is untouched. It does
// nothing unless CRAWL_LOAD_TEST=1, and nothing in the app imports it: it
// exists only on the command line of a load test.

if (process.env.CRAWL_LOAD_TEST === "1") {
  const base = Number(process.env.CRAWL_LOAD_TEST_BASE_PORT || 47000);
  const original = globalThis.fetch;
  const TEST_HOST = /^lt(\d{2})\.crawl-loadtest\.zz$/;
  globalThis.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url;
    try {
      url = new URL(raw);
    } catch {
      return original(input, init);
    }
    const m = TEST_HOST.exec(url.hostname);
    if (!m) return original(input, init);
    url.protocol = "http:";
    url.host = `127.0.0.1:${base + Number(m[1])}`;
    return original(url.href, init);
  };
  console.error(`[load-test] fetch to *.crawl-loadtest.zz goes to 127.0.0.1:${base}+N (pid ${process.pid})`);
}
