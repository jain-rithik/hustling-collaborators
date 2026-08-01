import type { ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-toast-up rounded-t-[24px] bg-surface p-5 pb-8 shadow-card sm:rounded-[24px] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 font-display text-lg font-bold text-ink">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
