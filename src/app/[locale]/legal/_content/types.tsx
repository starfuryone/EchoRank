// src/app/[locale]/legal/_content/types.tsx
//
// The shared shape of a legal document, and the renderer for its body.
//
// WHY THIS EXISTS: the consent gate opens these documents in a modal, and the
// modal must show the SAME text the route shows. An iframe would have worked
// and was rejected — it ships the whole page chrome, breaks focus trapping, and
// makes the modal's scroll container the iframe's problem. A second copy of the
// text was rejected for the obvious reason. So the body is data, the routes
// render it inside their page chrome, and the modal renders it inside a dialog.
//
// `_content` is underscore-prefixed so Next does not treat it as a route
// segment. It also keeps the documents out of the page files, which are only
// supposed to export route handlers and metadata.
//
// CLIENT-SAFE. These modules are dynamically imported by a client component, so
// nothing here may reach for Prisma, env, or a server-only API. The one runtime
// dependency is next/link, which works in both environments.

import type { ReactNode } from "react";

export interface LegalDoc {
  title: string;
  updated: string;
  /** Plain text for generateMetadata — a section paragraph may be JSX. */
  description: string;
  sections: { h: string; ps: ReactNode[] }[];
}

/** Builders take the locale because some paragraphs carry locale-aware links. */
export type LegalDocBuilder = (locale: string) => LegalDoc;

/**
 * The section list. Deliberately renders nothing but the sections — the page
 * chrome (nav, back button, footer) belongs to the route, and the dialog
 * chrome belongs to the modal.
 */
export function LegalBody({
  doc,
  className,
  headingClassName,
  paragraphClassName,
}: {
  doc: LegalDoc;
  className?: string;
  headingClassName?: string;
  paragraphClassName?: string;
}) {
  return (
    <div className={className}>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2 className={headingClassName}>{s.h}</h2>
          {s.ps.map((p, i) => (
            <p key={i} className={paragraphClassName}>
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
