// @vitest-environment jsdom
//
// tests/nosy-bat-intro-video.test.tsx — the crawler intro video on
// /[locale]/site-crawler (#video): the section right after the hero, in
// en / fr / de-CH; the <video> with its poster, preload="none", muted, no
// autoplay, and the two WebVTT tracks (both parse, same timings, inside the
// video's length); the VideoObject JSON-LD; the links to it from the homepage
// card, the Help modal and the guides index; the off-box media list.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/site-crawler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
}));

import { NB_INTRO_ANCHOR, NB_INTRO_VIDEO } from "@/lib/site-crawler/intro-video";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { TwoCrawlers } from "@/app/[locale]/TwoCrawlers";
import CrawlerHelpModal from "@/components/seo-tools/site-crawler-help";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { HOME_TOOLS } from "@/lib/i18n/content";
import { SITE_URL } from "@/lib/seo";

const ROOT = join(__dirname, "..");
const LOCALES = ["en", "fr", "de-CH"] as const;
const P = (locale: string) => ({ params: Promise.resolve({ locale }) });
const doc = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};
const page = async (l: string) => {
  const Page = (await import("@/app/[locale]/site-crawler/page")).default;
  return renderToStaticMarkup(await Page(P(l) as never));
};
const graph = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]!);
    return (data["@graph"] ?? [data]) as Record<string, unknown>[];
  });

describe.each(LOCALES)("%s", (l) => {
  it("the section sits right after the hero and before the capabilities, with its copy", async () => {
    const el = doc(await page(l));
    const sections = [...el.querySelectorAll("section")];
    const at = sections.findIndex((x) => x.id === NB_INTRO_ANCHOR);
    expect(at).toBeGreaterThan(0);
    expect(sections[at - 1]!.querySelector('[data-testid="hero-lockup"]')).not.toBeNull();
    expect(sections[at + 1]!.id).toBe("reports");
    const sec = sections[at]!;
    const fr = l === "fr";
    expect(sec.querySelector("p b")!.textContent).toBe(fr ? `Découvrez ${CRAWLER_BRAND.name}` : `Meet ${CRAWLER_BRAND.name}`);
    expect(sec.querySelector("h2")!.textContent).toBe(fr ? "Deux minutes, toutes les fonctionnalités." : "Two minutes, every feature.");
    expect(sec.textContent).toContain(fr ? "Vous préférez lire ? La liste complète des fonctionnalités est juste en dessous." : "Prefer reading? The full feature list is just below.");
    // The player's mute caption, and the signed-out CTA to /pricing.
    expect(sec.textContent).toContain(HOME_TOOLS[l].player.caption);
    expect(sec.querySelector(`a[href="/${l}/pricing"]`)).not.toBeNull();
  });

  it("the <video>: poster, preload=none, muted, no autoplay, the two tracks (none on by default)", async () => {
    const el = doc(await page(l));
    const v = el.querySelector(`section#${NB_INTRO_ANCHOR} video`)!;
    expect(v.getAttribute("src")).toBe(NB_INTRO_VIDEO.src);
    expect(v.getAttribute("poster")).toBe(NB_INTRO_VIDEO.poster);
    expect(v.getAttribute("preload")).toBe("none");
    expect(v.hasAttribute("muted")).toBe(true);
    expect(v.hasAttribute("autoplay")).toBe(false);
    const tracks = [...v.querySelectorAll("track")];
    expect(tracks.map((t) => [t.getAttribute("src"), t.getAttribute("srclang")])).toEqual([
      ["/videos/nosy-bat-intro.en.vtt", "en"],
      ["/videos/nosy-bat-intro.fr.vtt", "fr"],
    ]);
    expect(tracks.some((t) => t.hasAttribute("default"))).toBe(false);
  });

  it("VideoObject JSON-LD: name, description, absolute poster and file, upload date, duration", async () => {
    const node = graph(await page(l)).find((n) => n["@type"] === "VideoObject")!;
    expect(node).toBeDefined();
    expect(node).toMatchObject({
      thumbnailUrl: `${SITE_URL}${NB_INTRO_VIDEO.poster}`,
      contentUrl: `${SITE_URL}${NB_INTRO_VIDEO.src}`,
      uploadDate: "2026-11-05",
      duration: "PT3M16S",
    });
    expect(String(node.name)).toContain(CRAWLER_BRAND.name);
    expect(String(node.description).length).toBeGreaterThan(40);
  });

  it("the Help modal links to the video", async () => {
    const t = SITE_CRAWLER_COPY[l];
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    await act(async () => root.render(createElement(CrawlerHelpModal, { t, locale: l, quota: null, guideHref: "/g", allGuidesHref: "/gs", onClose: () => {} })));
    await vi.waitFor(() => expect(document.querySelector('[data-testid="help-watch-intro"]')).not.toBeNull());
    const a = document.querySelector('[data-testid="help-watch-intro"]')!;
    expect(a.getAttribute("href")).toBe(`/${l}/site-crawler#video`);
    expect(a.textContent).toBe({ en: "Watch the intro", fr: "Voir la présentation", "de-CH": "Intro ansehen" }[l]);
    act(() => root.unmount());
    el.remove();
    vi.unstubAllGlobals();
  });

  it("the homepage card and the guides index link to it", async () => {
    const home = doc(renderToStaticMarkup(TwoCrawlers({ locale: l, sectionNumber: "01" })));
    const w = home.querySelector('[data-testid="two-crawlers-watch"]')!;
    expect(w.getAttribute("href")).toBe(`/${l}/site-crawler#video`);
    expect(w.textContent).toBe(l === "fr" ? "Voir la présentation de 2 minutes" : "Watch the 2-minute intro");
    // Card B only, and no video on the homepage itself.
    expect(w.closest("article")!.querySelector("img")!.getAttribute("src")).toBe(CRAWLER_BRAND.logoOnDark);
    expect(home.querySelector("video")).toBeNull();
    const Guides = (await import("@/app/[locale]/learn/guides/page")).default;
    const g = doc(renderToStaticMarkup(await Guides(P(l) as never)));
    const a = g.querySelector('[data-testid="guides-watch-intro"]')!;
    expect(a.getAttribute("href")).toBe(`/${l}/site-crawler#video`);
    expect(a.closest('[data-testid="nosy-bat-guides"]')).not.toBeNull();
  });
});

