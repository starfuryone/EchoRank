// src/lib/site-crawler/structure-view.ts
//
// The Structure tab's layouts (Phase 4c), computed in the browser from the 4a
// graph endpoint with d3-hierarchy and d3-force — nothing else from d3. Pure
// and DOM-free, so the tests run the same code the tab draws.
//
// Client-safe: no server imports. The node and tree shapes are restated here
// as types rather than imported from graph.ts, which is server-only.

import { hierarchy, stratify, tree, type HierarchyPointNode } from "d3-hierarchy";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";

export interface StructureNode {
  id: string;
  url: string;
  statusCode: number | null;
  indexable: boolean;
  depth: number;
  inlinks: number;
  /** Phase 4g: Link Score 0–100, when the crawl has it. */
  linkScore?: number | null;
}

export interface StructureDir {
  name: string;
  path: string;
  pages: number;
  pageId: string | null;
  children: StructureDir[];
}

export type NodeClass = "indexable" | "nonIndexable" | "error";

/** Error = no response or 4xx/5xx; indexable = 200 and not noindex; anything else (3xx, noindex) is non-indexable. */
export function nodeClass(n: Pick<StructureNode, "statusCode" | "indexable">): NodeClass {
  if (n.statusCode === null || n.statusCode >= 400) return "error";
  return n.indexable ? "indexable" : "nonIndexable";
}

/** Fill per class. Literal colours, not classes: an exported SVG has no stylesheet. */
export const NODE_FILL: Record<NodeClass, string> = {
  indexable: "#16a34a",
  nonIndexable: "#d97706",
  error: "#dc2626",
};

/** Radius from inlinks: 3 px for none, up to 12 px for the most-linked page (area ∝ inlinks). */
export function nodeRadius(inlinks: number, maxInlinks: number): number {
  if (maxInlinks <= 0 || inlinks <= 0) return 3;
  return 3 + 9 * Math.sqrt(Math.min(inlinks, maxInlinks) / maxInlinks);
}

/** Phase 4g: size by Link Score (0–100) when the crawl has it, by inlinks otherwise. */
export function nodeSize(n: Pick<StructureNode, "inlinks" | "linkScore">, maxInlinks: number): number {
  return n.linkScore === null || n.linkScore === undefined ? nodeRadius(n.inlinks, maxInlinks) : nodeRadius(n.linkScore, 100);
}

/** The Pages filter a click applies: the folder's URL prefix, or the page's own URL. */
export function prefixFor(origin: string, path: string): string {
  return path === "/" ? `${origin}/` : `${origin}${path}`;
}

// ── Directory tree ──────────────────────────────────────────────────────────

export interface DirView {
  dir: StructureDir;
  /** Has children the user closed. */
  closed: boolean;
  children: DirView[];
}

/** The directory tree with closed folders' children removed. */
export function openTree(dir: StructureDir, closed: ReadonlySet<string>): DirView {
  const visit = (d: StructureDir): DirView => {
    const isClosed = closed.has(d.path) && d.children.length > 0;
    return { dir: d, closed: isClosed, children: isClosed ? [] : d.children.map(visit) };
  };
  return visit(dir);
}

/** Folders open by default: the root and its direct children; deeper folders start closed. */
export function defaultClosed(dir: StructureDir, openDepth = 2): Set<string> {
  const out = new Set<string>();
  const walk = (d: StructureDir, level: number) => {
    if (level >= openDepth && d.children.length) out.add(d.path);
    d.children.forEach((c) => walk(c, level + 1));
  };
  walk(dir, 0);
  return out;
}

export interface TreeLayout<T> {
  nodes: { data: T; x: number; y: number; depth: number }[];
  links: { source: { x: number; y: number }; target: { x: number; y: number } }[];
  width: number;
  height: number;
}

const ROW = 22;
const COL = 180;

