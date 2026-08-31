import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskCard, type TaskDto } from './TaskCard';

const todo: TaskDto = {
  id: 't1',
  title: '100 profiles shortlisting',
  ownerId: 'u1',
  campaignId: null,
  campaignName: null,
  estimatedMinutes: 30,
  status: 'todo',
  workDate: '2026-11-10',
  sortOrder: 10,
  plannedStartTime: null,
  plannedEndTime: null,
  startedAt: null,
  actualMinutes: null,
  withinEstimate: null,
  delayReason: null,
  carriedOver: false,
  timeliness: null,
};

describe('TaskCard', () => {
  it('shows Start for a todo task and never a ticking clock (PRD §7.3)', () => {
    render(<TaskCard t={todo} onStart={() => {}} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
    // No live timer: the DOM must not contain an HH:MM running counter.
    expect(document.body.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    expect(screen.getByText(/Estimated 30m/)).toBeInTheDocument();
  });

  it('fires Start → onStart', async () => {
    const onStart = vi.fn();
    render(<TaskCard t={todo} onStart={onStart} onComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('shows Mark complete for an active task', () => {
    render(<TaskCard t={{ ...todo, status: 'active' }} onStart={() => {}} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument();
  });

  it('shows estimated vs actual time and an On time status for a within-estimate task', () => {
    render(
      <TaskCard
        t={{ ...todo, status: 'done', actualMinutes: 28, withinEstimate: true, timeliness: 'on_time' }}
        onStart={() => {}}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText(/Estimated time:/i)).toBeInTheDocument();
    expect(screen.getByText(/Actual time taken:/i)).toBeInTheDocument();
    expect(screen.getByText(/On time/i)).toBeInTheDocument();
  });

  it('shows a Delayed status and the reason for a delayed task', () => {
    render(
      <TaskCard
        t={{
          ...todo,
          status: 'done',
          actualMinutes: 55,
          withinEstimate: false,
          timeliness: 'delayed',
          delayReason: 'Client sent revised assets midway',
        }}
        onStart={() => {}}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText(/Delayed/i)).toBeInTheDocument();
    expect(screen.getByText(/Reason for delay:/i)).toBeInTheDocument();
    expect(screen.getByText(/revised assets/i)).toBeInTheDocument();
  });

  it('shows the planned window in 12-hour format', () => {
    render(
      <TaskCard
        t={{ ...todo, plannedStartTime: '14:00', plannedEndTime: '16:00' }}
        onStart={() => {}}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText(/2 pm – 4 pm/)).toBeInTheDocument();
  });
});
