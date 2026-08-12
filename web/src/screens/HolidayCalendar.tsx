import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, EmptyState, Pill, Section, Spinner } from '@/components/ui';
import { IconChevronLeft } from '@/components/Icons';
import { fmtDate } from '@/lib/format';

interface Holiday {
  id: string;
  day: string;
  name: string;
  type: 'mandatory_holiday' | 'optional_holiday';
  seeded: boolean;
}

function monthLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function weekdayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
}

/** Group holidays (already sorted by day ascending) into ordered month buckets. */
function groupByMonth(holidays: Holiday[]): { month: string; items: Holiday[] }[] {
  const groups: { month: string; items: Holiday[] }[] = [];
  for (const holiday of holidays) {
    const month = monthLabel(holiday.day);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(holiday);
    else groups.push({ month, items: [holiday] });
  }
  return groups;
}

export function HolidayCalendar() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['holidays'], queryFn: () => api.get<{ holidays: Holiday[] }>('/holidays') });

  const holidays = q.data?.holidays ?? [];
  const today = new Date().toLocaleDateString('en-CA');
  const months = groupByMonth(holidays);

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <h1 className="font-display text-xl font-extrabold text-ink">Holiday Calendar</h1>
      {q.isLoading ? (
        <Spinner />
      ) : holidays.length === 0 ? (
        <EmptyState emoji="📅" title="No holidays listed" hint="Holidays for the year will appear here." />
      ) : (
        months.map((group) => (
          <Section key={group.month} title={group.month}>
            <div className="flex flex-col gap-2">
              {group.items.map((h) => (
                <Card
                  key={h.id}
                  className={`flex items-center justify-between !p-3 ${h.day < today ? 'opacity-60' : ''}`}
                >
                  <div>
                    <p className="text-[12px] text-muted">
                      {weekdayLabel(h.day)} · {fmtDate(h.day)}
                    </p>
                    <p className="font-display font-semibold text-ink">{h.name}</p>
                  </div>
                  {h.type === 'mandatory_holiday' ? (
                    <Pill tone="coral">Mandatory</Pill>
                  ) : (
                    <Pill tone="sunny">Optional</Pill>
                  )}
                </Card>
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}
