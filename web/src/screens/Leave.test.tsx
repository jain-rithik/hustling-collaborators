import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Leave } from './Leave';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  // The auth store pulls these in at import time.
  refreshSession: vi.fn(),
  setAccessToken: vi.fn(),
}));

const BALANCES = {
  employmentType: 'full_time',
  sharedPool: false,
  privilege: { total: 11, remaining: 8.5 },
  sick: { total: 7, remaining: 7 },
  compOff: 0,
  advanceDebt: 0,
  advanceCap: 5,
  probationEndDate: null,
  onProbation: false,
  noticeStartDate: null,
  noticeLastDate: null,
  onNoticePeriod: false,
};

function mockGet(balances: unknown = BALANCES) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/leave/balances')) return Promise.resolve(balances);
    if (path.startsWith('/leave/requests')) return Promise.resolve({ requests: [] });
    return Promise.resolve({ holidays: [] });
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** Render the screen and open the request form — every assertion below is about that form. */
async function openForm() {
  render(<Leave />, { wrapper });
  await userEvent.click(screen.getByRole('button', { name: /request/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet();
  useAuth.setState({
    status: 'authed',
    user: {
      id: 'u1',
      email: 'member@hustlingcollaborators.com',
      role: 'team_member',
      isAdmin: false,
      isFounder: false,
      fullName: 'Aarav Mehta',
      employeeCode: 'HC-004',
      photoUrl: null,
      reportingManagerId: 'rm1',
    },
  });
});

describe('Leave — request form (v4)', () => {
  it('lists each leave type as a row, with remaining/total on the right for Privilege and Sick', async () => {
    await openForm();
    expect(await screen.findByText('8.5/11')).toBeInTheDocument();
    expect(screen.getByText('7/7')).toBeInTheDocument();
    // Types without an entitlement pool carry no counter.
    expect(screen.getByRole('button', { name: /work from home/i })).toHaveTextContent(/^Work From Home$/);
  });

  it('shows one shared pool figure on both rows for an intern', async () => {
    mockGet({
      ...BALANCES,
      employmentType: 'intern',
      sharedPool: true,
      privilege: { total: 4, remaining: 2.5 },
      sick: { total: 4, remaining: 2.5 },
    });
    await openForm();
    expect(await screen.findAllByText('2.5/4')).toHaveLength(2);
    expect(screen.getByText(/share one pool of 4/i)).toBeInTheDocument();
  });

  it('asks only for "For date:" on Sick Leave — no from/to, no half day', async () => {
    await openForm();
    await userEvent.click(await screen.findByRole('button', { name: /sick leave/i }));
    expect(screen.getByText('For date:')).toBeInTheDocument();
    expect(screen.queryByText('From')).not.toBeInTheDocument();
    expect(screen.queryByText('To')).not.toBeInTheDocument();
    expect(screen.queryByText('Half day')).not.toBeInTheDocument();
    expect(screen.getByText(/5:30 AM/)).toBeInTheDocument();
  });

  it('asks "On which date:" for a comp-off', async () => {
    await openForm();
    await userEvent.click(await screen.findByRole('button', { name: /comp-off/i }));
    expect(screen.getByText('On which date:')).toBeInTheDocument();
    expect(screen.queryByText('From')).not.toBeInTheDocument();
  });

  it('no longer offers the old "this is a sick leave" checkbox on Privilege Leave', async () => {
    await openForm();
    await screen.findByText('8.5/11');
    expect(screen.queryByText(/sick leave request/i)).not.toBeInTheDocument();
    // Privilege Leave still keeps its half-day tick and from/to dates.
    expect(screen.getByText('Half day')).toBeInTheDocument();
    expect(screen.getByText('From')).toBeInTheDocument();
  });

  it('shows the policy notices from the server and closes the form on "Got it"', async () => {
    vi.mocked(api.post).mockResolvedValue({
      request: { id: 'l1' },
      notices: ['Sick leave raised after 9:30 AM is taken as Leave Without Pay.'],
      convertedToLwp: true,
      appliedAs: 'lwp',
    });
    await openForm();
    await userEvent.click(await screen.findByRole('button', { name: /sick leave/i }));
    await userEvent.type(screen.getByPlaceholderText('Eg. Family Function'), 'Down with fever');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Sick leave raised after 9:30 AM is taken as Leave Without Pay.')).toBeInTheDocument();
    // The request body dropped isSick — the leave type carries that meaning now.
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('isSick');
    await userEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
  });
});
