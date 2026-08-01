/**
 * Focus Time (PRD §12). The sum of Start→Done durations across the tasks completed that
 * day. Only Start→Done counts — the gap between task creation and Start is excluded by
 * construction (that is how `actualMinutes` is computed). Rendered as "Xh Ym in the zone".
 */
export interface DoneTaskTime {
  actualMinutes: number | null;
}

export function computeFocusMinutes(doneTasks: DoneTaskTime[]): number {
  return doneTasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);
}

/** Human phrase used by the client (which adds the 🎯). Never a percentage (PRD §7). */
export function formatFocus(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m in the zone`;
  if (m === 0) return `${h}h in the zone`;
  return `${h}h ${m}m in the zone`;
}
