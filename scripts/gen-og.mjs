// Generates public/og-home.png (1200x630) — the Open Graph / Twitter card.
//
//   node scripts/gen-og-image.mjs
//
// Uses sharp (already a Next dependency) to rasterize an inline SVG. No new
// packages, no network, no binary assets checked in beyond the PNG itself.
//
// Font note: this box has only DejaVu installed (/usr/share/fonts/truetype),
// so the card is set in DejaVu Sans rather than the site's Geist. Text is
// rendered by librsvg via fontconfig; if you add Geist to the system font path
// later, change FONT below and re-run.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 1200;
const H = 630;
const FONT = "DejaVu Sans";

const BG = "#0B0E11";
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

  <!-- wordmark -->
  <g transform="translate(80,150)">
    <polygon points="0,-13 15,0 0,13 -15,0" fill="url(#gold)"/>
    <text x="34" y="10" font-family="${FONT}" font-size="30" font-weight="bold"
          fill="#ffffff" letter-spacing="5">ECHORANK 360</text>
  </g>

  <!-- headline. Set on two lines: DejaVu runs wider than the site's Geist and
       the single-line version overflowed 1200px. -->
  <text x="80" y="322" font-family="${FONT}" font-size="74" font-weight="bold" fill="#ffffff">The business AI</text>
  <text x="80" y="410" font-family="${FONT}" font-size="74" font-weight="bold" fill="#ffffff">recommends <tspan fill="url(#gold)">wins.</tspan></text>

  <!-- subline -->
  <text x="80" y="492" font-family="${FONT}" font-size="26" fill="${MUTED}">AI Visibility Management Platform</text>

  <!-- engine strip -->
  <text x="80" y="556" font-family="${FONT}" font-size="19" fill="${MUTED}" letter-spacing="1">ChatGPT  ·  Google AI  ·  Perplexity  ·  Claude  ·  Gemini  ·  Copilot</text>

  <!-- bottom gold rule -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#gold)"/>
</svg>`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "og-home.png");

await mkdir(path.dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

const { width, height } = await sharp(out).metadata();
console.log(`wrote ${out} (${width}x${height})`);
