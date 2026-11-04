import React, { useState } from 'react';
import { Lock, Unlock, Database, Wifi, Trash2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { DataScope } from '../types/database';
import { formatDateTime } from '../lib/format';

interface Props {
  onOpenSupabaseModal: () => void;
}

const SENSITIVE_FIELDS = [
  { key: 'revenue_before_tax', label: 'Giá trị hợp đồng & Doanh thu' },
  { key: 'payments', label: 'Thực thu & Các đợt thanh toán' },
  { key: 'debt', label: 'Công nợ khách hàng' },
  { key: 'profit', label: 'Lợi nhuận dự án & công ty' },
  { key: 'other_salary', label: 'Mức lương của nhân sự khác' },
];

export const SettingsPage: React.FC<Props> = ({ onOpenSupabaseModal }) => {
  const {
    roles,
    users,
    employees,
    currentEmployee,
    currentRole,
    projectStatuses,
    jobTypes,
    defaultVatRate,
    standardWorkDays,
    officeAllowedIps,
    currentClientIp,
    auditLogs,
    updateRoleConfig,
    toggleUserLock,
    adminResetUserPassword,
    adminGetUserPassword,
    saveSystemSetting,
  } = useErp();

  const roleCode = currentRole?.code || currentEmployee?.role_code || '';
  const isAdmin = roleCode === 'super_admin' || roleCode === 'admin';

  const [tab, setTab] = useState<'rbac' | 'accounts' | 'catalogs' | 'audit'>('rbac');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  const handleToggleRevealPassword = async (userId: string) => {
    if (revealedPasswords[userId] !== undefined) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }
    const res = await adminGetUserPassword(userId);
    if (res.ok && typeof res.password === 'string') {
      setRevealedPasswords((prev) => ({ ...prev, [userId]: res.password || '' }));
    } else {
      window.alert(res.error || 'Không thể xem mật khẩu.');
    }
  };
  const [newStatus, setNewStatus] = useState('');
  const [newJobType, setNewJobType] = useState('');
  const [newOfficeIp, setNewOfficeIp] = useState('');
  const [vatInput, setVatInput] = useState(defaultVatRate);
  const [workDaysInput, setWorkDaysInput] = useState(standardWorkDays);

  const handleToggleHiddenField = async (roleId: string, currentHidden: string[], fieldKey: string) => {
    if (!isAdmin) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const exists = currentHidden.includes(fieldKey);
    const nextHidden = exists ? currentHidden.filter((f) => f !== fieldKey) : [...currentHidden, fieldKey];
    await updateRoleConfig(roleId, role.data_scope, nextHidden);
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-2">
        <Lock className="w-8 h-8 text-rose-500 mx-auto" />
        <div className="text-sm font-bold text-slate-900">Truy cập bị giới hạn</div>
        <p className="text-xs text-slate-600">
          Chỉ tài khoản Admin mới được phép xem và thao tác trên trang Cài đặt & Phân quyền.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('rbac')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'rbac' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            1. Ma trận Phân quyền Đa tầng
          </button>
          <button
            onClick={() => setTab('accounts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'accounts' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Quản lý Tài khoản Đăng nhập ({users.length})
          </button>
          <button
            onClick={() => setTab('catalogs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'catalogs' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            3. Cấu hình Trạng thái, Loại JOB & Tham số
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'audit' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            4. Nhật ký hệ thống Audit Logs ({auditLogs.length})
          </button>
        </div>

        <button
          onClick={onOpenSupabaseModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
        >
          <Database className="w-3.5 h-3.5" /> Cấu hình Kết nối Supabase & SQL
        </button>
      </div>

      {/* TAB 1: MA TRẬN PHÂN QUYỀN */}
      {tab === 'rbac' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <strong>Phân quyền theo Phạm vi dữ liệu & Phân quyền Trường dữ liệu nhạy cảm:</strong>{' '}
            Cho phép cấu hình phạm vi nhìn thấy dữ liệu (Toàn công ty / Phòng ban / Nhóm / Cá nhân) và bật/tắt ẩn các
            trường tài chính nhạy cảm đối với từng vai trò.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Phạm vi dữ liệu (Data Scope)</th>
                  <th className="px-4 py-3">Ẩn trường dữ liệu nhạy cảm (Field-level Security)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roles.map((r) => {
                  const hidden = Array.isArray(r.hidden_fields) ? r.hidden_fields : [];
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{r.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={r.data_scope}
                          onChange={(e) =>
                            updateRoleConfig(r.id, e.target.value as DataScope, hidden)
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                        >
                          <option value="system">Toàn hệ thống (Toàn công ty)</option>
                          <option value="department">Phòng ban (Chỉ xem phòng mình)</option>
                          <option value="team">Nhóm (Chỉ xem thành viên trong nhóm)</option>
                          <option value="personal">Cá nhân (Chỉ xem dự án mình phụ trách)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {SENSITIVE_FIELDS.map((sf) => {
                            const isHidden = hidden.includes(sf.key);
                            return (
                              <button
                                key={sf.key}
                                type="button"
                                onClick={() => handleToggleHiddenField(r.id, hidden, sf.key)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                                  isHidden
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}
                              >
                                {isHidden ? `Đang ẩn: ${sf.label}` : `Cho xem: ${sf.label}`}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TÀI KHOẢN ĐĂNG NHẬP */}
      {tab === 'accounts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Tên đăng nhập</th>
                <th className="px-4 py-3">Nhân sự liên kết</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Mật khẩu hiện tại</th>
                <th className="px-4 py-3">Đăng nhập gần nhất</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => {
                const emp = employees.find((e) => e.id === u.employee_id);
                const role = roles.find((r) => r.id === u.role_id);
                const revealed = revealedPasswords[u.id];
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{u.username}</td>
                    <td className="px-4 py-3 font-semibold">{emp?.full_name || 'Quản trị viên'}</td>
                    <td className="px-4 py-3">{role?.name || 'Super Admin'}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {revealed !== undefined ? revealed : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleRevealPassword(u.id)}
                          title={revealed !== undefined ? 'Ẩn mật khẩu' : 'Xem mật khẩu hiện tại'}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold cursor-pointer"
                        >
                          {revealed !== undefined ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" /> Ẩn
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-indigo-600" /> Xem
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatDateTime(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      {u.is_locked ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                          Đã khóa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                          Hoạt động
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const newPass = window.prompt(
                              `Nhập mật khẩu mới cho tài khoản "${u.username}" (${emp?.full_name || 'Quản trị viên'}):`
                            );
                            if (!newPass) return;
                            const res = await adminResetUserPassword(u.id, newPass);
                            if (res.ok) {
                              if (revealedPasswords[u.id] !== undefined) {
                                setRevealedPasswords((prev) => ({ ...prev, [u.id]: newPass }));
                              }
                              window.alert(`Đã cấp lại mật khẩu mới cho tài khoản "${u.username}".`);
                            } else {
                              window.alert(res.error || 'Không thể đặt lại mật khẩu.');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Đặt lại mật khẩu
                        </button>
                        <button
                          onClick={() => toggleUserLock(u.id, !u.is_locked)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-300 font-semibold cursor-pointer"
                        >
                          {u.is_locked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" /> Mở khóa
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-rose-600" /> Khóa tài khoản
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CẤU HÌNH ĐỘNG */}
      {tab === 'catalogs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900">
              Danh sách Trạng thái Dự án
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                placeholder="Thêm trạng thái mới..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300"
              />
              <button
                onClick={async () => {
                  if (!newStatus.trim()) return;
                  await saveSystemSetting('project_statuses', [...projectStatuses, newStatus.trim()]);
                  setNewStatus('');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
              >
                Thêm
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {projectStatuses.map((st, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold flex items-center gap-2"
                >
                  {idx + 1}. {st}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900">Danh sách Loại JOB & Tham số Tài chính / Nhân sự</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newJobType}
                onChange={(e) => setNewJobType(e.target.value)}
                placeholder="Thêm loại JOB (VD: App UI/UX)..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300"
              />
              <button
                onClick={async () => {
                  if (!newJobType.trim()) return;
                  await saveSystemSetting('job_types', [...jobTypes, newJobType.trim()]);
                  setNewJobType('');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
              >
                Thêm JOB
              </button>
            </div>
            <div className="flex flex-wrap gap-2 py-2">
              {jobTypes.map((jt, idx) => (
                <span key={idx} className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                  {jt}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t">
              <div>
                <label className="block font-semibold mb-1">Thuế suất VAT mặc định (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="0"
                    value={vatInput === 0 ? '' : vatInput}
                    onChange={(e) => setVatInput(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                  <button
                    onClick={() => saveSystemSetting('default_vat_rate', vatInput)}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white font-semibold"
                  >
                    Lưu
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Số công chuẩn tháng</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="26"
                    value={workDaysInput === 0 ? '' : workDaysInput}
                    onChange={(e) => setWorkDaysInput(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                  <button
                    onClick={() => saveSystemSetting('standard_work_days', workDaysInput)}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white font-semibold"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>

            {/* Cấu hình mạng Wi-Fi Công ty cho Chấm công Web */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-indigo-600" /> Cấu hình mạng Wi-Fi Công ty hợp lệ để Chấm công Web
                </label>
                {currentClientIp && (
                  <button
                    onClick={async () => {
                      const updated = Array.from(new Set([...officeAllowedIps, currentClientIp]));
                      await saveSystemSetting('office_allowed_ips', updated);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    + Đặt mạng hiện tại làm Wi-Fi Công ty
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Nếu đã khóa mạng Wi-Fi, nhân viên bắt buộc phải kết nối đúng Wi-Fi công ty mới được phép Check-in / Check-out. Nếu để trống sẽ cho phép mọi mạng.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newOfficeIp}
                  onChange={(e) => setNewOfficeIp(e.target.value)}
                  placeholder="Nhập địa chỉ IP hoặc DDNS công ty..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
                <button
                  onClick={async () => {
                    const clean = newOfficeIp.trim();
                    if (!clean) return;
                    const updated = Array.from(new Set([...officeAllowedIps, clean]));
                    await saveSystemSetting('office_allowed_ips', updated);
                    setNewOfficeIp('');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
                >
                  Thêm mạng
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {officeAllowedIps.length === 0 ? (
                  <span className="text-slate-400 italic">Chưa giới hạn mạng Wi-Fi (Đang cho phép mọi mạng chấm công)</span>
                ) : (
                  officeAllowedIps.map((ip, idx) => (
                    <span
                      key={ip}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold"
                    >
                      Mạng Wi-Fi Công ty #{idx + 1} (Đã ẩn IP)
                      <button
                        onClick={async () => {
                          const updated = officeAllowedIps.filter((item) => item !== ip);
                          await saveSystemSetting('office_allowed_ips', updated);
                        }}
                        className="text-rose-600 hover:text-rose-800 cursor-pointer"
                        title="Xóa cấu hình mạng này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NHẬT KÝ HỆ THỐNG AUDIT LOGS (Mục 12.2) */}
      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thao tác</th>
                <th className="px-4 py-3">Phân hệ</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Dữ liệu thay đổi (Trước → Sau)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {log.actor_name} <span className="text-slate-400">({log.actor_role})</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-indigo-600">{log.action_module}</td>
                  <td className="px-4 py-3 font-medium">{log.action_type}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-xl truncate font-mono text-[11px] text-slate-500">
                      {log.new_data ? JSON.stringify(log.new_data) : '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
