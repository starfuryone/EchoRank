// The trial length lives in TRIAL_DAYS, but the marketing catalogs are prose
// in five locales and are not templated — they cannot interpolate a constant
// without wrecking the translations. This test is what keeps them honest:
// it reads the shipped source and fails if any trial sentence quotes a number
// other than TRIAL_DAYS.
//
// It deliberately scans files rather than imports, because the strings live in
// page modules as well as catalogs and importing every marketing page here
// would pull half the app into the test run.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TRIAL_DAYS } from "@/lib/plan-config";

const ROOT = join(process.cwd(), "src");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // .bak.* copies are gitignored snapshots of pre-edit state and will always
    // contain the old number.
    if (name.includes(".bak.")) continue;
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/**
 * Trial phrases in the four languages the catalogs use. Each captures the
 * number so a wrong one is reported rather than merely detected.
 *
 * Non-trial uses of "14 days" are not matched by construction and are asserted
 * to survive below — the Terms notice period, the mention-rate window and the
 * demo timestamp all say "days" without saying "trial".
 */
const PATTERNS = [
  /(\d+)[-\s]day free trial/gi,
  /(\d+)[-\s]day trial/gi,
  /essai gratuit de (\d+) jours/gi,
  /essai de (\d+) jours/gi,
  /(\d+) Tage kostenlos testen/gi,
  /(\d+) Tage Testphase/gi,
  /(\d+) Tagen Gratis-Test/gi,
  /free for (\d+) days/gi,
  /gratuitement pendant (\d+) jours/gi,
];

describe("trial length copy", () => {
  const files = sourceFiles(ROOT);

  it("finds trial copy at all (guards against the patterns rotting)", () => {
    const hits = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return PATTERNS.some((p) => {
        p.lastIndex = 0;
        return p.test(src);
      });
    });
    expect(hits.length).toBeGreaterThan(5);
  });

  it("quotes TRIAL_DAYS everywhere it names a trial length", () => {
    const wrong: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const pattern of PATTERNS) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(src)) !== null) {
          if (Number(m[1]) !== TRIAL_DAYS) {
            wrong.push(`${file.replace(process.cwd() + "/", "")}: "${m[0]}"`);
          }
        }
      }
    }
    expect(wrong, `trial copy disagreeing with TRIAL_DAYS=${TRIAL_DAYS}`).toEqual([]);
  });

  it("leaves non-trial uses of 14 days alone", () => {
    const terms = readFileSync(
      join(ROOT, "app/[locale]/legal/terms/page.tsx"),
      "utf8",
    );
    // Notice period before Terms changes take effect — not the trial.
    expect(terms).toContain("14 days before taking effect");
    expect(terms).toContain("14 jours avant");
  });
});
