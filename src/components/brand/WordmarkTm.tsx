// The ™ after the K of the ECHORANK wordmark (src/lib/brand/wordmark-tm.ts):
// the shared `er-tm` class from globals.css, decorative so the accessible name
// stays the wordmark's. No hooks, no server imports.

export function WordmarkTm() {
  return (
    <span className="er-tm" aria-hidden="true">
      ™
    </span>
  );
}