describe("the WebVTT tracks", () => {
  const cues = (file: string) => {
    const text = readFileSync(join(ROOT, "public/videos", file), "utf8");
    expect(text.startsWith("WEBVTT\n")).toBe(true);
    const ts = (s: string) => {
      const m = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(s);
      expect(m, s).not.toBeNull();
      return Number(m![1]) * 3600 + Number(m![2]) * 60 + Number(m![3]) + Number(m![4]) / 1000;
    };
    return text
      .trim()
      .split(/\n\n+/)
      .slice(1)
      .map((block) => {
        const lines = block.split("\n");
        const timing = lines.find((x) => x.includes("-->"))!;
        const [a, b] = timing.split(" --> ");
        return { start: ts(a!), end: ts(b!), text: lines.slice(lines.indexOf(timing) + 1).join("\n") };
      });
  };

  it("both parse: one cue per scene, in order, inside the video's 195.584 s, the same timings in English and French", () => {
    const en = cues("nosy-bat-intro.en.vtt");
    const fr = cues("nosy-bat-intro.fr.vtt");
    expect(en).toHaveLength(15);
    expect(fr.map((c) => [c.start, c.end])).toEqual(en.map((c) => [c.start, c.end]));
    expect(en[0]!.start).toBe(0);
    for (let i = 0; i < en.length; i++) {
      expect(en[i]!.end).toBeGreaterThan(en[i]!.start);
      if (i > 0) expect(en[i]!.start).toBe(en[i - 1]!.end);
      expect(en[i]!.text.trim().length).toBeGreaterThan(0);
      expect(fr[i]!.text.trim().length).toBeGreaterThan(0);
    }
    expect(en.at(-1)!.end).toBeLessThanOrEqual(195.584);
    expect(NB_INTRO_VIDEO.durationSeconds).toBe(196);
  });
});

it("the intro is on the off-box media list (scripts/untracked-media.txt)", () => {
  const list = readFileSync(join(ROOT, "scripts/untracked-media.txt"), "utf8");
  expect(list).toContain("public/videos/nosy-bat-intro*.mp4");
  expect(list).toContain("public/videos/nosy-bat-intro*.jpg");
});
