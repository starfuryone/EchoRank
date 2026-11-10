// scripts/crawl-load-test/origins.mjs — the load test's 48 sites (no external site is ever touched).
//
// One HTTP server per site, each on its own local port (47001…47048), each a
// 2,000-page site: a root, /p/1 … /p/1999, robots.txt with a Sitemap line,
// sitemap.xml listing every page, and one shared image. Pages are generated
// on the fly (title, description, H1, ~350 words, 12 internal links, the
// image), answered after 30-80 ms like a real server. The crawler reaches
// them as http(s)://lt<N>.crawl-loadtest.zz through fetch-redirect.mjs.
//
//   node scripts/crawl-load-test/origins.mjs [sites=48] [pages=2000] [basePort=47000]

import http from "node:http";

const SITES = Number(process.argv[2] ?? 48);
const PAGES = Number(process.argv[3] ?? 2000);
const BASE = Number(process.argv[4] ?? 47000);
const WORDS = "crawl audit page site search index link title content rank local review visibility answer engine".split(" ");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const counts = new Map();

const host = (site) => `lt${String(site).padStart(2, "0")}.crawl-loadtest.zz`;
const words = (seed, n) => Array.from({ length: n }, (_, i) => WORDS[(seed * 31 + i * 7) % WORDS.length]).join(" ");

function page(site, n) {
  const origin = `https://${host(site)}`;
  const path = n === 0 ? "/" : `/p/${n}`;
  const links = new Set([0, 1, 2, 3, 4, 5]);
  for (let k = 1; k <= 6; k++) links.add(((n * 7 + k * 13) % (PAGES - 1)) + 1);
  if (n + 1 < PAGES) links.add(n + 1);
  if (n > 1) links.add(n - 1);
  const a = [...links].map((m) => `<a href="${m === 0 ? "/" : `/p/${m}`}">${words(m, 3)}</a>`).join(" ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page ${n} of site ${site}: ${words(n, 4)}</title>
<meta name="description" content="${words(n + 1, 18)}"><link rel="canonical" href="${origin}${path}">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body><header><nav>${a}</nav></header>
<main><h1>${words(n, 5)}</h1><p>${words(n + 2, 120)}</p><h2>${words(n + 3, 4)}</h2><p>${words(n + 4, 120)}</p>
<img src="/img/logo.png" alt="logo" width="1" height="1"><p>${words(n + 5, 110)}</p></main></body></html>`;
}

function sitemap(site) {
  const origin = `https://${host(site)}`;
  const urls = Array.from({ length: PAGES }, (_, n) => `<url><loc>${origin}${n === 0 ? "/" : `/p/${n}`}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

for (let site = 1; site <= SITES; site++) {
  const server = http.createServer((req, res) => {
    counts.set(site, (counts.get(site) ?? 0) + 1);
    const url = new URL(req.url ?? "/", "http://x");
    const send = (status, type, body) => {
      res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    const m = /^\/p\/(\d+)$/.exec(url.pathname);
    const n = url.pathname === "/" ? 0 : m ? Number(m[1]) : -1;
    const delay = 30 + ((site * 17 + Math.max(0, n) * 13) % 50);
    setTimeout(() => {
      if (url.pathname === "/robots.txt") return send(200, "text/plain", `User-agent: *\nAllow: /\nSitemap: https://${host(site)}/sitemap.xml\n`);
      if (url.pathname === "/sitemap.xml") return send(200, "application/xml", sitemap(site));
      if (url.pathname === "/img/logo.png") return send(200, "image/png", PNG);
      if (n >= 0 && n < PAGES) return send(200, "text/html; charset=utf-8", page(site, n));
      return send(404, "text/html; charset=utf-8", "<!doctype html><title>Not found</title><h1>Not found</h1>");
    }, delay);
  });
  server.keepAliveTimeout = 30_000;
  server.listen(BASE + site, "127.0.0.1");
}

console.log(`[origins] ${SITES} sites × ${PAGES} pages on 127.0.0.1:${BASE + 1}-${BASE + SITES}`);
setInterval(() => {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`[origins] ${new Date().toISOString()} requests so far: ${total}`);
}, 60_000).unref?.();
