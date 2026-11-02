import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Mail, Phone, Database, ArrowRight } from 'lucide-react';
import { useErp } from '../context/ErpContext';

interface Props {
  onOpenSupabaseSetup: () => void;
}

export const AuthGate: React.FC<Props> = ({ onOpenSupabaseSetup }) => {
  const { users, currentUser, login, bootstrapFirstAdmin } = useErp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) return null;

  const isFirstTimeSetup = users.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
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
      if (!res.ok) setError(res.error || 'Đăng nhập thất bại');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-white/15 rounded-xl">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <button
              type="button"
              onClick={onOpenSupabaseSetup}
              className="inline-flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg font-medium transition"
            >
              <Database className="w-3.5 h-3.5" /> Cấu hình Supabase
            </button>
          </div>
          <h1 className="text-xl font-bold mt-4">
            {isFirstTimeSetup ? 'Khởi Tạo Tài Khoản Quản Trị Đầu Tiên' : 'Đăng Nhập Hệ Thống Quản Trị ERP'}
          </h1>
          <p className="text-xs text-indigo-100 mt-1">
            {isFirstTimeSetup
              ? 'Cơ sở dữ liệu Supabase của bạn đang trống (không có dữ liệu ảo). Hãy tạo tài khoản Super Admin đầu tiên để bắt đầu vận hành.'
              : 'Hệ thống Quản lý Dự án – Nhân sự – Tài chính – Chấm công'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {isFirstTimeSetup && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
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
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@company.vn"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="090xxxxxxx"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Tên đăng nhập (Username / Email) *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Mật khẩu *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? 'Đang xử lý...'
              : isFirstTimeSetup
              ? 'Khởi tạo Super Admin & Bắt đầu'
              : 'Đăng nhập vào hệ thống'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
