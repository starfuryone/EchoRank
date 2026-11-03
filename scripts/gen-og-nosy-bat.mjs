// Generates public/nosy-bat/og.png (1200x630) — the Open Graph card for
// /[locale]/site-crawler.
//
//   node scripts/gen-og-nosy-bat.mjs
//
// Mark left, wordmark right, on the dark background. Both come from the brand
// SVGs in public/nosy-bat/ — the mark from nosy-bat-mark-on-dark.svg, the
// wordmark by cropping nosy-bat-logo-on-dark.svg to its text (its paths are
// already outlined, so no font is involved). Rasterised with sharp, an
// existing Next dependency, like the sibling gen-og-*.mjs scripts. Run once
// and commit the PNG; rerun only when the brand files change.

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 1200;
const H = 630;
const BG = "#181A20";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "nosy-bat");

const MARK = 400;
const mark = await sharp(await readFile(path.join(dir, "nosy-bat-mark-on-dark.svg")), { density: 300 })
  .resize(MARK, MARK)
  .png()
  .toBuffer();

// The logo is 640x200 with the mark in its first 200 px; cropping the viewBox
// to x >= 196 leaves the wordmark and byline.
const logo = await readFile(path.join(dir, "nosy-bat-logo-on-dark.svg"), "utf8");
const wordmarkSvg = logo
  .replace('viewBox="0 0 640 200"', 'viewBox="196 30 444 140"')
  .replace('width="640" height="200"', 'width="444" height="140"');
const WORD_W = 620;
const wordmark = await sharp(Buffer.from(wordmarkSvg), { density: 300 }).resize({ width: WORD_W }).png().toBuffer();
const wordH = (await sharp(wordmark).metadata()).height;

await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
  .composite([
    { input: mark, left: 80, top: Math.round((H - MARK) / 2) },
    { input: wordmark, left: 80 + MARK + 30, top: Math.round((H - wordH) / 2) },
  ])
  .png()
  .toFile(path.join(dir, "og.png"));

console.log("wrote public/nosy-bat/og.png");
