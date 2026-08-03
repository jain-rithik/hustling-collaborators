import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';

export function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(email, password);
      navigate('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-7 px-6">
      <Logo height={46} />
      <div className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-ink">Welcome back</h1>
        <p className="text-muted">Sign in to continue</p>
      </div>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={busy} className="mt-1">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="max-w-xs text-center text-[12px] text-muted/70">
        Internal tool for the Hustling Collaborators team. Access is invite-only.
      </p>
    </div>
  );
}
