import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'coral' | 'mint' }) {
  const styles = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    coral: 'btn bg-coral text-[#2a0d0d]',
    mint: 'btn bg-mint text-[#062a22]',
  }[variant];
  return (
    <button className={`${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Pill({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'mint' | 'coral' | 'sunny' | 'lavender' | 'primary';
}) {
  const tones = {
    default: 'bg-white/8 text-muted',
    mint: 'bg-mint/15 text-mint',
    coral: 'bg-coral/15 text-coral',
    sunny: 'bg-sunny/15 text-sunny',
    lavender: 'bg-lavender/20 text-lavender',
    primary: 'bg-primary/20 text-[#c9beff]',
  }[tone];
  return <span className={`pill ${tones} ${className}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  hint,
  action,
}: {
  emoji: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="text-3xl">{emoji}</div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {hint && <p className="max-w-xs text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = 'primary',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: 'primary' | 'mint' | 'coral' | 'sunny';
}) {
  const ring = {
    primary: 'text-primary',
    mint: 'text-mint',
    coral: 'text-coral',
    sunny: 'text-sunny',
  }[accent];
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`font-display text-[28px] font-extrabold leading-none ${ring}`}>{value}</span>
      {sub && <span className="text-[13px] text-muted">{sub}</span>}
    </Card>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[20px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
