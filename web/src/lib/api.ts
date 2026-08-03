const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Refresh the access token using the httpOnly refresh cookie. Returns true on success. */
export async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) {
    setAccessToken(null);
    return false;
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return true;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request<T>(method, path, body, false);
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code, err?.message ?? 'Something went wrong. Please try again.', err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
