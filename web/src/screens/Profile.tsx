import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, Card, Pill, Section, Spinner } from '@/components/ui';
import { LeaveArc } from '@/components/LeaveArc';
import { LogoMark } from '@/components/Logo';
import { IconLogout } from '@/components/Icons';
import { fmtDate, rupees } from '@/lib/format';

interface SalaryView {
  month: string;
  workingDays: number;
  lwpDays: number;
  advanceDebtDays: number;
  advanceDebtValue: number;
  gross: number;
  deductions: number;
  net: number;
}
interface LedgerEntry {
  id: string;
  effectiveDate: string;
  entryType: string;
  leaveType: string | null;
  amount: number;
  note: string | null;
}

export function Profile() {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const balance = useQuery({ queryKey: ['balance', user.id], queryFn: () => api.get<{ pl: number; compOff: number; advanceDebt: number }>(`/profiles/${user.id}/leave-balance`) });
  const salary = useQuery({ queryKey: ['salary', user.id], queryFn: () => api.get<SalaryView>(`/profiles/${user.id}/salary-view`) });
  const ledger = useQuery({ queryKey: ['ledger', user.id], queryFn: () => api.get<{ ledger: LedgerEntry[] }>(`/profiles/${user.id}/leave-ledger`) });

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="relative overflow-hidden rounded-[18px] bg-surface p-5">
        <div className="absolute right-3 top-3 opacity-30">
          <LogoMark size={26} />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/25 font-display text-xl font-extrabold text-[#c9beff]">
            {user.fullName.slice(0, 1)}
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-ink">{user.fullName}</h1>
            <p className="text-[13px] text-muted">{user.email}</p>
            <div className="mt-1 flex gap-1.5">
              <Pill tone="primary">{user.role.replaceAll('_', ' ')}</Pill>
              {user.isAdmin && <Pill tone="sunny">admin</Pill>}
            </div>
          </div>
        </div>
      </div>

      <Section title="Leave balance">
        <Card className="flex items-center justify-around">
          {balance.data ? <LeaveArc pl={balance.data.pl} compOff={balance.data.compOff} /> : <Spinner />}
          <div className="flex flex-col gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-mint" /> PL {balance.data?.pl ?? '—'}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary" /> Comp-off {balance.data?.compOff ?? '—'}
            </span>
            {(balance.data?.advanceDebt ?? 0) > 0 && (
              <span className="text-coral">−{balance.data!.advanceDebt} advance</span>
            )}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => navigate('/leave')}>
            🏖️ Leave
          </Button>
          <Button variant="ghost" onClick={() => navigate('/comp-off')}>
            🎟️ Comp-off
          </Button>
        </div>
      </Section>

      {salary.data && (
        <Section title="Salary — this month">
          <Card className="flex flex-col gap-2 text-sm">
            <Row label="Base (estimate)" value={rupees(salary.data.gross)} />
            <Row label={`LWP (${salary.data.lwpDays}d / ${salary.data.workingDays} working)`} value={`− ${rupees(salary.data.deductions)}`} />
            {salary.data.advanceDebtDays > 0 && (
              <Row label={`Advance-leave debt (${salary.data.advanceDebtDays}d)`} value={`${rupees(salary.data.advanceDebtValue)} due`} muted />
            )}
            <div className="my-1 border-t border-white/10" />
            <Row label="Net estimate" value={rupees(salary.data.net)} bold />
            <p className="text-[11px] text-muted/70">A transparency estimate — not an official payslip. No PF/ESI/TDS.</p>
          </Card>
        </Section>
      )}

      <Section title="Leave history">
        {ledger.isLoading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-2">
            {(ledger.data?.ledger ?? [])
              .slice()
              .reverse()
              .slice(0, 12)
              .map((e) => (
                <Card key={e.id} className="flex items-center justify-between !p-3 text-sm">
                  <div>
                    <p className="text-ink">{e.note ?? e.entryType}</p>
                    <p className="text-[12px] text-muted">{fmtDate(e.effectiveDate)}</p>
                  </div>
                  <span className={e.amount >= 0 ? 'text-mint' : 'text-coral'}>
                    {e.amount >= 0 ? '+' : ''}
                    {e.amount}
                  </span>
                </Card>
              ))}
          </div>
        )}
      </Section>

      {user.isAdmin && (
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          ⚙️ Admin console
        </Button>
      )}
      <Button variant="ghost" className="!text-coral" onClick={() => void logout()}>
        <IconLogout /> Log out
      </Button>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-muted' : 'text-ink'}`}>
      <span className={muted ? '' : 'text-muted'}>{label}</span>
      <span className={bold ? 'font-display font-bold text-ink' : ''}>{value}</span>
    </div>
  );
}
