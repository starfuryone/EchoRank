// tests/readiness-labels.test.tsx
//
// Label honesty for the AI readiness score (av-service ai_readiness.py, v2):
// the audit asks no AI engine anything, so every surface calls it the "AI
// readiness score"; real engine answers are "AI presence", beside it. Gates
// read "Capped at 45: homepage has under 150 words" in each language, and the
// fixes are the sidecar's top 3 by points recoverable.

import { readFileSync, existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  READINESS_COPY,
  fixLines,
  gateLine,
  readinessLocale,
  scoreVersionNote,
  type ReadinessLocale,
} from "@/lib/i18n/readiness";
import { VISIBILITY_COPY, BRAND_RADAR_COPY, MONITOR_CARD_COPY } from "@/lib/i18n/dashboard";
import { ReadinessBreakdown } from "@/components/visibility/ReadinessBreakdown";
import { Sparkline } from "@/components/visibility/MonitorCard";
import { toPartnerAudit } from "@/lib/partner/shape";

const LOCALES: ReadinessLocale[] = ["en", "fr", "de-CH"];
const SIDECAR = "/opt/echorank/av-service/ai_readiness.py";

describe("labels", () => {
  it("the audit's number is the AI readiness score everywhere, engine answers are AI presence", () => {
    expect(READINESS_COPY.en.label).toBe("AI readiness score");
    expect(READINESS_COPY.en.presence).toBe("AI presence");
    for (const l of LOCALES) {
      expect(VISIBILITY_COPY[l].statScore).toBe(READINESS_COPY[l].label);
      expect(BRAND_RADAR_COPY[l].statScore).toBe(READINESS_COPY[l].label);
      expect(BRAND_RADAR_COPY[l].statMentionRate(30)).toContain(READINESS_COPY[l].presence);
    }
    expect(VISIBILITY_COPY.en.statScore).not.toMatch(/visibility/i);
    // The cards never call the readiness number "visibility".
    expect(MONITOR_CARD_COPY.en.lastScore(60, "C")).toBe("last score 60 (C)");
  });

  it("the free check's widget copy says readiness and presence on both pages", () => {
    // Since 2026-11-10 the free audit's result shows the score under the
    // catalog's label (READINESS_COPY.label) and promises no "AI presence":
    // the audit asks no engine anything.
    const src = readFileSync("src/components/free-audit/FreeAuditResult.tsx", "utf8");
    expect(src).toContain("{rc.label}");
    expect(READINESS_COPY.en.label).toBe("AI readiness score");
    expect(READINESS_COPY.fr.label).toBe("Score de préparation IA");
    expect(src).not.toMatch(/AI presence|mentionLabel/);
  });

  it("folds marketing and dashboard locales to en / fr / de-CH", () => {
    expect(readinessLocale("fr-CA")).toBe("fr");
    expect(readinessLocale("de-CH")).toBe("de-CH");
    expect(readinessLocale("en-CA")).toBe("en");
    expect(readinessLocale(undefined)).toBe("en");
  });
});

