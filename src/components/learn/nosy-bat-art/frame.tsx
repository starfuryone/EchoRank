// The crawler guide diagrams' shared canvas: 640×360, inline SVG, original
// line drawings — no screenshots, no raster, no third-party imagery.
//
// Unlike the dashboard's How-to pictograms (howto-art/), these DO carry text:
// they are explanatory figures, not decoration. So every one is role="img",
// named by its <title> and described by the visible caption under it
// (aria-describedby), and every label inside is authored en + fr in the same
// file as the drawing. de-CH and the other locales fold to en, like the rest
// of the Knowledge Hub chrome.
//
// Ids are derived from the art id, not useId(): each diagram appears once per
// page, and a stable id is what lets a test find the caption a figure names.

import type { ReactNode } from "react";
import a from "./art.module.css";

export type ArtBase = "en" | "fr";
export type ArtText = Record<ArtBase, string>;

export interface ArtSpec {
  title: ArtText;
  caption: ArtText;
  draw: (b: ArtBase) => ReactNode;
}

export function NbFigure({ id, spec, base }: { id: string; spec: ArtSpec; base: ArtBase }) {
  const titleId = `nb-art-${id}-title`;
  const capId = `nb-art-${id}-caption`;
  return (
    <figure className={a.figure} data-nb-art={id}>
      <svg
        className={a.svg}
        viewBox="0 0 640 360"
        width={640}
        height={360}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={capId}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title id={titleId}>{spec.title[base]}</title>
        {spec.draw(base)}
      </svg>
      <figcaption id={capId} className={a.caption}>
        {spec.caption[base]}
      </figcaption>
    </figure>
  );
}

type Tone = "muted" | "accent" | "red" | "amber";
const LINE: Record<Tone, string> = { muted: a.arrow, accent: a.accentLine, red: a.redLine, amber: a.amberLine };
const HEAD: Record<Tone, string> = { muted: a.arrowHead, accent: a.accentHead, red: a.redHead, amber: a.amberHead };

/** A straight arrow from (x1,y1) to (x2,y2) with a filled head. */
export function Arrow({ x1, y1, x2, y2, tone = "muted" }: { x1: number; y1: number; x2: number; y2: number; tone?: Tone }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const L = 10;
  const W = 5;
  const bx = x2 - L * Math.cos(ang);
  const by = y2 - L * Math.sin(ang);
  const p = (dx: number, dy: number) => `${(bx + dx).toFixed(1)},${(by + dy).toFixed(1)}`;
  const nx = -Math.sin(ang) * W;
  const ny = Math.cos(ang) * W;
  return (
    <g>
      <path className={LINE[tone]} d={`M${x1} ${y1}L${bx.toFixed(1)} ${by.toFixed(1)}`} />
      <polygon className={HEAD[tone]} points={`${x2},${y2} ${p(nx, ny)} ${p(-nx, -ny)}`} />
    </g>
  );
}

/** A rounded card. */
export function Box({ x, y, w, h, r = 10, cls = a.card }: { x: number; y: number; w: number; h: number; r?: number; cls?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} className={cls} />;
}

/** A text line stand-in inside a card. */
export function Bar({ x, y, w }: { x: number; y: number; w: number }) {
  return <path className={a.line} d={`M${x} ${y}h${w}`} />;
}

/** A pill with centred text. */
export function Chip({ x, y, w, h = 28, text, cls = a.accent, textCls = a.tSm, mono = false }: {
  x: number; y: number; w: number; h?: number; text: string; cls?: string; textCls?: string; mono?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} className={cls} />
      <text x={x + w / 2} y={y + h / 2 + 4.5} textAnchor="middle" className={`${textCls}${mono ? ` ${a.mono}` : ""}`}>
        {text}
      </text>
    </g>
  );
}

export { a as artStyles };
