/**
 * @vitest-environment jsdom
 */
// tests/free-audit-teaser.dom.test.tsx
//
// The free-audit result must say what was measured, and nothing it did not.
// /api/av/audit runs a crawler-readability check and asks no AI engine, so
// the teaser prints the score as "AI readability" and the mention line as
// "not tested" — never "0% of tested queries" about queries that never ran.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuditWidget, type AuditWidgetContent } from "@/components/AuditWidget";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const C: AuditWidgetContent = {
  label: "Run a free basic audit",
  placeholder: "acme.com",
  runIdle: "Run free audit",
  runBusy: "Auditing…",
  noteTemplate: "Reading {brand}",
  errLimit: "limit",
  errGeneric: "error",
  fine: "fine",
  mentionLabel: "Named in AI answers",
  mentionValue: "{hits} of {total} AI engines",
  mentionNotTested: "not tested by the free audit",
  mentionGloss: "Whether ChatGPT, Claude, Gemini or Perplexity mention you.",
  readabilityLabel: "AI readability",
  readabilityGloss: "How easily AI crawlers can read and cite your site.",
  upsell: "Plans track prompts weekly.",
  ctaTemplate: "Track {brand}",
  ctaHref: "/en/pricing",
  again: "again",
  pdfIdle: "pdf",
  pdfBusy: "…",
  pdfErr: "err",
  pdfRetry: "retry",
};

async function runWith(payload: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
  );
  const { container } = render(<AuditWidget c={C} />);
  fireEvent.change(screen.getByPlaceholderText("acme.com"), { target: { value: "acme.com" } });
  fireEvent.click(screen.getByText("Run free audit"));
  await waitFor(() => expect(screen.getByText("Plans track prompts weekly.")).toBeTruthy());
  return container.textContent ?? "";
}

describe("free-audit teaser", () => {
  it("labels the sidecar score as AI readability out of 100, with its gloss", async () => {
    // The live route's shape: mentionRate/engines are constants, trustScore = score.
    const text = await runWith({ brand: "acme.com", score: 94, trustScore: 94, mentionRate: 0, engines: [] });
    expect(text).toContain("AI readability:");
    expect(text).toContain("94/100");
    expect(text).toContain("How easily AI crawlers can read and cite your site.");
    expect(text).not.toMatch(/Trust Score/);
  });

  it("says the mention check was not run rather than reporting 0%", async () => {
    const text = await runWith({ brand: "acme.com", score: 94, mentionRate: 0, engines: [] });
    expect(text).toContain("Named in AI answers:");
    expect(text).toContain("not tested by the free audit");
    expect(text).not.toMatch(/0%/);
    expect(text).toContain("Plans track prompts weekly.");
  });

  it("counts engines only when real engine results come back", async () => {
    const text = await runWith({
      brand: "acme.com",
      score: 80,
      engines: [
        { name: "ChatGPT", mentioned: true },
        { name: "Claude", mentioned: false },
        { name: "Gemini", mentioned: false },
      ],
    });
    expect(text).toContain("1 of 3 AI engines");
    expect(text).not.toContain("not tested");
  });
});
