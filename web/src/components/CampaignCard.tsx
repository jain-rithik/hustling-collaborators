import { useNavigate } from 'react-router-dom';
import { type DeadlineState, campaignAccent, campaignLabel, daysUntil, fmtDate, HEX } from '@/lib/format';
import { Pill } from './ui';

export interface CampaignDto {
  id: string;
  name: string;
  clientName: string | null;
  leadId: string;
  deadline: string;
  status: string;
  color: string | null;
  memberCount: number;
  state: DeadlineState;
}

export function CampaignCard({ c }: { c: CampaignDto }) {
  const navigate = useNavigate();
  const accent = campaignAccent[c.state];
  const border = c.color ?? HEX[accent];
  const overdue = c.state === 'overdue';
  const d = daysUntil(c.deadline);

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
      <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
        <span>👥 {c.memberCount} on it</span>
        <span>
          {c.state === 'delivered'
            ? '🎉 shipped'
            : d < 0
              ? `${Math.abs(d)}d overdue`
              : d === 0
                ? 'Due today'
                : `${d}d left · ${fmtDate(c.deadline)}`}
        </span>
      </div>
    </button>
  );
}
