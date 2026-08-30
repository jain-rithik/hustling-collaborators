/**
 * Overlapping arcs: Privilege Leave (teal, outer) + comp-off (purple, inner) — PRD §6.4.
 *
 * The outer arc is drawn against the member's own entitlement (`total`) rather than a fixed
 * ceiling, so a full-timer on 11 and an intern on 4 both read "how much of mine is left".
 */
export function LeaveArc({ remaining, total, compOff }: { remaining: number; total: number; compOff: number }) {
  const rPl = 62;
  const rCo = 46;
  const cPl = 2 * Math.PI * rPl;
  const cCo = 2 * Math.PI * rCo;
  const plPct = total > 0 ? Math.min(Math.max(remaining, 0) / total, 1) : 0;
  const coPct = Math.min(Math.max(compOff, 0) / 8, 1);

  return (
    <div className="relative h-40 w-40">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={rPl} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
        <circle cx="80" cy="80" r={rCo} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
        <circle
          cx="80"
          cy="80"
          r={rPl}
          fill="none"
          stroke="#00D4AA"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={cPl}
          strokeDashoffset={cPl * (1 - plPct)}
          transform="rotate(-90 80 80)"
        />
        <circle
          cx="80"
          cy="80"
          r={rCo}
          fill="none"
          stroke="#7B61FF"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={cCo}
          strokeDashoffset={cCo * (1 - coPct)}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] font-extrabold text-mint">{remaining}</span>
        <span className="text-[11px] text-muted">of {total} privilege</span>
        <span className="mt-1 text-[11px] text-[#c9beff]">{compOff} comp-off</span>
      </div>
    </div>
  );
}
