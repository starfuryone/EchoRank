// The Echorank AEO course — route table, metadata, JSON-LD and rendered pages.
// Follows tests/learn-content.test.ts + tests/learn-jsonld.test.ts: routes the
// config implies exist on disk and in the registry, structured data is derived
// from the config, and the HTML keeps the copy, CTA and accessibility rules in
// all five locales.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HubPage, { generateMetadata as hubMetadata } from "@/app/[locale]/learn/aeo/page";
import LessonPage, { generateMetadata as lessonMetadata, generateStaticParams } from "@/app/[locale]/learn/aeo/[lesson]/page";
import WorksheetPage, { generateMetadata as worksheetMetadata } from "@/app/[locale]/learn/aeo/worksheet/page";
import AllPage, { generateMetadata as allMetadata } from "@/app/[locale]/learn/aeo/all/page";
import ChapterPage from "@/app/[locale]/learn/[chapter]/page";
import { AEO_COURSE_ID, AEO_HUB_URL, aeoHubGraph, aeoLessonGraph, aeoLessonUrl } from "@/app/[locale]/learn/aeo/_shared/graph";
import { AEO_LESSONS, AEO_VIDEO_PROBE, aeoLessonPath, aeoLessonVideo, glanceRows, lessonMinutes } from "@/lib/aeo-course";
import { AEO_ALL, AEO_BASE, AEO_WORKSHEET, aeoRoutes } from "@/lib/aeo-course-routes";
import { ECHOPEDIA_SLUG, LEARN_CHAPTERS } from "@/lib/learn-content";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";

const APP = join(process.cwd(), "src", "app", "[locale]", "learn", "aeo");
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;
const hub = async (locale: string) => renderToStaticMarkup(await HubPage({ params: Promise.resolve({ locale }) }));
const lesson = async (locale: string, slug: string) => renderToStaticMarkup(await LessonPage({ params: Promise.resolve({ locale, lesson: slug }) }));
const FORBIDDEN = /EchoRank|Ahrefs|Semrush|Profound|Moz\b|transcript|source course|\d+(\.\d+)?\s?%/;

interface LdNode {
  "@type": string;
  "@id"?: string;
  [k: string]: unknown;
}
const nodes = (g: unknown) => JSON.parse(JSON.stringify(g)) as LdNode[];
const find = (g: LdNode[], type: string) => g.find((n) => n["@type"] === type)!;

describe("route table", () => {
  it("has the hub, the lesson route, the worksheet and the print view on disk", () => {
    for (const p of ["page.tsx", "[lesson]/page.tsx", "worksheet/page.tsx", "all/page.tsx"]) expect(existsSync(join(APP, p)), p).toBe(true);
  });

  it("cannot collide with /learn/[chapter]: no chapter, guide index or Echopedia is called aeo", () => {
    expect(LEARN_CHAPTERS.map((c) => c.slug)).not.toContain("aeo");
    expect(["guides", ECHOPEDIA_SLUG]).not.toContain("aeo");
    // And no lesson is named after a static sibling of the lesson route.
    expect(AEO_LESSONS.map((l) => l.slug)).not.toContain("worksheet");
    expect(AEO_LESSONS.map((l) => l.slug)).not.toContain("all");
  });

  it("registers the hub at 0.8 and each lesson at 0.6, once each; the noindex pages stay out", () => {
    expect(aeoRoutes()).toEqual([AEO_BASE, ...AEO_LESSONS.map((l) => aeoLessonPath(l.slug))]);
    for (const path of aeoRoutes()) {
      const hits = LOCALIZED_ROUTES.filter((r) => r.path === path);
      expect(hits, path).toHaveLength(1);
      expect(hits[0].priority, path).toBe(path === AEO_BASE ? 0.8 : 0.6);
      expect(KNOWN_MARKETING_PATHS).toContain(path);
    }
    for (const p of [AEO_WORKSHEET, AEO_ALL]) expect(LOCALIZED_ROUTES.some((r) => r.path === p), p).toBe(false);
  });

  it("generates every locale × lesson", () => {
    expect(generateStaticParams()).toHaveLength(SUPPORTED_LOCALES.length * AEO_LESSONS.length);
  });

  it("404s an unknown lesson and an unknown locale", async () => {
    await expect(LessonPage({ params: Promise.resolve({ locale: "en", lesson: "not-a-lesson" }) })).rejects.toThrow(NOT_FOUND);
    await expect(LessonPage({ params: Promise.resolve({ locale: "xx", lesson: "what-is-aeo" }) })).rejects.toThrow(NOT_FOUND);
    await expect(HubPage({ params: Promise.resolve({ locale: "xx" }) })).rejects.toThrow(NOT_FOUND);
  });

  it("leaves the existing chapters rendering", async () => {
    const html = renderToStaticMarkup(await ChapterPage({ params: Promise.resolve({ locale: "en", chapter: LEARN_CHAPTERS[0].slug }) }));
    expect(html).toContain(LEARN_CHAPTERS[0].title.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
  });
});

describe("metadata", () => {
  it("canonicals every locale to the en URL with the hreflang set", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const m = await hubMetadata({ params: Promise.resolve({ locale }) });
      expect(m.alternates?.canonical).toBe(AEO_HUB_URL);
      expect(Object.keys(m.alternates?.languages ?? {})).toEqual(expect.arrayContaining([...SUPPORTED_LOCALES, "x-default"]));
      for (const l of AEO_LESSONS) {
        const lm = await lessonMetadata({ params: Promise.resolve({ locale, lesson: l.slug }) });
        expect(lm.alternates?.canonical).toBe(aeoLessonUrl(l.slug));
        expect(lm.description).toBe(l.metaDescription);
      }
    }
  });

  it("noindexes the worksheet and the print view, canonical to the hub", async () => {
    for (const fn of [worksheetMetadata, allMetadata]) {
      const m = await fn({ params: Promise.resolve({ locale: "en" }) });
      expect(m.robots).toEqual({ index: false, follow: false });
      expect(m.alternates?.canonical).toBe(AEO_HUB_URL);
    }
  });
});

