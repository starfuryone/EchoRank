// src/lib/blog-agent/hero.ts
//
// The generated cover graphic. Four layouts, chosen deterministically from the
// slug so re-running the agent on the same article produces the same file.
//
// ABSTRACT ON PURPOSE. These are token-coloured compositions, not depictions of
// anything — which is what makes them honest: an image API asked for "AI search
// visibility" returns a stock-photo hallucination of a concept, and a drawing
// that illustrates nothing real is worse than a shape that admits it. The alt
// text says so too (see heroAlt in gate.ts).
//
// Same canvas and palette as the hand-drawn heroes committed with the blog
// feature, so the index grid does not visibly split into "human" and "machine".

/** Binance tokens, matching home2.module.css. */
const C = {
  bg: "#181A20",
  surface: "#1E2329",
  line: "#2B3139",
  faint: "#848E9C",
  text: "#EAECEF",
  gold: "#FCD535",
  goldDeep: "#F0B90B",
  green: "#0ECB81",
} as const;

/** Per-category accent, so a category reads at a glance in the grid. */
const ACCENT: Record<string, string> = {
  "GEO Guides": C.gold,
  "Best Practices": C.green,
  "Use Cases": "#7aa7ff",
  "AI Visibility": C.goldDeep,
  Research: "#B7BDC6",
  Tools: C.gold,
};

/** Stable small integer from a string. Not a hash for security — for layout. */
function pick(slug: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % modulo;
}

/** XML-escape the eyebrow text. A category is ours, but never trust it blind. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Deterministic pseudo-random series in [0,1), seeded by the slug.
 *
 * Layouts need varied bar heights that are STABLE — a Math.random() version
 * would redraw the file on every run and produce a git diff for no change.
 */
function series(slug: string, count: number): number[] {
  let state = 0;
  for (let i = 0; i < slug.length; i++) state = (state * 1103515245 + slug.charCodeAt(i) + 12345) >>> 0;
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) >>> 0;
    return ((state >>> 16) & 0x7fff) / 0x7fff;
  });
}

function frame(inner: string, eyebrow: string): string {
  return `<svg viewBox="0 0 1400 600" width="1400" height="600" xmlns="http://www.w3.org/2000/svg" font-family="Geist, system-ui, sans-serif">
  <rect width="1400" height="600" fill="${C.bg}"/>
  <rect x="70" y="70" width="1260" height="460" rx="16" fill="${C.surface}" stroke="${C.line}"/>
${inner}
  <text x="150" y="132" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" fill="${C.faint}" letter-spacing="2.2">${esc(eyebrow.toUpperCase())}</text>
</svg>
`;
}

/** Ascending bars — the "measurement" layout. */
function bars(accent: string, slug: string): string {
  const v = series(slug, 9);
  return v
    .map((n, i) => {
      const h = 90 + n * 230;
      return `  <rect x="${150 + i * 128}" y="${470 - h}" width="72" height="${h.toFixed(0)}" rx="5" fill="${i % 3 === 0 ? accent : C.line}"/>`;
    })
    .join("\n");
}

/** Two stacked tracks with a shortfall — the "gap" layout. */
function gap(accent: string, slug: string): string {
  const [a, b] = series(slug, 2);
  const wide = 500 + a * 560;
  const narrow = 160 + b * 260;
  return [
    `  <rect x="150" y="200" width="1100" height="72" rx="8" fill="#23282F"/>`,
    `  <rect x="150" y="340" width="1100" height="72" rx="8" fill="#23282F"/>`,
    `  <rect x="150" y="200" width="${wide.toFixed(0)}" height="72" rx="8" fill="${accent}"/>`,
    `  <rect x="150" y="340" width="${narrow.toFixed(0)}" height="72" rx="8" fill="${C.line}"/>`,
    `  <line x1="${(150 + narrow).toFixed(0)}" y1="450" x2="${(150 + wide).toFixed(0)}" y2="450" stroke="${C.faint}" stroke-width="2" stroke-dasharray="7 6"/>`,
  ].join("\n");
}

/** A node and its dependents — the "propagation" layout. */
function nodes(accent: string, slug: string): string {
  const v = series(slug, 6);
  const out = [`  <circle cx="270" cy="300" r="46" fill="${accent}"/>`];
  v.forEach((n, i) => {
    const y = 170 + i * 52;
    const x = 620 + n * 480;
    out.push(`  <line x1="316" y1="300" x2="${x.toFixed(0)}" y2="${y}" stroke="${C.line}" stroke-width="2"/>`);
    out.push(`  <circle cx="${x.toFixed(0)}" cy="${y}" r="${(10 + n * 14).toFixed(0)}" fill="${i % 2 ? C.line : accent}" opacity="${(0.4 + n * 0.6).toFixed(2)}"/>`);
  });
  return out.join("\n");
}

/** Sequential gates — the "pipeline" layout. */
function gates(accent: string, slug: string): string {
  const v = series(slug, 4);
  return v
    .map((n, i) => {
      const x = 210 + i * 270;
      const open = n > 0.35;
      return [
        `  <rect x="${x}" y="190" width="16" height="220" rx="4" fill="${C.line}"/>`,
        `  <rect x="${x + 150}" y="190" width="16" height="220" rx="4" fill="${C.line}"/>`,
        `  <rect x="${x + 16}" y="190" width="134" height="${open ? 44 : 220}" rx="4" fill="${open ? accent : C.line}" opacity="${open ? 0.28 : 0.5}"/>`,
      ].join("\n");
    })
    .join("\n");
}

const LAYOUTS = [bars, gap, nodes, gates];

/**
 * One hero SVG for an article.
 *
 * Deterministic in the slug: same slug, same bytes, so re-running the agent is
 * a no-op in git rather than a churned binary-ish diff every night.
 */
export function renderHero(input: { slug: string; category: string }): string {
  const accent = ACCENT[input.category] ?? C.gold;
  const layout = LAYOUTS[pick(input.slug, LAYOUTS.length)];
  return frame(layout(accent, input.slug), input.category);
}
