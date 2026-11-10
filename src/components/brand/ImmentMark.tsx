/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

/** Pittogramma semplificato Imment (Trust Blue), senza lettering. */
export function ImmentMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="#5195FF" />
      <path
        d="M8.5 22.5V9.5h4.2c2.85 0 4.55 1.45 4.55 3.85 0 1.55-.75 2.7-2.05 3.35L19.5 22.5h-3.55l-3.95-5.55H12v5.55H8.5Zm3.5-8.35h.7c1.15 0 1.85-.6 1.85-1.55s-.7-1.5-1.85-1.5H12v3.05Z"
        fill="#F3F6F9"
      />
      <circle cx="23.2" cy="11.2" r="2.2" fill="#F3F6F9" />
    </svg>
  );
}
