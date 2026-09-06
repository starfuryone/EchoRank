// tests/theme-contrast.test.ts
//
// WCAG AA contrast for every text-token-on-surface-token pairing the marketing
// theme actually uses, in BOTH themes, computed from the values that ship in
// src/app/globals.css.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────
// A contrast failure is invisible to whoever introduced it: they chose the
// colour BECAUSE they could read it, on their monitor, at their brightness.
// The reader who cannot is somewhere else. This is the only check in the suite
// that can hold that line, and it holds it against the real file — edit a
// token and the arithmetic moves here.
//
// ── THE THRESHOLDS ARE NOT UNIFORM, AND EACH EXCEPTION IS NAMED ───────────
// Body text is 4.5:1. A pairing allowed to sit at 3:1 has to say which large
// or bold text it is for, on the line. There are exactly two, both inherited
// from the night palette that shipped long before this file and that must not
// move — the whole point of the theme work is that a visitor who never touches
// the toggle sees no change.

import { describe, expect, it } from "vitest";
import { AA_BODY, AA_LARGE, contrastRatio, readCssTokens } from "./support/contrast";

const CSS = "src/app/globals.css";

const night = readCssTokens(CSS, ":root");
const day = readCssTokens(CSS, '[data-theme="day"]');

/** Surfaces text is actually painted on, in paint order. */
const SURFACES = ["--er-bg", "--er-surface", "--er-surface2"] as const;

/** Text tokens that carry BODY copy — the full 4.5:1 bar, everywhere. */
const BODY_TEXT = [
  "--er-text",
  "--er-text-muted",
  "--er-link",
  "--er-accent-text",
  // Phase 2. Every one of these replaced a literal or a FILL token that was
  // being read as text somewhere in the marketing tree.
  "--er-kb-gold",
  "--er-kb-gold-hi",
  "--er-green-text",
  "--er-red-text",
  "--er-warn-text",
] as const;

function value(tokens: Record<string, string>, name: string): string {
  const found = tokens[name];
  expect(found, `${name} missing from ${CSS}`).toBeTruthy();
  return found;
}

describe("both themes define the whole semantic set", () => {
  // The set is closed on purpose: a text colour with no token is a text colour
  // that cannot follow the theme, and it goes invisible in one of the two.
  const REQUIRED = [
    "--er-bg",
    "--er-surface",
    "--er-surface2",
    "--er-line",
    "--er-line-soft",
    "--er-text",
    "--er-text-muted",
    "--er-text-faint",
    "--er-text-inverse",
    "--er-link",
    "--er-accent-text",
    "--er-placeholder",
    "--er-kb-gold",
    "--er-kb-gold-hi",
    "--er-green-text",
    "--er-red-text",
    "--er-warn-text",
  ] as const;

  it("night carries every token", () => {
    for (const token of REQUIRED) expect(night[token], token).toBeTruthy();
  });

  it("day overrides every one of them", () => {
    // A token defined only at :root keeps its NIGHT value in day — which for a
    // text colour means white text on a white page. Every one must be listed.
    for (const token of REQUIRED) expect(day[token], token).toBeTruthy();
  });
});

/**
 * Night pairings below the body bar, each named rather than excluded quietly.
 * Both are Binance red on a raised surface — #F6465D is 4.48:1 on #1E2329 and
 * 3.72:1 on #2B3139 — and both are pre-existing: this is the palette that has
 * shipped for months, used for delta figures and chip labels, which are bold.
 * Night must not move, so they are pinned where they actually sit rather than
 * "fixed" into a colour nobody asked for.
 */
const NIGHT_LARGE_ONLY = new Set([
  "--er-red-text|--er-surface",
  "--er-red-text|--er-surface2",
]);

describe("night — body text on every surface", () => {
  for (const text of BODY_TEXT) {
    for (const surface of SURFACES) {
      const large = NIGHT_LARGE_ONLY.has(`${text}|${surface}`);
      it(`${text} on ${surface}${large ? " (bold/large only — pre-existing)" : ""}`, () => {
        const ratio = contrastRatio(value(night, text), value(night, surface));
        expect(ratio).toBeGreaterThanOrEqual(large ? AA_LARGE : AA_BODY);
        // A pinned exception must not silently become compliant either: if it
        // improves, the line above is stale and should be deleted.
        if (large) expect(ratio).toBeLessThan(AA_BODY);
      });
    }
  }
});

