import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  KeyRound,
  Terminal,
} from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from '../lib/supabase';
import { useErp } from '../context/ErpContext';
import schemaSql from '../../supabase/schema.sql?raw';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { health, refreshAll } = useErp();
  const currentCfg = getSupabaseConfig();

  const [url, setUrl] = useState(currentCfg.url);
  const [anonKey, setAnonKey] = useState(currentCfg.anonKey);
  const [copiedSql, setCopiedSql] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeStep, setActiveStep] = useState<'connect' | 'schema'>(
    health.connected && !health.schemaReady ? 'schema' : 'connect'
  );

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    await saveSupabaseConfig(url, anonKey);
    await refreshAll();
    setTesting(false);
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(schemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDisconnect = async () => {
    await clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    await refreshAll();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Cấu Hình Kết Nối Backend MVC ↔ Cơ Sở Dữ Liệu Supabase
              </h2>
              <p className="text-xs text-slate-400">
                Kiến trúc Fullstack MVC (Node.js/Express Backend + React Frontend) – 100% Dữ liệu thật
              </p>
            </div>
          </div>
          {health.connected && health.schemaReady && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {health.connected && health.schemaReady ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" /> Backend MVC đã kết nối Supabase & Đầy đủ 30 bảng dữ liệu
              </span>
            ) : health.connected && !health.schemaReady ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <AlertTriangle className="w-4 h-4" /> Đã kết nối API nhưng chưa chạy SQL khởi tạo bảng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                <AlertTriangle className="w-4 h-4" /> {health.errorMessage || 'Chưa kết nối Supabase'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveStep('connect')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeStep === 'connect'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              Bước 1: Nhập URL & Anon Key
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('schema')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeStep === 'schema'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              Bước 2: Chạy SQL tạo 30 bảng (schema.sql)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {activeStep === 'connect' ? (
            <div className="space-y-6">
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-sm text-slate-700 space-y-2">
                <div className="font-semibold text-indigo-950 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  Cách lấy thông tin kết nối từ Supabase cho Backend MVC:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
                  <li>
                    Truy cập{' '}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 font-medium underline inline-flex items-center gap-0.5"
                    >
                      Supabase Dashboard <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    và tạo một Project mới (hoặc chọn Project có sẵn).
                  </li>
                  <li>
                    Vào mục <strong>Project Settings (biểu tượng bánh răng)</strong> → chọn{' '}
                    <strong>Data API / API</strong>.
                  </li>
                  <li>
                    Sao chép <strong>Project URL</strong> và <strong>anon / public key</strong> dán vào ô bên dưới (hệ
                    thống sẽ gửi xuống lưu tại Backend MVC hoặc bạn có thể điền vào file{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded border">.env</code>).
                  </li>
                </ol>
              </div>

              <form onSubmit={handleSaveAndTest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Supabase Project URL (SUPABASE_URL / VITE_SUPABASE_URL) *
                  </label>
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Supabase Anon / Service Key (SUPABASE_ANON_KEY) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={testing}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                      {testing ? 'Đang gửi cấu hình xuống Backend...' : 'Lưu xuống Backend & Kiểm Tra Kết Nối'}
                    </button>

                    {currentCfg.source !== 'none' && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-medium transition"
                      >
                        Xóa cấu hình
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveStep('schema')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Chuyển sang Bước 2: Chạy SQL khởi tạo bảng →
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-700" />
                  Hướng dẫn khởi tạo 30 bảng cơ sở dữ liệu trên Supabase:
                </div>
                <p>
                  1. Nhấn nút <strong>"Sao chép toàn bộ SQL Schema"</strong> bên dưới (hoặc mở file{' '}
                  <code>supabase/schema.sql</code> trong thư mục dự án).
                </p>
                <p>
                  2. Trên Supabase Dashboard, mở mục <strong>SQL Editor</strong> ở thanh menu trái → nhấn{' '}
                  <strong>New query</strong>.
                </p>
                <p>
                  3. Dán toàn bộ đoạn mã SQL vào và nhấn <strong>Run (Ctrl + Enter)</strong>. Sau khi báo{' '}
                  <em>Success</em>, nhấn nút <strong>"Kiểm tra lại trạng thái bảng"</strong> bên dưới.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Nội dung file: supabase/schema.sql (30 bảng chuẩn ERD)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedSql ? 'Đã sao chép SQL!' : 'Sao chép toàn bộ SQL Schema'}
                  </button>
                  <button
                    type="button"
                    onClick={refreshAll}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Kiểm tra lại trạng thái bảng
                  </button>
                </div>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-80 border border-slate-800">
                {schemaSql}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Kiến trúc vận hành: <strong className="text-slate-700">Fullstack MVC (Express API `/api/*`)</strong>
          </span>
          {health.connected && health.schemaReady && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
            >
              Đóng cửa sổ & Vào hệ thống
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
