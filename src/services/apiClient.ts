const API_BASE = '/api';

export interface ApiActorHeaders {
  userId?: string | null;
  actorName?: string;
  actorRole?: string;
}

let currentActorHeaders: ApiActorHeaders = {};

export function setApiActorHeaders(headers: ApiActorHeaders) {
  currentActorHeaders = headers;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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
