// The package's 24 × 24 stroke icons, drawn from their shapes. No config
// import (only a type, which is erased), so the hub's client-side filter can
// render card icons without pulling src/lib/prompt-guides.ts into the bundle.

import type { IconShape } from "@/lib/prompt-guides";

export function IconShapes({ shapes }: { shapes: readonly IconShape[] }) {
  return (
    <>
      {shapes.map((s, i) =>
        s.el === "path" ? (
          <path key={i} d={s.d} />
        ) : s.el === "rect" ? (
          <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />
        ) : (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
        ),
      )}
    </>
  );
}

/** Decorative: the card's heading names the industry. */
export function GuideIcon({ shapes, size = 22 }: { shapes: readonly IconShape[]; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <IconShapes shapes={shapes} />
    </svg>
  );
}
