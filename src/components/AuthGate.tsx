import React, { useState } from 'react';
import { Lock, User, Mail, Phone, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useErp } from '../context/ErpContext';

interface Props {
  onOpenSupabaseSetup: () => void;
}

export const AuthGate: React.FC<Props> = () => {
  const { users, currentUser, login, bootstrapFirstAdmin } = useErp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) return null;

  const isFirstTimeSetup = users.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      if (isFirstTimeSetup) {
        const res = await bootstrapFirstAdmin({
          fullName,
          email,
          phone,
          username,
          password,
        });
        if (!res.ok) setError(res.error || 'Lỗi khởi tạo tài khoản');
      } else {
        const res = await login(username, password);
        if (!res.ok) setError(res.error || 'Tên đăng nhập hoặc mật khẩu không chính xác');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Hiệu ứng ánh sáng nền đồng bộ với Logo BAPAGENCY */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0b1024]/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-800/80 overflow-hidden relative z-10">
        {/* Header Logo & Thương hiệu BAPAGENCY */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-slate-800/80 bg-gradient-to-b from-[#070b19] to-[#0b1024]">
          <div className="w-28 h-28 mx-auto rounded-2xl overflow-hidden border border-slate-700/60 shadow-lg bg-[#050814] flex items-center justify-center">
            <img
              src="/bap-logo.png"
              alt="BAPAGENCY Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-widest text-white mt-4">
            BAPAGENCY
          </h1>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-400 uppercase mt-1">
            BUILDING AMAZING PRODUCTS
          </p>
          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            {isFirstTimeSetup
              ? 'Khởi tạo Tài khoản Quản trị Đầu tiên'
              : 'Đăng nhập Hệ thống Quản trị Dự án & Nhân sự'}
          </div>
        </div>

        {/* Form Đăng nhập */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-semibold text-center">
              {error}
            </div>
          )}

          {isFirstTimeSetup && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Họ và tên Quản trị viên *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@bapagency.vn"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="090xxxxxxx"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Tên đăng nhập hoặc Email *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập..."
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Mật khẩu *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang xác thực...
              </>
            ) : (
              <>
                {isFirstTimeSetup ? 'Khởi tạo Super Admin & Bắt đầu' : 'Đăng nhập hệ thống'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="px-8 py-4 bg-[#070b19] border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} <strong className="text-slate-300">BAPAGENCY</strong> • Hệ thống Quản trị Nội bộ
        </div>
      </div>
    </div>
  );
};
