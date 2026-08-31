import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { BreakControls } from './BreakControls';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  refreshSession: vi.fn(),
  setAccessToken: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('BreakControls', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ active: null, employeeAlert: false });
    vi.mocked(api.post).mockResolvedValue({ ok: true });
  });

  it('tells you the lunch allowance the moment the break starts', async () => {
    render(<BreakControls />, { wrapper });
    await userEvent.click(await screen.findByRole('button', { name: /taking lunch/i }));
    expect(await screen.findByText(/45 minutes/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/breaks/start', { type: 'lunch' });
  });

  it('tells you the shorter tea allowance', async () => {
    render(<BreakControls />, { wrapper });
    await userEvent.click(await screen.findByRole('button', { name: /tea break/i }));
    expect(await screen.findByText(/15 minutes/)).toBeInTheDocument();
  });

  it('never shows a timer or an elapsed duration (PRD §7.3)', async () => {
    vi.mocked(api.get).mockResolvedValue({
      active: { id: 'b1', type: 'lunch', startedAt: new Date().toISOString() },
      employeeAlert: false,
    });
    const { container } = render(<BreakControls />, { wrapper });
    await screen.findByRole('button', { name: /back at it/i });
    expect(container.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    expect(container.textContent).not.toMatch(/\d+\s*(min|minutes|m)\b/i);
  });

  it('does not greet you when starting the break fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('offline'));
    render(<BreakControls />, { wrapper });
    await userEvent.click(await screen.findByRole('button', { name: /taking lunch/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(screen.queryByText(/45 minutes/)).toBeNull();
  });
});
