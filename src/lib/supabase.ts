import { apiRequest } from '../services/apiClient';

const LS_URL_KEY = 'qlda_supabase_url';
const LS_ANON_KEY = 'qlda_supabase_anon_key';

export function getSupabaseConfig(): { url: string; anonKey: string; source: 'env' | 'local' | 'none' } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const localUrl = (typeof window !== 'undefined' ? localStorage.getItem(LS_URL_KEY) || '' : '').trim();
  const localKey = (typeof window !== 'undefined' ? localStorage.getItem(LS_ANON_KEY) || '' : '').trim();

  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey, source: 'local' };
  }
  if (
    envUrl &&
    envKey &&
    !envUrl.includes('your-project-id') &&
    !envKey.includes('your-supabase-anon-public-key')
  ) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }
  return { url: '', anonKey: '', source: 'none' };
}

export async function saveSupabaseConfig(url: string, anonKey: string): Promise<void> {
  localStorage.setItem(LS_URL_KEY, url.trim());
  localStorage.setItem(LS_ANON_KEY, anonKey.trim());
  await apiRequest('/config/supabase', {
    method: 'POST',
    body: JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }),
  });
}

export async function clearSupabaseConfig(): Promise<void> {
  localStorage.removeItem(LS_URL_KEY);
  localStorage.removeItem(LS_ANON_KEY);
  await apiRequest('/config/supabase', { method: 'DELETE' });
}

export interface SupabaseHealthStatus {
  configured: boolean;
  connected: boolean;
  schemaReady: boolean;
  errorMessage?: string;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  // Nếu trên trình duyệt có lưu URL/Key tạm mà Backend chưa có, tự động đồng bộ xuống Backend MVC
  const localCfg = getSupabaseConfig();
  let status = await apiRequest<SupabaseHealthStatus & { source?: string }>('/health');

  if (!status.configured && localCfg.url && localCfg.anonKey) {
    await apiRequest('/config/supabase', {
      method: 'POST',
      body: JSON.stringify({ url: localCfg.url, anonKey: localCfg.anonKey }),
    });
    status = await apiRequest<SupabaseHealthStatus>('/health');
  }

  return {
    configured: Boolean(status.configured),
    connected: Boolean(status.connected),
    schemaReady: Boolean(status.schemaReady),
    errorMessage: status.errorMessage,
  };
}
