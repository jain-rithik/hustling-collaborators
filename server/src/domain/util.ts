/** Round to 2 decimals, killing binary-float drift (leave amounts, money). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
