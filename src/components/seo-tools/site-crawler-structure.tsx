"use client";

// The Structure tab (Phase 4c): directory tree, crawl tree and internal-link
// graph from the 4a graph endpoint, laid out in the browser with d3-hierarchy
// and d3-force (src/lib/site-crawler/structure-view.ts). Loaded lazily — the
// client imports it through next/dynamic, so d3 never ships with Overview.
//
// Drawn as plain SVG with literal colours, so "Export SVG" is the element's
// own markup and "Export PNG" rasterises that same markup.

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import {
  NODE_FILL,
  defaultClosed,
  layoutCrawlTree,
  layoutDirectory,
  layoutLinks,
  nodeClass,
  nodeSize,
  openTree,
  prefixFor,
  svgDocument,
  type StructureDir,
  type StructureNode,
} from "@/lib/site-crawler/structure-view";

export type StructureView = "directory" | "crawl-tree" | "links";

type GraphResponse =
  | { kind: "directory"; nodes: StructureNode[]; tree: StructureDir }
  | { kind: "crawl-tree"; nodes: (StructureNode & { parentId: string | null })[] }
  | { kind: "links"; nodes: StructureNode[]; edges: { source: string; target: string; nofollow: boolean }[]; truncated: boolean };

const FOLDER_FILL = "#94a3b8";
const EDGE = "#cbd5e1";
const INK = "#111827";
const BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-300";

/** The graph endpoint's query for a view and segment. */
export function graphQuery(view: StructureView, segment: string | null): string {
  const q = new URLSearchParams({ kind: view });
  if (segment !== null) q.set("segment", segment);
  return q.toString();
}

