// The checkout consent gate: config-driven rendering, and server-side refusal.
//
// The mutation the config-driven tests exist to catch: someone writes the four
// document names into JSX because it reads more naturally, and the sentence
// then silently disagrees with what the server requires the first time the list
// changes. A checkout rejected for a document the buyer was never shown is the
// failure, and it would look like a server bug.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONSENT_DOCUMENTS,
  CONSENT_DOCUMENT_IDS,
  CONSENT_VERSION,
  checkConsent,
} from "@/lib/consent-config";
import { ConsentGate } from "@/app/[locale]/ConsentGate";
import { CONSENT_COPY } from "@/lib/i18n/content";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function gate(locale: "en" | "fr" = "en", modalOpen = false, accepted = false): string {
  return renderToStaticMarkup(
    createElement(ConsentGate, {
      locale,
      accepted,
      onChange: () => {},
      modalOpen,
      onCloseModal: () => {},
      ctaLabel: "Start free trial",
      onAccept: () => {},
    }),
  );
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

describe("the sentence is built from config, not written in JSX", () => {
  it("renders exactly one link per configured document", () => {
    // Derived from the config on both sides, so adding a document makes this
    // pass only if the component actually picked it up.
    const links = hrefs(gate()).filter((h) => h.startsWith("/en/legal/"));
    expect(links).toHaveLength(CONSENT_DOCUMENTS.length);
    for (const doc of CONSENT_DOCUMENTS) {
      expect(links).toContain(`/en${doc.href}`);
    }
  });

  it("names every document, in config order", () => {
    const html = gate();
    const t = CONSENT_COPY.en;
    const positions = CONSENT_DOCUMENTS.map((d) => html.indexOf(t[d.labelKey]));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
  });

  it("opens every document in a new tab", () => {
    // These are read mid-checkout; navigating away would lose the plan choice.
    const html = gate();
    const targets = [...html.matchAll(/<a[^>]*>/g)].map((m) => m[0]);
    expect(targets).toHaveLength(CONSENT_DOCUMENTS.length);
    expect(targets.every((a) => a.includes('target="_blank"'))).toBe(true);
    expect(targets.every((a) => a.includes("noopener"))).toBe(true);
  });

  it("lists the same documents in the modal", () => {
    const links = hrefs(gate("en", true)).filter((h) => h.startsWith("/en/legal/"));
    // Sentence + modal, so twice the config length — no more. The modal used to
    // carry a second, plain list beside the sentence; the checkbox row replaced
    // it, and three copies of the same four links in one dialog is the drift
    // this count is here to catch.
    expect(links).toHaveLength(CONSENT_DOCUMENTS.length * 2);
  });

  it("renders the identical sentence in the modal, from the same catalog", () => {
    const html = gate("fr", true).replace(/&#x27;/g, "'");
    const t = CONSENT_COPY.fr;
    // Twice: once under the grid, once in the dialog.
    expect(html.split(t.agreePrefix)).toHaveLength(3);
    expect(html.split(t.subscriptionAgreement)).toHaveLength(3);
  });

  it("opens the modal's document links in a new tab too", () => {
    const anchors = [...gate("en", true).matchAll(/<a[^>]*>/g)].map((m) => m[0]);
    expect(anchors).toHaveLength(CONSENT_DOCUMENTS.length * 2);
    expect(anchors.every((a) => a.includes('target="_blank"'))).toBe(true);
    expect(anchors.every((a) => a.includes('rel="noopener noreferrer"'))).toBe(true);
  });
});

describe("the modal's checkbox row", () => {
  it("gives the dialog checkbox its own id, and a label bound to it", () => {
    const html = gate("en", true);
    const boxes = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => m[0]);
    expect(boxes).toHaveLength(2);
    const ids = [...html.matchAll(/<input[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    // Two rows on one document: sharing an id would point both labels at the
    // first checkbox and leave the dialog's unclickable by its own text.
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`for="${id}"`);
  });

  it("reflects the shared state rather than a local one", () => {
    // The prop is the only source: unchecked in, unchecked in BOTH rows.
    expect([...gate("en", true).matchAll(/checked=""/g)]).toHaveLength(0);
    expect([...gate("en", true, true).matchAll(/checked=""/g)]).toHaveLength(2);
  });

  it("disables the dialog's checkout button until the box is ticked", () => {
    const closed = gate("en", true).match(/<button[^>]*>Start free trial<\/button>/);
    expect(closed).not.toBeNull();
    expect(closed![0]).toContain("disabled");
    const open = gate("en", true, true).match(/<button[^>]*>Start free trial<\/button>/);
    expect(open![0]).not.toContain("disabled");
  });

  it("is a dialog labelled by its own title", () => {
    const html = gate("en", true);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/);
    expect(labelledBy).not.toBeNull();
    // The id it names must be the element carrying the title text.
    const title = new RegExp(`id="${labelledBy![1]}"[^>]*>${CONSENT_COPY.en.modalTitle}<`);
    expect(html).toMatch(title);
  });

  it("is translated, and locale-prefixes the document links", () => {
    // Compared after unescaping: React escapes the apostrophe in "J'accepte"
    // to &#x27;, so a raw toContain on the catalog string never matches.
    const html = gate("fr").replace(/&#x27;/g, "'");
    expect(html).toContain(CONSENT_COPY.fr.agreePrefix);
    expect(html).toContain(CONSENT_COPY.fr.subscriptionAgreement);
    expect(hrefs(html).every((h) => h.startsWith("/fr/legal/"))).toBe(true);
  });

  it("has copy for every marketing locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = CONSENT_COPY[locale];
      expect(t.agreePrefix).toBeTruthy();
      expect(t.modalTitle).toBeTruthy();
      // Every document's label key must resolve, or the sentence renders
      // "undefined" as a link.
      for (const doc of CONSENT_DOCUMENTS) expect(t[doc.labelKey]).toBeTruthy();
    }
    // de-CH uses ss, never ß.
    expect(JSON.stringify(CONSENT_COPY["de-CH"])).not.toContain("ß");
  });
});

describe("server-side consent validation", () => {
  const valid = {
    accepted: true,
    timestamp: "2026-08-07T10:00:00.000Z",
    version: CONSENT_VERSION,
    documents: [...CONSENT_DOCUMENT_IDS],
  };

  it("accepts a complete, current payload", () => {
    expect(checkConsent(valid)).toEqual({ ok: true });
  });

  it("rejects a missing consent object", () => {
    expect(checkConsent(undefined).reason).toBe("missing");
    expect(checkConsent(null).reason).toBe("missing");
    expect(checkConsent("yes").reason).toBe("missing");
  });

  it("rejects accepted=false, and a truthy non-true", () => {
    expect(checkConsent({ ...valid, accepted: false }).reason).toBe("not_accepted");
    // "true" the string must not pass for true.
    expect(checkConsent({ ...valid, accepted: "true" }).reason).toBe("not_accepted");
  });

  it("rejects a stale version", () => {
    // A checkout tab left open across a version bump has to re-consent.
    expect(checkConsent({ ...valid, version: "2026-07" }).reason).toBe("stale_version");
    expect(checkConsent({ ...valid, version: undefined }).reason).toBe("stale_version");
  });

  it("rejects a payload missing any single document", () => {
    for (const id of CONSENT_DOCUMENT_IDS) {
      const documents = CONSENT_DOCUMENT_IDS.filter((d) => d !== id);
      expect(checkConsent({ ...valid, documents }).reason).toBe("missing_documents");
    }
    expect(checkConsent({ ...valid, documents: [] }).reason).toBe("missing_documents");
    expect(checkConsent({ ...valid, documents: "all" }).reason).toBe("missing_documents");
  });

  it("tolerates an extra document id", () => {
    // A client that still sends a document we have retired is not lying about
    // what it accepted.
    expect(checkConsent({ ...valid, documents: [...valid.documents, "retired"] }).ok).toBe(true);
  });

  it("requires exactly the four documents the agreement names", () => {
    expect([...CONSENT_DOCUMENT_IDS].sort()).toEqual([
      "cookies",
      "privacy",
      "subscription_agreement",
      "terms",
    ]);
  });
});

describe("document links open the modal instead of navigating", () => {
  it("keeps a real href on every link", () => {
    // The interception is an enhancement over a working link. Middle-click,
    // ctrl-click, no-JS and crawlers all need the real page, which is also what
    // keeps the sitemap entries honest.
    const html = gate();
    for (const doc of CONSENT_DOCUMENTS) {
      expect(html).toContain(`href="/en${doc.href}"`);
    }
  });

  it("loads each document body from the same builder the route renders", async () => {
    // No second copy of the text and no iframe: if these diverged, the modal
    // could show a document the /legal route does not.
    const { loadLegalDoc } = await import("@/app/[locale]/legal/_content/registry");
    for (const doc of CONSENT_DOCUMENTS) {
      const d = await loadLegalDoc(doc.id, "en");
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.sections.length).toBeGreaterThan(0);
    }
  });

  it("serves the French body for a French locale", async () => {
    const { loadLegalDoc } = await import("@/app/[locale]/legal/_content/registry");
    const fr = await loadLegalDoc("terms", "fr");
    expect(fr.title).toBe("Conditions d'utilisation");
  });

  it("has a loader for every consent document, and only those", async () => {
    // Exhaustive by type; asserted at runtime too, so a document added to the
    // config without a loader fails here rather than at click time.
    const { LEGAL_DOC_LOADERS } = await import("@/app/[locale]/legal/_content/registry");
    expect(Object.keys(LEGAL_DOC_LOADERS).sort()).toEqual([...CONSENT_DOCUMENT_IDS].sort());
  });
});
