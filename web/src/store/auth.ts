import { create } from 'zustand';
import type { AuthUser } from '@hc/shared';
import { api, refreshSession, setAccessToken } from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authed' | 'anon';
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  async bootstrap() {
    if (await refreshSession()) {
      const { user } = await api.get<{ user: AuthUser }>('/auth/me');
      set({ user, status: 'authed' });
    } else {
      set({ status: 'anon' });
    }
  },

  async login(email, password) {
    const { accessToken, user } = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(accessToken);
    set({ user, status: 'authed' });
  },

  async logout() {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    set({ user: null, status: 'anon' });
  },

  isAdmin: () => get().user?.isAdmin ?? false,
}));
