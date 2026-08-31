/** Round to 2 decimals, killing binary-float drift (leave amounts, money). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Round DOWN to the nearest step (default: half a day). Prorata leave credits use this so a
 * balance is always a clean 0.5-day figure and is never credited before it is fully earned.
 */
export function floorToStep(n: number, step = 0.5): number {
  if (step <= 0) return round2(n);
  return round2(Math.floor(round2(n / step)) * step);
}
