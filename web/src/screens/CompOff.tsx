import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Pill, Section, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconChevronLeft, IconPlus } from '@/components/Icons';
import { fmtDate } from '@/lib/format';

interface CompOffRequest {
  id: string;
  offDate: string;
  plannedWork: string;
  reason: string;
  status: string;
}

const STATUS_TONE: Record<string, 'mint' | 'coral' | 'sunny' | 'default'> = {
  approved: 'mint',
  rejected: 'coral',
  pending: 'sunny',
};

export function CompOff() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['compoff', 'mine'], queryFn: () => api.get<{ requests: CompOffRequest[] }>('/comp-off/requests') });

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <Section
        title="Comp-off"
        action={
          <Button variant="ghost" className="!px-3 !py-2" onClick={() => setOpen(true)}>
            <IconPlus /> Request
          </Button>
        }
      >
        <p className="-mt-1 text-[12px] text-muted">
          Working an off day? Request BEFORE the day — comp-off is credited by an admin after, at their discretion.
        </p>
        {q.isLoading ? (
          <Spinner />
        ) : (q.data?.requests.length ?? 0) === 0 ? (
          <EmptyState
            emoji="🎟️"
            title="No comp-off requests"
            hint="Planning to work on an off day? Request it in advance to earn a compensatory day off."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {q.data!.requests.map((r) => (
              <Card key={r.id} className="flex items-center justify-between !p-3">
                <div>
                  <p className="font-display font-semibold text-ink">{fmtDate(r.offDate)}</p>
                  <p className="text-[12px] text-muted">{r.plannedWork}</p>
                </div>
                <Pill tone={STATUS_TONE[r.status] ?? 'default'}>{r.status}</Pill>
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
  const [offDate, setOffDate] = useState('');
  const [plannedWork, setPlannedWork] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/comp-off/requests', { offDate, plannedWork, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['compoff'] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (offDate && plannedWork && reason) create.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Comp-off request">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Off day you'll work</label>
          <input className="input" type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Planned work</label>
          <input className="input" value={plannedWork} onChange={(e) => setPlannedWork(e.target.value)} placeholder="Eg. Finalise campaign edits" />
        </div>
        <div>
          <label className="label">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Eg. Approaching client deadline" />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Sending…' : 'Submit request'}
        </Button>
      </form>
    </Modal>
  );
}
