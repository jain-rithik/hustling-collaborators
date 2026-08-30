import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMPLOYMENT_TYPES,
  type EmploymentType,
  GENDER_LABELS,
  GENDERS,
  type Gender,
} from '@hc/shared';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, Card, Pill, Section, Spinner } from '@/components/ui';
import { LeaveArc } from '@/components/LeaveArc';
import { LogoMark } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { IconLogout } from '@/components/Icons';
import { fmtDate, rupees } from '@/lib/format';

interface ProfileDto {
  userId: string;
  fullName: string;
  email: string;
  employmentType: EmploymentType;
  joiningDate: string | null;
  dateOfBirth: string | null;
  designation: string | null;
  department: string | null;
  gender: Gender | null;
  probationEndDate: string | null;
  onProbation: boolean;
  noticeStartDate: string | null;
  noticeLastDate: string | null;
  onNoticePeriod: boolean;
}
interface LeaveBalance {
  pl: number;
  privilege: { total: number; remaining: number };
  sick: { total: number; remaining: number };
  /** Interns draw Privilege and Sick from one shared pool, so both figures are the same number. */
  sharedPool: boolean;
  compOff: number;
  advanceDebt: number;
}
interface SalaryView {
  month: string;
  daysBasis: number;
  perDayRate: number;
  paidDays: number;
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

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  intern: 'Internship',
  full_time: 'Full time',
};

/** `fmtDate` is day + month (right for birthdays); joining and probation dates need the year too. */
const fmtDateYear = (iso: string) => `${fmtDate(iso)} ${iso.slice(0, 4)}`;

export function Profile() {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [salaryUnlocked, setSalaryUnlocked] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editDetails, setEditDetails] = useState(false);

  const profile = useQuery({
    queryKey: ['profile', user.id],
    queryFn: () => api.get<{ profile: ProfileDto }>(`/profiles/${user.id}`),
  });
  const balance = useQuery({ queryKey: ['balance', user.id], queryFn: () => api.get<LeaveBalance>(`/profiles/${user.id}/leave-balance`) });
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

  const me = profile.data?.profile;

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

      <Section
        title="Your details"
        action={
          me && (
            <Button variant="ghost" className="!px-3 !py-2" onClick={() => setEditDetails(true)}>
              Edit
            </Button>
          )
        }
      >
        {!me ? (
          <Spinner />
        ) : (
          <Card className="flex flex-col gap-2 text-sm">
            {(me.onProbation || me.onNoticePeriod) && (
              <div className="mb-1 flex flex-wrap gap-1.5">
                {me.onProbation && (
                  <Pill>On probation{me.probationEndDate ? ` until ${fmtDateYear(me.probationEndDate)}` : ''}</Pill>
                )}
                {me.onNoticePeriod && <Pill tone="sunny">Notice period</Pill>}
              </div>
            )}
            <Detail label="Designation" value={me.designation} />
            <Detail label="Birthday" value={me.dateOfBirth && fmtDate(me.dateOfBirth)} />
            <Detail
              label="Joining date"
              value={me.joiningDate && fmtDateYear(me.joiningDate)}
              caption="Visible only to you and Admin."
            />
            <Detail label="Gender" value={me.gender && GENDER_LABELS[me.gender]} />
            <Detail label="Employment type" value={EMPLOYMENT_TYPE_LABELS[me.employmentType]} />
          </Card>
        )}
      </Section>

      <Section title="Leave balance">
        <Card className="flex items-center justify-around gap-3">
          {balance.data ? (
            <LeaveArc
              remaining={balance.data.privilege.remaining}
              total={balance.data.privilege.total}
              compOff={balance.data.compOff}
            />
          ) : (
            <Spinner />
          )}
          <div className="flex flex-col gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full bg-mint" /> Privilege Leave{' '}
              {balance.data ? `${balance.data.privilege.remaining}/${balance.data.privilege.total}` : '—'}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full bg-lavender" /> Sick Leave{' '}
              {balance.data ? `${balance.data.sick.remaining}/${balance.data.sick.total}` : '—'}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full bg-primary" /> Comp-off {balance.data?.compOff ?? '—'}
            </span>
            {(balance.data?.advanceDebt ?? 0) > 0 && (
              <span className="text-coral">−{balance.data!.advanceDebt} advance</span>
            )}
          </div>
        </Card>
        {balance.data?.sharedPool && (
          <p className="text-[12px] text-muted">
            On an internship, Privilege and Sick leave share one pool of {balance.data.privilege.total}.
          </p>
        )}
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
            <Row label="Per day" value={rupees(salary.data.perDayRate)} />
            <p className="-mt-1 text-[11px] text-muted/70">
              Salary is calculated on a {salary.data.daysBasis}-day month.
            </p>
            <Row label="Paid days" value={`${salary.data.paidDays} of ${salary.data.daysBasis}`} />
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

      {/* Mounted only while open so every field starts from the freshly-fetched profile. */}
      {editDetails && me && <DetailsModal profile={me} onClose={() => setEditDetails(false)} />}

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

/** A member maintaining their own details (v4 change log) — saved via PATCH /profiles/me. */
function DetailsModal({ profile, onClose }: { profile: ProfileDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [designation, setDesignation] = useState(profile.designation ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [joiningDate, setJoiningDate] = useState(profile.joiningDate ?? '');
  const [gender, setGender] = useState<Gender | ''>(profile.gender ?? '');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(profile.employmentType);
  const [err, setErr] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ profile: ProfileDto }>('/profiles/me', {
        designation: designation.trim() || null,
        dateOfBirth: dateOfBirth || null,
        // A joining date can be corrected but never blanked — accrual and probation run off it.
        joiningDate: joiningDate || undefined,
        gender: gender || null,
        employmentType,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', profile.userId] });
      // Employment type decides the entitlement, so the leave figures move with it.
      void qc.invalidateQueries({ queryKey: ['balance', profile.userId] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    save.mutate();
  }

  return (
    <Modal open onClose={onClose} title="Your details">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Designation</label>
          <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Eg. Social Media Executive" />
        </div>
        <div>
          <label className="label">Birthday</label>
          <input className="input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
        <div>
          <label className="label">Joining date</label>
          <input className="input" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
          <p className="mt-1 text-[12px] text-muted">Visible only to you and Admin.</p>
        </div>
        <div>
          <label className="label">Gender</label>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
            <option value="">Not added yet</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Employment type</label>
          <select className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save details'}
        </Button>
      </form>
    </Modal>
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

/** One line of the member's own details. A blank field invites them to add it — it is not an error. */
function Detail({ label, value, caption }: { label: string; value: string | null | undefined; caption?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted">{label}</span>
      <div className="text-right">
        <span className={value ? 'text-ink' : 'text-muted/70'}>{value || 'Not added yet'}</span>
        {caption && <p className="text-[11px] text-muted/70">{caption}</p>}
      </div>
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
