const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? rawApiUrl.endsWith('/api')
    ? rawApiUrl
    : `${rawApiUrl}/api`
  : '/api';

export interface ApiActorHeaders {
  userId?: string | null;
  actorName?: string;
  actorRole?: string;
}

export const LS_LAST_ACTIVE_AT = 'qlda_last_active_at';
export const SS_SESSION_EXPIRED_NOTICE = 'qlda_session_expired_notice';
export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút (600,000 ms)

export function recordUserActivity() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_LAST_ACTIVE_AT, String(Date.now()));
  }
}

let currentActorHeaders: ApiActorHeaders = {};

export function setApiActorHeaders(headers: ApiActorHeaders) {
  currentActorHeaders = headers;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (currentActorHeaders.userId || endpoint.startsWith('/auth/')) {
    recordUserActivity();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (currentActorHeaders.userId) {
    headers['x-user-id'] = currentActorHeaders.userId;
  }
  if (currentActorHeaders.actorName) {
    headers['x-actor-name'] = encodeURIComponent(currentActorHeaders.actorName);
  }
  if (currentActorHeaders.actorRole) {
    headers['x-actor-role'] = encodeURIComponent(currentActorHeaders.actorRole);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => ({ ok: false, error: 'Phản hồi từ Backend không hợp lệ' }));
  return json as T;
}
