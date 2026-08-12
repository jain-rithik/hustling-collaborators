import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { MemeEventKey } from '@hc/shared';
import { useAuth } from '@/store/auth';
import { useToasts } from '@/store/toast';
import { api } from '@/lib/api';
import { Card, Pill, Section, Spinner, StatCard } from '@/components/ui';
import { CampaignCard, type CampaignDto } from '@/components/CampaignCard';
import { BreakControls } from '@/components/BreakControls';
import { IconPin } from '@/components/Icons';
import { fmtTime12, greeting } from '@/lib/format';

const STATE_PRIORITY: Record<string, number> = { overdue: 0, due_today: 1, coming_up: 2, on_track: 3, delivered: 4 };
const clientToday = () => new Date().toLocaleDateString('en-CA');

export function Home() {
  const user = useAuth((s) => s.user)!;
  const meme = useToasts((s) => s.meme);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => api.get<TodayAttendance>('/attendance/today') });
  const tasks = useQuery({ queryKey: ['tasks', clientToday()], queryFn: () => api.get<{ tasks: unknown[] }>(`/tasks?date=${clientToday()}`) });
  const board = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.get<{ board: BoardRow[] }>('/leaderboard') });
  const focus = useQuery({ queryKey: ['focus'], queryFn: () => api.get<{ todayMinutes: number; phrase: string }>('/focus/me') });
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<{ campaigns: CampaignDto[] }>('/campaigns') });

  const invalidateToday = () => qc.invalidateQueries({ queryKey: ['attendance', 'today'] });

  const checkIn = useMutation({
    mutationFn: async () => {
      const geo = await getGeo();
      return api.post<{ memeEvent: MemeEventKey }>('/attendance/check-in', geo);
    },
    onSuccess: (res) => {
      void meme(res.memeEvent);
      void invalidateToday();
    },
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const geo = await getGeo();
      return api.post('/attendance/check-out', geo);
    },
    onSuccess: () => void invalidateToday(),
  });

  const wfh = useMutation({
    mutationFn: () => api.post<{ memeEvent: MemeEventKey }>('/attendance/wfh-confirm'),
    onSuccess: (res) => {
      void meme(res.memeEvent);
      void invalidateToday();
    },
  });

  const rank = board.data?.board.find((b) => b.userId === user.id)?.rank;
  const taskCount = tasks.data?.tasks.length ?? 0;
  const urgent = [...(campaigns.data?.campaigns ?? [])]
    .filter((c) => c.state !== 'delivered')
    .sort((a, b) => (STATE_PRIORITY[a.state] ?? 9) - (STATE_PRIORITY[b.state] ?? 9))[0];

  const firstName = user.fullName.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col gap-6 pt-1">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink">
            {greeting()},<br />
            {firstName}
          </h1>
        </div>
        <span className="mt-1 text-[13px] text-muted">
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </header>

      {today.data && (
        <AttendanceCTA
          today={today.data}
          onCheckIn={() => checkIn.mutate()}
          onCheckOut={() => checkOut.mutate()}
          onWfh={() => wfh.mutate()}
          busy={checkIn.isPending || checkOut.isPending || wfh.isPending}
        />
      )}

      {today.data?.checkedIn && today.data.status !== 'wfh' && <BreakControls />}

      <div className="grid grid-cols-2 gap-3">
        <button className="text-left" onClick={() => navigate('/tasks')}>
          <StatCard label="Today's tasks" value={taskCount} sub={taskCount === 0 ? 'Add your first' : 'View your plan'} />
        </button>
        <button className="text-left" onClick={() => navigate('/leaderboard')}>
          <StatCard label="Leaderboard" value={rank ? `#${rank}` : '—'} accent="sunny" sub={rank ? 'this month' : 'building it'} />
        </button>
      </div>

      {focus.data && (
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-muted">Today's focus</p>
            <p className="font-display text-lg font-bold text-mint">{focus.data.phrase}</p>
          </div>
          <span className="text-2xl">🧠</span>
        </Card>
      )}

      <Section title="Your campaign">
        {campaigns.isLoading ? (
          <Spinner />
        ) : urgent ? (
          <CampaignCard c={urgent} />
        ) : (
          <Card className="text-sm text-muted">No active campaigns right now.</Card>
        )}
      </Section>
    </div>
  );
}

function AttendanceCTA({
  today,
  onCheckIn,
  onCheckOut,
  onWfh,
  busy,
}: {
  today: TodayAttendance;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onWfh: () => void;
  busy: boolean;
}) {
  if (today.checkedIn) {
    const label =
      today.status === 'wfh'
        ? 'Working from home today'
        : today.isLate
          ? 'Checked in for the day'
          : 'Checked in for the day';
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm text-ink">{label}</span>
            {today.checkInAt && (
              <span className="text-[12px] text-muted">
                In at {fmtTime12(today.checkInAt)}
                {today.checkOutAt ? ` · Out at ${fmtTime12(today.checkOutAt)}` : ''}
              </span>
            )}
          </div>
          <Pill tone={today.isLate ? 'coral' : 'mint'}>{today.status}</Pill>
        </div>
        {today.status !== 'wfh' &&
          (today.checkedOut ? (
            <p className="text-center text-[12px] text-muted">You have checked out for the day.</p>
          ) : (
            <button onClick={onCheckOut} disabled={busy} className="btn w-full bg-white/8 text-ink disabled:opacity-50">
              {busy ? 'Please wait…' : 'Check out for the day'}
            </button>
          ))}
      </Card>
    );
  }
  if (today.isWfhDay) {
    return (
      <button onClick={onWfh} disabled={busy} className="btn w-full bg-lavender/20 py-4 text-lavender">
        Working from home today — tap to confirm
      </button>
    );
  }
  if (today.canCheckIn) {
    return (
      <button onClick={onCheckIn} disabled={busy} className="btn-primary w-full py-4 text-base">
        <IconPin /> {busy ? 'Checking you in…' : 'Check in for the day'}
      </button>
    );
  }
  return (
    <Card className="text-sm text-muted">
      Today is a day off — {today.dayType.replaceAll('_', ' ')}. Your tasks stay open if you choose to work.
    </Card>
  );
}

async function getGeo(): Promise<{ lat: number | null; lng: number | null; accuracy: number | null }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ lat: null, lng: null, accuracy: null });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve({ lat: null, lng: null, accuracy: null }),
      { timeout: 8000 },
    );
  });
}

interface TodayAttendance {
  day: string;
  dayType: string;
  canCheckIn: boolean;
  isWfhDay: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
  status: string | null;
  isLate: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
}
interface BoardRow {
  userId: string;
  rank: number;
}
