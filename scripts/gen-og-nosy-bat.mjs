// Generates public/nosy-bat/og.png (1200x630) — the Open Graph card for
// /[locale]/site-crawler.
//
//   node scripts/gen-og-nosy-bat.mjs
//
// The v3 wordmark in white (public/nosy-bat/v3/nosy-bat-logo-on-dark.svg,
// viewBox 195 218 1915 266, cropped to the glyphs), rasterised as-is from the
// SVG 640 px wide — no edited paths or colours — on the dark #181A20
// background, with the byline set as text beside it (the byline is never part
// of the artwork). Rasterised with
// sharp, an existing Next dependency, like the sibling gen-og-*.mjs scripts.
// The byline uses the box's sans (DejaVu Sans here), so rerunning on another
// machine can shift the type slightly. Run once and commit the PNG; rerun when
// the logo or the byline changes. tests/nosy-bat-logo.test.tsx checks 1200x630.

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 1200;
const H = 630;
const BG = "#181A20";
const TEXT = "#EAECEF";
const MUTED = "#B7BDC6";
// Kept in step with CRAWLER_BRAND.byline (src/lib/site-crawler/brand.ts).
const BYLINE = ["crawler by", "Echorank"];

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "nosy-bat");
const svg = await readFile(path.join(dir, "v3", "nosy-bat-logo-on-dark.svg"));
if (!svg.includes('viewBox="195 218 1915 266"')) throw new Error("expected the 1915x266 wordmark");

const LW = 640;
const LH = Math.round((LW * 266) / 1915);
const logo = await sharp(svg, { density: Math.ceil((72 * LW * 2) / 1915) }).resize(LW, LH, { fit: "fill" }).png().toBuffer();

const LEFT = 90;
const TOP = Math.round((H - LH) / 2);
const TX = LEFT + LW + 44;
const byline = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W - TX}" height="${H}">` +
    `<text x="0" y="${H / 2 - 8}" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" fill="${MUTED}">${BYLINE[0]}</text>` +
    `<text x="0" y="${H / 2 + 46}" font-family="DejaVu Sans, Arial, sans-serif" font-size="46" font-weight="bold" fill="${TEXT}">${BYLINE[1]}</text>` +
    `</svg>`,
);

await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
  .composite([
    { input: logo, left: LEFT, top: TOP },
    { input: byline, left: TX, top: 0 },
  ])
  .flatten({ background: BG })
  .png()
  .toFile(path.join(dir, "og.png"));

console.log("wrote public/nosy-bat/og.png");
