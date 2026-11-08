import React, { useState, useRef } from 'react';
import { Plus, ArrowLeftRight, Lock, Trash2, Loader2, Wallet, Pencil } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { Employee } from '../types/database';
import { formatCurrency, formatDate, getTodayISO } from '../lib/format';

export const HrPage: React.FC = () => {
  const {
    scopedEmployees,
    employees,
    departments,
    teams,
    shifts,
    roles,
    employeeTransfers,
    scopedProjects,
    currentRole,
    currentEmployee,
    isFieldHidden,
    getProjectFinancials,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createDepartment,
    createTeam,
    transferEmployee,
  } = useErp();

  const [tab, setTab] = useState<'employees' | 'org' | 'sale_kpi' | 'designer_kpi'>('employees');
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Employee | null>(null);
  const [salaryTarget, setSalaryTarget] = useState<Employee | null>(null);
  const [salaryForm, setSalaryForm] = useState<{
    base_salary: number;
    default_allowance: number;
    salary_formula_type: 'standard_day' | 'fixed_month';
    monthly_kpi_target: number;
  }>({
    base_salary: 0,
    default_allowance: 0,
    salary_formula_type: 'standard_day',
    monthly_kpi_target: 0,
  });
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState('');
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const creatingEmpLock = useRef(false);
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);
  const [empError, setEmpError] = useState('');

  // Sửa thông tin hồ sơ nhân viên
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    birth_date: '',
    phone: '',
    email: '',
    address: '',
    position: '',
    role_code: '',
    shift_id: '',
    hire_date: '',
    contract_type: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const openEditEmployee = (emp: Employee) => {
    setEditError('');
    setEditTarget(emp);
    setEditForm({
      full_name: emp.full_name || '',
      birth_date: emp.birth_date ? String(emp.birth_date).slice(0, 10) : '',
      phone: emp.phone || '',
      email: emp.email || '',
      address: emp.address || '',
      position: emp.position || '',
      role_code: emp.role_code || '',
      shift_id: emp.shift_id || '',
      hire_date: emp.hire_date ? String(emp.hire_date).slice(0, 10) : '',
      contract_type: emp.contract_type || 'Chính thức',
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget || savingEdit) return;
    if (!editForm.full_name.trim()) {
      setEditError('Họ tên không được để trống.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const payload: Partial<Employee> = {
        full_name: editForm.full_name.trim(),
        birth_date: editForm.birth_date || null,
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        address: editForm.address.trim(),
        position: editForm.position.trim(),
        shift_id: editForm.shift_id || null,
        hire_date: editForm.hire_date || editTarget.hire_date,
        contract_type: editForm.contract_type,
      };
      // Chỉ Admin được đổi vai trò hệ thống, và chỉ gửi khi có thay đổi
      if (isAdmin && editForm.role_code && editForm.role_code !== editTarget.role_code) {
        payload.role_code = editForm.role_code;
      }
      const res = await updateEmployee(editTarget.id, payload);
      if (!res.ok) {
        setEditError(res.error || 'Không thể cập nhật hồ sơ nhân viên.');
        return;
      }
      setEditTarget(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const effectiveRoleCode = currentRole?.code || currentEmployee?.role_code || 'super_admin';
  const isAdmin = effectiveRoleCode === 'super_admin' || effectiveRoleCode === 'admin';

  // Form thêm nhân viên + tạo tài khoản đăng nhập
  const [empForm, setEmpForm] = useState({
    full_name: '',
    birth_date: '',
    phone: '',
    email: '',
    address: '',
    department_id: '',
    team_id: '',
    shift_id: shifts[0]?.id || '',
    position: 'Nhân viên Kinh doanh',
    role_code: 'sale',
    hire_date: getTodayISO(),
    contract_type: 'Chính thức',
    work_status: 'Đang làm việc' as Employee['work_status'],
    base_salary: 12000000,
    default_allowance: 1500000,
    salary_formula_type: 'standard_day' as 'standard_day' | 'fixed_month',
    monthly_kpi_target: 100000000,
    username: '',
    password: '',
    roleId: '',
  });

  // Form tạo Phòng ban / Nhóm
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptManager, setDeptManager] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDept, setTeamDept] = useState('');
  const [teamLeader] = useState('');

  // Form điều chuyển
  const [transDept, setTransDept] = useState('');
  const [transTeam, setTransTeam] = useState('');
  const [transReason, setTransReason] = useState('');

  const hideOtherSalary = isFieldHidden('other_salary') || isFieldHidden('base_salary');
  const today = getTodayISO();

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingEmpLock.current || isCreatingEmp) return;
    creatingEmpLock.current = true;
    setIsCreatingEmp(true);
    setEmpError('');
    try {
      const matchedRole = roles.find((r) => r.code === empForm.role_code);
      const res = await createEmployee(
        empForm,
        empForm.username.trim()
          ? {
              username: empForm.username,
              password: empForm.password || '123456',
              roleId: empForm.roleId || matchedRole?.id || '',
            }
          : undefined
      );
      if (res.ok) {
        setShowAddEmp(false);
        setEmpForm({ ...empForm, full_name: '', phone: '', email: '', username: '', password: '' });
      } else {
        setEmpError(res.error || 'Không thể tạo nhân sự mới.');
      }
    } finally {
      creatingEmpLock.current = false;
      setIsCreatingEmp(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto touch-scroll scrollbar-none pb-1 w-full lg:w-auto">
          <button
            onClick={() => setTab('employees')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition ${
              tab === 'employees' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            1. Hồ sơ Nhân sự ({scopedEmployees.length})
          </button>
          <button
            onClick={() => setTab('org')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition ${
              tab === 'org' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            2. Phòng ban, Nhóm & Điều chuyển
          </button>
          <button
            onClick={() => setTab('sale_kpi')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition ${
              tab === 'sale_kpi' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            3. Hiệu suất Sale
          </button>
          <button
            onClick={() => setTab('designer_kpi')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition ${
              tab === 'designer_kpi' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            4. Hiệu suất Designer
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setEmpError('');
              setShowAddEmp(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm nhân viên mới
          </button>
        )}
      </div>

      {/* TAB 1: DANH SÁCH HỒ SƠ NHÂN VIÊN */}
      {tab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[850px]">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Mã NV</th>
                  <th className="px-4 py-3">Họ tên & Liên hệ</th>
                  <th className="px-4 py-3">Phòng ban / Nhóm</th>
                  <th className="px-4 py-3">Chức vụ / Vai trò</th>
                  <th className="px-4 py-3">Ngày vào / HĐLĐ</th>
                  <th className="px-4 py-3 text-right">Lương cơ bản & Phụ cấp</th>
                  <th className="px-4 py-3">Trạng thái làm việc</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scopedEmployees.map((emp) => {
                  const dept = departments.find((d) => d.id === emp.department_id);
                  const team = teams.find((t) => t.id === emp.team_id);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">{emp.employee_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{emp.full_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {emp.phone || '—'} • {emp.email || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{dept?.name || 'Chưa phân phòng'}</div>
                        <div className="text-[11px] text-slate-500">{team?.name || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{emp.position}</div>
                        <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                          {emp.role_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>{formatDate(emp.hire_date)}</div>
                        <div className="text-[11px] text-slate-500">{emp.contract_type}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hideOtherSalary ? (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Lock className="w-3 h-3" /> Bảo mật
                          </span>
                        ) : (
                          <>
                            <div className="font-bold text-slate-900">{formatCurrency(emp.base_salary)}</div>
                            <div className="text-[11px] text-emerald-700">
                              PC: {formatCurrency(emp.default_allowance)}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={emp.work_status}
                          onChange={(e) =>
                            updateEmployee(emp.id, { work_status: e.target.value as Employee['work_status'] })
                          }
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                        >
                          <option value="Đang làm việc">Đang làm việc</option>
                          <option value="Thử việc">Thử việc</option>
                          <option value="Nghỉ thai sản">Nghỉ thai sản</option>
                          <option value="Tạm nghỉ">Tạm nghỉ</option>
                          <option value="Đã nghỉ việc">Đã nghỉ việc (Tự khóa TK)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditEmployee(emp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold cursor-pointer"
                            title="Sửa thông tin hồ sơ nhân viên"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Sửa hồ sơ
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setSalaryError('');
                                setSalaryTarget(emp);
                                setSalaryForm({
                                  base_salary: Number(emp.base_salary) || 0,
                                  default_allowance: Number(emp.default_allowance) || 0,
                                  salary_formula_type: emp.salary_formula_type || 'standard_day',
                                  monthly_kpi_target: Number(emp.monthly_kpi_target) || 0,
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold cursor-pointer"
                              title="Điều chỉnh lương cơ bản & phụ cấp (Chỉ Admin)"
                            >
                              <Wallet className="w-3.5 h-3.5" /> Điều chỉnh lương
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setTransferTarget(emp);
                              setTransDept(emp.department_id || '');
                              setTransTeam(emp.team_id || '');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Điều chuyển
                          </button>
                          {isAdmin && emp.employee_code !== 'NV-0001' && emp.id !== currentEmployee?.id && (
                            <button
                              disabled={deletingEmpId === emp.id}
                              onClick={async () => {
                                if (deletingEmpId) return;
                                if (
                                  !window.confirm(
                                    `Bạn có chắc chắn muốn xóa hồ sơ nhân viên [${emp.employee_code}] ${emp.full_name} và tài khoản đăng nhập liên kết không?`
                                  )
                                ) {
                                  return;
                                }
                                setDeletingEmpId(emp.id);
                                try {
                                  const res = await deleteEmployee(emp.id);
                                  if (!res.ok) {
                                    alert(res.error || 'Không thể xóa nhân viên');
                                  }
                                } finally {
                                  setDeletingEmpId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer disabled:opacity-50"
                              title="Xóa hồ sơ nhân viên & tài khoản đăng nhập"
                            >
                              {deletingEmpId === emp.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xóa...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                                </>
                              )}
                            </button>
                          )}
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

      {/* TAB 2: QUẢN LÝ PHÒNG BAN & NHÓM */}
      {tab === 'org' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phòng ban */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <h4 className="font-bold text-sm text-slate-900">Danh sách Phòng ban ({departments.length})</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <input
                type="text"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="Mã PB (VD: P_KD)"
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Tên phòng ban"
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <select
                value={deptManager}
                onChange={(e) => setDeptManager(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="">-- Trưởng phòng --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
              <button
                disabled={isCreatingDept}
                onClick={async () => {
                  if (!deptCode.trim() || !deptName.trim() || isCreatingDept) return;
                  setIsCreatingDept(true);
                  try {
                    await createDepartment(deptCode, deptName, deptManager || null);
                    setDeptCode('');
                    setDeptName('');
                  } finally {
                    setIsCreatingDept(false);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isCreatingDept ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...
                  </>
                ) : (
                  'Tạo Phòng'
                )}
              </button>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {departments.map((d) => {
                const mgr = employees.find((e) => e.id === d.manager_id);
                const count = employees.filter((e) => e.department_id === d.id).length;
                return (
                  <div key={d.id} className="p-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-mono font-bold text-indigo-600 mr-2">{d.code}</span>
                      <strong className="text-slate-900">{d.name}</strong>
                      <div className="text-slate-500">Trưởng phòng: {mgr?.full_name || 'Chưa bổ nhiệm'}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 font-bold">{count} nhân sự</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nhóm */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <h4 className="font-bold text-sm text-slate-900">Danh sách Nhóm chuyên môn ({teams.length})</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <input
                type="text"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="Mã Nhóm"
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Tên Nhóm"
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <select
                value={teamDept}
                onChange={(e) => setTeamDept(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="">-- Thuộc Phòng --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                disabled={isCreatingTeam}
                onClick={async () => {
                  if (!teamCode.trim() || !teamName.trim() || isCreatingTeam) return;
                  setIsCreatingTeam(true);
                  try {
                    await createTeam(teamCode, teamName, teamDept || null, teamLeader || null);
                    setTeamCode('');
                    setTeamName('');
                  } finally {
                    setIsCreatingTeam(false);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isCreatingTeam ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...
                  </>
                ) : (
                  'Tạo Nhóm'
                )}
              </button>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {teams.map((t) => {
                const dept = departments.find((d) => d.id === t.department_id);
                return (
                  <div key={t.id} className="p-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-mono font-bold text-emerald-600 mr-2">{t.code}</span>
                      <strong className="text-slate-900">{t.name}</strong>
                      <div className="text-slate-500">Phòng ban: {dept?.name || '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lịch sử điều chuyển */}
            <div className="pt-2">
              <h5 className="text-xs font-bold uppercase text-slate-500 mb-2">
                Lịch sử điều chuyển nhân sự ({employeeTransfers.length})
              </h5>
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {employeeTransfers.map((tr) => {
                  const emp = employees.find((e) => e.id === tr.employee_id);
                  const toD = departments.find((d) => d.id === tr.to_department_id);
                  return (
                    <div key={tr.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <strong>{emp?.full_name}</strong> chuyển tới <strong>{toD?.name || 'Phòng mới'}</strong> ngày{' '}
                      {formatDate(tr.transfer_date)} • Lý do: {tr.reason}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HIỆU SUẤT SALE (Mục 7.3) */}
      {tab === 'sale_kpi' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[750px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Nhân sự Sale</th>
                <th className="px-4 py-3 text-center">Tổng dự án</th>
                <th className="px-4 py-3 text-center">HĐ mới</th>
                <th className="px-4 py-3 text-center">DA hoàn thành</th>
                <th className="px-4 py-3 text-right">DT Trước thuế (100%)</th>
                <th className="px-4 py-3 text-right">DT Sau thuế</th>
                <th className="px-4 py-3 text-right">Thực thu</th>
                <th className="px-4 py-3 text-right">Công nợ</th>
                <th className="px-4 py-3 text-right">Tỷ lệ hoàn thành KPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees
                .filter((e) => e.role_code === 'sale' || scopedProjects.some((p) => p.sale_id === e.id))
                .map((emp) => {
                  const projs = scopedProjects.filter((p) => p.sale_id === emp.id && !p.is_archived);
                  const completed = projs.filter((p) => ['Hoàn thành', 'Đã bàn giao'].includes(p.status)).length;
                  const signed = projs.filter((p) => p.contract_status === 'Đã ký').length;
                  let revBefore = 0;
                  let revAfter = 0;
                  let paid = 0;
                  let debt = 0;
                  for (const p of projs) {
                    const f = getProjectFinancials(p);
                    revBefore += f.revenueBeforeTax;
                    revAfter += f.revenueAfterTax;
                    paid += f.confirmedPayments;
                    debt += f.remainingDebt;
                  }
                  const kpiTarget = Number(emp.monthly_kpi_target) || 0;
                  const kpiRate = kpiTarget > 0 ? Math.round((revBefore / kpiTarget) * 100) : 100;

                  return (
                    <tr key={emp.id}>
                      <td className="px-4 py-3 font-bold">
                        [{emp.employee_code}] {emp.full_name}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{projs.length}</td>
                      <td className="px-4 py-3 text-center">{signed}</td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-bold">{completed}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatCurrency(revBefore)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(revAfter)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(debt)}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-indigo-600">{kpiRate}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 4: HIỆU SUẤT DESIGNER (Mục 7.4) */}
      {tab === 'designer_kpi' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[750px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Nhân sự Designer</th>
                <th className="px-4 py-3 text-center">Tổng DA giao</th>
                <th className="px-4 py-3 text-center">Đang làm</th>
                <th className="px-4 py-3 text-center">Hoàn thành</th>
                <th className="px-4 py-3 text-center">Tổng số trang</th>
                <th className="px-4 py-3 text-center">Quá hạn</th>
                <th className="px-4 py-3 text-right">Doanh thu ghi nhận (100%)</th>
                <th className="px-4 py-3 text-right">Thực thu DA phụ trách</th>
                <th className="px-4 py-3 text-right">Tỷ lệ đúng hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees
                .filter((e) => e.role_code === 'designer' || scopedProjects.some((p) => p.designer_id === e.id))
                .map((emp) => {
                  const projs = scopedProjects.filter((p) => p.designer_id === emp.id && !p.is_archived);
                  const active = projs.filter(
                    (p) => !['Hoàn thành', 'Đã bàn giao', 'Hủy dự án'].includes(p.status)
                  ).length;
                  const completed = projs.filter((p) => ['Hoàn thành', 'Đã bàn giao'].includes(p.status)).length;
                  const pages = projs.reduce((s, p) => s + (Number(p.page_count) || 0), 0);
                  const overdue = projs.filter(
                    (p) => p.deadline && p.deadline < today && !['Hoàn thành', 'Đã bàn giao'].includes(p.status)
                  ).length;

                  let revBefore = 0;
                  let paid = 0;
                  for (const p of projs) {
                    const f = getProjectFinancials(p);
                    revBefore += f.revenueBeforeTax;
                    paid += f.confirmedPayments;
                  }
                  const onTimeRate =
                    projs.length > 0 ? Math.round(((projs.length - overdue) / projs.length) * 100) : 100;

                  return (
                    <tr key={emp.id}>
                      <td className="px-4 py-3 font-bold">
                        [{emp.employee_code}] {emp.full_name}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{projs.length}</td>
                      <td className="px-4 py-3 text-center text-indigo-600 font-semibold">{active}</td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-bold">{completed}</td>
                      <td className="px-4 py-3 text-center font-bold">{pages} trang</td>
                      <td className="px-4 py-3 text-center text-rose-600 font-bold">{overdue}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(revBefore)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{onTimeRate}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal Thêm nhân viên */}
      {showAddEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Thêm Hồ Sơ Nhân Sự & Cấp Tài Khoản</h3>
              <button onClick={() => setShowAddEmp(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {empError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                  {empError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={empForm.full_name}
                    onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chức vụ *</label>
                  <input
                    type="text"
                    required
                    value={empForm.position}
                    onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vai trò hệ thống *</label>
                  <select
                    value={empForm.role_code}
                    onChange={(e) => setEmpForm({ ...empForm, role_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phòng ban</label>
                  <select
                    value={empForm.department_id}
                    onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn Phòng ban --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lương cơ bản tháng (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={empForm.base_salary === 0 ? '' : empForm.base_salary}
                    onChange={(e) => setEmpForm({ ...empForm, base_salary: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phụ cấp định kỳ (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={empForm.default_allowance === 0 ? '' : empForm.default_allowance}
                    onChange={(e) => setEmpForm({ ...empForm, default_allowance: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên đăng nhập (Nếu cấp TK)</label>
                  <input
                    type="text"
                    value={empForm.username}
                    onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })}
                    placeholder="VD: sale01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
                  <input
                    type="password"
                    value={empForm.password}
                    onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                    placeholder="Mặc định: 123456"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  disabled={isCreatingEmp}
                  onClick={() => setShowAddEmp(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEmp}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingEmp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo nhân sự...
                    </>
                  ) : (
                    'Lưu nhân sự'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal điều chuyển nhân sự */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4 text-xs">
            <h4 className="font-bold text-sm">Điều chuyển phòng ban / nhóm: {transferTarget.full_name}</h4>
            <div>
              <label className="block font-semibold mb-1">Phòng ban mới</label>
              <select
                value={transDept}
                onChange={(e) => setTransDept(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="">-- Chọn Phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Nhóm mới</label>
              <select
                value={transTeam}
                onChange={(e) => setTransTeam(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="">-- Chọn Nhóm --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Lý do điều chuyển *</label>
              <input
                type="text"
                value={transReason}
                onChange={(e) => setTransReason(e.target.value)}
                placeholder="Tái cơ cấu nhóm dự án..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                disabled={isTransferring}
                onClick={() => setTransferTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-semibold disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                disabled={isTransferring}
                onClick={async () => {
                  if (isTransferring) return;
                  setIsTransferring(true);
                  try {
                    await transferEmployee(transferTarget.id, transDept || null, transTeam || null, transReason);
                    setTransferTarget(null);
                    setTransReason('');
                  } finally {
                    setIsTransferring(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang điều chuyển...
                  </>
                ) : (
                  'Xác nhận điều chuyển'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal điều chỉnh lương nhân sự (Chỉ Admin) */}
      {isAdmin && salaryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  Điều chỉnh lương & phụ cấp nhân sự
                </h4>
                <p className="text-slate-500 mt-0.5">
                  Nhân sự: <strong className="text-indigo-600">[{salaryTarget.employee_code}] {salaryTarget.full_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSalaryTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {salaryError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {salaryError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lương cơ bản (VNĐ / tháng) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={salaryForm.base_salary === 0 ? '' : salaryForm.base_salary}
                  placeholder="0"
                  onChange={(e) =>
                    setSalaryForm({ ...salaryForm, base_salary: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Hiển thị: <strong className="text-indigo-600">{formatCurrency(salaryForm.base_salary)}</strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phụ cấp cố định mặc định (VNĐ / tháng)
                </label>
                <input
                  type="number"
                  min={0}
                  value={salaryForm.default_allowance === 0 ? '' : salaryForm.default_allowance}
                  placeholder="0"
                  onChange={(e) =>
                    setSalaryForm({
                      ...salaryForm,
                      default_allowance: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-emerald-700"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Hiển thị: <strong className="text-emerald-700">{formatCurrency(salaryForm.default_allowance)}</strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hình thức tính lương</label>
                <select
                  value={salaryForm.salary_formula_type}
                  onChange={(e) =>
                    setSalaryForm({
                      ...salaryForm,
                      salary_formula_type: e.target.value as 'standard_day' | 'fixed_month',
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="standard_day">Tính theo ngày công chuẩn (Lương CB / Công chuẩn × Công hưởng)</option>
                  <option value="fixed_month">Lương cứng cố định tháng</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chỉ tiêu KPI doanh thu tháng (VNĐ)
                </label>
                <input
                  type="number"
                  min={0}
                  value={salaryForm.monthly_kpi_target === 0 ? '' : salaryForm.monthly_kpi_target}
                  placeholder="0"
                  onChange={(e) =>
                    setSalaryForm({
                      ...salaryForm,
                      monthly_kpi_target: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={savingSalary}
                onClick={() => setSalaryTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={savingSalary}
                onClick={async () => {
                  setSavingSalary(true);
                  setSalaryError('');
                  try {
                    const res = await updateEmployee(salaryTarget.id, {
                      base_salary: salaryForm.base_salary,
                      default_allowance: salaryForm.default_allowance,
                      salary_formula_type: salaryForm.salary_formula_type,
                      monthly_kpi_target: salaryForm.monthly_kpi_target,
                    });
                    if (!res.ok) {
                      setSalaryError(res.error || 'Không thể cập nhật mức lương.');
                      return;
                    }
                    setSalaryTarget(null);
                  } finally {
                    setSavingSalary(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                {savingSalary ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                  </>
                ) : (
                  'Lưu điều chỉnh lương'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sửa thông tin hồ sơ nhân viên */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-amber-600" />
                  Sửa thông tin hồ sơ nhân viên
                </h4>
                <p className="text-slate-500 mt-0.5">
                  Mã NV: <strong className="text-indigo-600">{editTarget.employee_code}</strong>
                </p>
              </div>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  value={editForm.birth_date}
                  onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chức vụ</label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vai trò hệ thống {!isAdmin && <span className="text-slate-400 font-normal">(Chỉ Admin được đổi)</span>}
                </label>
                <select
                  value={editForm.role_code}
                  disabled={!isAdmin}
                  onChange={(e) => setEditForm({ ...editForm, role_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ca làm việc mặc định</label>
                <select
                  value={editForm.shift_id}
                  onChange={(e) => setEditForm({ ...editForm, shift_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Chưa chọn ca --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.work_day_ratio} công)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loại hợp đồng</label>
                <select
                  value={editForm.contract_type}
                  onChange={(e) => setEditForm({ ...editForm, contract_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {Array.from(
                    new Set(['Chính thức', 'Thử việc', 'Cộng tác viên', 'Thời vụ', 'Thực tập', editForm.contract_type].filter(Boolean))
                  ).map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày vào làm</label>
                <input
                  type="date"
                  value={editForm.hire_date}
                  onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Phòng ban / Nhóm đổi bằng nút <strong>Điều chuyển</strong> (có lưu lịch sử); lương đổi bằng nút{' '}
              <strong>Điều chỉnh lương</strong>.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                  </>
                ) : (
                  'Lưu hồ sơ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
