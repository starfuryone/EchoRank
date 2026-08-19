// Generates public/og/seo-guide.png (1200x630) — the Open Graph card for
// /[locale]/seo-guide, the Complete SEO & AI Visibility Guide.
//
//   node scripts/gen-og-seo-guide.mjs
//
// Same approach and palette as scripts/gen-og-link-building-playbook.mjs:
// rasterize an inline SVG with sharp (an existing Next dependency). No new
// packages, no network.
//
// Font note: this box has only DejaVu installed, so the card is set in DejaVu
// Sans rather than the site's Geist — see gen-og.mjs for the same caveat.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 1200;
const H = 630;
const FONT = "DejaVu Sans";

const BG = "#181A20";
const GOLD_LIGHT = "#f7d76f";
const GOLD_DARK = "#b88420";
const MUTED = "#8b93a1";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${GOLD_LIGHT}" stop-opacity="0.20"/>
      <stop offset="0.55" stop-color="${GOLD_LIGHT}" stop-opacity="0.06"/>
      <stop offset="1" stop-color="${GOLD_LIGHT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>
  <circle cx="${W - 90}" cy="60" r="470" fill="url(#glow)"/>

  <!-- gold rule, top left -->
  <rect x="80" y="96" width="64" height="4" rx="2" fill="url(#gold)"/>

  <!-- diamond mark + wordmark -->
  <g transform="translate(80,150)">
    <polygon points="0,-13 15,0 0,13 -15,0" fill="url(#gold)"/>
    <text x="34" y="10" font-family="${FONT}" font-size="30" font-weight="bold"
          fill="#ffffff" letter-spacing="5">ECHORANK</text>
  </g>

  <!-- title. Two lines, white then gold, exactly as the two sibling cards do
       it: the second line is the half that names the subject. "SEO & AI
       Visibility" on one line runs past the 1200px edge in DejaVu, which is
       wider than the site's Geist.
       AMPERSAND IS ESCAPED. This string is parsed as XML by sharp, so a bare
       "&" is a fatal parse error, not a rendering nicety — the two sibling
       cards never hit it because neither title contains one. -->
  <text x="80" y="330" font-family="${FONT}" font-size="76" font-weight="bold" fill="#ffffff">Complete SEO</text>
  <text x="80" y="420" font-family="${FONT}" font-size="76" font-weight="bold" fill="url(#gold)">&amp; AI Visibility</text>

  <!-- subtitle -->
  <text x="80" y="500" font-family="${FONT}" font-size="28" fill="${MUTED}">The Echorank Complete Guide</text>

  <!-- bottom gold rule -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#gold)"/>
</svg>`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "og", "seo-guide.png");

await mkdir(path.dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

const { width, height } = await sharp(out).metadata();
console.log(`wrote ${out} (${width}x${height})`);
