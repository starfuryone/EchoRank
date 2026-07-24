// Dark canvas for the standalone intelligence surface (/intelligence/
// competitors, /intelligence/risk). These pages are styled entirely in the
// dark zinc/teal "signals" palette but historically inherited the root
// layout's white body — bg-zinc-900/60 panels and zinc-200 text over white
// render as washed-out gray. The theme belongs to this segment, so it is
// pinned here (same zinc token family the pages use) rather than by making
// the global body OS-scheme-dependent.
export default function IntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">{children}</div>
  );
}
