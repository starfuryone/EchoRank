// The Echorank AI Visibility sub-brand on a page (src/lib/ai-visibility/brand.ts).
//
//   <AiVisibilityLogo>  the logo as an <img> of the SVG, explicit width/height
//                       at 2056:518. surface "dark" / "light", or "themed" for
//                       the public pages (dark by default, light under
//                       [data-theme="day"]: the light file is added, shown only
//                       there, and decorative, so one accessible name).
//   <AvEmblem>          the gold emblem, square, decorative.
//   <AvEmblemIcon>      the currentColor emblem in an icon slot (the sidebar, the
//                       top bar): painted through a CSS mask filled with
//                       currentColor, since an <img> cannot take the page's
//                       colour; the file is used as-is.
//
// No hooks, no server imports: Server and Client Components both use these.

import type { CSSProperties } from "react";
import { AV_BRAND, avLogoWidthAt } from "@/lib/ai-visibility/brand";
import l from "./ai-visibility-logo.module.css";

export function AiVisibilityLogo({
  height,
  alt = AV_BRAND.name,
  surface,
  className,
  testId,
}: {
  height: number;
  /** "" makes it decorative. */
  alt?: string;
  surface: "dark" | "light" | "themed";
  className?: string;
  testId?: string;
}) {
  const width = avLogoWidthAt(height);
  const img = (src: string, a: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG at a fixed size; next/image adds nothing
    <img className={cls} src={src} width={width} height={height} alt={a} aria-hidden={a === "" ? true : undefined} decoding="async" />
  );
  return (
    <span className={[l.wrap, className].filter(Boolean).join(" ")} data-testid={testId} data-av-logo="">
      {surface === "light" && img(AV_BRAND.logoOnLight, alt, l.img)}
      {surface === "dark" && img(AV_BRAND.logoOnDark, alt, l.img)}
      {surface === "themed" && (
        <>
          {img(AV_BRAND.logoOnDark, alt, `${l.img} ${l.night}`)}
          {img(AV_BRAND.logoOnLight, "", `${l.img} ${l.day}`)}
        </>
      )}
    </span>
  );
}

export function AvEmblem({ size, className }: { size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG at a fixed size
    <img className={className} src={AV_BRAND.emblem} width={size} height={size} alt="" aria-hidden="true" data-av-emblem="" />
  );
}

const MASK = `url("${AV_BRAND.emblemCurrent}") center / contain no-repeat`;
const MASK_STYLE: CSSProperties = { display: "inline-block", backgroundColor: "currentColor", mask: MASK, WebkitMask: MASK };

/** lucide's shape (a className), so it drops into an icon slot; size from the className. */
export function AvEmblemIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={className} style={{ ...MASK_STYLE, ...style }} data-av-emblem-current="" />;
}
