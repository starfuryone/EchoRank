/**
 * Deterministic initials avatar, used when a user has no provider image.
 *
 * Rendered as inline SVG rather than a generated raster file: it needs no
 * build step, no storage, and stays crisp at any size. The hue is derived
 * from the seed so a given user always gets the same colour, and the palette
 * is restricted to the shell's dark/gold range.
 */

function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  // Bias toward the amber/gold end of the wheel so avatars sit in the shell palette.
  return 30 + (h % 40);
}

export function InitialsAvatar({
  name,
  email,
  size = 56,
  className = "",
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = initialsOf(name, email);
  const hue = hueOf(name || email || "anon");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={name || email || "Avatar"}
      className={className}
    >
      <circle cx="50" cy="50" r="50" fill={`hsl(${hue} 45% 18%)`} />
      <circle cx="50" cy="50" r="49" fill="none" stroke={`hsl(${hue} 70% 55%)`} strokeWidth="2" />
      <text
        x="50"
        y="50"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize="38"
        fontWeight="600"
        fill={`hsl(${hue} 75% 70%)`}
        fontFamily="system-ui, sans-serif"
      >
        {initials}
      </text>
    </svg>
  );
}

export { initialsOf };