describe("gates and fixes", () => {
  it("reads the brief's example in each language", () => {
    const g = { id: "thin-homepage", cap: 45, params: { words: 82 } };
    expect(gateLine(g, "en")).toBe("Capped at 45: homepage has under 150 words");
    expect(gateLine(g, "fr")).toBe("Plafonné à 45 : la page d’accueil compte moins de 150 mots");
    expect(gateLine(g, "de-CH")).toBe("Auf 45 begrenzt: die Startseite hat weniger als 150 Wörter");
    // An id this app does not know keeps the sidecar's English.
    expect(gateLine({ id: "new-gate", cap: 50, reason: "something new" }, "fr")).toBe("Plafonné à 50 : something new");
  });

  it("localizes fixes by id and keeps the points recoverable", () => {
    const fixes = [
      { id: "noindex", kind: "gate" as const, recover: 39.6, fix: "en" },
      { id: "org-schema", kind: "check" as const, recover: 3, params: { found: true, missing: ["sameAs"] } },
      { id: "unknown-check", kind: "check" as const, recover: 1, title: "Sidecar title", fix: "Sidecar fix." },
    ];
    const de = fixLines(fixes, "de-CH");
    expect(de[0]).toMatchObject({ id: "noindex", recover: 40 });
    expect(de[0].fix).toContain("noindex");
    expect(de[1].fix).toBe("Vervollständigen Sie Ihr JSON-LD: ergänzen Sie sameAs.");
    expect(de[2]).toMatchObject({ title: "Sidecar title", fix: "Sidecar fix." });
  });

  it("every gate, group and check the sidecar emits has words in every language", () => {
    const keys = (o: object) => Object.keys(o).sort();
    for (const l of LOCALES) {
      expect(keys(READINESS_COPY[l].gates)).toEqual(keys(READINESS_COPY.en.gates));
      expect(keys(READINESS_COPY[l].gateFixes)).toEqual(keys(READINESS_COPY.en.gates));
      expect(keys(READINESS_COPY[l].checks)).toEqual(keys(READINESS_COPY.en.checks));
      expect(keys(READINESS_COPY[l].groups)).toEqual(["access", "content", "discoverability", "entity", "rendering"]);
    }
    if (existsSync(SIDECAR)) {
      const py = readFileSync(SIDECAR, "utf8");
      const gateIds = [...py.matchAll(/^\s+"([a-z-]+)": \d+,$/gm)].map((m) => m[1]);
      expect(gateIds.length).toBe(8);
      for (const id of gateIds) expect(READINESS_COPY.en.gates).toHaveProperty(id);
      const checkIds = [...py.matchAll(/Check\("([a-z-]+)"/g), ...py.matchAll(/(?:content_check|disc|page_check)\("([a-z-]+)"/g)]
        .map((m) => m[1]);
      // 24 in v2, plus v3's informational "faq-markup".
      expect(checkIds.length).toBe(25);
      for (const id of checkIds) expect(READINESS_COPY.en.checks).toHaveProperty(id);
    }
  });

  it("de-CH writes ss, never ß", () => {
    expect(JSON.stringify(READINESS_COPY["de-CH"], (_k, v) => (typeof v === "function" ? v({ pages: 3 }) : v)))
      .not.toContain("ß");
  });
});

describe("the dashboard breakdown", () => {
  const audit = {
    confidence: "low" as const,
    gates: [{ id: "thin-homepage", cap: 45, reason: "x", params: { words: 90 } }],
    groups: [
      { id: "access", points: 11, max: 15 },
      { id: "content", points: 9, max: 35 },
    ],
    top_fixes: [{ id: "thin-homepage", kind: "gate" as const, recover: 12 }],
    checks: [
      { id: "raw-content", category: "Main content in the raw HTML", points: 3, max: 6, status: "" },
      { id: "render-gap", category: "Little hidden behind JavaScript", points: 0, max: 4, status: "", ran: false },
    ],
  };

  it("shows the groups, the cap with its reason, the top fixes and unrun checks", () => {
    const html = renderToStaticMarkup(createElement(ReadinessBreakdown, { audit, locale: "en" }));
    expect(html).toContain("Capped at 45: homepage has under 150 words");
    expect(html).toContain("Content substance");
    expect(html).toContain("up to +12 points");
    expect(html).toContain("Low confidence");
    expect(html).toContain("not run");
  });

  it("renders in French", () => {
    const html = renderToStaticMarkup(createElement(ReadinessBreakdown, { audit, locale: "fr" }));
    expect(html).toContain("Plafonné à 45");
    expect(html).toContain("Substance du contenu");
  });

  it("v3: llms.txt and FAQ markup read 'not scored', never 0/0; Organization schema says what it helps", () => {
    const v3 = {
      ...audit,
      checks: [
        { id: "org-schema", category: "Organization / LocalBusiness schema", points: 6, max: 8, status: "" },
        { id: "llms-txt", category: "llms.txt", points: 0, max: 0, status: "", scored: false },
        { id: "faq-markup", category: "FAQ markup (FAQPage)", points: 0, max: 0, status: "", scored: false },
      ],
    };
    const en = renderToStaticMarkup(createElement(ReadinessBreakdown, { audit: v3, locale: "en" }));
    expect(en.match(/not scored: no AI engine confirms using it/g)).toHaveLength(2);
    expect(en).not.toContain("0/0");
    expect(en).toContain("6/8");
    expect(en).toContain("Helps Google and Bing identify your business.");
    const de = renderToStaticMarkup(createElement(ReadinessBreakdown, { audit: v3, locale: "de-CH" }));
    expect(de).toContain("nicht bewertet");
    expect(de).toContain("Hilft Google und Bing");
  });
});

describe("history breaks at a version change", () => {
  it("draws one segment per version with a marker between them", () => {
    const html = renderToStaticMarkup(
      createElement(Sparkline, {
        points: [
          { score: 90, scoreVersion: 1 },
          { score: 92, scoreVersion: 1 },
          { score: 60, scoreVersion: 2 },
          { score: 63, scoreVersion: 2 },
        ],
        hint: "",
      }),
    );
    expect(html).toContain('data-segments="2"');
    expect(html.match(/<polyline/g)).toHaveLength(2);
    expect(html).toContain("stroke-dasharray");
  });

  it("the note names each change the history crosses", () => {
    expect(scoreVersionNote([1, 1, 2], "en")).toBe("Scoring updated Nov 2026: stricter on content and entity signals");
    expect(scoreVersionNote([2, 3], "en")).toBe("Scoring updated Nov 2026: llms.txt and FAQ markup are no longer scored");
    expect(scoreVersionNote([1, 2, 3], "fr")).toContain("plus exigeante");
    expect(scoreVersionNote([1, 2, 3], "fr")).toContain("ne sont plus notés");
    expect(scoreVersionNote([2, 3], "de-CH")).toContain("nicht mehr bewertet");
  });
});

describe("partner API", () => {
  it("reports the score version, the gates and v2 check ids", () => {
    const a = toPartnerAudit(
      {
        id: "a1",
        url: "https://acme.example",
        score: 45,
        grade: "D",
        scoreVersion: 2,
        createdAt: new Date("2026-11-07T00:00:00Z"),
        raw: {
          gates: [{ id: "thin-homepage", cap: 45, reason: "The homepage has under 150 words of main text (90)." }],
          checks: [{ id: "raw-content", category: "Main content in the raw HTML", points: 3, max: 6 }],
          robots: { present: true, bots: {} },
        },
      },
      "quick",
    );
    expect(a.scoreVersion).toBe(2);
    expect(a.gates[0]).toMatchObject({ id: "thin-homepage", cap: 45 });
    expect(a.checks[0].key).toBe("raw-content");
    const v1 = toPartnerAudit({ id: "a0", url: "u", score: 90, grade: "A", createdAt: new Date(), raw: {} }, "quick");
    expect(v1.scoreVersion).toBe(1);
    expect(v1.gates).toEqual([]);
  });
});
