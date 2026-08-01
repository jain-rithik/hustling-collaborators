import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Card, Section, Spinner } from '@/components/ui';
import { DayChip, type DayInfo } from '@/components/DayChip';

const clientToday = () => new Date().toLocaleDateString('en-CA');
const thisMonth = () => clientToday().slice(0, 7);
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function Attendance() {
  const user = useAuth((s) => s.user)!;
  const monthQ = useQuery({
    queryKey: ['attendance', user.id, thisMonth()],
    queryFn: () => api.get<{ month: string; days: DayInfo[] }>(`/attendance/${user.id}?month=${thisMonth()}`),
  });

  const days = monthQ.data?.days ?? [];
  const firstWeekday = days[0] ? new Date(`${days[0].day}T00:00:00`).getDay() : 0;

  return (
    <div className="flex flex-col gap-5 pt-1">
      <Section title="Your attendance">
        {monthQ.isLoading ? (
          <Spinner />
        ) : (
          <Card className="flex flex-col gap-3">
            <p className="text-center font-display text-base font-bold text-ink">
              {new Date(`${thisMonth()}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
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
          </Card>
        )}
      </Section>

      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 p-4 text-[12px] text-muted">
        <Legend color="bg-mint" label="On time" />
        <Legend color="bg-coral" label="Late" />
        <Legend color="bg-lavender" label="WFH / half-day" />
        <Legend color="bg-primary" label="On leave" />
        <Legend color="bg-white/10" label="Off / holiday" />
      </div>
      <p className="text-center text-[12px] text-muted/70">
        Late arrivals are just noted here — never an automatic penalty. Finish strong 💪
      </p>
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
