/**
 * Soft multi-node mark — echoes the Ask hub logo without competing with copy.
 * Decorative only (aria-hidden).
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 280 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="ask-hero-glow" x1="40" y1="40" x2="240" y2="240" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" stopOpacity="0.18" />
          <stop offset="1" stopColor="#6B21A8" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <circle cx="140" cy="140" r="120" fill="url(#ask-hero-glow)" />
      {/* Soft brackets */}
      <path
        d="M72 78c-18 12-28 36-28 62s10 50 28 62"
        stroke="#4F46E5"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M208 78c18 12 28 36 28 62s-10 50-28 62"
        stroke="#6B21A8"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.28"
      />
      {/* Hub lines */}
      <line x1="140" y1="140" x2="140" y2="72" stroke="#0A2540" strokeWidth="2.5" opacity="0.2" />
      <line x1="140" y1="140" x2="88" y2="140" stroke="#0A2540" strokeWidth="2.5" opacity="0.2" />
      <line x1="140" y1="140" x2="192" y2="140" stroke="#0A2540" strokeWidth="2.5" opacity="0.2" />
      <line x1="140" y1="140" x2="140" y2="208" stroke="#0A2540" strokeWidth="2.5" opacity="0.2" />
      {/* Nodes */}
      <circle cx="140" cy="140" r="18" fill="#0A2540" opacity="0.85" />
      <circle cx="140" cy="72" r="12" fill="#4F46E5" />
      <circle cx="88" cy="140" r="11" fill="#6B21A8" />
      <circle cx="192" cy="140" r="11" fill="#6366F1" />
      <circle cx="140" cy="208" r="11" fill="#0A2540" opacity="0.7" />
    </svg>
  );
}
