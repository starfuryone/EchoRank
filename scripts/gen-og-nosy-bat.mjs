// Generates public/nosy-bat/og.png (1200x630) — the Open Graph card for
// /[locale]/site-crawler.
//
//   node scripts/gen-og-nosy-bat.mjs
//
// The v2 logo (public/nosy-bat/v2/nosy-bat-logo.png, transparent, 735x410)
// composited at its own size — never resampled, cropped, recoloured or given
// effects — on the dark #181A20 background, with the byline set as text
// beside it (the byline is never part of the artwork). Rasterised with sharp,
// an existing Next dependency, like the sibling gen-og-*.mjs scripts. The text
// uses the box's sans (DejaVu Sans here), so rerunning on another machine can
// shift the type slightly. Run once and commit the PNG; rerun when the logo or
// the byline changes. tests/nosy-bat-logo.test.ts checks the output is 1200x630.

import sharp from "sharp";
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
const logoPath = path.join(dir, "v2", "nosy-bat-logo.png");
const { width: LW, height: LH } = await sharp(logoPath).metadata();
if (LW !== 735 || LH !== 410) throw new Error(`expected the 735x410 logo, got ${LW}x${LH}`);

const LEFT = 60;
const TOP = Math.round((H - LH) / 2);
const TX = LEFT + LW + 40;
const byline = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W - TX}" height="${H}">` +
    `<text x="0" y="${H / 2 - 8}" font-family="DejaVu Sans, Arial, sans-serif" font-size="46" fill="${MUTED}">${BYLINE[0]}</text>` +
    `<text x="0" y="${H / 2 + 52}" font-family="DejaVu Sans, Arial, sans-serif" font-size="52" font-weight="bold" fill="${TEXT}">${BYLINE[1]}</text>` +
    `</svg>`,
);

await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
  .composite([
    { input: logoPath, left: LEFT, top: TOP },
    { input: byline, left: TX, top: 0 },
  ])
  .flatten({ background: BG })
  .png()
  .toFile(path.join(dir, "og.png"));

console.log("wrote public/nosy-bat/og.png");
