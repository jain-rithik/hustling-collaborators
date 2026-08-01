import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastHost } from './MemeToast';
import { useToasts } from '@/store/toast';

afterEach(() => {
  act(() => useToasts.setState({ toasts: [], lastByEvent: {} }));
});

describe('MemeToast', () => {
  it('renders a queued meme line as a status pill', () => {
    render(<ToastHost />);
    act(() => useToasts.getState().push('Abhi maja aayega na bhidu! 🔥'));
    expect(screen.getByRole('status')).toHaveTextContent('Abhi maja aayega na bhidu! 🔥');
  });

  it('remembers the last line per event (drives the no-repeat rule)', () => {
    act(() => useToasts.setState({ lastByEvent: { checkin_on_time: 'Punctual Hustler has entered the chat ⚡' } }));
    expect(useToasts.getState().lastByEvent.checkin_on_time).toContain('Punctual Hustler');
  });

  it('shows nothing when the queue is empty', () => {
    render(<ToastHost />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
