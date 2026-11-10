// The footer's "Other services" group (src/lib/other-services.ts): one link
// to llms.txt Studio's free generator, with its one-line description. No
// hooks, so every footer can render it, server or client. Wraps at any width
// (320 px included): block layout, long text breaks inside its own box.

import { OTHER_SERVICES_COPY, llmsTxtGeneratorHref, otherServicesBase } from "@/lib/other-services";

export function OtherServices({ locale }: { locale: string }) {
  const c = OTHER_SERVICES_COPY[otherServicesBase(locale)];
  return (
    <div
      data-testid="footer-other-services"
      style={{ flexBasis: "100%", minWidth: 0, maxWidth: "100%", fontSize: 13, lineHeight: 1.5, margin: "8px 0", overflowWrap: "anywhere" }}
    >
      <span style={{ display: "block", fontWeight: 600 }}>{c.heading}</span>
      <a href={llmsTxtGeneratorHref("footer")}>{c.footerLabel}</a>
      <span style={{ display: "block", opacity: 0.75 }}>{c.footerLine}</span>
    </div>
  );
}
