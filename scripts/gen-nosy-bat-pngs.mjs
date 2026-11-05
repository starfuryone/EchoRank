// Generates the PNGs of the three v3 wordmarks (public/nosy-bat/v3/):
// nosy-bat-logo{,-on-dark,-on-dark-teal}-{240,480,800,1200}.png, rasterised
// as-is from the SVGs (viewBox 195 218 1915 266, 7.2:1), transparent, each at
// its width and the height the ratio gives. The emblem PNGs are not made here.
//
//   node scripts/gen-nosy-bat-pngs.mjs
//
// Rerun after any change to the wordmark SVGs; tests/nosy-bat-logo.test.tsx
// checks the sizes. The 800 px teal file is the emails' and the PDF's logo.

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "nosy-bat", "v3");
const VB_W = 1915;
const VB_H = 266;
const WIDTHS = [240, 480, 800, 1200];

for (const name of ["nosy-bat-logo", "nosy-bat-logo-on-dark", "nosy-bat-logo-on-dark-teal"]) {
  const svg = await readFile(path.join(dir, `${name}.svg`));
  if (!svg.includes(`viewBox="195 218 ${VB_W} ${VB_H}"`)) throw new Error(`${name}.svg: unexpected viewBox`);
  for (const w of WIDTHS) {
    const h = Math.round((w * VB_H) / VB_W);
    // Rasterise above the target size, then downscale: crisper edges.
    await sharp(svg, { density: Math.ceil((72 * w * 2) / VB_W) })
      .resize(w, h, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, `${name}-${w}.png`));
    console.log(`wrote ${name}-${w}.png ${w}x${h}`);
  }
}
