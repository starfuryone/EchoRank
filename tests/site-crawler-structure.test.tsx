// @vitest-environment jsdom
//
// tests/site-crawler-structure.test.tsx — Phase 4c Structure tab: the pure
// layouts (d3-hierarchy / d3-force), the export document, and the panel in
// every dashboard locale, including the click-through to Pages.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import {
  CRAWL_TREE_ROOT,
  NODE_FILL,
  defaultClosed,
  layoutCrawlTree,
  layoutDirectory,
  layoutLinks,
  nodeClass,
  nodeRadius,
  openTree,
  prefixFor,
  svgDocument,
  type StructureDir,
  type StructureNode,
} from "@/lib/site-crawler/structure-view";
import StructurePanel, { graphQuery } from "@/components/seo-tools/site-crawler-structure";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const node = (id: string, over: Partial<StructureNode> = {}): StructureNode => ({
  id,
  url: `https://x.com/${id}`,
  statusCode: 200,
  indexable: true,
  depth: 1,
  inlinks: 1,
  ...over,
});
const dir = (path: string, children: StructureDir[] = [], pageId: string | null = null): StructureDir => ({
  name: path === "/" ? "/" : path.split("/").pop()!,
  path,
  pages: 1 + children.reduce((n, c) => n + c.pages, 0),
  pageId,
  children,
});

