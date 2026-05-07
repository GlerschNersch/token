/**
 * HomeArcade logo.
 *
 * Concept: a stylised cabinet marquee — a CRT screen with two dot eyes (lit
 * pixels) and a control deck, framed by a rounded bezel. Single-shape mark,
 * works at 16px favicon and 200px hero.
 *
 * Monochrome by default (uses currentColor); when `accent` is true the eyes
 * pick up the accent color and the screen bezel uses the primary.
 */
export function Logo({
  size = 28,
  accent = true,
  className,
}: {
  size?: number;
  accent?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      role="img"
      aria-label="HomeArcade"
      className={className}
    >
      <rect
        x="3"
        y="4"
        width="26"
        height="24"
        rx="3.5"
        stroke={accent ? "hsl(var(--primary))" : "currentColor"}
        strokeWidth="1.6"
      />
      <rect
        x="6"
        y="8"
        width="20"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="12"
        cy="14.5"
        r="1.6"
        fill={accent ? "hsl(var(--accent))" : "currentColor"}
        stroke="none"
      />
      <circle
        cx="20"
        cy="14.5"
        r="1.6"
        fill={accent ? "hsl(var(--accent))" : "currentColor"}
        stroke="none"
      />
      <rect
        x="10"
        y="23"
        width="12"
        height="2"
        rx="1"
        fill={accent ? "hsl(var(--primary))" : "currentColor"}
        stroke="none"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="brand-wordmark">
      <Logo size={24} />
      <div className="leading-none">
        <div className="font-display text-[14px] font-semibold tracking-tight">
          HOME<span className="text-primary">.</span>ARCADE
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground mt-1 whitespace-nowrap">
          Home Assistant ⇄ RetroBat
        </div>
      </div>
    </div>
  );
}
