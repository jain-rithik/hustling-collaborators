import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskCard, type TaskDto } from './TaskCard';

const todo: TaskDto = {
  id: 't1',
  title: '100 profiles shortlisting',
  campaignId: null,
  estimatedMinutes: 30,
  status: 'todo',
  actualMinutes: null,
  withinEstimate: null,
};

describe('TaskCard', () => {
  it('shows On it for a todo task and never a ticking clock (PRD §7.3)', () => {
    render(<TaskCard t={todo} onStart={() => {}} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /on it/i })).toBeInTheDocument();
    // No live timer: the DOM must not contain an HH:MM running counter.
    expect(document.body.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    expect(screen.getByText(/~ 30m planned/)).toBeInTheDocument();
  });

  it('fires On it → onStart', async () => {
    const onStart = vi.fn();
    render(<TaskCard t={todo} onStart={onStart} onComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /on it/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('shows Nailed it for an active task', () => {
    render(<TaskCard t={{ ...todo, status: 'active' }} onStart={() => {}} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /nailed it/i })).toBeInTheDocument();
  });

  it('shows an on-estimate badge for a completed task', () => {
    render(
      <TaskCard
        t={{ ...todo, status: 'done', actualMinutes: 28, withinEstimate: true }}
        onStart={() => {}}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText(/on estimate/i)).toBeInTheDocument();
  });
});
