import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Users,
  Clock,
  Wallet,
  FileSpreadsheet,
  CreditCard,
  Receipt,
  TrendingUp,
  BarChart3,
  Settings,
  Bell,
  Database,
  LogOut,
  KeyRound,
  CheckCircle2,
  Menu,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import { ErpProvider, useErp } from './context/ErpContext';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { AuthGate } from './components/AuthGate';
import { ExcelImportModal } from './components/ExcelImportModal';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CustomersPage } from './pages/CustomersPage';
import { HrPage } from './pages/HrPage';
import { AttendancePage } from './pages/AttendancePage';
import { PayrollPage } from './pages/PayrollPage';
import { RevenuePage } from './pages/RevenuePage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ProfitReportPage } from './pages/ProfitReportPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { formatDateTime } from './lib/format';

type ModuleKey =
  | 'dashboard'
  | 'projects'
  | 'customers'
  | 'hr'
  | 'attendance'
  | 'payroll'
  | 'revenue'
  | 'payments'
  | 'expenses'
  | 'profit'
  | 'reports'
  | 'settings';

const NAV_ITEMS: Array<{ id: ModuleKey; label: string; stt: number; icon: React.ReactNode }> = [
  { stt: 1, id: 'dashboard', label: 'Dashboard Tổng quan', icon: <LayoutDashboard className="w-4 h-4" /> },
  { stt: 2, id: 'projects', label: 'Quản lý dự án', icon: <FolderKanban className="w-4 h-4" /> },
  { stt: 3, id: 'customers', label: 'Quản lý khách hàng', icon: <Building2 className="w-4 h-4" /> },
  { stt: 4, id: 'hr', label: 'Quản lý nhân sự', icon: <Users className="w-4 h-4" /> },
  { stt: 5, id: 'attendance', label: 'Quản lý chấm công', icon: <Clock className="w-4 h-4" /> },
  { stt: 6, id: 'payroll', label: 'Quản lý lương', icon: <Wallet className="w-4 h-4" /> },
  { stt: 7, id: 'revenue', label: 'Quản lý doanh thu', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { stt: 8, id: 'payments', label: 'Quản lý thanh toán', icon: <CreditCard className="w-4 h-4" /> },
  { stt: 9, id: 'expenses', label: 'Quản lý chi phí', icon: <Receipt className="w-4 h-4" /> },
  { stt: 10, id: 'profit', label: 'Báo cáo lợi nhuận', icon: <TrendingUp className="w-4 h-4" /> },
  { stt: 11, id: 'reports', label: 'Báo cáo thống kê', icon: <BarChart3 className="w-4 h-4" /> },
  { stt: 12, id: 'settings', label: 'Cài đặt & Phân quyền', icon: <Settings className="w-4 h-4" /> },
];

const MainShell: React.FC = () => {
  const {
    health,
    loading,
    refreshAll,
    currentUser,
    currentEmployee,
    currentRole,
    notifications,
    markNotificationRead,
    changeMyPassword,
    logout,
  } = useErp();

  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (!oldPwd || !newPwd) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
      return;
    }
    if (newPwd.trim().length < 4) {
      setPwdError('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    setPwdLoading(true);
    const res = await changeMyPassword(oldPwd, newPwd);
    setPwdLoading(false);
    if (!res.ok) {
      setPwdError(res.error || 'Không thể đổi mật khẩu.');
      return;
    }
    setPwdSuccess('Đổi mật khẩu thành công!');
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
  };

  const roleCode = currentRole?.code || currentEmployee?.role_code || '';
  const isAdmin = roleCode === 'super_admin' || roleCode === 'admin';
  const visibleNavItems = NAV_ITEMS.filter((item) => item.id !== 'settings' || isAdmin);

  // Quản lý chế độ giao diện Sáng / Tối (Dark / Light mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bap_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    localStorage.setItem('bap_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (!isAdmin && activeModule === 'settings') {
      setActiveModule('dashboard');
    }
  }, [isAdmin, activeModule]);

  // Tự động chuẩn hóa mọi ô nhập số (input[type="number"]): loại bỏ số 0 thừa ở đầu khi gõ phím (VD: 020 -> 20, 012000 -> 12000)
  useEffect(() => {
    const handleNumberInput = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (target && target.tagName === 'INPUT' && target.type === 'number') {
        if (/^0\d+/.test(target.value)) {
          target.value = target.value.replace(/^0+(?=\d)/, '');
        }
      }
    };
    document.addEventListener('input', handleNumberInput, true);
    return () => document.removeEventListener('input', handleNumberInput, true);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Khi đang tải dữ liệu lần đầu và chưa có phiên đăng nhập -> Hiển thị màn hình chờ BAPAGENCY
  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-[#050814] flex flex-col items-center justify-center p-4 text-white space-y-4">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-700/60 shadow-xl bg-[#050814]">
          <img src="/bap-logo.png" alt="BAPAGENCY Logo" className="w-full h-full object-cover" />
        </div>
        <div className="text-lg font-extrabold tracking-widest">BAPAGENCY</div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span>Đang tải hệ thống...</span>
        </div>
      </div>
    );
  }

  // Nếu chưa kết nối Supabase hoặc chưa tạo bảng SQL -> Mở cửa sổ Hướng dẫn & Kết nối Supabase
  if (!loading && (!health.connected || !health.schemaReady)) {
    return (
      <div className="min-h-screen bg-slate-900">
        <SupabaseSetupModal isOpen={true} onClose={() => setShowSupabaseModal(false)} />
      </div>
    );
  }

  // Bắt buộc đăng nhập mới được vào Dashboard
  if (!currentUser) {
    return (
      <>
        <AuthGate onOpenSupabaseSetup={() => setShowSupabaseModal(true)} />
        <SupabaseSetupModal isOpen={showSupabaseModal} onClose={() => setShowSupabaseModal(false)} />
      </>
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeModule) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar trái */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 shrink-0`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <img
                src="/bap-logo.png"
                alt="BAPAGENCY"
                className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
              />
              <div>
                <div className="text-xs font-extrabold text-white tracking-wider">BAPAGENCY</div>
                <div className="text-[10px] text-slate-400">Quản trị Dự án & Nhân sự</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                {item.icon}
                {sidebarOpen && (
                  <span className="truncate">
                    {item.stt}. {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2 text-xs">
          {/* Nút chuyển đổi Giao diện Sáng / Tối */}
          <div className="flex items-center justify-between p-1 rounded-xl bg-slate-800/90 border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setTheme('light')}
              title="Chuyển sang giao diện Sáng"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                theme === 'light'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              {sidebarOpen && <span>Sáng</span>}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              title="Chuyển sang giao diện Tối"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                theme === 'dark'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
              {sidebarOpen && <span>Tối</span>}
            </button>
          </div>

          {sidebarOpen && isAdmin && (
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supabase DB</span>
              </span>
              {health.connected && health.schemaReady ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  Online
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  Cấu hình
                </span>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Khu vực nội dung chính bên phải (Mục 13.2) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-base font-extrabold text-slate-900">
              Phân hệ {currentNav.stt}: {currentNav.label}
            </h1>
            <p className="text-[11px] text-slate-500">
              Phạm vi dữ liệu:{' '}
              <strong className="text-indigo-600 uppercase">{currentRole?.data_scope || 'system'}</strong> • Vai trò:{' '}
              <strong>{currentRole?.name || 'Super Admin'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              title="Đồng bộ dữ liệu mới nhất từ Supabase"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowSupabaseModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Supabase Connected
              </button>
            )}

            {/* Chuông thông báo tự động (Mục 12.1) */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-40 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold flex justify-between">
                    <span>Thông báo hệ thống ({notifications.length})</span>
                    <button onClick={() => setShowNotifDropdown(false)}>✕</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">Chưa có thông báo mới</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-3 cursor-pointer hover:bg-slate-50 ${
                            !n.is_read ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <div className="font-bold text-slate-900">{n.title}</div>
                          <div className="text-slate-600 mt-0.5">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Thông tin tài khoản, Đổi mật khẩu & Đăng xuất */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
              <div className="text-right hidden md:block">
                <div className="font-bold text-slate-900">
                  {currentEmployee?.full_name || currentUser?.username}
                </div>
                <div className="text-[11px] text-slate-500">{currentRole?.name}</div>
              </div>
              <button
                onClick={() => {
                  setPwdError('');
                  setPwdSuccess('');
                  setOldPwd('');
                  setNewPwd('');
                  setConfirmPwd('');
                  setShowChangePwdModal(true);
                }}
                title="Đổi mật khẩu cá nhân"
                className="p-2 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                title="Đăng xuất"
                className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Nội dung phân hệ */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeModule === 'dashboard' && <DashboardPage onOpenExcelImport={() => setShowExcelModal(true)} />}
          {activeModule === 'projects' && <ProjectsPage onOpenExcelImport={() => setShowExcelModal(true)} />}
          {activeModule === 'customers' && <CustomersPage />}
          {activeModule === 'hr' && <HrPage />}
          {activeModule === 'attendance' && <AttendancePage />}
          {activeModule === 'payroll' && <PayrollPage />}
          {activeModule === 'revenue' && <RevenuePage />}
          {activeModule === 'payments' && <PaymentsPage />}
          {activeModule === 'expenses' && <ExpensesPage />}
          {activeModule === 'profit' && <ProfitReportPage />}
          {activeModule === 'reports' && <ReportsPage onOpenExcelImport={() => setShowExcelModal(true)} />}
          {activeModule === 'settings' && isAdmin && (
            <SettingsPage onOpenSupabaseModal={() => setShowSupabaseModal(true)} />
          )}
        </main>
      </div>

      {/* Modal Đổi mật khẩu cá nhân */}
      {showChangePwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  Đổi mật khẩu tài khoản
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Tài khoản: <strong className="text-indigo-600">{currentUser?.username}</strong> (
                  {currentEmployee?.full_name || 'Quản trị viên'})
                </p>
              </div>
              <button
                onClick={() => setShowChangePwdModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {pwdError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                {pwdSuccess}
              </div>
            )}

            <form onSubmit={handleSelfPasswordChange} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mật khẩu hiện tại *</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="Nhập mật khẩu đang sử dụng"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mật khẩu mới *</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Tối thiểu 4 ký tự"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePwdModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {pwdLoading ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <SupabaseSetupModal isOpen={showSupabaseModal} onClose={() => setShowSupabaseModal(false)} />
      <ExcelImportModal isOpen={showExcelModal} onClose={() => setShowExcelModal(false)} />
    </div>
  );
};

export default function App() {
  return (
    <ErpProvider>
      <MainShell />
    </ErpProvider>
  );
}
