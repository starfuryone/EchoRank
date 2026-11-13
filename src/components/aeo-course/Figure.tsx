// The frame every course graphic uses: an animated wrapper (Reveal) around a
// role="img" SVG with a <title> and a <desc>, scaled by its viewBox. Server
// component; the SVG itself is server-rendered.

import type { ReactNode } from "react";
import { Reveal } from "./motion";
import css from "./aeo.module.css";

export function Figure({
  id,
  title,
  desc,
  width,
  height,
  wide,
  hero,
  caption,
  children,
}: {
  id: string;
  title: string;
  desc: string;
  width: number;
  height: number;
  wide?: boolean;
  hero?: boolean;
  caption?: string;
  children: ReactNode;
}) {
  const cls = [css.fig, wide ? css.figWide : "", hero ? css.figHero : ""].filter(Boolean).join(" ");
  return (
    <figure className={css.figure} data-graphic={id}>
      <Reveal>
        <svg className={cls} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t ${id}-d`} focusable="false">
          <title id={`${id}-t`}>{title}</title>
          <desc id={`${id}-d`}>{desc}</desc>
          {children}
        </svg>
      </Reveal>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Greedy word wrap for SVG text, which does not wrap on its own. */
export function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && `${line} ${w}`.length > max) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

export function Lines({ x, y, lines, lh, size, className, anchor, weight }: { x: number; y: number; lines: string[]; lh: number; size: number; className: string; anchor?: "start" | "middle" | "end"; weight?: number }) {
  return (
    <text x={x} y={y} fontSize={size} className={className} textAnchor={anchor} fontWeight={weight}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i ? lh : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}
