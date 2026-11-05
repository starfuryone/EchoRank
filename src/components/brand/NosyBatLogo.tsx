// <NosyBatLogo> — the crawler brand's v3 wordmark as an <img> of the SVG, used
// as-is, with explicit width and height at 1915:266 so nothing shifts while it loads.
//
// No hooks and no server imports, so Server and Client Components both use it.
// `tone` picks the file: "light" (teal, light backgrounds), "dark" (white),
// "accent" (light teal, the public hero only). `themed` is for the public
// pages, dark by default with a day theme: it adds the teal file, shown only
// under [data-theme="day"] (decorative, so one accessible name either way).
// The byline is the caller's text, beside or under this, never part of it.

import { CRAWLER_BRAND, logoWidthAt } from "@/lib/site-crawler/brand";
import l from "./nosy-bat-logo.module.css";

const SRC = { light: CRAWLER_BRAND.logo, dark: CRAWLER_BRAND.logoOnDark, accent: CRAWLER_BRAND.logoOnDarkAccent } as const;

export function NosyBatLogo({
  height,
  alt,
  tone = "light",
  themed = false,
  className,
  testId,
}: {
  /** Rendered height in CSS px; the width follows (logoWidthAt). */
  height: number;
  /** Accessible name; "" makes it decorative (aria-hidden). */
  alt: string;
  tone?: keyof typeof SRC;
  /** On a public page with the day theme: swap to the teal file there. */
  themed?: boolean;
  className?: string;
  testId?: string;
}) {
  const width = logoWidthAt(height);
  const img = (src: string, a: string, cls: string | undefined) => (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG at a fixed size; next/image adds nothing
    <img className={cls} src={src} width={width} height={height} alt={a} aria-hidden={a === "" ? true : undefined} decoding="async" />
  );
  return (
    <span className={[l.wrap, className].filter(Boolean).join(" ")} data-testid={testId}>
      {img(SRC[tone], alt, themed ? `${l.img} ${l.night}` : l.img)}
      {themed && tone !== "light" && img(SRC.light, "", `${l.img} ${l.day}`)}
    </span>
  );
}
