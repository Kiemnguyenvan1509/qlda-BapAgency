import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_FILE_PATH = path.resolve(process.cwd(), 'backend/.supabase-config.json');

export interface BackendSupabaseCredentials {
  url: string;
  anonKey: string;
  source: 'env' | 'file' | 'none';
}

export function getBackendSupabaseConfig(): BackendSupabaseCredentials {
  // 1. Ưu tiên đọc từ file cấu hình lưu qua giao diện quản trị nếu có
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      if (raw.url && raw.anonKey) {
        return { url: raw.url.trim(), anonKey: raw.anonKey.trim(), source: 'file' };
      }
    } catch {
      // ignore invalid json
    }
  }

  // 2. Đọc từ biến môi trường .env
  const envUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

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

export function saveBackendSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  fs.mkdirSync(path.dirname(CONFIG_FILE_PATH), { recursive: true });
  fs.writeFileSync(
    CONFIG_FILE_PATH,
    JSON.stringify({ url: cleanUrl, anonKey: cleanKey, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8'
  );
  cachedClient = null;
}

export function clearBackendSupabaseConfig(): void {
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    fs.unlinkSync(CONFIG_FILE_PATH);
  }
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseDb(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = getBackendSupabaseConfig();
  if (!url || !anonKey) return null;
  try {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    return cachedClient;
  } catch {
    return null;
  }
}

export function requireSupabaseDb(): SupabaseClient {
  const db = getSupabaseDb();
  if (!db) {
    throw new Error('Chưa cấu hình kết nối Supabase trên Backend.');
  }
  return db;
}
