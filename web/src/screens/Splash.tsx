import { Logo } from '@/components/Logo';

export function Splash() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 bg-bg">
      <Logo height={44} />
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
      <p className="text-sm text-muted">Waking up ☕</p>
    </div>
  );
}
