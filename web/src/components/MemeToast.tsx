import { useToasts } from '@/store/toast';

/** Rounded pill that slides up from the bottom, sits ~3s, never blocks the UI (PRD §6.5). */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-toast-up pointer-events-auto max-w-[90%] rounded-full border border-primary/70 bg-surface px-4 py-2.5 text-center text-[14px] font-medium text-ink shadow-glow"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
