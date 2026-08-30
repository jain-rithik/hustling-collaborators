import { useNavigate } from 'react-router-dom';
import { type DeadlineState, campaignAccent, campaignLabel, daysUntil, fmtDate, HEX } from '@/lib/format';
import { Pill } from './ui';

export interface CampaignDto {
  id: string;
  name: string;
  clientName: string | null;
  leadId: string;
  leadName: string | null;
  deadline: string;
  status: string;
  color: string | null;
  members: { userId: string; fullName: string }[];
  memberNames: string[];
  memberCount: number;
  state: DeadlineState;
}

/** Enough names to recognise the team at a glance; the rest roll up into "+N more". */
const NAMES_SHOWN = 3;

/** Cards name the team instead of counting it (v4 feedback), without wrapping into a wall of names. */
function teamLine(names: string[]): string {
  if (names.length === 0) return 'No one added yet';
  const extra = names.length - NAMES_SHOWN;
  return extra > 0 ? `${names.slice(0, NAMES_SHOWN).join(', ')} +${extra} more` : names.join(', ');
}

export function CampaignCard({ c }: { c: CampaignDto }) {
  const navigate = useNavigate();
  const accent = campaignAccent[c.state];
  const border = c.color ?? HEX[accent];
  const overdue = c.state === 'overdue';
  const d = daysUntil(c.deadline);
  const countdown =
    c.state === 'delivered' ? 'Delivered' : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : `${d}d left`;

  return (
    <button
      onClick={() => navigate(`/campaigns/${c.id}`)}
      className={`card relative w-full overflow-hidden text-left transition active:scale-[0.99] ${
        overdue ? 'animate-pulse-soft' : ''
      }`}
      style={{ borderLeft: `6px solid ${border}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[17px] font-bold text-ink">
            {c.clientName ?? c.name}
          </h3>
          <p className="truncate text-[13px] text-muted">{c.name}</p>
        </div>
        <Pill tone={accent}>{c.status === 'delivered' ? 'Delivered' : campaignLabel[c.state]}</Pill>
      </div>
      {/* Who is on this and when it's due, so nobody has to tap in to find out (v4 feedback). */}
      <div className="mt-3 flex flex-col gap-1 text-[13px] leading-snug">
        <p className="truncate text-muted/70">
          Lead: <span className="text-ink">{c.leadName ?? 'Not assigned yet'}</span>
        </p>
        <p className="break-words text-muted/70">
          Team: <span className="text-ink">{teamLine(c.memberNames)}</span>
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
        <span className="text-muted/70">
          Deadline: <span className="text-ink">{fmtDate(c.deadline)}</span>
        </span>
        <span className={overdue ? 'font-semibold text-coral' : 'text-muted'}>{countdown}</span>
      </div>
    </button>
  );
}
