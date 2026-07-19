import type { JsonLdNode } from "./jsonld";

/**
 * Renders exactly one application/ld+json script wrapping a @graph.
 *
 * Use one JsonLd per page. Multiple scripts are legal but make the emitted
 * data harder to audit, and the whole point of this service is that a page's
 * structured data is inspectable in one place.
 *
 * Escaping: JSON.stringify does not escape "<", so a string containing
 * "</script>" would terminate the block early and inject markup. We escape the
 * three characters that matter inside a script context.
 */
export function JsonLd({ graph }: { graph: JsonLdNode[] }) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}

export default JsonLd;
