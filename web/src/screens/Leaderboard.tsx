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

  // The podium and list show the finishing POSITION (1st, 2nd, 3rd …) from the sorted board,
  // so tied scores still read as distinct places rather than everyone sharing "1".
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex flex-col items-center gap-2">
        <Logo height={22} />
        <h1 className="font-display text-xl font-extrabold text-ink">This month's leaderboard</h1>
      </div>

      {q.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((idx) => {
              const r = top3[idx];
              if (!r) return <div key={idx} />;
              const place = idx + 1; // podium slot: centre = 1st, left = 2nd, right = 3rd
              const isFirst = place === 1;
              return (
                <div
                  key={r.userId}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-3 ${
                    isFirst ? 'bg-sunny/15 pb-5' : 'bg-surface'
                  } ${r.userId === me.id ? 'ring-1 ring-primary' : ''}`}
                >
                  <span className="text-lg">{place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}</span>
                  <span className={`font-display font-extrabold leading-none ${isFirst ? 'text-[40px] text-sunny' : 'text-[30px] text-ink'}`}>
                    {ordinal(place)}
                  </span>
                  <span className="max-w-full truncate text-[12px] text-muted">{r.name.split(' ')[0]}</span>
                  <span className="font-display text-sm font-bold text-ink">{r.score}<span className="text-muted">/100</span></span>
                  {r.streak > 1 && <span className="text-[11px] text-mint">🔥 {r.streak}mo</span>}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {rest.map((r, i) => (
              <Card key={r.userId} className={`flex items-center gap-3 !p-3 ${r.userId === me.id ? 'ring-1 ring-primary' : ''}`}>
                <span className="w-8 font-display text-base font-bold text-muted">{ordinal(i + 4)}</span>
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
            Three factors, equally weighted: on-time attendance, hitting your estimates, and delivering campaigns.
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
