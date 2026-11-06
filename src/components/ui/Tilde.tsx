/** El ✓ que se dibuja solo (300 ms): al anotar, cobrar o guardar. Con reduced-motion queda dibujado. */
export function Tilde({ tamano = 28, color = "var(--verde)", className = "" }: { tamano?: number; color?: string; className?: string }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path className="tilde" d="M5 13l4 4L19 7" />
    </svg>
  );
}
