import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { MemeEventKey } from '@hc/shared';
import { useAuth } from '@/store/auth';
import { useToasts } from '@/store/toast';
import { api } from '@/lib/api';
import { Card, Pill, Section, Spinner, StatCard } from '@/components/ui';
import { CampaignCard, type CampaignDto } from '@/components/CampaignCard';
import { IconPin } from '@/components/Icons';
import { greeting } from '@/lib/format';

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
  const balance = useQuery({ queryKey: ['balance', user.id], queryFn: () => api.get<Balance>(`/profiles/${user.id}/leave-balance`) });
  const focus = useQuery({ queryKey: ['focus'], queryFn: () => api.get<{ todayMinutes: number; phrase: string }>('/focus/me') });
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<{ campaigns: CampaignDto[] }>('/campaigns') });

  const checkIn = useMutation({
    mutationFn: async () => {
      const geo = await getGeo();
      return api.post<{ memeEvent: MemeEventKey }>('/attendance/check-in', geo);
    },
    onSuccess: (res) => {
      void meme(res.memeEvent);
      void qc.invalidateQueries({ queryKey: ['attendance', 'today'] });
    },
  });

  const wfh = useMutation({
    mutationFn: () => api.post<{ memeEvent: MemeEventKey }>('/attendance/wfh-confirm'),
    onSuccess: (res) => {
      void meme(res.memeEvent);
      void qc.invalidateQueries({ queryKey: ['attendance', 'today'] });
    },
  });

  const rank = board.data?.board.find((b) => b.userId === user.id)?.rank;
  const taskCount = tasks.data?.tasks.length ?? 0;
  const urgent = [...(campaigns.data?.campaigns ?? [])]
    .filter((c) => c.state !== 'delivered')
    .sort((a, b) => (STATE_PRIORITY[a.state] ?? 9) - (STATE_PRIORITY[b.state] ?? 9))[0];

  const firstName = user.fullName.split(' ')[0] || 'Hustler';

  return (
    <div className="flex flex-col gap-6 pt-1">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-muted">{greeting()}</p>
          <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink">
            Hey Hustler {firstName}, <br />
            Let's go 🚀
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
          onWfh={() => wfh.mutate()}
          busy={checkIn.isPending || wfh.isPending}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <button className="text-left" onClick={() => navigate('/tasks')}>
          <StatCard label="Today's tasks" value={taskCount} sub={taskCount === 0 ? 'add your first 🎯' : 'kya plan hai'} />
        </button>
        <button className="text-left" onClick={() => navigate('/leaderboard')}>
          <StatCard label="Leaderboard" value={rank ? `#${rank}` : '—'} accent="sunny" sub={rank ? 'this month' : 'building it'} />
        </button>
      </div>

      {focus.data && (
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-muted">Today's Focus</p>
            <p className="font-display text-lg font-bold text-mint">{focus.data.phrase} 🎯</p>
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
          <Card className="text-sm text-muted">No active campaigns right now — enjoy the calm ✨</Card>
        )}
      </Section>

      {balance.data && (
        <div className="flex items-center justify-center gap-2">
          <Pill tone="mint">🏖️ {balance.data.pl} PL left</Pill>
          <Pill tone="primary">🎟️ {balance.data.compOff} comp-off</Pill>
          {balance.data.advanceDebt > 0 && <Pill tone="coral">−{balance.data.advanceDebt} advance</Pill>}
        </div>
      )}
    </div>
  );
}

function AttendanceCTA({
  today,
  onCheckIn,
  onWfh,
  busy,
}: {
  today: TodayAttendance;
  onCheckIn: () => void;
  onWfh: () => void;
  busy: boolean;
}) {
  if (today.checkedIn) {
    return (
      <Card className="flex items-center justify-between">
        <span className="text-sm text-ink">
          {today.status === 'wfh' ? 'Working from home today 🏠' : today.isLate ? 'Checked in (a lil late) ✅' : "You're checked in ✅"}
        </span>
        <Pill tone={today.isLate ? 'coral' : 'mint'}>{today.status}</Pill>
      </Card>
    );
  }
  if (today.isWfhDay) {
    return (
      <button onClick={onWfh} disabled={busy} className="btn w-full bg-lavender/20 py-4 text-lavender">
        Working from home today 🏠 — tap to confirm
      </button>
    );
  }
  if (today.canCheckIn) {
    return (
      <button onClick={onCheckIn} disabled={busy} className="btn-primary w-full py-4 text-base">
        <IconPin /> {busy ? 'Marking you in…' : 'Check in for the day'}
      </button>
    );
  }
  return (
    <Card className="text-sm text-muted">
      Aaj chhutti hai 🌴 — {today.dayType.replaceAll('_', ' ')}. Tasks still open if you're hustling.
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
  status: string | null;
  isLate: boolean;
}
interface BoardRow {
  userId: string;
  rank: number;
}
interface Balance {
  pl: number;
  compOff: number;
  advanceDebt: number;
}
