import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToasts } from '@/store/toast';
import { Button, Card, Pill, Spinner } from '@/components/ui';
import { IconChevronLeft } from '@/components/Icons';
import { type DeadlineState, campaignAccent, campaignLabel, fmtDate, fmtDateTime } from '@/lib/format';
import type { CampaignDto } from '@/components/CampaignCard';
import type { TaskDto } from '@/components/TaskCard';

interface CampaignNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
}

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const meme = useToasts((s) => s.meme);
  const qc = useQueryClient();

  const cQ = useQuery({ queryKey: ['campaign', id], queryFn: () => api.get<{ campaign: CampaignDto }>(`/campaigns/${id}`) });
  const tQ = useQuery({ queryKey: ['campaign', id, 'tasks'], queryFn: () => api.get<{ tasks: TaskDto[] }>(`/campaigns/${id}/tasks`) });

  const deliver = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/deliver`),
    onSuccess: () => {
      void meme('campaign_delivered');
      void qc.invalidateQueries({ queryKey: ['campaign', id] });
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const c = cQ.data?.campaign;
  const canDeliver = c && (user.isAdmin || user.role === 'reporting_manager' || c.leadId === user.id) && c.status !== 'delivered';
  // The lead already appears on their own line, so the team list below is everyone else.
  const teammates = c?.members.filter((m) => m.userId !== c.leadId) ?? [];

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>

      {cQ.isLoading || !c ? (
        <Spinner />
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-ink">{c.clientName ?? c.name}</h1>
                <p className="text-sm text-muted">{c.name}</p>
              </div>
              <Pill tone={campaignAccent[c.state as DeadlineState]}>{campaignLabel[c.state as DeadlineState]}</Pill>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-muted">
              <span>Due {fmtDate(c.deadline)}</span>
            </div>
            {canDeliver && (
              <Button variant="mint" className="mt-2" disabled={deliver.isPending} onClick={() => deliver.mutate()}>
                {deliver.isPending ? 'Saving…' : 'Mark delivered'}
              </Button>
            )}
          </Card>

          {/* Names, not a head count — you should know who you're working with (v4 feedback). */}
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold text-ink">Team</h2>
            <div className="flex flex-wrap gap-2">
              <Pill tone="primary">
                {c.leadName ?? 'Lead not assigned'}
                <span className="rounded-full bg-primary/30 px-1.5 text-[10px] uppercase tracking-wide">Lead</span>
              </Pill>
              {teammates.map((m) => (
                <Pill key={m.userId}>{m.fullName}</Pill>
              ))}
            </div>
            {teammates.length === 0 && <p className="text-[13px] text-muted">No one else on the team yet.</p>}
          </Card>

          <CampaignBrief campaignId={id!} leadId={c.leadId} />

          <h2 className="font-display text-lg font-bold text-ink">Team tasks</h2>
          {(tQ.data?.tasks.length ?? 0) === 0 ? (
            <Card className="text-sm text-muted">No tasks tagged to this campaign yet.</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {tQ.data!.tasks.map((t) => (
                <Card key={t.id} className="flex items-center justify-between !p-3">
                  <span className={`text-sm ${t.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>{t.title}</span>
                  <Pill tone={t.status === 'done' ? 'mint' : t.status === 'active' ? 'primary' : 'default'}>
                    {t.status === 'done' ? 'Done' : t.status === 'active' ? 'In progress' : 'To do'}
                  </Pill>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The brief, a Google Sheet link, or anything else the team needs on hand (v4 feedback). */
function CampaignBrief({ campaignId, leadId }: { campaignId: string; leadId: string }) {
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notesQ = useQuery({
    queryKey: ['campaign', campaignId, 'notes'],
    queryFn: () => api.get<{ notes: CampaignNote[] }>(`/campaigns/${campaignId}/notes`),
  });

  const add = useMutation({
    mutationFn: (body: string) => api.post(`/campaigns/${campaignId}/notes`, { text: body }),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: ['campaign', campaignId, 'notes'] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Couldn't save that. Please try again."),
  });

  const remove = useMutation({
    mutationFn: (noteId: string) => api.del(`/campaigns/${campaignId}/notes/${noteId}`),
    onSuccess: () => {
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ['campaign', campaignId, 'notes'] });
    },
  });

  const trimmed = text.trim();
  // Your own notes are yours to remove; the lead and admins keep the brief tidy.
  const canDelete = (n: CampaignNote) => n.authorId === user.id || leadId === user.id || user.isAdmin;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    setErr(null);
    add.mutate(trimmed);
  }

  const notes = notesQ.data?.notes ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold text-ink">Campaign Brief &amp; Details</h2>

      <Card className="flex flex-col gap-2">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <textarea
            className="input min-h-[84px]"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the brief, a Google Sheet link, or a note the team needs"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted">{err ? <span className="text-coral">{err}</span> : 'Links open in a new tab.'}</p>
            <Button type="submit" className="!px-6 !py-2" disabled={!trimmed || add.isPending}>
              {add.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      </Card>

      {notesQ.isLoading ? (
        <Spinner />
      ) : notes.length === 0 ? (
        <Card className="text-sm text-muted">
          No brief added yet. Paste the brief, a Google Sheet link, or any note the team needs.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <Card key={n.id} className="flex flex-col gap-2 !p-3">
              <NoteText text={n.text} />
              <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
                <span>
                  {n.authorName ?? 'Someone'} · {noteTime(n.createdAt)}
                </span>
                {canDelete(n) &&
                  (confirmDelete === n.id ? (
                    <span className="flex items-center gap-2">
                      <button type="button" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="pill bg-coral/20 text-coral"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(n.id)}
                      >
                        Confirm delete
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="text-coral" onClick={() => setConfirmDelete(n.id)}>
                      Delete
                    </button>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** Split on whole URLs — the capture group keeps them, so odd chunks are always the links. */
const URL_RE = /(https?:\/\/\S+)/g;

/** Notes are plain text from people, so links are built as real <a> nodes — never raw HTML. */
function NoteText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-ink">
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/** Short timestamps: relative while a note is fresh, then the date and 12-hour time. */
function noteTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 2880) return 'Yesterday';
  return fmtDateTime(iso);
}
