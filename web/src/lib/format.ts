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
  overdue: 'This one needs your attention 🔴',
  delivered: 'Delivered ✅',
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
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
