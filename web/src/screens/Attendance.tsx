import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Card, Section, Spinner } from '@/components/ui';
import { DayChip, type DayInfo } from '@/components/DayChip';
import { IconChevronLeft } from '@/components/Icons';

const clientToday = () => new Date().toLocaleDateString('en-CA');
const thisMonth = () => clientToday().slice(0, 7);
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Shift a YYYY-MM key by a number of months. */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Attendance() {
  const user = useAuth((s) => s.user)!;
  const [ym, setYm] = useState(thisMonth());

  const monthQ = useQuery({
    queryKey: ['attendance', user.id, ym],
    queryFn: () => api.get<{ month: string; days: DayInfo[] }>(`/attendance/${user.id}?month=${ym}`),
  });

  const days = monthQ.data?.days ?? [];
  const firstWeekday = days[0] ? new Date(`${days[0].day}T00:00:00`).getDay() : 0;
  // Don't allow browsing beyond the current month (no data exists yet).
  const atCurrentMonth = ym >= thisMonth();

  return (
    <div className="flex flex-col gap-5 pt-1">
      <Section title="Your attendance">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setYm((m) => shiftMonth(m, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-muted transition hover:text-ink"
              aria-label="Previous month"
            >
              <IconChevronLeft />
            </button>
            <p className="font-display text-base font-bold text-ink">
              {new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={() => setYm((m) => shiftMonth(m, 1))}
              disabled={atCurrentMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-muted transition hover:text-ink disabled:opacity-30"
              aria-label="Next month"
            >
              <IconChevronLeft className="rotate-180" />
            </button>
          </div>

          {monthQ.isLoading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="text-[11px] text-muted">
                  {w}
                </span>
              ))}
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`b${i}`} />
              ))}
              {days.map((d) => (
                <DayChip key={d.day} d={d} isToday={d.day === clientToday()} />
              ))}
            </div>
          )}
        </Card>
      </Section>

      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 p-4 text-[12px] text-muted">
        <Legend color="bg-mint" label="On time" />
        <Legend color="bg-coral" label="Late" />
        <Legend color="bg-lavender" label="WFH / half-day" />
        <Legend color="bg-primary" label="On leave" />
        <Legend color="bg-sunny" label="Holiday" />
        <Legend color="bg-white/10" label="Weekly off" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}
