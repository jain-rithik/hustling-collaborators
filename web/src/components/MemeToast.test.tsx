import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastHost } from './MemeToast';
import { useToasts } from '@/store/toast';

afterEach(() => {
  act(() => useToasts.setState({ toasts: [], lastByEvent: {} }));
});

describe('MemeToast', () => {
  it('renders a queued toast line as a status pill', () => {
    render(<ToastHost />);
    act(() => useToasts.getState().push('Right on target. Your focus really shows.'));
    expect(screen.getByRole('status')).toHaveTextContent('Right on target. Your focus really shows.');
  });

  it('remembers the last line per event (drives the no-repeat rule)', () => {
    act(() => useToasts.setState({ lastByEvent: { checkin_on_time: 'Right on time. Have a productive day ahead.' } }));
    expect(useToasts.getState().lastByEvent.checkin_on_time).toContain('productive day');
  });

  it('shows nothing when the queue is empty', () => {
    render(<ToastHost />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
