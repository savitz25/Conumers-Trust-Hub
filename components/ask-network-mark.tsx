/**
 * Tight Ask hub mark — viewBox fills the optical square (no transparent padding).
 * Slot height is CSS 36 / 33 / 30 via --th-logo-slot-height.
 */
export function AskNetworkMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      width="36"
      height="36"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M9 5H5v26h4"
        stroke="#0A2540"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 5h4v26h-4"
        stroke="#0A2540"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="18" y1="11.2" x2="18" y2="18" stroke="#0A2540" strokeWidth="1.2" />
      <line x1="12.2" y1="18" x2="18" y2="18" stroke="#0A2540" strokeWidth="1.2" />
      <line x1="23.8" y1="18" x2="18" y2="18" stroke="#0A2540" strokeWidth="1.2" />
      <line x1="18" y1="24.8" x2="18" y2="18" stroke="#0A2540" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="2.1" fill="#0A2540" />
      <circle cx="18" cy="10.2" r="2.5" fill="#F86008" />
      <circle cx="11.2" cy="18" r="2.5" fill="#3B82F6" />
      <circle cx="24.8" cy="18" r="2.5" fill="#14B8A6" />
      <circle cx="18" cy="25.8" r="2.5" fill="#8B5CF6" />
    </svg>
  );
}
