import { create } from 'zustand';
import type { MemeEventKey } from '@hc/shared';
import { api } from '@/lib/api';

export interface Toast {
  id: string;
  text: string;
}

interface ToastState {
  toasts: Toast[];
  lastByEvent: Record<string, string>;
  push: (text: string) => void;
  dismiss: (id: string) => void;
  /** Fire a meme toast for an event, honouring the no-repeat-twice-in-a-row rule (PRD §6.5). */
  meme: (event: MemeEventKey) => Promise<void>;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  lastByEvent: {},

  push(text) {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => get().dismiss(id), 3000);
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  async meme(event) {
    try {
      const last = get().lastByEvent[event];
      const qs = last ? `?event=${event}&exclude=${encodeURIComponent(last)}` : `?event=${event}`;
      const { line } = await api.get<{ line: string | null }>(`/meme${qs}`);
      if (line) {
        set((s) => ({ lastByEvent: { ...s.lastByEvent, [event]: line } }));
        get().push(line);
      }
    } catch {
      /* toasts are non-critical */
    }
  },
}));
