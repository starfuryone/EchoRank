// URL acceptance for snapshots: any public page, scheme optional, SSRF held.
//
// The two halves matter equally. Rejecting a competitor's URL would remove the
// reason the tool exists; accepting 127.0.0.1 would make it an SSRF gadget.
import { describe, it, expect } from "vitest";
import { normalizeSnapshotUrl, rejectionCopyKey } from "@/lib/historical/url";

describe("scheme-less normalization", () => {
  it("accepts a bare hostname and assumes https", () => {
    const r = normalizeSnapshotUrl("cnn.com");
    expect(r.ok).toBe(true);
    expect(r.url).toBe("https://cnn.com/");
  });

  it("accepts a bare host with a path", () => {
    expect(normalizeSnapshotUrl("cnn.com/politics").url).toBe("https://cnn.com/politics");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSnapshotUrl("   example.com  ").url).toBe("https://example.com/");
  });

  it("never rewrites a scheme that IS present", () => {
    // http stays http — silently upgrading would capture a different response
    // than the one the user asked for.
    expect(normalizeSnapshotUrl("http://example.com/").url).toBe("http://example.com/");
  });

  it("does not upgrade a rejected scheme into an accepted one", () => {
    for (const bad of ["ftp://example.com/", "file:///etc/passwd", "gopher://example.com/"]) {
      expect(normalizeSnapshotUrl(bad).ok, bad).toBe(false);
    }
  });

  it("rejects genuinely invalid input", () => {
    for (const bad of ["", "   ", "not a url", "http://", "://x"]) {
      expect(normalizeSnapshotUrl(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects an absurdly long URL", () => {
    expect(normalizeSnapshotUrl(`https://example.com/${"a".repeat(2100)}`).ok).toBe(false);
  });
});

describe("query strings are preserved", () => {
  it("keeps the query, unlike the probe-oriented guard it reuses", () => {
    // /search?q=plumbers is a DIFFERENT PAGE from /search. Dropping the query
    // would file the wrong content under the URL the user typed.
    const r = normalizeSnapshotUrl("https://example.com/search?q=plumbers&page=2");
    expect(r.ok).toBe(true);
    expect(r.url).toBe("https://example.com/search?q=plumbers&page=2");
  });

  it("keeps the query on scheme-less input too", () => {
    expect(normalizeSnapshotUrl("example.com/s?q=1").url).toBe("https://example.com/s?q=1");
  });

  it("drops the fragment, which never reaches a server", () => {
    const r = normalizeSnapshotUrl("https://example.com/page?a=1#section");
    expect(r.url).toBe("https://example.com/page?a=1");
  });

  it("gives one snapshot history per page, not per fragment", () => {
    expect(normalizeSnapshotUrl("https://example.com/p#a").url).toBe(
      normalizeSnapshotUrl("https://example.com/p#b").url,
    );
  });
});

describe("third-party URLs are accepted", () => {
  it("accepts domains a tenant does not own", () => {
    // No ownership check exists and none should: comparing your page against a
    // competitor's IS the tool.
    for (const url of [
      "https://cnn.com/",
      "https://competitor-site.com/pricing",
      "https://www.homestars.com/plumbing",
      "https://en.wikipedia.org/wiki/Plumbing",
    ]) {
      expect(normalizeSnapshotUrl(url).ok, url).toBe(true);
    }
  });

  it("never reports a domain mismatch", () => {
    const r = normalizeSnapshotUrl("https://someone-elses-site.com/");
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });
});

describe("RFC 2606 reserved TLDs are refused", () => {
  it("rejects .example, .test and .invalid", () => {
    // Documentation-only names. Worth a test because they are the obvious
    // thing to reach for when writing fixtures, and they are NOT public sites.
    for (const url of ["https://foo.example/", "https://foo.test/", "https://foo.invalid/"]) {
      expect(normalizeSnapshotUrl(url).ok, url).toBe(false);
    }
  });
});

describe("SSRF guard still rejects", () => {
  const blocked: Array<[string, string]> = [
    ["loopback ip", "http://127.0.0.1/"],
    ["loopback ip with port", "http://127.0.0.1:4400/admin"],
    ["all-zeros", "http://0.0.0.0/"],
    ["localhost", "http://localhost/"],
    ["link-local metadata", "http://169.254.169.254/latest/meta-data/"],
    ["private 10.x", "http://10.0.0.5/"],
    ["private 192.168.x", "http://192.168.1.1/"],
    ["private 172.16.x", "http://172.16.0.1/"],
    ["ipv6 loopback", "http://[::1]/"],
    ["internal hostname", "https://db.internal/"],
    ["local suffix", "https://printer.local/"],
    ["single-label host", "http://intranet/"],
    ["credentials in url", "https://user:pass@example.com/"],
    ["non-standard port", "https://example.com:2375/"],
    ["public ip literal", "http://93.184.216.34/"],
  ];

  it.each(blocked)("rejects %s", (_label, url) => {
    expect(normalizeSnapshotUrl(url).ok).toBe(false);
  });

  it("rejects scheme-less private hosts too — normalization is not a bypass", () => {
    // The https:// prefix is added BEFORE validation, so a bare "127.0.0.1"
    // must not sneak through as a hostname.
    for (const bare of ["127.0.0.1", "localhost", "169.254.169.254", "db.internal"]) {
      expect(normalizeSnapshotUrl(bare).ok, bare).toBe(false);
    }
  });

  it("reports a reason the UI can turn into specific copy", () => {
    expect(rejectionCopyKey(normalizeSnapshotUrl("ftp://x.com/").reason)).toBe("errUrlScheme");
    expect(rejectionCopyKey(normalizeSnapshotUrl("https://u:p@x.com/").reason)).toBe("errUrlCredentials");
    expect(rejectionCopyKey(normalizeSnapshotUrl("https://x.com:2375/").reason)).toBe("errUrlPort");
    expect(rejectionCopyKey(normalizeSnapshotUrl("http://127.0.0.1/").reason)).toBe("errUrlPrivate");
    // A single-label host is not a public site, so it reports private_host
    // rather than a parse failure — the copy is more specific, not less.
    expect(rejectionCopyKey(normalizeSnapshotUrl("garbage").reason)).toBe("errUrlPrivate");
    expect(rejectionCopyKey(normalizeSnapshotUrl("not a url").reason)).toBe("errInvalidUrl");
  });
});

describe("redirect-to-private is out of scope here, by design", () => {
  it("accepts a URL that could still redirect somewhere private", () => {
    // This function guards what is expressible in the URL AS WRITTEN. A public
    // host that 302s to 127.0.0.1 is caught in the sidecar, which is the only
    // layer holding the socket — ai_lens.assert_fetchable re-resolves every hop
    // and refuses any that leaves the requested registrable domain.
    // Asserting that here would be asserting a lie about where the check lives.
    expect(normalizeSnapshotUrl("https://redirector-site.com/to-internal").ok).toBe(true);
  });
});
