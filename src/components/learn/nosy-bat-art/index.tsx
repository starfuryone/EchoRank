// The crawler guides' diagrams, by the id a {k:"figure"} block names
// (src/lib/learn-nosy-bat.ts). An id with no entry here renders nothing and
// fails tests/nosy-bat-guides.test.tsx, which walks every guide body.

import { NbFigure, type ArtBase, type ArtSpec } from "./frame";
import { HEROES } from "./heroes";
import { exportOneRowPerLink, whereBrokenLinkLives, whichFix } from "./broken-links";
import { crawlToSitemap, largeSites, whereItGoes } from "./sitemap";

export const NB_ART: Readonly<Record<string, ArtSpec>> = {
  "broken-links-where": whereBrokenLinkLives,
  "broken-links-export": exportOneRowPerLink,
  "broken-links-fix": whichFix,
  "sitemap-funnel": crawlToSitemap,
  "sitemap-index": largeSites,
  "sitemap-where": whereItGoes,
};

export function NbArt({ id, base }: { id: string; base: ArtBase }) {
  const spec = NB_ART[id];
  return spec ? <NbFigure id={id} spec={spec} base={base} /> : null;
}

export function NbHero({ id }: { id: string }) {
  const H = HEROES[id];
  return H ? <H /> : null;
}

export { HEROES };
