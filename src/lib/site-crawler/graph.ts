// src/lib/site-crawler/graph.ts
//
// The Structure tab's data (Phase 4a endpoint, drawn in 4c): three views of a
// crawl, each bounded by `limit` nodes (≤ 2,000) so the browser can lay them
// out with d3-hierarchy / d3-force.
//
//   directory   — URL paths as a tree: host → /blog → /blog/2026 → pages.
//                 Folders carry how many pages sit under them.
//   crawl-tree  — the BFS discovery tree (crawl_pages.parentPageId).
//   links       — the internal-link graph among the most-linked pages.
//
// Nodes are chosen by depth then inlinks, so the top of each structure is
// always present and a parent is in the set before its children.

import "server-only";
import { prisma } from "@/lib/prisma";

export const GRAPH_KINDS = ["directory", "crawl-tree", "links"] as const;
export type GraphKind = (typeof GRAPH_KINDS)[number];
export const GRAPH_MAX_NODES = 2_000;
/** Edges returned for the links view, at most. */
export const GRAPH_MAX_EDGES = 20_000;

export interface GraphNode {
  id: string;
  url: string;
  statusCode: number | null;
  /** 200 and not noindex. */
  indexable: boolean;
  depth: number;
  inlinks: number;
}

export interface DirNode {
  name: string;
  /** Path up to here, "/" for the host. */
  path: string;
  /** Pages at or under this path, among the nodes returned. */
  pages: number;
  /** The page at exactly this path, when it was crawled. */
  pageId: string | null;
  children: DirNode[];
}

interface Row {
  id: string;
  url: string;
  statusCode: number | null;
  noindex: boolean | null;
  depth: number;
  inlinkCount: number | null;
  parentPageId: string | null;
}

const toNode = (r: Row): GraphNode => ({
  id: r.id,
  url: r.url,
  statusCode: r.statusCode,
  indexable: r.statusCode === 200 && r.noindex !== true,
  depth: r.depth,
  inlinks: r.inlinkCount ?? 0,
});

/** Pure: a directory tree from page URLs. Query strings are part of the leaf name. */
export function directoryTree(rows: Pick<Row, "id" | "url">[]): DirNode {
  const root: DirNode = { name: "/", path: "/", pages: 0, pageId: null, children: [] };
  for (const r of rows) {
    let u: URL;
    try {
      u = new URL(r.url);
    } catch {
      continue;
    }
    const segments = u.pathname.split("/").filter(Boolean);
    if (u.search) {
      if (segments.length) segments[segments.length - 1] += u.search;
      else segments.push(u.search);
    }
    let node = root;
    node.pages++;
    let path = "";
    for (const seg of segments) {
      path += `/${seg}`;
      let child = node.children.find((c) => c.name === seg);
      if (!child) {
        child = { name: seg, path, pages: 0, pageId: null, children: [] };
        node.children.push(child);
      }
      child.pages++;
      node = child;
    }
    node.pageId = r.id;
  }
  return root;
}

/** Pure: parent links kept only when the parent is in the set (the rest hang off the root). */
export function crawlTree(rows: Row[]): (GraphNode & { parentId: string | null })[] {
  const ids = new Set(rows.map((r) => r.id));
  return rows.map((r) => ({ ...toNode(r), parentId: r.parentPageId && ids.has(r.parentPageId) ? r.parentPageId : null }));
}

async function topPages(jobId: string, limit: number, order: "depth" | "inlinks", segment: number | null): Promise<Row[]> {
  return prisma.crawlPage.findMany({
    // Phase 4c: the segment filter narrows the node set; the links view keeps
    // only edges between nodes in it.
    where: { crawlJobId: jobId, ...(segment === null ? {} : { segmentIds: { has: segment } }) },
    orderBy: order === "depth" ? [{ depth: "asc" }, { inlinkCount: "desc" }, { id: "asc" }] : [{ inlinkCount: "desc" }, { depth: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, url: true, statusCode: true, noindex: true, depth: true, inlinkCount: true, parentPageId: true },
  });
}

export async function crawlGraph(jobId: string, kind: GraphKind, limit: number, segment: number | null = null) {
  const n = Math.max(1, Math.min(GRAPH_MAX_NODES, limit));
  if (kind === "directory") {
    const rows = await topPages(jobId, n, "depth", segment);
    return { kind, nodes: rows.map(toNode), tree: directoryTree(rows) };
  }
  if (kind === "crawl-tree") {
    return { kind, nodes: crawlTree(await topPages(jobId, n, "depth", segment)) };
  }
  // links: the most-linked pages and the edges among them.
  const rows = await topPages(jobId, n, "inlinks", segment);
  const ids = rows.map((r) => r.id);
  const edges = await prisma.crawlLink.findMany({
    where: { crawlJobId: jobId, fromPageId: { in: ids }, toPageId: { in: ids } },
    take: GRAPH_MAX_EDGES,
    select: { fromPageId: true, toPageId: true, nofollow: true },
  });
  return {
    kind,
    nodes: rows.map(toNode),
    edges: edges.map((e) => ({ source: e.fromPageId, target: e.toPageId!, nofollow: e.nofollow })),
    truncated: edges.length >= GRAPH_MAX_EDGES,
  };
}
