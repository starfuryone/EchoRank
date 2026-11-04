import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "backlinks.page_with_links_is_broken": {
    name: "Broken page that other sites link to",
    description: "Other websites link to this URL, but it returns an error (4xx or 5xx) or no response. Visitors from those links reach a dead end, and the value of the links is lost. The evidence shows the status and how many backlinks and referring domains point here.",
    howToFix: "Restore the page, or 301-redirect the URL to the closest live page so the links count again. For valuable links, also ask the linking sites to update them.",
  },
  "backlinks.page_with_links_redirects": {
    name: "Redirecting page that other sites link to",
    description: "Other websites link to this URL, which redirects. A single permanent redirect passes most of a link's value, but chains, temporary redirects and redirects to an unrelated page lose some of it.",
    howToFix: "Make sure it is one 301 to the right page. For the most valuable referring domains, ask them to link to the final URL directly.",
  },
};