describe("JSON-LD", () => {
  it("describes the hub as a free, self-paced online Course with an ItemList and a BreadcrumbList", () => {
    const g = nodes(aeoHubGraph("en"));
    const course = find(g, "Course");
    expect(course["@id"]).toBe(AEO_COURSE_ID);
    expect(course.isAccessibleForFree).toBe(true);
    expect((course.offers as { price: number }).price).toBe(0);
    expect((course.hasCourseInstance as { courseMode: string }).courseMode).toBe("online");
    expect((course.provider as { "@id": string })["@id"]).toBe(find(g, "Organization")["@id"]);
    const list = find(g, "ItemList");
    expect((list.itemListElement as { url: string }[]).map((i) => i.url)).toEqual(AEO_LESSONS.map((l) => aeoLessonUrl(l.slug)));
    expect(find(g, "BreadcrumbList")).toBeTruthy();
    expect(g.some((n) => n["@type"] === "FAQPage")).toBe(false);
  });

  it("makes each lesson an Article that is part of the course, with no FAQPage", () => {
    for (const l of AEO_LESSONS) {
      const g = nodes(aeoLessonGraph(l, "en"));
      const art = find(g, "Article");
      expect(art.headline).toBe(l.title);
      expect(art.url).toBe(aeoLessonUrl(l.slug));
      expect((art.isPartOf as { "@id": string }[]).map((x) => x["@id"])).toContain(AEO_COURSE_ID);
      expect(g.some((n) => n["@type"] === "FAQPage")).toBe(false);
      const crumbs = find(g, "BreadcrumbList").itemListElement as { item: string }[];
      expect(crumbs.map((c) => c.item).slice(-2)).toEqual([AEO_HUB_URL, aeoLessonUrl(l.slug)]);
    }
  });

  it("parses as JSON out of the rendered page", async () => {
    const m = (await hub("fr")).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(JSON.parse(m![1])["@graph"].some((n: LdNode) => n["@type"] === "Course")).toBe(true);
  });
});

