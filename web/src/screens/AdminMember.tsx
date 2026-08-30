import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EMPLOYMENT_TYPES, GENDER_LABELS, type Gender } from '@hc/shared';
import { api } from '@/lib/api';
import { Card, Pill, Spinner } from '@/components/ui';
import { IconChevronLeft } from '@/components/Icons';
import { fmtClock, fmtDate } from '@/lib/format';
import type { TaskDto } from '@/components/TaskCard';

interface MemberProfile {
  userId: string;
  fullName: string;
  email: string;
  designation: string | null;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  joiningDate: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  probationEndDate: string | null;
  onProbation: boolean;
  noticeStartDate: string | null;
  noticeLastDate: string | null;
  onNoticePeriod: boolean;
}

interface HistoryDay {
  date: string;
  total: number;
  done: number;
  delayed: number;
  pending: number;
  tasks: TaskDto[];
}

const clientToday = () => new Date().toLocaleDateString('en-CA');

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  intern: 'Internship',
  full_time: 'Full time',
};

/**
 * A member's day, opened from the Admin console (v4 change log). Admin sees what they are
 * working on today and can step back through their last 30 days one date at a time.
 */
export function AdminMember() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const today = clientToday();
  const [openDate, setOpenDate] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.get<{ profile: MemberProfile }>(`/profiles/${userId}`),
  });
  const todayQ = useQuery({
    queryKey: ['tasks', userId, today],
    queryFn: () => api.get<{ tasks: TaskDto[] }>(`/tasks?ownerId=${userId}&date=${today}&carryOver=1`),
  });
  const historyQ = useQuery({
    queryKey: ['tasks', 'history', userId],
    queryFn: () => api.get<{ from: string; to: string; days: HistoryDay[] }>(`/tasks/history?ownerId=${userId}`),
  });

  const p = profileQ.data?.profile;
  const days = historyQ.data?.days ?? [];
  const selected = days.find((d) => d.date === openDate) ?? null;

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Admin console
      </button>

      {profileQ.isLoading || !p ? (
        <Spinner />
      ) : (
        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-ink">{p.fullName}</h1>
              <p className="text-sm text-muted">{p.designation ?? 'No designation added yet'}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="primary">{EMPLOYMENT_LABELS[p.employmentType]}</Pill>
              {p.onProbation && <Pill tone="sunny">On probation</Pill>}
              {p.onNoticePeriod && <Pill tone="coral">Notice period</Pill>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
            <Detail label="Email" value={p.email} />
            {/* Only Admin sees a joining date, which is exactly who is looking at this page. */}
            <Detail label="Joined" value={p.joiningDate ? fmtDate(p.joiningDate) : 'Not added yet'} />
            <Detail label="Birthday" value={p.dateOfBirth ? fmtDate(p.dateOfBirth) : 'Not added yet'} />
            <Detail label="Gender" value={p.gender ? GENDER_LABELS[p.gender] : 'Not added yet'} />
            <Detail
              label="Probation ends"
              value={p.probationEndDate ? fmtDate(p.probationEndDate) : '—'}
            />
            <Detail
              label="Notice"
              value={
                p.noticeStartDate
                  ? `${fmtDate(p.noticeStartDate)}${p.noticeLastDate ? ` → ${fmtDate(p.noticeLastDate)}` : ''}`
                  : 'Not on notice'
              }
            />
          </dl>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Today’s tasks</h2>
        {todayQ.isLoading ? (
          <Spinner />
        ) : (todayQ.data?.tasks.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">Nothing planned for today yet.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {todayQ.data!.tasks.map((t) => (
              <TaskLine key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Last 30 days</h2>
        {historyQ.isLoading ? (
          <Spinner />
        ) : days.length === 0 ? (
          <Card className="text-sm text-muted">No tasks logged in the last 30 days.</Card>
        ) : (
          <>
            {/* Date tabs — tap one to open that day (v4 change log). */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((d) => {
                const active = d.date === openDate;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setOpenDate(active ? null : d.date)}
                    aria-pressed={active}
                    className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-[12px] transition ${
                      active ? 'border-primary bg-primary/20 text-[#c9beff]' : 'border-white/15 bg-white/5 text-muted'
                    }`}
                  >
                    <span className="font-semibold">{fmtDate(d.date)}</span>
                    <span className={d.delayed > 0 ? 'text-coral' : ''}>
                      {d.done}/{d.total}
                      {d.delayed > 0 ? ` · ${d.delayed} delayed` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            {selected ? (
              <div className="flex flex-col gap-2">
                {selected.tasks.map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted">Tap a date to see that day’s tasks.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted/70">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

/** One task, read as "name — campaign — on time / delayed", with the delay remark in view. */
function TaskLine({ t }: { t: TaskDto }) {
  const status =
    t.status !== 'done'
      ? { label: 'Pending', tone: 'sunny' as const }
      : t.timeliness === 'delayed'
        ? { label: 'Delayed', tone: 'coral' as const }
        : { label: t.timeliness === 'before_time' ? 'Before time' : 'On time', tone: 'mint' as const };
  const window =
    t.plannedStartTime && t.plannedEndTime ? `${fmtClock(t.plannedStartTime)} – ${fmtClock(t.plannedEndTime)}` : null;

  return (
    <Card className="flex flex-col gap-1 !p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm text-ink">
          {t.title}
          {t.campaignName && <span className="text-muted"> — {t.campaignName}</span>}
        </span>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      {window && <span className="text-[12px] text-muted">{window}</span>}
      {t.delayReason && (
        <p className="rounded-lg bg-coral/10 px-2.5 py-1.5 text-[12px] text-coral">
          Reason for delay: <span className="text-ink">{t.delayReason}</span>
        </p>
      )}
    </Card>
  );
}
