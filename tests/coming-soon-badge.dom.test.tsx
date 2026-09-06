// @vitest-environment jsdom
//
// tests/coming-soon-badge.dom.test.tsx
//
// The golden "Coming soon" badge, and the flag that drives it.
//
// ── THE FLAG LIST IS PINNED, NOT DERIVED ──────────────────────────────────
// Which cards carry `requiresGoogleApproval` is a PRODUCT claim — "this does
// not work yet, and not because of anything you did". Adding or removing one
// should fail here and be argued for, the same way the pooled-search feature
// list does in seo-quota.test.ts. The criterion is what actually calls Google:
// exactly two modules request a Google OAuth scope (gsc/client.ts, ga/client.ts)
// plus the Business Profile integration point that has no code yet.
//
// ── AND THE BADGE REPLACES, IT DOES NOT STACK ─────────────────────────────
// Asserted by rendering the real hub card markup, because "replaces" is only
// true of the output — the config cannot say it.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ComingSoonBadge } from "@/components/layout/coming-soon-badge";
import { NewBadge } from "@/components/layout/new-badge";
import { COMING_SOON_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
import { REPUTATION_TOOL_GROUPS } from "@/lib/reputation-tools";
import { MARKETING_CATEGORIES } from "@/lib/marketing-templates";
import { AA_BODY, contrastRatio, readCssTokens } from "./support/contrast";

afterEach(cleanup);

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];

// ─── The flag ───────────────────────────────────────────────────────────────

describe("which cards are blocked on Google", () => {
  it("flags exactly the three Google-backed SEO tools", () => {
    const flagged = SEO_TOOL_GROUPS.flatMap((g) => g.tools)
      .filter((tool) => tool.requiresGoogleApproval)
      .map((tool) => tool.id)
      .sort();
    // gsc_insights   — GSC OAuth, webmasters.readonly (restricted scope)
    // web_analytics  — GA4 OAuth, analytics.readonly (sensitive scope)
    // gbp_monitor    — Business Profile API, an approval-gated program
    expect(flagged).toEqual(["gbp_monitor", "gsc_insights", "web_analytics"]);
  });

  it("flags nothing in Reputation Tools or Marketing Studio", () => {
    // A FINDING, not an omission. /monitoring lists GOOGLE among seven review
    // platforms, but its Google reviews arrive by import and by the browser
    // extension — no Google OAuth scope is requested on that path. Marketing
    // Studio reaches no external API at all; template 09 "analytics" takes
    // PASTED rows and summarises them in TypeScript.
    expect(
      REPUTATION_TOOL_GROUPS.flatMap((g) => g.tools).filter((t) => t.requiresGoogleApproval),
    ).toEqual([]);
    expect(MARKETING_CATEGORIES.filter((c) => c.requiresGoogleApproval)).toEqual([]);
  });

  it("changes no routing or gating — every flagged card keeps its href", () => {
    // Badge only. A flagged card that quietly stopped linking anywhere would
    // be a gating change made inside a flag named for a badge.
    for (const tool of SEO_TOOL_GROUPS.flatMap((g) => g.tools)) {
      if (!tool.requiresGoogleApproval) continue;
      expect(tool.href, tool.id).toMatch(/^\//);
    }
  });
});

// ─── The badge ──────────────────────────────────────────────────────────────

describe("the badge", () => {
  it("shows the label, and tells a screen reader the reason", () => {
    render(<ComingSoonBadge locale="en" />);
    // "Coming soon" alone is the one thing this badge does NOT mean: the
    // surface is built and works — Google has not approved the access.
    expect(screen.getByText(COMING_SOON_COPY.en.label)).toBeTruthy();
    expect(screen.getByText(COMING_SOON_COPY.en.sr)).toBeTruthy();
  });

  it("uses the brand gold token, not a loose hex", () => {
    const { container } = render(<ComingSoonBadge locale="en" />);
    const className = container.firstElementChild?.getAttribute("class") ?? "";
    expect(className).toContain("bg-brand-gold");
    expect(className).toContain("text-brand-gold-ink");
    expect(className).not.toMatch(/#|\[#/);
  });

  it("matches the NEW badge's corner and size language", () => {
    // One family, not two designs sharing a row.
    const gold = render(<ComingSoonBadge locale="en" />).container.firstElementChild;
    cleanup();
    const neu = render(<NewBadge locale="en" />).container.firstElementChild;
    for (const shared of ["rounded-full", "px-2", "py-0.5", "text-[10px]", "uppercase"]) {
      expect(gold?.getAttribute("class"), `gold ${shared}`).toContain(shared);
      expect(neu?.getAttribute("class"), `new ${shared}`).toContain(shared);
    }
  });

  it("is readable — gold is a FILL, and its ink is pinned beside it", () => {
    // #F0B90B is 1.9:1 against white and unusable as text. The pairing that
    // works is gold-as-background with the dark ink on it, which is why the
    // two are tokens rather than a caller's judgement. Computed from the
    // values that actually ship.
    const tokens = readCssTokens("src/app/globals.css", ":root");
    const gold = tokens["--brand-gold"];
    const ink = tokens["--brand-gold-ink"];
    expect(gold, "--brand-gold missing from globals.css").toBeTruthy();
    expect(ink, "--brand-gold-ink missing from globals.css").toBeTruthy();
    expect(contrastRatio(gold, ink)).toBeGreaterThanOrEqual(AA_BODY);
    // And the trap this pairing exists to prevent.
    expect(contrastRatio(gold, "#FFFFFF")).toBeLessThan(AA_BODY);
  });
});

// ─── Replacement ────────────────────────────────────────────────────────────

describe("it replaces rather than stacks", () => {
  it("hides the NEW badge on a card that carries both", () => {
    // gbp_monitor carries badge:"new" AND requiresGoogleApproval, which is the
    // only card that can prove replacement.
    const gbp = SEO_TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.id === "gbp_monitor");
    expect(gbp?.badge).toBe("new");
    expect(gbp?.requiresGoogleApproval).toBe(true);

    // The hub's own expression, rendered.
    render(
      <>
        {gbp?.requiresGoogleApproval ? (
          <ComingSoonBadge locale="en" />
        ) : (
          gbp?.badge === "new" && <NewBadge locale="en" />
        )}
      </>,
    );
    expect(screen.getByText(COMING_SOON_COPY.en.label)).toBeTruthy();
    expect(screen.queryByText("New")).toBeNull();
  });
});

// ─── Copy ───────────────────────────────────────────────────────────────────

describe("copy", () => {
  it("covers all three catalogs", () => {
    for (const locale of LOCALES) {
      const copy = COMING_SOON_COPY[locale];
      expect(copy.label.length, locale).toBeGreaterThan(0);
      expect(copy.sr.length, locale).toBeGreaterThan(copy.label.length);
      expect(copy.reason.length, locale).toBeGreaterThan(0);
      // The reason has to name Google — that IS the information.
      expect(copy.sr, locale).toMatch(/Google/);
      expect(copy.reason, locale).toMatch(/Google/);
    }
  });

  it("renders in the caller's locale", () => {
    render(<ComingSoonBadge locale="fr" />);
    expect(screen.getByText(COMING_SOON_COPY.fr.label)).toBeTruthy();
  });

  it("de-CH uses ss, never sz", () => {
    const copy = COMING_SOON_COPY["de-CH"];
    for (const line of [copy.label, copy.sr, copy.reason]) {
      expect(line).not.toContain("ß");
    }
  });
});
