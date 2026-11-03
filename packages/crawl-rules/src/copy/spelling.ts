import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "spelling.misspellings": {
    name: "Spelling mistakes",
    description: "Words in the page's visible text that are not in the dictionary for its language (from <html lang>). Names and product terms show up here too until they are added to the accepted words.",
    howToFix: "Correct the misspelled words. Add brand names, product names and other correct terms to your accepted words so they are not reported again.",
  },
  "spelling.over_5_misspellings": {
    name: "More than 5 spelling mistakes",
    description: "More than five different words on the page are not in the dictionary. At that count it is usually an unproofread page, a page in a different language than its lang attribute says, or a run of names that should be accepted words.",
    howToFix: "Proofread the page. If the words are correct, check that <html lang> matches the page's language and add the terms to your accepted words.",
  },
  "spelling.unsupported_language": {
    name: "Language not spell-checked",
    description: "The page's language is not one the spell check covers (English, French and German), so its text was not checked.",
    howToFix: "Nothing to fix on the page. Check its text with a spell checker for its language before publishing.",
  },
};
