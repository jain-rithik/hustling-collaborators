import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LEAVE_TYPES, type LeaveType } from '@hc/shared';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Pill, Section, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconChevronLeft, IconPlus } from '@/components/Icons';
import { fmtDate } from '@/lib/format';

interface LeaveRequest {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  requestedDays: number;
  reason: string;
  status: string;
}

const STATUS_TONE: Record<string, 'mint' | 'coral' | 'sunny' | 'default'> = {
  approved: 'mint',
  rejected: 'coral',
  pending: 'sunny',
  cancelled: 'default',
};

export function Leave() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['leave', 'mine'], queryFn: () => api.get<{ requests: LeaveRequest[] }>('/leave/requests') });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave'] }),
  });

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <Section
        title="Your leave"
        action={
          <Button variant="ghost" className="!px-3 !py-2" onClick={() => setOpen(true)}>
            <IconPlus /> Request
          </Button>
        }
      >
        {q.isLoading ? (
          <Spinner />
        ) : (q.data?.requests.length ?? 0) === 0 ? (
          <EmptyState emoji="🏖️" title="No leave yet" hint="Need a break? Request one — you've earned it." />
        ) : (
          <div className="flex flex-col gap-2">
            {q.data!.requests.map((r) => (
              <Card key={r.id} className="flex items-center justify-between !p-3">
                <div>
                  <p className="font-display font-semibold text-ink">
                    {r.leaveType.replaceAll('_', ' ')} · {r.requestedDays}d
                  </p>
                  <p className="text-[12px] text-muted">
                    {fmtDate(r.startDate)}
                    {r.startDate !== r.endDate ? ` → ${fmtDate(r.endDate)}` : ''} · {r.reason}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                  {r.status === 'pending' && (
                    <button className="text-[11px] text-coral" onClick={() => cancel.mutate(r.id)}>
                      cancel
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
      <RequestModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function RequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [leaveType, setLeaveType] = useState<LeaveType>('pl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post('/leave/requests', { leaveType, startDate, endDate: isHalfDay ? startDate : endDate || startDate, isHalfDay, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave'] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (startDate && reason) create.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Request leave">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} /> Half day
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">From</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {!isHalfDay && (
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <label className="label">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ghar pe function hai" />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Sending…' : 'Submit request'}
        </Button>
      </form>
    </Modal>
  );
}
