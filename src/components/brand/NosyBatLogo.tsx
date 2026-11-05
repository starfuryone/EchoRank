// <NosyBatLogo> — the crawler brand's v2 logo: <picture> with the WebP and a PNG
// fallback (srcSet of the 240 / 480 / 735 / 800 files), explicit width and
// height at the artwork's 735:410 so nothing shifts while it loads.
//
// No hooks and no server imports, so Server and Client Components both use it.
// `onDark` adds the glow (NOSY_BAT_LOGO_GLOW) as a CSS filter — never in the
// image — and the public day theme drops it. The byline is the caller's text,
// beside or under this, never part of it. Under 120 px wide use the mark.

import { CRAWLER_BRAND, NOSY_BAT_LOGO_GLOW, logoWidth } from "@/lib/site-crawler/brand";
import l from "./nosy-bat-logo.module.css";

const L = CRAWLER_BRAND.logo;
const PNG_SRCSET = [...L.sizes.slice(0, 2), { src: L.png, w: L.width }, ...L.sizes.slice(2)].map((x) => `${x.src} ${x.w}w`).join(", ");

export function NosyBatLogo({
  height,
  alt,
  onDark = false,
  className,
  testId,
}: {
  /** Rendered height in CSS px; the width follows the 735:410 ratio. */
  height: number;
  /** Accessible name; "" makes it decorative (aria-hidden). */
  alt: string;
  /** On a dark surface: the soft gold glow. */
  onDark?: boolean;
  className?: string;
  testId?: string;
}) {
  const width = logoWidth(height);
  const sizes = `${width}px`;
  return (
    <picture className={[l.picture, className].filter(Boolean).join(" ")} data-testid={testId}>
      <source type="image/webp" srcSet={`${L.webp} ${L.width}w`} sizes={sizes} />
      {/* A plain <img> in <picture>: fixed-size static art, the browser picks the format. */}
      <img
        className={onDark ? `${l.img} ${l.glow}` : l.img}
        src={L.png}
        srcSet={PNG_SRCSET}
        sizes={sizes}
        width={width}
        height={height}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        decoding="async"
        data-glow={onDark ? NOSY_BAT_LOGO_GLOW : undefined}
      />
    </picture>
  );
}