function download(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Rasterise the SVG at 2× on a white background, capped at 8,192 px a side. */
function exportPng(svg: SVGSVGElement, name: string) {
  const w = Number(svg.getAttribute("width")) || 800;
  const h = Number(svg.getAttribute("height")) || 600;
  const scale = Math.min(2, 8192 / Math.max(w, h));
  const url = URL.createObjectURL(new Blob([svgDocument(svg.outerHTML)], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => b && download(b, name), "image/png");
  };
  img.src = url;
}

export default function StructurePanel({
  crawlId,
  rootUrl,
  segment = null,
  purged = false,
  onFilterPages,
  t,
  int,
}: {
  crawlId: string;
  rootUrl: string;
  segment?: string | null;
  purged?: boolean;
  /** A click: open Pages filtered to URLs starting with this. */
  onFilterPages: (urlPrefix: string) => void;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}) {
  const c = t.p4c;
  const [view, setView] = useState<StructureView>("directory");
  const [data, setData] = useState<{ key: string; body: GraphResponse | null } | null>(null);
  const [closed, setClosed] = useState<{ key: string; set: Set<string> } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const key = `${view}|${segment ?? ""}`;
  const origin = useMemo(() => {
    try {
      return new URL(rootUrl).origin;
    } catch {
      return "";
    }
  }, [rootUrl]);

  useEffect(() => {
    if (purged) return;
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/graph?${graphQuery(view, segment)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: GraphResponse | null) => {
        if (!cancelled) setData({ key, body });
      })
      .catch(() => {
        if (!cancelled) setData({ key, body: null });
      });
    return () => {
      cancelled = true;
    };
  }, [crawlId, view, segment, key, purged]);

  const body = data?.key === key ? data.body : undefined;
  const dirTree = body?.kind === "directory" ? body.tree : null;
  const closedSet = useMemo(
    () => (dirTree ? (closed?.key === key ? closed.set : defaultClosed(dirTree)) : new Set<string>()),
    [dirTree, closed, key],
  );
  const toggle = (path: string) => {
    const next = new Set(closedSet);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setClosed({ key, set: next });
  };

  const drawing = useMemo(() => {
    if (!body) return null;
    if (body.kind === "links") return { kind: "links" as const, ...layoutLinks(body.nodes, body.edges) };
    if (body.kind === "crawl-tree") return { kind: "crawl-tree" as const, ...layoutCrawlTree(body.nodes) };
    return { kind: "directory" as const, ...layoutDirectory(openTree(body.tree, closedSet)), byId: new Map(body.nodes.map((n) => [n.id, n])) };
  }, [body, closedSet]);

  const maxIn = body ? body.nodes.reduce((m, n) => Math.max(m, n.inlinks), 0) : 0;
  const filename = (ext: string) => `site-structure-${view}.${ext}`;
  const pageTitle = (n: StructureNode) => c.stTooltip(n.url, int.format(n.inlinks), int.format(n.depth));
  const activate = (fn: () => void) => ({
    role: "button",
    tabIndex: 0,
    style: { cursor: "pointer" },
    onClick: fn,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn();
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-60">
            <Select
              aria-label={c.stViewLabel}
              value={view}
              onChange={(e) => setView(e.target.value as StructureView)}
              options={[
                { value: "directory", label: c.stViewDirectory },
                { value: "crawl-tree", label: c.stViewCrawlTree },
                { value: "links", label: c.stViewLinks },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            {(["indexable", "nonIndexable", "error"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NODE_FILL[k] }} aria-hidden="true" />
                {k === "indexable" ? c.stLegendIndexable : k === "nonIndexable" ? c.stLegendNonIndexable : c.stLegendError}
              </span>
            ))}
            <span>{c.stSizeNote}</span>
            <button type="button" className={BTN} disabled={!drawing} onClick={() => svgRef.current && download(new Blob([svgDocument(svgRef.current.outerHTML)], { type: "image/svg+xml" }), filename("svg"))}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {c.stExportSvg}
            </button>
            <button type="button" className={BTN} disabled={!drawing} onClick={() => svgRef.current && exportPng(svgRef.current, filename("png"))}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {c.stExportPng}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {purged ? (
          <p className="text-sm text-gray-500">{c.stPurged}</p>
        ) : body === undefined ? (
          <p className="text-sm text-gray-500">{c.stLoading}</p>
        ) : !drawing || drawing.nodes.length === 0 ? (
          <p className="text-sm text-gray-500">{c.stEmpty}</p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {c.stNodesNote(int.format(body!.nodes.length))} {c.stHelp}
            </p>
            {body?.kind === "links" && body.truncated && <p className="text-xs text-gray-500">{c.stTruncated}</p>}
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-100">
              <svg
                ref={svgRef}
                xmlns="http://www.w3.org/2000/svg"
                width={drawing.width}
                height={drawing.height}
                viewBox={`0 0 ${drawing.width} ${drawing.height}`}
                fontFamily="system-ui, sans-serif"
                fontSize={11}
              >
                <rect width={drawing.width} height={drawing.height} fill="#ffffff" />
                {drawing.kind === "links" ? (
                  <>
                    <g stroke={EDGE} strokeOpacity={0.6}>
                      {drawing.links.map((l, i) => (
                        <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} strokeDasharray={l.nofollow ? "2 2" : undefined} />
                      ))}
                    </g>
                    {drawing.nodes.map((n) => (
                      <circle key={n.id} cx={n.x} cy={n.y} r={n.r} fill={NODE_FILL[nodeClass(n.node)]} {...activate(() => onFilterPages(n.node.url))}>
                        <title>{pageTitle(n.node)}</title>
                      </circle>
                    ))}
                  </>
                ) : (
                  <>
                    <g fill="none" stroke={EDGE}>
                      {drawing.links.map((l, i) => (
                        <path key={i} d={`M${l.source.x},${l.source.y}C${(l.source.x + l.target.x) / 2},${l.source.y} ${(l.source.x + l.target.x) / 2},${l.target.y} ${l.target.x},${l.target.y}`} />
                      ))}
                    </g>
                    {drawing.kind === "directory"
                      ? drawing.nodes.map(({ data: v, x, y }) => {
                          const page = v.dir.pageId ? drawing.byId.get(v.dir.pageId) : undefined;
                          const hasKids = v.dir.children.length > 0;
                          return (
                            <g key={v.dir.path} transform={`translate(${x},${y})`}>
                              <g {...activate(() => onFilterPages(prefixFor(origin, v.dir.path)))}>
                                <circle r={page ? nodeSize(page, maxIn) : 4} fill={page ? NODE_FILL[nodeClass(page)] : FOLDER_FILL} />
                                <text x={14} dy="0.32em" fill={INK}>
                                  {v.dir.name} ({int.format(v.dir.pages)})
                                </text>
                                <title>{page ? pageTitle(page) : c.stFolderTooltip(v.dir.path, int.format(v.dir.pages))}</title>
                              </g>
                              {hasKids && (
                                <g transform="translate(-14,0)" {...activate(() => toggle(v.dir.path))} aria-label={c.stToggle(v.dir.name, !v.closed)}>
                                  <rect x={-5} y={-5} width={10} height={10} rx={2} fill="#ffffff" stroke={FOLDER_FILL} />
                                  <text textAnchor="middle" dy="0.32em" fontSize={10} fill={INK}>
                                    {v.closed ? "+" : "−"}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })
                      : drawing.nodes.map(({ data: n, x, y }) =>
                          n ? (
                            <g key={n.id} transform={`translate(${x},${y})`} {...activate(() => onFilterPages(n.url))}>
                              <circle r={nodeSize(n, maxIn)} fill={NODE_FILL[nodeClass(n)]} />
                              <text x={14} dy="0.32em" fill={INK}>
                                {n.url.replace(origin, "") || "/"}
                              </text>
                              <title>{pageTitle(n)}</title>
                            </g>
                          ) : (
                            <circle key="root" cx={x} cy={y} r={4} fill={FOLDER_FILL} />
                          ),
                        )}
                  </>
                )}
              </svg>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
