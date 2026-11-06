// The free audit's verdicts in fr / de-CH (src/lib/i18n/audit-verdicts.ts) and
// the AI Search overview's citation-gap panel copy (CITATION_GAP_PANEL_COPY).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_VERDICT_COPY,
  AUDIT_VERDICT_KEYS,
  localizeAuditVerdict,
  type AuditVerdict,
} from "@/lib/i18n/audit-verdicts";
import { CITATION_GAP_PANEL_COPY } from "@/lib/i18n/dashboard";

const ROOT = join(__dirname, "..");
const SIDECAR = "/opt/echorank/av-service/free_audit_checks.py";

/** One verdict per key, with params shaped like the sidecar's. */
const SAMPLES: Record<string, Omit<AuditVerdict, "id" | "title" | "detail" | "fix">> = {
  "robots.blocked": { pass: false, key: "robots.blocked", params: { token: "GPTBot" } },
  "robots.partial": { pass: true, key: "robots.partial", params: { token: "CCBot", paths: "/x/" } },
  "robots.allowed": { pass: true, key: "robots.allowed", params: { token: "ClaudeBot" } },
  "robots.none": { pass: true, key: "robots.none", params: { token: "PerplexityBot" } },
  "signal.blocks": { pass: false, key: "signal.blocks", params: { signals: "ai-input=no", managed: true } },
  "signal.ok": { pass: true, key: "signal.ok", params: { signals: "search=yes", managed: false } },
  "signal.none": { pass: true, key: "signal.none", params: {} },
  "cloudflare.detected": { pass: null, key: "cloudflare.detected", params: { found: ["cf-ray", "managed-robots"] } },
  "cloudflare.none": { pass: true, key: "cloudflare.none", params: { found: [] } },
  "llms.missing": { pass: false, key: "llms.missing", params: {} },
  "llms.invalid": { pass: false, key: "llms.invalid", params: { problems: ["html", "links"] } },
  "llms.valid": { pass: true, key: "llms.valid", params: { links: 1 } },
  "js.flagged": { pass: false, key: "js.flagged", params: { textLen: 40, framework: "React" } },
  "js.ok": { pass: true, key: "js.ok", params: { textLen: 4000, framework: "" } },
  "nap.none": { pass: false, key: "nap.none", params: {} },
  "nap.single": { pass: false, key: "nap.single", params: { only: "footer" } },
  "nap.match": { pass: true, key: "nap.match", params: { sources: ["schema", "footer", "contact"], name: "Acme" } },
  "nap.differ": { pass: false, key: "nap.differ", params: { what: "phones", sources: ["schema", "footer"] } },
  "answer.ok": { pass: true, key: "answer.ok", params: { have: ["questions", "lists", "date"], missing: [] } },
  "answer.weak": { pass: false, key: "answer.weak", params: { have: [], missing: ["questions", "faq", "lists"] } },
};
const verdict = (key: string): AuditVerdict => ({
  id: key, title: `EN title ${key}`, detail: `EN detail ${key}`, fix: SAMPLES[key]!.pass === true ? "" : `EN fix ${key}`,
  ...SAMPLES[key]!,
});

describe("audit verdicts in fr / de-CH", () => {
  it("covers every key the sidecar emits", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...AUDIT_VERDICT_KEYS].sort());
    for (const loc of ["fr", "de-CH"] as const) {
      expect(Object.keys(AUDIT_VERDICT_COPY[loc].verdicts).sort()).toEqual([...AUDIT_VERDICT_KEYS].sort());
    }
  });

  it.skipIf(!existsSync(SIDECAR))("matches the sidecar's VERDICT_KEYS", () => {
    const py = readFileSync(SIDECAR, "utf8");
    const block = py.slice(py.indexOf("VERDICT_KEYS = ("), py.indexOf(")", py.indexOf("VERDICT_KEYS = (")));
    const keys = [...block.matchAll(/"([a-z]+\.[a-z]+)"/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...AUDIT_VERDICT_KEYS].sort());
  });

  it("renders every key with no English left, a fix only when not passing, and no ß in de-CH", () => {
    for (const loc of ["fr", "de-CH"] as const) {
      for (const key of AUDIT_VERDICT_KEYS) {
        const v = localizeAuditVerdict(verdict(key), loc);
        expect(v.title, `${loc} ${key}`).not.toMatch(/^EN /);
        expect(v.detail, `${loc} ${key}`).not.toMatch(/^EN |undefined|\[object/);
        if (v.pass === true) expect(v.fix).toBe("");
        else expect(v.fix, `${loc} ${key}`).toMatch(/\S/);
        if (loc === "de-CH") expect(`${v.title} ${v.detail} ${v.fix}`).not.toContain("ß");
      }
    }
  });

  it("English and unknown keys keep the sidecar's text", () => {
    const v = verdict("nap.none");
    expect(localizeAuditVerdict(v, "en")).toBe(v);
    const odd = { ...v, key: "future.check" };
    expect(localizeAuditVerdict(odd, "fr")).toBe(odd);
    const old = { ...v, key: undefined, params: undefined };
    expect(localizeAuditVerdict(old, "de-CH")).toBe(old);
  });

  it("says the Cloudflare advice and fills params", () => {
    const fr = localizeAuditVerdict(verdict("cloudflare.detected"), "fr");
    expect(fr.detail).toBe("Cloudflare détecté (un en-tête cf-ray, un robots.txt géré par Cloudflare).");
    expect(fr.fix).toContain("Security → Bots → Block AI bots");
    expect(fr.pass).toBeNull();
    const de = localizeAuditVerdict(verdict("cloudflare.detected"), "de-CH");
    expect(de.fix).toBe(
      "Wenn Sie Cloudflare nutzen, prüfen Sie Security → Bots → Block AI bots; diese Einstellung können wir von aussen nicht sehen.",
    );
    expect(localizeAuditVerdict(verdict("nap.match"), "fr").detail).toBe(
      "Le même téléphone apparaît dans les données structurées, le pied de page et la page de contact pour Acme.",
    );
    expect(localizeAuditVerdict(verdict("robots.blocked"), "de-CH").title).toBe("OpenAI GPTBot (Training) kann Ihre Website lesen");
    expect(localizeAuditVerdict(verdict("llms.valid"), "fr").detail).toBe("/llms.txt est valide (1 lien).");
  });
});

describe("citation-gap panel copy", () => {
  it("has every string and source type in en, fr and de-CH", () => {
    const en = CITATION_GAP_PANEL_COPY.en;
    for (const loc of ["fr", "de-CH"] as const) {
      const c = CITATION_GAP_PANEL_COPY[loc];
      expect(Object.keys(c).sort()).toEqual(Object.keys(en).sort());
      expect(Object.keys(c.types).sort()).toEqual(Object.keys(en.types).sort());
      expect(c.title).not.toBe(en.title);
      if (loc === "de-CH") expect(JSON.stringify(c)).not.toContain("ß");
    }
  });

  it("the overview renders the panel from the catalog, not inline English", () => {
    const src = readFileSync(join(ROOT, "src/app/(dashboard)/visibility/ai-search/overview-client.tsx"), "utf8");
    expect(src).toContain("CITATION_GAP_PANEL_COPY[locale]");
    for (const s of ['"Citation gap"', "Named instead of you", "Nothing to close", "GAP_TYPE_LABEL"]) expect(src).not.toContain(s);
    const page = readFileSync(join(ROOT, "src/app/(dashboard)/visibility/ai-search/page.tsx"), "utf8");
    expect(page).toMatch(/locale=\{dashboardLocale\(/);
  });
});