describe("day — body text on every surface", () => {
  for (const text of BODY_TEXT) {
    for (const surface of SURFACES) {
      it(`${text} on ${surface}`, () => {
        expect(contrastRatio(value(day, text), value(day, surface))).toBeGreaterThanOrEqual(
          AA_BODY,
        );
      });
    }
  }
});

describe("faint text", () => {
  it("day clears the body bar on every surface", () => {
    // New values, so they were chosen to clear it. #767E8B — the floor that was
    // proposed — is 4.1:1 on white and fails outright; this is darker by
    // exactly as much as the arithmetic demanded.
    for (const surface of SURFACES) {
      expect(
        contrastRatio(value(day, "--er-text-faint"), value(day, surface)),
        surface,
      ).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("night clears the body bar on the page background", () => {
    // Where .label and the small print actually sit.
    expect(
      contrastRatio(value(night, "--er-text-faint"), value(night, "--er-bg")),
    ).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("night on the raised surface is large-text only, and that is pre-existing", () => {
    // #848E9C on #2B3139 is ~3.9:1. It is the palette that has shipped for
    // months, and night MUST NOT MOVE — a visitor who never touches the toggle
    // is entitled to see no change. Pinned at the bar it actually meets so the
    // number cannot quietly get worse, and recorded here rather than silently
    // excluded.
    const ratio = contrastRatio(value(night, "--er-text-faint"), value(night, "--er-surface2"));
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
    expect(ratio).toBeLessThan(AA_BODY);
  });
});

describe("gold is a fill, never text", () => {
  it("is theme-INVARIANT, so day must not override it", () => {
    // Gold is the brand, not a surface. It looks the same in both themes, and
    // the ink on it is dark in both — which is only true because day leaves
    // both alone. An override here would be a second gold to keep in step.
    expect(day["--er-gold"]).toBeUndefined();
    expect(day["--er-gold-deep"]).toBeUndefined();
    expect(day["--er-on-gold"]).toBeUndefined();
  });

  it("carries dark ink that clears the bar", () => {
    expect(
      contrastRatio(value(night, "--er-gold"), value(night, "--er-on-gold")),
    ).toBeGreaterThanOrEqual(AA_BODY);
    expect(
      contrastRatio(value(night, "--er-gold-deep"), value(night, "--er-on-gold")),
    ).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("fails as text on a day page, which is why --er-accent-text exists", () => {
    // The trap the accent token exists to prevent, asserted so nobody
    // "simplifies" it back to the brand yellow.
    expect(contrastRatio(night["--er-gold"], day["--er-bg"])).toBeLessThan(AA_BODY);
    expect(contrastRatio(night["--er-gold-deep"], day["--er-bg"])).toBeLessThan(AA_BODY);
    // And the token that replaced it clears the bar.
    expect(contrastRatio(day["--er-accent-text"], day["--er-bg"])).toBeGreaterThanOrEqual(
      AA_BODY,
    );
  });
});

describe("inverse text", () => {
  it("is readable on the surface it is meant for, in both themes", () => {
    // --er-text-inverse is for elements that keep the OPPOSITE surface: a dark
    // card in day, a light chip at night. In day that surface is the night bg;
    // at night it is the day bg.
    expect(contrastRatio(day["--er-text-inverse"], night["--er-bg"])).toBeGreaterThanOrEqual(
      AA_BODY,
    );
    expect(contrastRatio(night["--er-text-inverse"], day["--er-bg"])).toBeGreaterThanOrEqual(
      AA_BODY,
    );
  });
});

describe("placeholders", () => {
  it("clear the body bar — the classic invisible-on-white bug", () => {
    // Its own token because browsers do not inherit ::placeholder from the
    // input's colour, so a themed input with an unthemed placeholder is the
    // single easiest way to ship an invisible field.
    expect(
      contrastRatio(value(day, "--er-placeholder"), value(day, "--er-bg")),
    ).toBeGreaterThanOrEqual(AA_BODY);
    expect(
      contrastRatio(value(night, "--er-placeholder"), value(night, "--er-bg")),
    ).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("colours that must NOT follow the theme", () => {
  // Three families are invariant on purpose, and each has a different reason.
  it("gold, because it is the brand fill", () => {
    expect(day["--er-gold"]).toBeUndefined();
  });

  it("--er-media-*, because it is painted on video", () => {
    // Mute chips, play buttons, end-card overlays. The still behind them is
    // dark in day exactly as it is at night, so a themed value there is the
    // bug rather than the fix.
    for (const token of [
      "--er-media-well",
      "--er-media-scrim",
      "--er-media-scrim-strong",
      "--er-media-ink",
      "--er-media-text",
      "--er-media-text-muted",
    ]) {
      expect(night[token], token).toBeTruthy();
      expect(day[token], `${token} must not be overridden in day`).toBeUndefined();
    }
  });

  it("and the media text is readable on the media well", () => {
    expect(
      contrastRatio(value(night, "--er-media-text"), value(night, "--er-media-well")),
    ).toBeGreaterThanOrEqual(AA_BODY);
    expect(
      contrastRatio(value(night, "--er-media-text-muted"), value(night, "--er-media-well")),
    ).toBeGreaterThanOrEqual(AA_BODY);
    expect(
      contrastRatio(value(night, "--er-media-ink"), value(night, "--er-media-well")),
    ).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("status colours: the FILL and the TEXT are different tokens", () => {
  // --er-green / --er-red paint bar segments, left rules and icon washes; the
  // *-text pair are the same roles as type. They are equal at night by
  // construction — the homepage must not move — and diverge in day, where the
  // bright values are 1.9:1 and 3.6:1 on white.
  it("night: text token equals its fill token", () => {
    expect(night["--er-green-text"].toLowerCase()).toBe(night["--er-green"].toLowerCase());
    expect(night["--er-red-text"].toLowerCase()).toBe(night["--er-red"].toLowerCase());
    expect(night["--er-warn-text"].toLowerCase()).toBe(night["--er-gold-deep"].toLowerCase());
  });

  it("day: the fills stay bright and would fail as text", () => {
    expect(day["--er-green"]).toBeUndefined();
    expect(day["--er-red"]).toBeUndefined();
    expect(contrastRatio(night["--er-green"], day["--er-bg"])).toBeLessThan(AA_BODY);
    expect(contrastRatio(night["--er-red"], day["--er-bg"])).toBeLessThan(AA_BODY);
  });

  it("day: the text tokens clear the bar that the fills fail", () => {
    for (const token of ["--er-green-text", "--er-red-text", "--er-warn-text"]) {
      expect(
        contrastRatio(value(day, token), value(day, "--er-bg")),
        token,
      ).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});

describe("the Knowledge-Hub gold is a second gold, kept as one", () => {
  it("night keeps #c9a227 — /learn, /free-tools, /guides and /resources", () => {
    // Unifying it with brand gold would repaint four sections at night, which
    // is precisely what this work must not do.
    expect(night["--er-kb-gold"].toLowerCase()).toBe("#c9a227");
    expect(night["--er-kb-gold-hi"].toLowerCase()).toBe("#fff1a8");
  });

  it("day goes dark, because #c9a227 is 2.6:1 on white", () => {
    expect(contrastRatio(night["--er-kb-gold"], day["--er-bg"])).toBeLessThan(AA_BODY);
    expect(contrastRatio(day["--er-kb-gold"], day["--er-bg"])).toBeGreaterThanOrEqual(AA_BODY);
    // The hover tint is the worse of the two: a pale yellow on white.
    expect(contrastRatio(night["--er-kb-gold-hi"], day["--er-bg"])).toBeLessThan(AA_LARGE);
    expect(contrastRatio(day["--er-kb-gold-hi"], day["--er-bg"])).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("night is the default and does not move", () => {
  it("keeps the palette that shipped", () => {
    // The theme work must be invisible to anyone who never presses the toggle.
    // These are the values from home2.module.css before it was themed.
    expect(night["--er-bg"].toLowerCase()).toBe("#181a20");
    expect(night["--er-surface"].toLowerCase()).toBe("#1e2329");
    expect(night["--er-surface2"].toLowerCase()).toBe("#2b3139");
    expect(night["--er-text"].toLowerCase()).toBe("#eaecef");
    expect(night["--er-text-muted"].toLowerCase()).toBe("#b7bdc6");
    expect(night["--er-text-faint"].toLowerCase()).toBe("#848e9c");
    expect(night["--er-gold"].toLowerCase()).toBe("#fcd535");
    expect(night["--er-gold-deep"].toLowerCase()).toBe("#f0b90b");
  });
});
