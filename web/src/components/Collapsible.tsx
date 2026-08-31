import { type ReactNode, useState } from 'react';

/**
 * A section that starts closed and opens on tap (v4 change log — the Admin console is a stack
 * of these so the page is scannable instead of endless).
 */
export function Collapsible({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Small count/status shown next to the title, e.g. the number of pending requests. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-[18px] border border-white/10 bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
      >
        <span className="flex items-center gap-2">
          <span className="font-display text-[16px] font-bold text-ink">{title}</span>
          {badge}
        </span>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4">{children}</div>}
    </section>
  );
}