describe("node colour and size", () => {
  it.each([
    [200, true, "indexable"],
    [200, false, "nonIndexable"],
    [301, false, "nonIndexable"],
    [404, false, "error"],
    [503, false, "error"],
    [null, false, "error"],
  ] as const)("status %s indexable=%s → %s", (statusCode, indexable, want) => {
    expect(nodeClass({ statusCode, indexable })).toBe(want);
    expect(NODE_FILL[want]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each([
    [0, 10, 3],
    [10, 10, 12],
    [20, 10, 12],
    [5, 0, 3],
  ])("radius(%i of max %i) = %i", (inlinks, max, r) => {
    expect(nodeRadius(inlinks, max)).toBeCloseTo(r);
  });

  it("prefixFor: the root folder is the origin with a slash", () => {
    expect(prefixFor("https://x.com", "/")).toBe("https://x.com/");
    expect(prefixFor("https://x.com", "/blog")).toBe("https://x.com/blog");
  });
});

describe("directory tree", () => {
  const t = dir("/", [dir("/blog", [dir("/blog/a"), dir("/blog/b", [dir("/blog/b/c")])]), dir("/shop")], "root");

  it("opens the root and its children by default, closes deeper folders", () => {
    expect([...defaultClosed(t)].sort()).toEqual(["/blog/b"]);
  });

  it("a closed folder's children are not laid out; opening one adds them", () => {
    const closed = layoutDirectory(openTree(t, new Set(["/blog"])));
    expect(closed.nodes.map((n) => n.data.dir.path)).toEqual(["/", "/blog", "/shop"]);
    expect(closed.nodes.find((n) => n.data.dir.path === "/blog")!.data.closed).toBe(true);
    const open = layoutDirectory(openTree(t, new Set()));
    expect(open.nodes).toHaveLength(6);
    expect(open.links).toHaveLength(5);
    // Depth runs left to right.
    const x = (p: string) => open.nodes.find((n) => n.data.dir.path === p)!.x;
    expect(x("/") < x("/blog") && x("/blog") < x("/blog/b") && x("/blog/b") < x("/blog/b/c")).toBe(true);
  });
});

describe("crawl tree", () => {
  it("hangs pages without a parent in the set off one synthetic root", () => {
    const l = layoutCrawlTree([
      { ...node("r", { depth: 0 }), parentId: null },
      { ...node("a"), parentId: "r" },
      { ...node("b", { depth: 2 }), parentId: "missing" },
      { ...node("s"), parentId: "s" },
    ]);
    expect(l.nodes).toHaveLength(5);
    expect(l.nodes.filter((n) => n.data === null)).toHaveLength(1);
    expect(l.links).toHaveLength(4);
    expect(CRAWL_TREE_ROOT).toBe("__root");
    expect(layoutCrawlTree([])).toEqual({ nodes: [], links: [], width: 0, height: 0 });
  });
});

describe("internal-link graph", () => {
  const nodes = Array.from({ length: 40 }, (_, i) => node(`n${i}`, { inlinks: 40 - i }));
  const edges = [
    ...nodes.slice(1).map((n, i) => ({ source: n.id, target: nodes[i]!.id, nofollow: false })),
    { source: "n1", target: "gone", nofollow: false },
    { source: "n2", target: "n2", nofollow: false },
  ];

  it("drops edges to nodes outside the set and self-links; fits every node in the box", () => {
    const l = layoutLinks(nodes, edges, { ticks: 50 });
    expect(l.nodes).toHaveLength(40);
    expect(l.links).toHaveLength(39);
    for (const n of l.nodes) {
      expect(n.x! - n.r).toBeGreaterThanOrEqual(0);
      expect(n.y! - n.r).toBeGreaterThanOrEqual(0);
      expect(n.x! + n.r).toBeLessThanOrEqual(l.width);
      expect(n.y! + n.r).toBeLessThanOrEqual(l.height);
    }
    expect(l.nodes[0]!.r).toBeCloseTo(12);
  });

  it("is deterministic, so the export matches the screen", () => {
    const a = layoutLinks(nodes, edges, { ticks: 30 });
    const b = layoutLinks(nodes, edges, { ticks: 30 });
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
  });
});

describe("export and query", () => {
  it("svgDocument adds the XML prolog and the namespace once", () => {
    expect(svgDocument('<svg width="1"></svg>')).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1"></svg>');
    expect(svgDocument('<svg xmlns="http://www.w3.org/2000/svg"></svg>').match(/xmlns=/g)).toHaveLength(1);
  });

  it("graphQuery carries the segment only when one is picked", () => {
    expect(graphQuery("links", null)).toBe("kind=links");
    expect(graphQuery("directory", "2")).toBe("kind=directory&segment=2");
  });
});

describe("StructurePanel", () => {
  const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
  const int = new Intl.NumberFormat("en-US");
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    host?.remove();
    host = null;
    vi.unstubAllGlobals();
  });

  async function mount(l: DashLocale, body: unknown, onFilterPages = vi.fn(), segment: string | null = null) {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<StructurePanel crawlId="c1" rootUrl="https://x.com/" segment={segment} onFilterPages={onFilterPages} t={SITE_CRAWLER_COPY[l]} int={int} />);
    });
    await act(async () => {});
    return { fetchMock, onFilterPages };
  }

  it.each(LOCALES)("%s: directory view draws folders, a click filters Pages to the folder", async (l) => {
    const tree = dir("/", [dir("/blog", [dir("/blog/a", [], "a")])], "r");
    const { fetchMock, onFilterPages } = await mount(l, { kind: "directory", nodes: [node("r", { url: "https://x.com/" }), node("a", { url: "https://x.com/blog/a", statusCode: 404, indexable: false })], tree }, vi.fn(), "1");
    expect(fetchMock).toHaveBeenCalledWith("/api/seo/v1/crawl/c1/graph?kind=directory&segment=1");
    const c = SITE_CRAWLER_COPY[l].p4c;
    expect(host!.textContent).toContain(c.stViewDirectory);
    expect(host!.textContent).not.toMatch(/undefined|NaN/);
    expect(host!.querySelectorAll("svg circle").length).toBe(3);
    const blog = [...host!.querySelectorAll('svg [role="button"]')].find((g) => g.textContent?.startsWith("blog"))!;
    await act(async () => (blog as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onFilterPages).toHaveBeenCalledWith("https://x.com/blog");
  });

  it("links view: one circle per page coloured by class, the tooltip carries URL, inlinks and depth", async () => {
    const nodes = [node("a", { inlinks: 4, depth: 0 }), node("b", { statusCode: 500, indexable: false })];
    const { onFilterPages } = await mount("en", { kind: "links", nodes, edges: [{ source: "b", target: "a", nofollow: true }], truncated: true });
    // The panel opens on the directory view; this body is what the endpoint returned for it.
    const circles = host!.querySelectorAll("svg circle");
    expect(circles).toHaveLength(2);
    expect([...circles].map((c) => c.getAttribute("fill"))).toEqual([NODE_FILL.indexable, NODE_FILL.error]);
    expect(circles[0]!.querySelector("title")!.textContent).toBe("https://x.com/a\n4 inlinks · depth 0");
    expect(host!.textContent).toContain(SITE_CRAWLER_COPY.en.p4c.stTruncated);
    expect(host!.querySelector("line")!.getAttribute("stroke-dasharray")).toBe("2 2");
    await act(async () => circles[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onFilterPages).toHaveBeenCalledWith("https://x.com/b");
  });

  it("a purged crawl says so and fetches nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host!).render(<StructurePanel crawlId="c1" rootUrl="https://x.com/" purged onFilterPages={() => {}} t={SITE_CRAWLER_COPY.en} int={int} />);
    });
    expect(host.textContent).toContain(SITE_CRAWLER_COPY.en.p4c.stPurged);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