describe("rendered pages", () => {
  it("renders the hub: lesson cards, glance table with minutes, the hero loop and the CTA", async () => {
    const html = await hub("en");
    expect([...html.matchAll(/data-lesson="/g)]).toHaveLength(12);
    const glance = html.slice(html.indexOf('data-testid="aeo-glance"'), html.indexOf("</table>", html.indexOf('data-testid="aeo-glance"')));
    for (const r of glanceRows()) expect(glance).toContain(`>${r.minutes}</td>`);
    expect(html).toContain('id="g-mrca-loop-t"');
    expect(html).toContain('data-testid="aeo-start"');
    expect(html).toContain(`href="/en${AEO_WORKSHEET}"`);
    expect(html).toContain(`href="/en${AEO_ALL}"`);
  });

  it("renders each lesson's closing sequence and its graphic", async () => {
    for (const l of AEO_LESSONS) {
      const html = await lesson("en", l.slug);
      const order = ['id="takeaways"', 'id="practice"', 'id="check"', 'data-testid="aeo-tool-card"', 'aria-label="Course contents"'].map((s) => html.lastIndexOf(s));
      expect(order.every((v) => v > 0), l.slug).toBe(true);
      expect(order.slice(0, 4), l.slug).toEqual([...order.slice(0, 4)].sort((a, b) => a - b));
      expect([...html.matchAll(/type="radio"/g)].length, l.slug).toBeGreaterThanOrEqual(9);
      for (const b of l.body) if (b.k === "graphic") expect(html, `${l.slug} ${b.id}`).toContain(`data-graphic="g-${b.id}"`);
    }
  });

  it("puts the worksheet and the sales CTA at the end of the last lesson only", async () => {
    const last = await lesson("en", AEO_LESSONS[11].slug);
    expect(last).toContain('data-testid="aeo-cta"');
    expect(await lesson("en", AEO_LESSONS[0].slug)).not.toContain('data-testid="aeo-cta"');
  });

  it("keeps the copy, CTA and accessibility rules on every page in every locale", async () => {
    const pages: [(typeof SUPPORTED_LOCALES)[number], string, string][] = [];
    for (const locale of SUPPORTED_LOCALES) {
      pages.push([locale, "hub", await hub(locale)]);
      for (const l of AEO_LESSONS) pages.push([locale, l.slug, await lesson(locale, l.slug)]);
      pages.push([locale, "worksheet", renderToStaticMarkup(await WorksheetPage({ params: Promise.resolve({ locale }) }))]);
      pages.push([locale, "all", renderToStaticMarkup(await AllPage({ params: Promise.resolve({ locale }) }))]);
    }
    for (const [locale, name, html] of pages) {
      const tag = `${locale} ${name}`;
      // The copy rule applies to what a reader sees (and to every attribute's
      // words, checked below), not to CSS values like the shared nav's 100%.
      const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
      expect(text, tag).not.toMatch(FORBIDDEN);
      expect(html, tag).not.toMatch(/EchoRank|Ahrefs|Semrush|Profound|Moz\b|transcript|source course/);
      expect(html, tag).not.toContain('target="_blank"');
      expect(html, tag).not.toMatch(/href="\/[a-zA-Z-]*\/?register/);
      for (const svg of html.matchAll(/<svg[^>]*role="img"[^>]*>([\s\S]*?)<\/svg>/g)) expect(svg[1], tag).toMatch(/^<title id="[^"]+">[^<]+<\/title><desc id="[^"]+">[^<]+<\/desc>/);
      for (const table of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
        expect(table[0], tag).toMatch(/<caption>/);
        expect(table[0], tag).not.toMatch(/<th(?=[\s>])(?![^>]*scope=)[^>]*>/);
      }
      if (html.includes('data-testid="aeo-cta"')) {
        const cta = html.slice(html.indexOf('data-testid="aeo-cta"'), html.indexOf("</aside>", html.indexOf('data-testid="aeo-cta"')));
        expect(cta, tag).toContain(`href="/${locale}/pricing"`);
        expect(cta, tag).toContain(`href="/${locale}/free-audit"`);
        expect(cta, tag).toContain(HOME_PRICING_CHROME[locale].cancelAnytime.replace(/'/g, "&#x27;"));
      }
    }
    expect(pages.filter(([, , h]) => h.includes('data-testid="aeo-cta"')).length).toBe(SUPPORTED_LOCALES.length * 2);
  }, 120_000);
});

describe("lesson videos", () => {
  // What each lesson's video resolves to. Only `file` and `uploadDate` are in
  // the lesson; everything else here is derived (src/lib/aeo-course/video.ts).
  const EXPECTED = [
    {
      slug: "what-is-aeo",
      file: "aeo-what-is-aeo",
      uploadDate: "2026-11-13",
      durationSeconds: 103, // floored from ffprobe's 103.594 s
      duration: "PT1M43S",
      caption: "Prefer to watch? This 2-minute video covers the lesson.",
      minutes: 6,
    },
    {
      slug: "how-ai-answers-are-built",
      file: "aeo-02-how-ai-answers-are-built",
      uploadDate: "2026-11-14",
      durationSeconds: 154, // floored from ffprobe's 154.16 s
      duration: "PT2M34S",
      caption: "Prefer to watch? This 3-minute video covers the lesson.",
      minutes: lessonMinutes(AEO_LESSONS[1]),
    },
    {
      slug: "engines-compared",
      file: "aeo-03-engines-compared",
      uploadDate: "2026-11-15",
      durationSeconds: 151, // floored from ffprobe's 151.92 s
      duration: "PT2M31S",
      caption: "Prefer to watch? This 3-minute video covers the lesson.",
      minutes: lessonMinutes(AEO_LESSONS[2]),
    },
  ] as const;
  const byslug = (slug: string) => AEO_LESSONS.find((l) => l.slug === slug)!;

  it("are declared as a file name and a date, on lessons 1 to 3 only", () => {
    expect(AEO_LESSONS.filter((l) => l.video).map((l) => l.slug)).toEqual(EXPECTED.map((e) => e.slug));
    for (const e of EXPECTED) {
      expect(byslug(e.slug).video, e.slug).toEqual({ file: e.file, uploadDate: e.uploadDate });
    }
    // The lesson-1 video adds no words: the reading-time label stays put.
    expect(lessonMinutes(AEO_LESSONS[0])).toBe(6);
  });

  it("resolve paths from the file name, copy from the lesson, numbers from the probe", () => {
    for (const e of EXPECTED) {
      const l = byslug(e.slug);
      expect(aeoLessonVideo(l), e.slug).toEqual({
        src: `/videos/${e.file}-web.mp4`,
        poster: `/videos/${e.file}-poster.jpg`,
        title: l.title,
        description: l.summary,
        uploadDate: e.uploadDate,
        durationSeconds: e.durationSeconds,
        width: 1920,
        height: 1080,
      });
    }
    // Every declared file has a probe line, and the resolver refuses one without.
    for (const l of AEO_LESSONS.filter((x) => x.video)) expect(AEO_VIDEO_PROBE[l.video!.file], l.slug).toBeDefined();
    expect(() => aeoLessonVideo({ ...AEO_LESSONS[EXPECTED.length], video: { file: "aeo-99-missing", uploadDate: "2026-11-14" } })).toThrow(/AEO_VIDEO_PROBE/);
  });

  it("ship the web copy, the original and the poster under public/", () => {
    // Bundled assets, so this is the check that they are on the box.
    for (const e of EXPECTED) {
      for (const asset of [`/videos/${e.file}-web.mp4`, `/videos/${e.file}.mp4`, `/videos/${e.file}-poster.jpg`]) {
        const file = join(process.cwd(), "public", asset);
        expect(existsSync(file), asset).toBe(true);
        expect(statSync(file).size, asset).toBeGreaterThan(0);
      }
    }
  });

  it("commit the posters and keep the mp4 files out of git", () => {
    // The media backup copies mp4 and pdf only; a poster must live in git.
    for (const e of EXPECTED) {
      const ignored = (p: string) => spawnSync("git", ["check-ignore", "-q", p], { cwd: process.cwd() }).status === 0;
      expect(ignored(`public/videos/${e.file}-poster.jpg`), e.file).toBe(false);
      expect(ignored(`public/videos/${e.file}-web.mp4`), e.file).toBe(true);
      expect(ignored(`public/videos/${e.file}.mp4`), e.file).toBe(true);
    }
  });

  it.skipIf(spawnSync("ffprobe", ["-version"]).status !== 0)(
    "have probe lines that match ffprobe on the web copies, which are H.264/AAC, at most 1080p, moov first",
    () => {
      for (const l of AEO_LESSONS.filter((x) => x.video)) {
        const file = l.video!.file;
        const path = join(process.cwd(), "public", "videos", `${file}-web.mp4`);
        const probe = (args: string[]) =>
          spawnSync("ffprobe", ["-v", "error", ...args, "-of", "csv=p=0", path], { encoding: "utf8" }).stdout.trim();
        const [size, duration] = probe(["-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration"]).split("\n");
        const [width, height] = size.split(",").map(Number);
        const line = `  "${file}": { duration: ${Number(duration)}, width: ${width}, height: ${height} },`;
        expect(AEO_VIDEO_PROBE[file], `paste into AEO_VIDEO_PROBE:\n${line}`).toEqual({ duration: Number(duration), width, height });
        expect(height, file).toBeLessThanOrEqual(1080);
        expect(probe(["-select_streams", "v:0", "-show_entries", "stream=codec_name"]), file).toBe("h264");
        expect(probe(["-select_streams", "a:0", "-show_entries", "stream=codec_name"]), file).toBe("aac");
        // +faststart: the moov atom comes before the media data.
        const head = readFileSync(path).subarray(0, 1 << 20).toString("latin1");
        expect(head.indexOf("moov"), file).toBeGreaterThan(-1);
        expect(head.indexOf("moov"), file).toBeLessThan(head.indexOf("mdat"));
      }
    },
  );

  it("add one VideoObject with absolute URLs to each lesson's graph, and none elsewhere", () => {
    for (const e of EXPECTED) {
      const l = byslug(e.slug);
      const videos = nodes(aeoLessonGraph(l, "en")).filter((n) => n["@type"] === "VideoObject");
      expect(videos, e.slug).toHaveLength(1);
      const v = videos[0];
      expect(v["@id"]).toBe(`${aeoLessonUrl(l.slug)}#video`);
      expect(v.name).toBe(l.title);
      expect(v.description).toBe(l.summary);
      expect(v.contentUrl).toBe(`https://echorank360.com/videos/${e.file}-web.mp4`);
      expect(v.thumbnailUrl).toBe(`https://echorank360.com/videos/${e.file}-poster.jpg`);
      expect(v.duration).toBe(e.duration);
      expect(v.uploadDate).toBe(e.uploadDate);
      expect([v.width, v.height]).toEqual([1920, 1080]);
    }
    for (const l of AEO_LESSONS.filter((x) => !x.video)) {
      expect(nodes(aeoLessonGraph(l, "en")).some((n) => n["@type"] === "VideoObject"), l.slug).toBe(false);
    }
  });

  it("render the player under the summary and above 'In this lesson', in every locale", async () => {
    for (const e of EXPECTED) {
      const l = byslug(e.slug);
      for (const locale of SUPPORTED_LOCALES) {
        const html = await lesson(locale, l.slug);
        const tag = html.match(/<video[^>]*>/g) ?? [];
        expect(tag, `${e.slug} ${locale}`).toHaveLength(1);
        expect(tag[0]).toContain(`src="/videos/${e.file}-web.mp4"`);
        expect(tag[0]).toContain(`poster="/videos/${e.file}-poster.jpg"`);
        expect(tag[0]).toContain("controls");
        expect(tag[0]).toContain('preload="metadata"');
        expect(tag[0]).toMatch(/playsinline/i);
        expect(tag[0]).not.toMatch(/autoplay|muted/i);
        expect(html).toContain(`<figcaption>${e.caption}</figcaption>`);
        const at = html.indexOf("<video");
        // The summary is the lead under the H1 (searched from the H1, since the
        // JSON-LD before <main> carries it too).
        // Escaped as React writes text ("Google's" → "Google&#x27;s").
        const escaped = l.summary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
        const lead = html.indexOf(escaped, html.indexOf("<h1"));
        expect(lead, locale).toBeGreaterThan(html.indexOf("<h1"));
        expect(at, locale).toBeGreaterThan(lead);
        expect(at, locale).toBeLessThan(html.indexOf('id="objectives"'));
        const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)!;
        expect(JSON.parse(ld[1])["@graph"].filter((n: LdNode) => n["@type"] === "VideoObject"), locale).toHaveLength(1);
      }
    }
  });

  it("are hidden in print, and stay off lessons without one and the print view", async () => {
    for (const e of EXPECTED) {
      const html = await lesson("en", e.slug);
      const figure = html.slice(html.lastIndexOf("<figure", html.indexOf("<video")), html.indexOf("<video"));
      expect(figure, e.slug).toMatch(/class="[^"]*noPrint/);
    }
    // The first lesson after the ones that have a video.
    expect(await lesson("en", AEO_LESSONS[EXPECTED.length].slug)).not.toContain("<video");
    expect(renderToStaticMarkup(await AllPage({ params: Promise.resolve({ locale: "en" }) }))).not.toContain("<video");
  });
});
