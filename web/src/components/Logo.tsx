/** White HC wordmark + coloured handshake mark (PRD §6.8). Uses the bundled logo asset. */
export function Logo({ className = '', height = 28 }: { className?: string; height?: number }) {
  return (
    <img
      src="/hc-logo.png"
      alt="Hustling Collaborators"
      height={height}
      style={{ height }}
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}

/** Compact mark-only version (the coloured H) for tight spots. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return <img src="/icon.svg" alt="HC" width={size} height={size} className="select-none" draggable={false} />;
}
