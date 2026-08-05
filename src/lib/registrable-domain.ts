// src/lib/registrable-domain.ts
//
// eTLD+1 extraction, in a module with NO dependencies.
//
// EXTRACTED FROM ai-lens/url.ts, not copied. That file imports Prisma at module
// scope, so anything needing this pure function was dragging a database client
// (and a DATABASE_URL requirement) along with it — which is how a URL helper
// ended up untestable without a database. ai-lens/url.ts now re-exports from
// here, so there is still exactly one copy of the suffix list.

// Mirrors registrable_domain() in av-service/ai_lens.py. Two copies of a suffix
// heuristic is not ideal, but the alternative is shipping the public suffix list
// to both runtimes; both err the same way (toward "different domain"), and the
// sidecar's copy is the one that gates redirects.
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "net.uk", "sch.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz",
  "co.za", "org.za", "web.za", "net.za",
  "com.br", "net.br", "org.br", "gov.br",
  "co.jp", "or.jp", "ne.jp", "ac.jp", "go.jp",
  "com.cn", "net.cn", "org.cn", "gov.cn",
  "co.in", "net.in", "org.in", "gov.in", "ac.in",
  "com.mx", "org.mx", "gob.mx",
  "com.sg", "com.hk", "com.tw", "com.tr", "com.ar", "com.co",
  "gc.ca", "qc.ca", "on.ca",
  "co.il", "org.il", "ac.il",
]);

export function registrableDomain(hostOrUrl: string): string {
  let host = (hostOrUrl ?? "").trim().toLowerCase();
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      /* fall through and treat the input as a bare host */
    }
  }
  host = host.replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}
