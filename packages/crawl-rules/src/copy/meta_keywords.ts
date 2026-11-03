import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "meta_keywords.present": {
    name: "Meta keywords tag present",
    description: "The page carries a <meta name=\"keywords\"> tag. Google and Bing ignore it for ranking; its only effect is publishing your target keywords to competitors.",
    howToFix: "Remove the tag from the template or SEO plugin settings.",
  },
};
