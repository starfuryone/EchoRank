// Animation class names and a delay helper for the course graphics. A plain
// module (not "use client") so server-rendered SVG can use the real values;
// the trigger lives in motion.tsx.

import type { CSSProperties } from "react";
import css from "./aeo.module.css";

/** The CSS module hashes these names, so they are read from it, never typed. */
export const A = {
  draw: css["a-draw"],
  fade: css["a-fade"],
  pop: css["a-pop"],
  growY: css["a-growY"],
  growX: css["a-growX"],
  slide: css["a-slide"],
  collapse: css["a-collapse"],
  pulse: css["a-pulse"],
  warn: css["a-warn"],
  travel: css["a-travel"],
};

/** Inline custom properties: --d (the delay) plus any others a keyframe reads. */
export function delay(seconds: number, extra?: Record<string, string>): CSSProperties {
  return { ["--d" as string]: `${seconds}s`, ...(extra ?? {}) } as CSSProperties;
}
