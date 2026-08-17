/**
 * @vitest-environment jsdom
 */
// The explainer video button's INTERACTION, in a real DOM.
//
// The companion suite (ai-search-explainer-video.test.ts) covers the config: the
// assets on disk, the three copy catalogs, and the fact that the dialog contract
// is delegated to components/ui/modal.tsx rather than re-implemented. This one
// covers what only a document can — and it stands in for the authenticated
// browser pass, which cannot run from here: the route sits behind the
// aiSearchEnabledFor rollout flag and needs a session.
//
// jsdom does not implement media playback: HTMLMediaElement.play/pause are not
// functions, and currentTime is inert. pause() is therefore spied rather than
// called for real — the assertion is that the component asks for the reset, which
// is the part a regression would drop.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExplainerVideoButton } from "@/app/(dashboard)/visibility/ai-search/setup/ExplainerVideoButton";
import { AI_SEARCH_EXPLAINER_COPY } from "@/lib/i18n/dashboard";

const copy = AI_SEARCH_EXPLAINER_COPY.en;

/** The trigger, as a screen reader would find it. */
const trigger = () => screen.getByRole("button", { name: copy.watch });
const dialog = () => screen.queryByRole("dialog");
const video = () => document.querySelector("video");

afterEach(cleanup);

function open() {
  const button = trigger();
  button.focus();
  fireEvent.click(button);
  return button;
}

describe("the trigger", () => {
  it("renders on the page with the localized label, and opens nothing yet", () => {
    render(<ExplainerVideoButton locale="en" />);
    expect(trigger()).toBeInTheDocument();
    // No dialog and — importantly — no <video> element, so the browser is not
    // asked for the mp4 until someone actually wants it.
    expect(dialog()).not.toBeInTheDocument();
    expect(video()).toBeNull();
  });

  it.each(["en", "fr", "de-CH"] as const)("uses the %s label", (locale) => {
    render(<ExplainerVideoButton locale={locale} />);
    expect(
      screen.getByRole("button", { name: AI_SEARCH_EXPLAINER_COPY[locale].watch }),
    ).toBeInTheDocument();
  });
});

describe("opening", () => {
  it("shows a modal dialog naming itself, with the player inside", () => {
    render(<ExplainerVideoButton locale="en" />);
    open();

    const d = dialog()!;
    expect(d).toBeInTheDocument();
    expect(d).toHaveAttribute("aria-modal", "true");
    // The accessible name comes from the title the Modal renders, via
    // aria-labelledby — not from a hard-coded aria-label here.
    expect(d).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(d.getAttribute("aria-labelledby")!)).toHaveTextContent(
      copy.modalTitle,
    );

    const v = video()!;
    expect(v).toBeInTheDocument();
    expect(v).toHaveAttribute("src", "/videos/ai-search-tracking-explainer.mp4");
    expect(v).toHaveAttribute("poster", "/videos/ai-search-tracking-explainer-poster.jpg");
    expect(v).toHaveAttribute("preload", "metadata");
    expect(v.hasAttribute("controls")).toBe(true);
    // The one thing that must never be true of a narrated clip in a modal.
    expect(v.hasAttribute("autoplay")).toBe(false);
  });

  it("moves focus into the dialog and locks background scrolling", () => {
    render(<ExplainerVideoButton locale="en" />);
    open();
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("navigates nowhere — the trigger is a button, not a link", () => {
    render(<ExplainerVideoButton locale="en" />);
    const button = open();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(dialog()!.querySelector("a")).toBeNull();
  });
});

describe("closing", () => {
  // All three routes out, each asserted to also reset playback and restore focus.
  const routes: [string, () => void][] = [
    ["the X button", () => fireEvent.click(screen.getByRole("button", { name: copy.close }))],
    ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
    // The overlay is the dialog's parent; Modal only closes when the click
    // landed on the overlay itself, never on a bubble from inside.
    ["a backdrop click", () => fireEvent.click(dialog()!.parentElement!)],
  ];

  it.each(routes)("closes on %s", (_label, act) => {
    render(<ExplainerVideoButton locale="en" />);
    open();
    act();
    expect(dialog()).not.toBeInTheDocument();
    expect(video()).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it.each(routes)("pauses and rewinds the video when closed by %s", (_label, act) => {
    render(<ExplainerVideoButton locale="en" />);
    open();

    const v = video()! as HTMLVideoElement;
    // jsdom leaves these unimplemented, so install what the component calls.
    const pause = vi.fn();
    Object.defineProperty(v, "pause", { value: pause, configurable: true });
    let currentTime = 12.5;
    Object.defineProperty(v, "currentTime", {
      get: () => currentTime,
      set: (n: number) => {
        currentTime = n;
      },
      configurable: true,
    });

    act();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(currentTime).toBe(0);
  });

  it.each(routes)("returns focus to the trigger after %s", (_label, act) => {
    render(<ExplainerVideoButton locale="en" />);
    const button = open();
    act();
    expect(document.activeElement).toBe(button);
  });

  it("does not close on a click inside the dialog", () => {
    // The bug this guards: a backdrop handler that fires on any bubbled click
    // would dismiss the modal the moment someone hit play.
    render(<ExplainerVideoButton locale="en" />);
    open();
    fireEvent.click(video()!);
    expect(dialog()).toBeInTheDocument();
  });
});

describe("reopening", () => {
  it("starts from a fresh player rather than a mid-scrub one", () => {
    // Modal unmounts its children, so the second open builds a new <video>. This
    // is the behaviour that makes the reset above belt-and-braces rather than
    // load-bearing — worth pinning so a switch to keeping children mounted is a
    // visible decision.
    render(<ExplainerVideoButton locale="en" />);
    open();
    const first = video();
    fireEvent.keyDown(document, { key: "Escape" });
    open();
    expect(video()).not.toBe(first);
    expect(video()).toBeInTheDocument();
  });
});
