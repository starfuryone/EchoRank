// SSRF guard for URLs the av-visibility sidecar will fetch (src/lib/public-url.ts),
// and its two callers that take a URL from outside: the anonymous free audit
// (/api/av/audit) and the partner API. DNS is stubbed: names under
// *.resolves-private.test-dns map to private addresses, everything else to a
// public one (93.184.215.14).

import { beforeEach, describe, expect, it, vi } from "vitest";

const PRIVATE_DNS: Record<string, string[]> = {
  "localhost.": ["127.0.0.1"],
  "127.0.0.1.nip.io": ["127.0.0.1"],
  "intranet.example-corp.com": ["10.1.2.3"],
  "metadata.example-cloud.com": ["169.254.169.254"],
  "v6.example-corp.com": ["2606:4700::1", "fd00::5"],
  "mapped.example-corp.com": ["::ffff:192.168.1.1"],
};
const lookup = vi.fn(async (host: string) => {
  if (host === "nxdomain.example.com") throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  return (PRIVATE_DNS[host] ?? ["93.184.215.14"]).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
});
vi.mock("node:dns/promises", () => ({ lookup: (h: string) => lookup(h), default: { lookup: (h: string) => lookup(h) } }));

const store = new Map<string, number>();
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    incr: async (k: string) => {
      store.set(k, (store.get(k) ?? 0) + 1);
      return store.get(k);
    },
    get: async (k: string) => (store.has(k) ? String(store.get(k)) : null),
    expire: async () => 1,
  }),
}));

const REJECTED: Array<[string, string]> = [
  ["http://127.0.0.1:4500/audit", "bad_port"],
  ["127.0.0.1:4400", "bad_port"],
  ["localhost", "private_host"],
  ["http://localhost:4500/", "bad_port"],
  ["http://10.0.0.5/", "private_host"],
  ["http://169.254.169.254/latest/meta-data/", "private_host"],
  ["file:///etc/passwd", "bad_scheme"],
  ["gopher://example.com/", "bad_scheme"],
  ["https://example.com:4400/", "bad_port"],
  ["https://example.com:4500/", "bad_port"],
  ["https://example.com:4540/", "bad_port"],
  ["http://[::1]/", "ip_literal"],
  ["http://127.0.0.1/", "private_host"],
  ["https://user:pw@example.com/", "has_credentials"],
  ["https://localhost./", "resolves_private"],
  ["https://127.0.0.1.nip.io/", "resolves_private"],
  ["https://intranet.example-corp.com/", "resolves_private"],
  ["https://metadata.example-cloud.com/", "resolves_private"],
  ["https://v6.example-corp.com/", "resolves_private"],
  ["https://mapped.example-corp.com/", "resolves_private"],
  ["https://nxdomain.example.com/", "unresolvable"],
];

describe("guardPublicUrl", () => {
  it.each(REJECTED)("refuses %s (%s)", async (url, reason) => {
    const { guardPublicUrl } = await import("@/lib/public-url");
    expect(await guardPublicUrl(url)).toEqual({ ok: false, reason });
  });

  it("passes a normal domain, normalized to https", async () => {
    const { guardPublicUrl } = await import("@/lib/public-url");
    expect(await guardPublicUrl("example.com")).toEqual({ ok: true, url: "https://example.com/" });
    expect(await guardPublicUrl("http://www.example.com/about?x=1")).toEqual({ ok: true, url: "http://www.example.com/about" });
  });

  it("classifies addresses", async () => {
    const { isNonPublicAddress } = await import("@/lib/public-url");
    for (const ip of ["127.0.0.1", "10.9.9.9", "172.20.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::10.0.0.1", "198.18.0.1"]) {
      expect(isNonPublicAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.215.14", "1.1.1.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isNonPublicAddress(ip), ip).toBe(false);
    }
  });
});

describe("/api/av/audit SSRF", () => {
  beforeEach(() => store.clear());

  async function post(brand: string, ip = "198.51.100.1") {
    const { POST } = await import("@/app/api/av/audit/route");
    return POST(
      new Request("http://127.0.0.1:4400/api/av/audit", {
        method: "POST",
        headers: { "cf-connecting-ip": ip, "content-type": "application/json" },
        body: JSON.stringify({ brand }),
      }) as never,
    );
  }

  it.each(["http://127.0.0.1:4500/audit", "localhost", "http://10.0.0.5/", "http://169.254.169.254/", "file:///etc/passwd", "https://localhost./"])(
    "refuses %s with 400 and never calls the sidecar",
    async (brand) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await post(brand);
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    },
  );

  it("a refused URL does not spend the IP's daily audit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ score: 50 }), { status: 200 })));
    expect((await post("http://10.0.0.5/", "198.51.100.7")).status).toBe(400);
    expect((await post("example.com", "198.51.100.7")).status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("a normal domain goes to the sidecar as the normalized URL", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ score: 50 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await post("example.com", "198.51.100.2");
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ url: "https://example.com/", crawl: false });
    vi.unstubAllGlobals();
  });
});