/** Horizontal tidy tree: depth runs left to right, one row per leaf. */
function layoutTree<T>(root: HierarchyPointNode<T> | null): TreeLayout<T> {
  if (!root) return { nodes: [], links: [], width: 0, height: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  root.each((n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  });
  // d3 lays out top-down (x across, y down); swap so depth runs across.
  const pad = 16;
  const nodes = root.descendants().map((n) => ({ data: n.data, x: n.y + pad, y: n.x - minX + pad, depth: n.depth }));
  const links = root.links().map((l) => ({
    source: { x: l.source.y + pad, y: l.source.x - minX + pad },
    target: { x: l.target.y + pad, y: l.target.x - minX + pad },
  }));
  return { nodes, links, width: maxY + COL + pad * 2, height: maxX - minX + pad * 2 + ROW };
}

export function layoutDirectory(view: DirView): TreeLayout<DirView> {
  return layoutTree(tree<DirView>().nodeSize([ROW, COL])(hierarchy(view)));
}

// ── Crawl tree ──────────────────────────────────────────────────────────────

export const CRAWL_TREE_ROOT = "__root";

/**
 * The BFS discovery tree. Pages whose parent is outside the node set (or the
 * start URL itself) hang off one synthetic root so stratify has a single root.
 */
export function layoutCrawlTree(nodes: (StructureNode & { parentId: string | null })[]): TreeLayout<StructureNode | null> {
  if (nodes.length === 0) return { nodes: [], links: [], width: 0, height: 0 };
  const ids = new Set(nodes.map((n) => n.id));
  const rows: { id: string; parentId: string | null; node: StructureNode | null }[] = [
    { id: CRAWL_TREE_ROOT, parentId: null, node: null },
    ...nodes.map((n) => ({ id: n.id, parentId: n.parentId && ids.has(n.parentId) && n.parentId !== n.id ? n.parentId : CRAWL_TREE_ROOT, node: n })),
  ];
  const strat = stratify<(typeof rows)[number]>()
    .id((r) => r.id)
    .parentId((r) => r.parentId)(rows);
  const laid = tree<(typeof rows)[number]>().nodeSize([ROW, COL])(strat);
  const out = layoutTree(laid);
  return { ...out, nodes: out.nodes.map((n) => ({ ...n, data: n.data.node })) };
}

// ── Internal-link graph ─────────────────────────────────────────────────────

export interface ForceNode extends SimulationNodeDatum {
  id: string;
  node: StructureNode;
  r: number;
}

export interface ForceLayout {
  nodes: ForceNode[];
  links: { source: ForceNode; target: ForceNode; nofollow: boolean }[];
  width: number;
  height: number;
}

/**
 * A static force layout: the simulation is ticked to rest here, synchronously,
 * then drawn once. 2,000 nodes animating live would pin a laptop's CPU for no
 * reading benefit. Deterministic for a given input (d3-force seeds its own
 * phyllotaxis start positions and LCG jiggle), so the export matches the screen.
 */
export function layoutLinks(
  nodes: StructureNode[],
  edges: { source: string; target: string; nofollow: boolean }[],
  opts: { size?: number; ticks?: number } = {},
): ForceLayout {
  const size = opts.size ?? 900;
  const maxIn = nodes.reduce((m, n) => Math.max(m, n.inlinks), 0);
  const fnodes: ForceNode[] = nodes.map((n) => ({ id: n.id, node: n, r: nodeRadius(n.inlinks, maxIn) }));
  const byId = new Map(fnodes.map((n) => [n.id, n]));
  const flinks = edges.filter((e) => e.source !== e.target && byId.has(e.source) && byId.has(e.target)).map((e) => ({ source: e.source, target: e.target, nofollow: e.nofollow }));
  const sim = forceSimulation<ForceNode>(fnodes)
    .force("charge", forceManyBody<ForceNode>().strength(-30).distanceMax(size / 2))
    .force("link", forceLink<ForceNode, { source: string | ForceNode; target: string | ForceNode; nofollow: boolean }>(flinks).id((d) => d.id).distance(30).strength(0.2))
    .force("collide", forceCollide<ForceNode>((d) => d.r + 1))
    .force("center", forceCenter(size / 2, size / 2))
    .stop();
  const ticks = opts.ticks ?? Math.min(300, Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())));
  for (let i = 0; i < ticks; i++) sim.tick();
  // Fit to the box.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of fnodes) {
    minX = Math.min(minX, (n.x ?? 0) - n.r);
    minY = Math.min(minY, (n.y ?? 0) - n.r);
    maxX = Math.max(maxX, (n.x ?? 0) + n.r);
    maxY = Math.max(maxY, (n.y ?? 0) + n.r);
  }
  const pad = 10;
  for (const n of fnodes) {
    n.x = (n.x ?? 0) - minX + pad;
    n.y = (n.y ?? 0) - minY + pad;
  }
  return {
    nodes: fnodes,
    links: flinks as unknown as ForceLayout["links"],
    width: Math.ceil(maxX - minX + pad * 2) || size,
    height: Math.ceil(maxY - minY + pad * 2) || size,
  };
}

// ── Export ──────────────────────────────────────────────────────────────────

/** A standalone SVG document from the drawn element's markup. */
export function svgDocument(markup: string): string {
  const withNs = markup.includes('xmlns="http://www.w3.org/2000/svg"') ? markup : markup.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${withNs}`;
}
