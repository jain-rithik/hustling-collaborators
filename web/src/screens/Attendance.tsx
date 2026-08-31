import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Card, Pill, Section, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { DayChip, type DayInfo } from '@/components/DayChip';
import { IconChevronLeft } from '@/components/Icons';
import { fmtDate, istToday } from '@/lib/format';

const thisMonth = () => istToday().slice(0, 7);
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  mandatory_holiday: 'Mandatory Holiday',
  optional_holiday: 'Optional Holiday',
};

interface Holiday {
  id: string;
  day: string;
  name: string;
  type: 'mandatory_holiday' | 'optional_holiday';
}

interface Birthday {
  fullName: string;
  photoUrl: string | null;
  dateOfBirth: string;
}

/** Shift a YYYY-MM key by a number of months. */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Attendance() {
  const user = useAuth((s) => s.user)!;
  const [ym, setYm] = useState(thisMonth());
  const [selectedHoliday, setSelectedHoliday] = useState<DayInfo | null>(null);

  const monthQ = useQuery({
    queryKey: ['attendance', user.id, ym],
    queryFn: () => api.get<{ month: string; days: DayInfo[] }>(`/attendance/${user.id}?month=${ym}`),
  });

  const holidaysQ = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.get<{ holidays: Holiday[] }>('/holidays'),
  });

  const birthdaysQ = useQuery({
    queryKey: ['birthdays'],
    queryFn: () => api.get<{ birthdays: Birthday[] }>('/profiles/birthdays'),
  });

  const days = monthQ.data?.days ?? [];
  const firstWeekday = days[0] ? new Date(`${days[0].day}T00:00:00`).getDay() : 0;

  const holidays = holidaysQ.data?.holidays ?? [];
  const monthHolidays = holidays.filter((h) => h.day.slice(0, 7) === ym);
  const mandatoryHolidays = monthHolidays.filter((h) => h.type === 'mandatory_holiday');
  const optionalHolidays = monthHolidays.filter((h) => h.type === 'optional_holiday');

  const todayMd = istToday().slice(5); // 'MM-DD'
  const birthdays = (birthdaysQ.data?.birthdays ?? [])
    .filter((b) => b.dateOfBirth.slice(5, 7) === ym.slice(5, 7))
    .sort((a, b) => Number(a.dateOfBirth.slice(8, 10)) - Number(b.dateOfBirth.slice(8, 10)));

  // Resolve the selected holiday's name/type, falling back to the holidays query by day.
  const selectedMatch = selectedHoliday
    ? holidays.find((h) => h.day === selectedHoliday.day)
    : undefined;
  const selectedName = selectedHoliday?.holidayName ?? selectedMatch?.name ?? 'Holiday';
  const selectedType =
    HOLIDAY_TYPE_LABEL[selectedHoliday?.dayType ?? ''] ??
    (selectedMatch ? HOLIDAY_TYPE_LABEL[selectedMatch.type] : undefined) ??
    'Holiday';

  return (
    <div className="flex flex-col gap-5 pt-1">
      {/* Order (v3 feedback): calendar → colour meanings → this month → full holiday list. */}
      <Section title="Your calendar">
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
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-muted transition hover:text-ink"
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
                <DayChip key={d.day} d={d} isToday={d.day === istToday()} onSelect={setSelectedHoliday} />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 p-4 text-[12px] text-muted">
          <Legend color="bg-mint" label="On time" />
          <Legend color="bg-coral" label="Late" />
          <Legend color="bg-halfday" label="Half day" />
          <Legend color="bg-wfh" label="WFH" />
          <Legend color="bg-primary" label="On leave" />
          <Legend color="bg-sunny" label="Holiday" />
        </div>
      </Section>

      {mandatoryHolidays.length > 0 && (
        <Section title="Mandatory Holidays This Month">
          <Card className="flex flex-col gap-1.5">
            {mandatoryHolidays.map((h) => (
              <p key={h.id} className="text-[13px] text-ink/80">
                {`${fmtDate(h.day)} — ${h.name}`}
              </p>
            ))}
          </Card>
        </Section>
      )}

      {optionalHolidays.length > 0 && (
        <Section title="Optional Holidays This Month">
          <Card className="flex flex-col gap-1.5">
            {optionalHolidays.map((h) => (
              <p key={h.id} className="text-[13px] text-ink/80">
                {`${fmtDate(h.day)} — ${h.name}`}
              </p>
            ))}
          </Card>
        </Section>
      )}

      {birthdays.length > 0 && (
        <Section title="Birthdays This Month 🎂">
          <Card className="flex flex-col gap-1.5">
            {birthdays.map((b) => {
              const firstName = b.fullName.split(' ')[0];
              const dayMonth = new Date(`${b.dateOfBirth}T00:00:00`).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              });
              const isBirthdayToday = b.dateOfBirth.slice(5) === todayMd;
              return (
                <p
                  key={`${b.fullName}-${b.dateOfBirth}`}
                  className={`flex items-center gap-2 text-[13px] ${isBirthdayToday ? 'text-sunny' : 'text-ink/80'}`}
                >
                  <span>{`${firstName} — ${dayMonth}`}</span>
                  {isBirthdayToday && <Pill tone="sunny">Today</Pill>}
                </p>
              );
            })}
          </Card>
        </Section>
      )}

      <Link
        to="/holidays"
        className="flex items-center justify-center rounded-2xl border border-white/10 py-3 text-sm text-[#c9beff] transition hover:brightness-110"
      >
        View the full holiday calendar →
      </Link>

      <Modal open={!!selectedHoliday} onClose={() => setSelectedHoliday(null)} title="Holiday">
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-bold text-ink">{selectedName}</p>
          <p className="text-[13px] text-muted">{selectedType}</p>
        </div>
      </Modal>
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
