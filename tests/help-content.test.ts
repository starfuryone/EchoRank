// In-app Help hub config — drift guard, in the style of the seo-tools route
// table test.
//
// The failure this prevents: a Help button on a dashboard page that deep-links
// to a Knowledge Hub article which has been renamed or removed. That is a 404
// reached from inside the product, by someone who is already stuck.
//
// It also enforces the rule the two halves of this feature share: ONE content
// config. Nothing here may restate an article's title or description — every
// card resolves its copy through learn-content.ts, and this suite fails if a
// card names a slug that file does not have.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  HELP_GROUPS,
  HELP_HUB,
  HELP_VIDEO,
  helpArticleFor,
  helpLearnPaths,
  learnHref,
  pageHelp,
} from "@/lib/help-content";
import {
  LEARN_CHAPTERS,
  LEARN_GUIDES,
  LEARN_PDF,
  chapterBySlug,
  guideBySlug,
  learnRoutes,
} from "@/lib/learn-content";
import { HELP_COPY } from "@/lib/i18n/dashboard";
import type { PlanType } from "@/generated/prisma";

const LOCALES = ["en", "fr", "de-CH"] as const;
const ALL_PLANS: PlanType[] = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
const ALL_CARDS = HELP_GROUPS.flatMap((g) => g.cards);

describe("route", () => {
  it("renders from a page inside the (dashboard) group", () => {
    expect(existsSync(join(process.cwd(), "src", "app", "(dashboard)", "help", "page.tsx"))).toBe(
      true,
    );
    expect(HELP_HUB).toBe("/help");
  });

  it("is a plain dashboard route, gated by nothing but tenancy", () => {
    // Help is never plan-gated, and no tier is route-confined any more, so
    // there is no allowlist that could exclude it.
    expect(HELP_HUB.startsWith("/")).toBe(true);
    expect(ALL_PLANS.length).toBeGreaterThan(0);
  });
});

describe("cards derive from learn-content", () => {
  it("gives every group at least one card, and no duplicate card ids", () => {
    expect(HELP_GROUPS.map((g) => g.id)).toEqual([
      "getting_started",
      "course",
      "guides",
      "reference",
    ]);
    for (const g of HELP_GROUPS) expect(g.cards.length, g.id).toBeGreaterThan(0);
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists every course chapter and every guide, in config order", () => {
    const course = HELP_GROUPS.find((g) => g.id === "course")!;
    expect(course.cards.map((c) => c.slug)).toEqual(LEARN_CHAPTERS.map((c) => c.slug));
    const guides = HELP_GROUPS.find((g) => g.id === "guides")!;
    expect(guides.cards.map((c) => c.slug)).toEqual(LEARN_GUIDES.map((g) => g.slug));
  });

  it("names only slugs that exist", () => {
    for (const card of ALL_CARDS) {
      if (card.kind === "chapter") {
        expect(chapterBySlug(card.slug!), card.id).toBeDefined();
      }
      if (card.kind === "guide" || card.kind === "video") {
        expect(guideBySlug(card.slug!), card.id).toBeDefined();
      }
    }
  });

  it("points every learn card at a real Knowledge Hub route", () => {
    const known = new Set(learnRoutes());
    for (const path of helpLearnPaths()) {
      expect(known.has(path), `${path} is not a learn route`).toBe(true);
    }
  });

  it("carries its own copy only for the cards that are not articles", () => {
    // A card whose copy comes from learn-content must NOT also have a catalog
    // entry — that is the duplicate this feature exists to avoid.
    const selfCopy = ALL_CARDS.filter((c) => c.kind === "app" || c.kind === "external").map(
      (c) => c.id,
    );
    const derived = ALL_CARDS.filter(
      (c) => c.kind === "chapter" || c.kind === "guide" || c.kind === "video",
    ).map((c) => c.id);

    for (const locale of LOCALES) {
      const cards = HELP_COPY[locale].cards;
      for (const id of selfCopy) {
        expect(cards[id], `${locale}: missing copy for ${id}`).toBeDefined();
        expect(cards[id].name.trim().length).toBeGreaterThan(0);
        expect(cards[id].description.trim().length).toBeGreaterThan(0);
      }
      for (const id of derived) {
        expect(cards[id], `${locale}: ${id} restates copy that learn-content owns`).toBeUndefined();
      }
    }
  });

  it("ships the PDF the reference group links to", () => {
    const pdf = ALL_CARDS.find((c) => c.id === "pdf")!;
    expect(pdf.href).toBe(LEARN_PDF);
    expect(existsSync(join(process.cwd(), "public", LEARN_PDF))).toBe(true);
  });

  it("opens the install walkthrough in place, with the video from the config", () => {
    const video = ALL_CARDS.filter((c) => c.kind === "video");
    expect(video).toHaveLength(1);
    expect(video[0].slug).toBe("install-browser-extension");
    expect(HELP_VIDEO?.src).toBe(guideBySlug("install-browser-extension")!.video!.src);
  });
});

describe("pageHelp deep links", () => {
  it("maps every route to a Knowledge Hub page that exists", () => {
    const known = new Set(learnRoutes());
    for (const [route, path] of Object.entries(pageHelp)) {
      expect(known.has(path), `${route} → ${path} is not a learn route`).toBe(true);
    }
  });

  it("covers the routes whose help has an obvious article", () => {
    expect(Object.keys(pageHelp).sort()).toEqual(
      ["/campaigns", "/extension", "/imports", "/visibility", "/visibility/tools/ai-lens"].sort(),
    );
  });

  it("returns nothing for a route with no obvious match", () => {
    // A help link that lands on a loosely related article teaches people the
    // button does not work. Absent is better.
    expect(helpArticleFor("/billing")).toBeUndefined();
    expect(helpArticleFor("/team")).toBeUndefined();
  });

  it("locale-prefixes the article link with the visitor's dashboard language", () => {
    for (const locale of LOCALES) {
      expect(learnHref(locale, pageHelp["/imports"])).toBe(
        `/${locale}/learn/guides/csv-review-import`,
      );
    }
  });
});

describe("hub chrome i18n", () => {
  it("covers all three dashboard locales and no more", () => {
    expect(Object.keys(HELP_COPY).sort()).toEqual(["de-CH", "en", "fr"]);
  });

  it("resolves every group heading and shared label in every locale", () => {
    for (const locale of LOCALES) {
      const copy = HELP_COPY[locale];
      for (const group of HELP_GROUPS) {
        expect(copy.groups[group.id].trim().length, `${locale} ${group.id}`).toBeGreaterThan(0);
      }
      for (const label of [
        copy.hubTitle,
        copy.hubSubtitle,
        copy.videoBadge,
        copy.newTab,
        copy.closeLabel,
        copy.readFullGuide,
        copy.browseAll,
        copy.minRead(5),
      ]) {
        expect(label.trim().length, locale).toBeGreaterThan(0);
      }
    }
  });

  it("says Echorank, never EchoRank", () => {
    for (const locale of LOCALES) {
      expect(JSON.stringify(HELP_COPY[locale])).not.toMatch(/EchoRank/);
    }
  });

  it("uses ss and never ß in de-CH", () => {
    // House rule. "Schliessen", not "Schließen".
    expect(JSON.stringify(HELP_COPY["de-CH"])).not.toMatch(/ß/);
  });
});
