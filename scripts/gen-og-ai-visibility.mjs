// Generates the Open Graph cards (1200x630) for /[locale]/ai-visibility and
// /[locale]/ai-visibility-check:
//
//   public/ai-visibility/og-ai-visibility.png        the logo
//   public/ai-visibility/og-ai-visibility-check.png  the logo + "Free AI Visibility Check"
//
//   node scripts/gen-og-ai-visibility.mjs
//
// The on-dark logo (public/ai-visibility/echorank-ai-visibility-logo-on-dark.svg,
// viewBox 2056x518, final artwork) rasterised as-is from the SVG — no edited
// paths or colours — centred on the dark #181A20 background. The check card's
// line is the page's English eyebrow (SNAPSHOT_COPY.en.eyebrow), set in the
// box's sans (DejaVu Sans here), so a rerun elsewhere can shift the type
// slightly. Rasterised with sharp, an existing Next dependency, like the
// sibling gen-og-*.mjs scripts. Run once and commit the PNGs; rerun when the
// logo or the line changes. tests/ai-visibility-brand.test.tsx checks 1200x630.

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 1200;
const H = 630;
const BG = "#181A20";
const MUTED = "#B7BDC6";
const CHECK_LINE = "Free AI Visibility Check";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "ai-visibility");
const svg = await readFile(path.join(dir, "echorank-ai-visibility-logo-on-dark.svg"));
const m = /viewBox="([\d.\s-]+)"/.exec(svg.toString());
const [, , vw, vh] = (m ? m[1] : "").trim().split(/\s+/).map(Number);
if (!(vw > 0 && vh > 0) || Math.abs(vw / vh - 2056 / 518) > 0.01) throw new Error("expected the 2056x518 logo");

async function card(file, logoW, line) {
  const logoH = Math.round((logoW * vh) / vw);
  const logo = await sharp(svg, { density: Math.ceil((72 * logoW * 2) / vw) }).resize(logoW, logoH, { fit: "fill" }).png().toBuffer();
  const top = Math.round((H - logoH - (line ? 90 : 0)) / 2);
  const layers = [{ input: logo, left: Math.round((W - logoW) / 2), top }];
  if (line) {
    const text = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="80">` +
        `<text x="${W / 2}" y="52" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" fill="${MUTED}">${line}</text>` +
        `</svg>`,
    );
    layers.push({ input: text, left: 0, top: top + logoH + 34 });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite(layers)
    .flatten({ background: BG })
    .png()
    .toFile(path.join(dir, file));
  console.log(`wrote public/ai-visibility/${file}`);
}

await card("og-ai-visibility.png", 760, null);
await card("og-ai-visibility-check.png", 680, CHECK_LINE);
