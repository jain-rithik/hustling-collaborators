export type DeadlineState = 'on_track' | 'coming_up' | 'due_today' | 'overdue' | 'delivered';

export const campaignAccent: Record<DeadlineState, 'mint' | 'sunny' | 'coral' | 'lavender'> = {
  on_track: 'mint',
  coming_up: 'sunny',
  due_today: 'coral',
  overdue: 'coral',
  delivered: 'lavender',
};

export const campaignLabel: Record<DeadlineState, string> = {
  on_track: 'On track',
  coming_up: 'Coming up',
  due_today: 'Due today',
  overdue: 'Overdue — needs attention',
  delivered: 'Delivered',
};

export const HEX = {
  mint: '#00D4AA',
  coral: '#FF6B6B',
  sunny: '#FFD60A',
  lavender: '#C4B5FD',
  primary: '#7B61FF',
} as const;

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso)
    .toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s?[AP]M/i, (m) => m.trim().toLowerCase());
}

/** A clock time-of-day in 12-hour "4 pm" / "4:30 pm" form (minutes dropped when :00). */
function to12h(hours: number, minutes: number): string {
  const period = hours < 12 ? 'am' : 'pm';
  const hr = hours % 12 || 12;
  return minutes === 0 ? `${hr} ${period}` : `${hr}:${String(minutes).padStart(2, '0')} ${period}`;
}

/** Format an "HH:mm" string (planned task window, half-day times) as "4 pm" / "4:30 pm". */
export function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return to12h(h, m);
}

/** Format an ISO instant as an IST clock time, e.g. "10:32 am" (used for arrival/check-in times). */
export function fmtTime12(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    .replace(/\s?[AP]M/i, (m) => m.trim().toLowerCase());
}

/** Minutes between two "HH:mm" strings (planned end − start), or null if invalid/negative. */
export function minutesBetween(startHHmm: string, endHHmm: string): number | null {
  const [sh, sm] = startHHmm.split(':').map(Number);
  const [eh, em] = endHHmm.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function minutesToHuman(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
