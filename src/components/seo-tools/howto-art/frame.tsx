// The How-to pictograms' shared canvas: 120×80, decorative (aria-hidden,
// focusable="false"), no text. Strokes are currentColor (gray from the
// frame); <Accent> paints its children emerald. Original drawings: no
// screenshots, nothing that goes stale when the UI changes.

import type { ReactNode } from "react";

export function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      width={120}
      height={80}
      aria-hidden="true"
      focusable="false"
      data-howto-art={label}
      className="h-20 w-[120px] shrink-0 text-gray-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function Accent({ children }: { children: ReactNode }) {
  return <g className="text-emerald-600">{children}</g>;
}

/** A page-ish card: rounded rectangle. */
export const Card = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => <rect x={x} y={y} width={w} height={h} rx={4} />;

/** A text line stand-in. */
export const Line = ({ x, y, w }: { x: number; y: number; w: number }) => <path d={`M${x} ${y}h${w}`} />;
