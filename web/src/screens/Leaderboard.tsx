import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Card, Spinner } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { IconArrowDown, IconArrowUp } from '@/components/Icons';

interface Row {
  userId: string;
  name: string;
  photoUrl: string | null;
  score: number;
  hasData: boolean;
  rank: number;
  movement: 'up' | 'down' | 'same' | 'new';
  streak: number;
}

export function Leaderboard() {
  const me = useAuth((s) => s.user)!;
  const q = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.get<{ board: Row[] }>('/leaderboard') });
  const board = q.data?.board ?? [];
  const top3 = board.slice(0, 3);
  const rest = board.slice(3);

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex flex-col items-center gap-2">
        <Logo height={22} />
        <h1 className="font-display text-xl font-extrabold text-ink">This month's board 🏆</h1>
      </div>

      {q.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((idx) => {
              const r = top3[idx];
              if (!r) return <div key={idx} />;
              const isFirst = idx === 0;
              return (
                <div
                  key={r.userId}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-3 ${
                    isFirst ? 'bg-sunny/15 pb-5' : 'bg-surface'
                  } ${r.userId === me.id ? 'ring-1 ring-primary' : ''}`}
                >
                  <span className="text-lg">{isFirst ? '👑' : idx === 1 ? '🥈' : '🥉'}</span>
                  <span className={`font-display font-extrabold leading-none ${isFirst ? 'text-[48px] text-sunny' : 'text-[34px] text-ink'}`}>
                    {r.rank}
                  </span>
                  <span className="max-w-full truncate text-[12px] text-muted">{r.name.split(' ')[0]}</span>
                  <span className="font-display text-sm font-bold text-ink">{r.score}<span className="text-muted">/100</span></span>
                  {r.streak > 1 && <span className="text-[11px] text-mint">🔥 {r.streak}mo</span>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {rest.map((r) => (
              <Card key={r.userId} className={`flex items-center gap-3 !p-3 ${r.userId === me.id ? 'ring-1 ring-primary' : ''}`}>
                <span className="w-6 font-display text-lg font-bold text-muted">{r.rank}</span>
                <div className="flex-1">
                  <p className="font-display font-semibold text-ink">{r.name}</p>
                  {r.streak > 1 && <p className="text-[11px] text-mint">🔥 {r.streak}-month streak</p>}
                </div>
                <Movement m={r.movement} />
                <span className="font-display text-lg font-extrabold text-ink">{r.score}</span>
              </Card>
            ))}
          </div>
          <p className="text-center text-[12px] text-muted/70">
            Three things, equally weighted: showing up on time, hitting your estimates, delivering campaigns. 💪
          </p>
        </>
      )}
    </div>
  );
}

function Movement({ m }: { m: Row['movement'] }) {
  if (m === 'up') return <IconArrowUp className="text-mint" width={18} height={18} />;
  if (m === 'down') return <IconArrowDown className="text-coral" width={18} height={18} />;
  if (m === 'new') return <span className="text-[11px] text-lavender">new</span>;
  return <span className="text-muted">·</span>;
}
