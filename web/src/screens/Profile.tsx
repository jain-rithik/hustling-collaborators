import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, Card, Pill, Section, Spinner } from '@/components/ui';
import { LeaveArc } from '@/components/LeaveArc';
import { LogoMark } from '@/components/Logo';
import { Modal } from '@/components/Modal';
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
  const [salaryUnlocked, setSalaryUnlocked] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const balance = useQuery({ queryKey: ['balance', user.id], queryFn: () => api.get<{ pl: number; compOff: number; advanceDebt: number }>(`/profiles/${user.id}/leave-balance`) });
  const salary = useQuery({
    queryKey: ['salary', user.id],
    queryFn: () => api.get<SalaryView>(`/profiles/${user.id}/salary-view`),
    enabled: salaryUnlocked,
  });
  const ledger = useQuery({
    queryKey: ['ledger', user.id],
    queryFn: () => api.get<{ ledger: LedgerEntry[] }>(`/profiles/${user.id}/leave-ledger`),
    enabled: showHistory,
  });

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
              <span className="h-3 w-3 rounded-full bg-mint" /> Paid Leave {balance.data?.pl ?? '—'}
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
            🗓️ Leave
          </Button>
          <Button variant="ghost" onClick={() => navigate('/comp-off')}>
            🎟️ Comp-off
          </Button>
        </div>
      </Section>

      <Section title="Salary">
        {!salaryUnlocked ? (
          <Card className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="text-lg">🔒</span>
              <span>Your salary details are protected.</span>
            </div>
            <Button variant="ghost" className="!px-3 !py-2" onClick={() => setAskPassword(true)}>
              View
            </Button>
          </Card>
        ) : salary.isLoading || !salary.data ? (
          <Spinner />
        ) : (
          <Card className="flex flex-col gap-2 text-sm">
            <Row label="Base (estimate)" value={rupees(salary.data.gross)} />
            <Row label={`LWP (${salary.data.lwpDays}d / ${salary.data.workingDays} working)`} value={`− ${rupees(salary.data.deductions)}`} />
            {salary.data.advanceDebtDays > 0 && (
              <Row label={`Advance-leave debt (${salary.data.advanceDebtDays}d)`} value={`${rupees(salary.data.advanceDebtValue)} due`} muted />
            )}
            <div className="my-1 border-t border-white/10" />
            <Row label="Net estimate" value={rupees(salary.data.net)} bold />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted/70">A transparency estimate — not an official payslip. No PF/ESI/TDS.</p>
              <button className="text-[11px] text-muted underline" onClick={() => setSalaryUnlocked(false)}>
                Hide
              </button>
            </div>
          </Card>
        )}
      </Section>

      <Section title="Leave history">
        <Card className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Your full accrual and deduction history.</span>
          <Button variant="ghost" className="!px-3 !py-2" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Hide' : 'View'}
          </Button>
        </Card>
        {showHistory &&
          (ledger.isLoading ? (
            <Spinner />
          ) : (ledger.data?.ledger.length ?? 0) === 0 ? (
            <Card className="text-sm text-muted">No history yet.</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {(ledger.data?.ledger ?? [])
                .slice()
                .reverse()
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
          ))}
      </Section>

      {user.isAdmin && (
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          ⚙️ Admin console
        </Button>
      )}
      <Button variant="ghost" className="!text-coral" onClick={() => void logout()}>
        <IconLogout /> Log out
      </Button>

      <PasswordGateModal
        open={askPassword}
        onClose={() => setAskPassword(false)}
        onVerified={() => {
          setSalaryUnlocked(true);
          setAskPassword(false);
        }}
      />
    </div>
  );
}

/** Re-confirm the signed-in user's password before revealing salary. */
function PasswordGateModal({ open, onClose, onVerified }: { open: boolean; onClose: () => void; onVerified: () => void }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const verify = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/auth/verify-password', { password }),
    onSuccess: (res) => {
      if (res.ok) {
        setPassword('');
        setErr('');
        onVerified();
      } else {
        setErr('Incorrect password. Please try again.');
      }
    },
    onError: () => setErr('Incorrect password. Please try again.'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (password) verify.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirm your password">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">For your privacy, please re-enter your password to view salary details.</p>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={verify.isPending}>
          {verify.isPending ? 'Checking…' : 'Unlock salary'}
        </Button>
      </form>
    </Modal>
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
