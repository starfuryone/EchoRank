import { doc, page, pc, withFacts, type RuleCase } from "../harness";

const body = (b: string) => page(doc("<title>t</title>", b));
const img = (attrs: string) => `<img ${attrs}>`;
const GOOD = 'src="/a.webp" alt="A plumber fixing a sink" width="300" height="200"';
const checked = (broken: number, oversize: number) =>
  withFacts(body(img(GOOD)), (p) => {
    p.imageChecks = { checked: 3, broken, oversize, sample: "https://example.com/big.jpg" };
  });

const cases: RuleCase[] = [
  pc("images.missing_alt", "no alt", true, body(img('src="/a.webp" width="1" height="1"')), { count: 1 }),
  pc("images.missing_alt", "empty alt is decorative, fine", false, body(img('src="/a.webp" alt=""'))),
  pc("images.alt_over_100_chars", "essay alt", true, body(img(`src="/a.webp" alt="${"x".repeat(120)}"`))),
  pc("images.alt_over_100_chars", "short alt", false, body(img(GOOD))),
  pc("images.missing_size_attributes", "no height", true, body(img('src="/a.webp" alt="a" width="10"'))),
  pc("images.missing_size_attributes", "both set", false, body(img(GOOD))),
  pc("images.missing_size_attributes", "svg exempt", false, body(img('src="/logo.svg" alt="a"'))),
  pc("images.broken", "one broken", true, checked(1, 0), { count: 1 }),
  pc("images.broken", "none broken", false, checked(0, 0)),
  pc("images.over_100kb", "one heavy", true, checked(0, 1)),
  pc("images.over_100kb", "none heavy", false, checked(0, 0)),
  pc("images.alt_equals_filename", "alt = stem", true, body(img('src="/img/hero_banner.jpg?v=2" alt="Hero-banner"'))),
  pc("images.alt_equals_filename", "real alt", false, body(img(GOOD))),
  pc("images.over_50_images", "60 images", true, body(img(GOOD).repeat(60)), { count: 60 }),
  pc("images.over_50_images", "5 images", false, body(img(GOOD).repeat(5))),
  pc("images.not_lazy_loaded", "fifth image eager", true, body(img(GOOD).repeat(5)), { count: 2 }),
  pc("images.not_lazy_loaded", "later ones lazy", false, body(img(GOOD).repeat(3) + img(`${GOOD} loading="lazy"`).repeat(2))),
  pc("images.first_image_lazy", "hero lazy", true, body(img(`${GOOD} loading="lazy"`))),
  pc("images.first_image_lazy", "hero eager", false, body(img(GOOD))),
  pc("images.missing_srcset", "wide, single file", true, body(img('src="/a.jpg" alt="a" width="1200" height="600"'))),
  pc("images.missing_srcset", "has srcset", false, body(img('src="/a.jpg" srcset="/a-600.jpg 600w, /a.jpg 1200w" alt="a" width="1200"'))),
  pc("images.missing_srcset", "small icon", false, body(img('src="/i.png" alt="a" width="32" height="32"'))),
  pc("images.not_next_gen_format", "plain jpeg", true, body(img('src="/a.jpg" alt="a"'))),
  pc("images.not_next_gen_format", "jpeg with a webp source", false, body('<picture><source type="image/webp" srcset="/a.webp"><img src="/a.jpg" alt="a"></picture>')),
  pc("images.not_next_gen_format", "webp", false, body(img(GOOD))),
];

export default cases;
