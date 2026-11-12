// tests/helpers/agreement-snapshot.ts
//
// The served Subscription Agreement (buildSubscriptionAgreement), as the
// markdown body of the root drafting snapshot, echorank360-subscription-
// agreement.md. tests/legal-subscription-plans.test.ts compares the file to
// this, byte for byte, from "# Subscription Agreement" down (the HTML comment
// above it is hand-written). When the agreement changes, re-cut the file from
// this output; do not edit the snapshot by hand.
//
// Markdown shape, as the Aug-2026 snapshot had it: "## " per section, "### "
// for a numbered paragraph's title ("1.1 Available Plans. Echorank360 …"
// becomes "### 1.1 Available Plans" and its text), §1.1's plan lines as a
// Plan | Monthly | Yearly table. A link renders as its label.

import { isValidElement, type ReactNode } from "react";
import type { LegalDoc } from "@/app/[locale]/legal/_content/types";

/** A paragraph's text: strings as written, an element by its children, a label-only link by its label. */
export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode; label?: string };
    if (props.children !== undefined) return nodeText(props.children);
    return props.label ?? "";
  }
  return "";
}

const PRICED = /^([A-Z][A-Za-z ]+): (\$[\d,]+\/month), or (\$[\d,]+\.\d\d\/year \(\$[\d,]+\.\d\d\/month equivalent\))\.$/;
const CUSTOM = /^([A-Z][A-Za-z ]+): (custom pricing — contact us)\.$/;
const NUMBERED = /^(\d+\.\d+) ([^.]+)\. ([\s\S]*)$/;

/** One §1.1 plan line as a table row, or null when it is not a plan line. */
export function planRow(line: string): string | null {
  const p = line.match(PRICED);
  if (p) return `| ${p[1]} | ${p[2]} | ${p[3]} |`;
  const c = line.match(CUSTOM);
  if (c) {
    const cell = c[2][0].toUpperCase() + c[2].slice(1);
    return `| ${c[1]} | ${cell} | ${cell} |`;
  }
  return null;
}

export function agreementMarkdown(doc: LegalDoc): string {
  const out: string[] = [`# ${doc.title}`, doc.updated];
  for (const section of doc.sections) {
    out.push(`## ${section.h}`);
    let table: string[] = [];
    const flush = () => {
      if (table.length) out.push(["| Plan | Monthly | Yearly |", "|---|---|---|", ...table].join("\n"));
      table = [];
    };
    for (const p of section.ps) {
      const text = nodeText(p);
      const row = planRow(text);
      if (row) {
        table.push(row);
        continue;
      }
      flush();
      const n = text.match(NUMBERED);
      if (n) out.push(`### ${n[1]} ${n[2]}`, n[3]);
      else out.push(text);
    }
    flush();
  }
  return out.join("\n\n") + "\n";
}
