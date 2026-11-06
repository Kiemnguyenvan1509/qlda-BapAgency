import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Clock, Download, Wifi, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { LeaveRequest, OvertimeRequest } from '../types/database';
import { exportToExcel, formatDate, formatDateTime, getTodayISO } from '../lib/format';

export const AttendancePage: React.FC = () => {
  const {
    attendance,
    shifts,
    leaveRequests,
    overtimeRequests,
    scopedEmployees,
    employees,
    currentEmployee,
    currentRole,
    standardWorkDays,
    officeAllowedIps,
    autoSyncOfficeIp,
    currentClientIp,
    canAction,
    checkInAttendance,
    checkOutAttendance,
    submitAttendanceExplanation,
    approveAttendanceAdjustment,
    createShift,
    createLeaveRequest,
    updateLeaveStatus,
    createOvertimeRequest,
    updateOvertimeStatus,
    saveSystemSetting,
  } = useErp();

  const [tab, setTab] = useState<'daily' | 'summary' | 'shifts' | 'leaves' | 'overtime'>('daily');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(currentEmployee?.id || employees[0]?.id || '');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const [isSubmittingAtt, setIsSubmittingAtt] = useState(false);
  const attSubmittingLock = useRef(false);
  const [isCreatingLeave, setIsCreatingLeave] = useState(false);
  const [updatingLeaveId, setUpdatingLeaveId] = useState<string | null>(null);
  const [isCreatingOt, setIsCreatingOt] = useState(false);
  const [updatingOtId, setUpdatingOtId] = useState<string | null>(null);
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [submittingExpId, setSubmittingExpId] = useState<string | null>(null);
  const [approvingAdjId, setApprovingAdjId] = useState<string | null>(null);
  const [savingWifiSetting, setSavingWifiSetting] = useState(false);

  // Bộ lọc tháng cho Bảng tổng hợp chấm công (Mục 8.6)
  const [sumMonth, setSumMonth] = useState<number>(new Date().getMonth() + 1);
  const [sumYear, setSumYear] = useState<number>(new Date().getFullYear());

  // State tạo Ca làm (Mục 8.2)
  const [shiftForm, setShiftForm] = useState({
    code: '',
    name: '',
    start_time: '08:30',
    end_time: '17:30',
    break_minutes: 60,
    grace_late_minutes: 15,
  });

  // State tạo đơn nghỉ phép (Mục 8.4)
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '',
    leave_type: 'Nghỉ phép năm' as LeaveRequest['leave_type'],
    start_date: getTodayISO(),
    end_date: getTodayISO(),
    total_days: 1,
    reason: '',
  });

  // State tạo đơn tăng ca (Mục 8.5)
  const [otForm, setOtForm] = useState({
    employee_id: '',
    project_id: '',
    overtime_date: getTodayISO(),
    start_time: '18:00',
    end_time: '20:30',
    total_hours: 2.5,
    overtime_type: 'Ngày thường' as OvertimeRequest['overtime_type'],
    reason: '',
  });

  const roleCode = currentRole?.code || currentEmployee?.role_code || '';
  const isAdmin = roleCode === 'super_admin' || roleCode === 'admin';
  const activeEmpId = isAdmin
    ? selectedEmpId || currentEmployee?.id || employees[0]?.id || ''
    : currentEmployee?.id || '';
  const activeEmp = employees.find((e) => e.id === activeEmpId);

  // State chọn ca làm việc khi Check-in (cho phép đổi ca đột xuất nửa ngày: Ca Sáng 0.5 công / Ca Chiều 0.5 công)
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  useEffect(() => {
    if (shifts.length === 0) return;
    if (activeEmp?.shift_id && shifts.some((s) => s.id === activeEmp.shift_id)) {
      setSelectedShiftId(activeEmp.shift_id);
    } else {
      const hcShift = shifts.find((s) => s.code === 'HC_01' || s.name.toLowerCase().includes('hành chính'));
      setSelectedShiftId(hcShift ? hcShift.id : shifts[0].id);
    }
  }, [activeEmpId, activeEmp?.shift_id, shifts]);

  const today = getTodayISO();
  const todayRec = attendance.find(
    (a) => a.employee_id === activeEmpId && String(a.work_date).slice(0, 10) === today
  );
  const isIpMatched = officeAllowedIps.length === 0 || (Boolean(currentClientIp) && officeAllowedIps.includes(currentClientIp));

  // Tổng hợp bảng công tháng (Mục 8.6)
  const monthlySummaryRows = useMemo(() => {
    const prefix = `${sumYear}-${String(sumMonth).padStart(2, '0')}`;
    return scopedEmployees.map((emp) => {
      const empAtt = attendance.filter((a) => a.employee_id === emp.id && a.work_date.startsWith(prefix));
      const actualDays = empAtt.reduce((s, a) => s + (Number(a.work_day_credit) || 0), 0);
      const lateCount = empAtt.filter((a) => (a.late_minutes || 0) > 0).length;
      const lateMinutes = empAtt.reduce((s, a) => s + (Number(a.late_minutes) || 0), 0);
      const earlyCount = empAtt.filter((a) => (a.early_leave_minutes || 0) > 0).length;
      const earlyMinutes = empAtt.reduce((s, a) => s + (Number(a.early_leave_minutes) || 0), 0);
      const missingCheckout = empAtt.filter((a) => a.check_in && !a.check_out).length;

      const empLeaves = leaveRequests.filter(
        (l) => l.employee_id === emp.id && l.status === 'Đã duyệt' && l.start_date.startsWith(prefix)
      );
      const paidLeave = empLeaves.filter((l) => l.is_paid).reduce((s, l) => s + (Number(l.total_days) || 0), 0);
      const unpaidLeave = empLeaves.filter((l) => !l.is_paid).reduce((s, l) => s + (Number(l.total_days) || 0), 0);

      const empOt = overtimeRequests.filter(
        (o) => o.employee_id === emp.id && o.status === 'Đã duyệt' && o.overtime_date.startsWith(prefix)
      );
      const otHours = empOt.reduce((s, o) => s + (Number(o.total_hours) || 0), 0);

      const unexcusedDays = Math.max(0, standardWorkDays - actualDays - paidLeave - unpaidLeave);

      return {
        emp,
        standardDays: standardWorkDays,
        actualDays,
        paidLeave,
        unpaidLeave,
        unexcusedDays,
        lateCount,
        lateMinutes,
        earlyCount,
        earlyMinutes,
        otHours,
        missingCheckout,
      };
    });
  }, [scopedEmployees, attendance, leaveRequests, overtimeRequests, sumMonth, sumYear, standardWorkDays]);

  return (
    <div className="space-y-4">
      {/* Check-in / Check-out Quick Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Chấm Công Web Trực Tuyến Hôm Nay ({formatDate(today)})
            </div>
            <p className="text-xs text-slate-300">
              Hệ thống tự động đối chiếu Địa chỉ IP mạng Wi-Fi đang kết nối với IP Wi-Fi công ty trước khi ghi nhận Check-in / Check-out.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isAdmin ? (
              <select
                value={activeEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.employee_code}] {e.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <span
                title="Bạn chỉ có thể chấm công cho chính mình"
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold"
              >
                [{currentEmployee?.employee_code || 'NV'}] {currentEmployee?.full_name || 'Chưa gắn hồ sơ NV'}
              </span>
            )}

            {!todayRec ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-indigo-500/50">
                <span className="text-slate-400 font-medium">Ca làm:</span>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="bg-transparent text-indigo-300 font-bold focus:outline-none cursor-pointer"
                  title="Chọn ca làm việc (Mặc định ca Hành chính 1 công; Đột xuất nửa ngày: chọn Ca Sáng 0.5 công hoặc Ca Chiều 0.5 công)"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.name} ({s.work_day_ratio} công • {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                Ca hôm nay:{' '}
                <strong className="text-indigo-300">
                  {shifts.find((s) => s.id === todayRec.shift_id)?.name || 'Ca làm việc'}
                </strong>{' '}
                ({todayRec.work_day_credit} công)
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-indigo-300 font-semibold">
              <Wifi className="w-3.5 h-3.5" /> Chấm công Web
            </span>

            {!todayRec ? (
              <button
                disabled={isSubmittingAtt}
                onClick={async () => {
                  if (!activeEmpId || attSubmittingLock.current || isSubmittingAtt) return;
                  attSubmittingLock.current = true;
                  setIsSubmittingAtt(true);
                  try {
                    const res = await checkInAttendance(activeEmpId, 'Web', selectedShiftId || undefined);
                    setStatusIsError(!res.ok);
                    setStatusMsg(res.ok ? 'Đã Check-in vào ca thành công! (1/1 lần trong ngày)' : res.error || '');
                  } finally {
                    attSubmittingLock.current = false;
                    setIsSubmittingAtt(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSubmittingAtt ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...
                  </>
                ) : (
                  `Check-in Vào Ca (${
                    shifts.find((s) => s.id === selectedShiftId)?.work_day_ratio !== undefined
                      ? `${shifts.find((s) => s.id === selectedShiftId)?.work_day_ratio} công`
                      : '1 lần/ngày'
                  })`
                )}
              </button>
            ) : !todayRec.check_out ? (
              <button
                disabled={isSubmittingAtt}
                onClick={async () => {
                  if (attSubmittingLock.current || isSubmittingAtt) return;
                  attSubmittingLock.current = true;
                  setIsSubmittingAtt(true);
                  try {
                    const res = await checkOutAttendance(todayRec.id);
                    setStatusIsError(!res.ok);
                    setStatusMsg(res.ok ? 'Đã Check-out kết thúc ca! (Hoàn tất 1/1 lần trong ngày)' : res.error || '');
                  } finally {
                    attSubmittingLock.current = false;
                    setIsSubmittingAtt(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAtt ? 'Đang xử lý...' : 'Check-out Ra Ca (1 lần/ngày)'}
              </button>
            ) : (
              <span className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-semibold">
                Đã hoàn tất Check-in & Check-out hôm nay (Tối đa 1 lần/ngày)
              </span>
            )}
          </div>
        </div>

        {/* Thanh trạng thái đối chiếu mạng Wi-Fi Công ty (đã ẩn địa chỉ IP) */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {officeAllowedIps.length === 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" /> Chưa khóa mạng Wi-Fi Công ty (Đang cho phép mọi mạng chấm công)
              </span>
            ) : isIpMatched ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Hợp lệ: Đang kết nối đúng mạng Wi-Fi Công ty
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" /> Không khớp mạng Wi-Fi Công ty – Sẽ bị chặn chấm công
              </span>
            )}
          </div>

          {canAction('settings', 'edit') && currentClientIp && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={savingWifiSetting}
                onClick={async () => {
                  if (savingWifiSetting) return;
                  setSavingWifiSetting(true);
                  try {
                    const nextVal = !autoSyncOfficeIp;
                    await saveSystemSetting('auto_sync_office_ip', nextVal);
                    setStatusIsError(false);
                    setStatusMsg(
                      nextVal
                        ? 'Đã BẬT Tự động cập nhật Wi-Fi Công ty mỗi khi tài khoản Admin mở web!'
                        : 'Đã TẮT Tự động cập nhật Wi-Fi Công ty.'
                    );
                  } finally {
                    setSavingWifiSetting(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-50 ${
                  autoSyncOfficeIp
                    ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {savingWifiSetting && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />}
                Auto-Sync mạng Wi-Fi theo máy Admin: {autoSyncOfficeIp ? 'ĐANG BẬT' : 'ĐANG TẮT'}
              </button>
              {!officeAllowedIps.includes(currentClientIp) && (
                <button
                  disabled={savingWifiSetting}
                  onClick={async () => {
                    if (savingWifiSetting) return;
                    setSavingWifiSetting(true);
                    try {
                      const updated = Array.from(new Set([...officeAllowedIps, currentClientIp]));
                      await saveSystemSetting('office_allowed_ips', updated);
                      setStatusIsError(false);
                      setStatusMsg('Đã khóa chấm công theo mạng Wi-Fi công ty hiện tại.');
                    } finally {
                      setSavingWifiSetting(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {savingWifiSetting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> Đang lưu...
                    </>
                  ) : (
                    '+ Đặt mạng hiện tại làm Wi-Fi Công ty'
                  )}
                </button>
              )}
              {officeAllowedIps.length > 0 && (
                <button
                  disabled={savingWifiSetting}
                  onClick={async () => {
                    if (savingWifiSetting) return;
                    if (!window.confirm('Bạn muốn gỡ giới hạn mạng Wi-Fi công ty (cho phép chấm công từ mọi mạng)?')) return;
                    setSavingWifiSetting(true);
                    try {
                      await saveSystemSetting('auto_sync_office_ip', false);
                      await saveSystemSetting('office_allowed_ips', []);
                      setStatusIsError(false);
                      setStatusMsg('Đã gỡ khóa mạng Wi-Fi công ty.');
                    } finally {
                      setSavingWifiSetting(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {savingWifiSetting ? 'Đang xử lý...' : 'Gỡ khóa Wi-Fi'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold ${
            statusIsError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          {statusMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('daily')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'daily' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            1. Nhật ký Chấm công & Giải trình ({attendance.length})
          </button>
          <button
            onClick={() => setTab('summary')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Bảng tổng hợp chấm công tháng
          </button>
          <button
            onClick={() => setTab('leaves')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'leaves' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            3. Nghỉ phép ({leaveRequests.length})
          </button>
          <button
            onClick={() => setTab('overtime')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'overtime' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            4. Tăng ca OT ({overtimeRequests.length})
          </button>
          <button
            onClick={() => setTab('shifts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'shifts' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            5. Quản lý Ca làm việc ({shifts.length})
          </button>
        </div>
      </div>

      {/* TAB 1: NHẬT KÝ CHẤM CÔNG & GIẢI TRÌNH */}
      {tab === 'daily' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Giờ Check-in</th>
                <th className="px-4 py-3">Giờ Check-out</th>
                <th className="px-4 py-3">Phương thức chấm công</th>
                <th className="px-4 py-3 text-center">Đi muộn / Về sớm</th>
                <th className="px-4 py-3 text-center">Công ghi nhận</th>
                <th className="px-4 py-3">Giải trình & Lịch sử điều chỉnh</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attendance.map((rec) => {
                const emp = employees.find((e) => e.id === rec.employee_id);
                return (
                  <tr key={rec.id}>
                    <td className="px-4 py-3 font-semibold">{formatDate(rec.work_date)}</td>
                    <td className="px-4 py-3 font-bold">
                      [{emp?.employee_code}] {emp?.full_name}
                      {rec.shift_id && (
                        <div className="text-[11px] font-normal text-slate-500">
                          {shifts.find((s) => s.id === rec.shift_id)?.name || 'Ca làm việc'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-emerald-700 font-semibold">{formatDateTime(rec.check_in)}</td>
                    <td className="px-4 py-3 text-indigo-700 font-semibold">{formatDateTime(rec.check_out)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-indigo-700">Chấm công Web</span> •{' '}
                      <span className="text-slate-600">Wi-Fi Công ty</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {rec.late_minutes > 0 ? (
                        <span className="text-rose-600 font-bold">Muộn {rec.late_minutes}p</span>
                      ) : (
                        <span className="text-emerald-600">Đúng giờ</span>
                      )}
                      {rec.early_leave_minutes > 0 && (
                        <div className="text-amber-600">Sớm {rec.early_leave_minutes}p</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{rec.work_day_credit} công</td>
                    <td className="px-4 py-3">
                      {rec.explanation_reason ? (
                        <div>
                          <span className="font-semibold text-amber-800">{rec.explanation_reason}</span> (
                          {rec.explanation_status})
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {(isAdmin || rec.employee_id === currentEmployee?.id) && (
                        <button
                          disabled={submittingExpId === rec.id}
                          onClick={async () => {
                            if (submittingExpId) return;
                            const reason = window.prompt('Nhập nội dung giải trình đi muộn / quên chấm công:');
                            if (reason) {
                              setSubmittingExpId(rec.id);
                              try {
                                await submitAttendanceExplanation(rec.id, reason);
                              } finally {
                                setSubmittingExpId(null);
                              }
                            }
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {submittingExpId === rec.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Đang gửi...
                            </>
                          ) : (
                            'Gửi giải trình'
                          )}
                        </button>
                      )}
                      {canAction('attendance', 'approve') && (
                        <button
                          disabled={approvingAdjId === rec.id}
                          onClick={async () => {
                            if (approvingAdjId) return;
                            const note = window.prompt('Lý do Quản lý duyệt đủ 1.0 ngày công:', 'Duyệt giải trình đi gặp khách hàng');
                            if (note) {
                              setApprovingAdjId(rec.id);
                              try {
                                await approveAttendanceAdjustment(
                                  rec.id,
                                  rec.check_in,
                                  rec.check_out || new Date().toISOString(),
                                  0,
                                  0,
                                  1.0,
                                  'Đã duyệt',
                                  note
                                );
                              } finally {
                                setApprovingAdjId(null);
                              }
                            }
                          }}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {approvingAdjId === rec.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Đang duyệt...
                            </>
                          ) : (
                            'Duyệt công'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: BẢNG TỔNG HỢP CHẤM CÔNG THÁNG (Mục 8.6) */}
      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold">Kỳ tổng hợp công:</span>
              <input
                type="number"
                min={1}
                max={12}
                placeholder="1"
                value={sumMonth === 0 ? '' : sumMonth}
                onChange={(e) => setSumMonth(Number(e.target.value))}
                className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-300"
              />
              <span>/</span>
              <input
                type="number"
                placeholder="2026"
                value={sumYear === 0 ? '' : sumYear}
                onChange={(e) => setSumYear(Number(e.target.value))}
                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300"
              />
            </div>
            <button
              onClick={() =>
                exportToExcel(
                  monthlySummaryRows.map((r) => ({
                    'Mã NV': r.emp.employee_code,
                    'Họ tên': r.emp.full_name,
                    'Công chuẩn': r.standardDays,
                    'Công thực tế': r.actualDays,
                    'Ngày nghỉ phép (hưởng lương)': r.paidLeave,
                    'Ngày nghỉ không lương': r.unpaidLeave,
                    'Ngày nghỉ không phép': r.unexcusedDays,
                    'Số lần đi muộn': r.lateCount,
                    'Tổng phút đi muộn': r.lateMinutes,
                    'Số lần về sớm': r.earlyCount,
                    'Tổng phút về sớm': r.earlyMinutes,
                    'Số giờ tăng ca': r.otHours,
                    'Số ngày thiếu dữ liệu': r.missingCheckout,
                  })),
                  `Bang_Tong_Hop_Cham_Cong_T${sumMonth}_${sumYear}`
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" /> Xuất Excel Bảng Công
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-3">Mã NV</th>
                    <th className="px-3 py-3">Họ tên</th>
                    <th className="px-3 py-3 text-center">Công chuẩn</th>
                    <th className="px-3 py-3 text-center">Công thực tế</th>
                    <th className="px-3 py-3 text-center">Nghỉ phép</th>
                    <th className="px-3 py-3 text-center">Nghỉ K.Lương</th>
                    <th className="px-3 py-3 text-center">Nghỉ K.Phép</th>
                    <th className="px-3 py-3 text-center">Đi muộn (Lần/Phút)</th>
                    <th className="px-3 py-3 text-center">Về sớm (Lần/Phút)</th>
                    <th className="px-3 py-3 text-center">Giờ tăng ca</th>
                    <th className="px-3 py-3 text-center">Thiếu dữ liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {monthlySummaryRows.map((r) => (
                    <tr key={r.emp.id}>
                      <td className="px-3 py-3 font-mono font-bold text-indigo-600">{r.emp.employee_code}</td>
                      <td className="px-3 py-3 font-bold">{r.emp.full_name}</td>
                      <td className="px-3 py-3 text-center">{r.standardDays}</td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-700">{r.actualDays}</td>
                      <td className="px-3 py-3 text-center">{r.paidLeave}</td>
                      <td className="px-3 py-3 text-center">{r.unpaidLeave}</td>
                      <td className="px-3 py-3 text-center text-rose-600">{r.unexcusedDays}</td>
                      <td className="px-3 py-3 text-center">
                        {r.lateCount} lần ({r.lateMinutes}p)
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.earlyCount} lần ({r.earlyMinutes}p)
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-indigo-700">{r.otHours}h</td>
                      <td className="px-3 py-3 text-center">{r.missingCheckout}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NGHỈ PHÉP (Mục 8.4) */}
      {tab === 'leaves' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
            {isAdmin ? (
              <select
                value={leaveForm.employee_id}
                onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="">-- Nhân sự xin nghỉ --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-700 flex items-center">
                [{currentEmployee?.employee_code}] {currentEmployee?.full_name}
              </div>
            )}
            <select
              value={leaveForm.leave_type}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, leave_type: e.target.value as LeaveRequest['leave_type'] })
              }
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="Nghỉ phép năm">Nghỉ phép năm</option>
              <option value="Nghỉ không lương">Nghỉ không lương</option>
              <option value="Nghỉ ốm">Nghỉ ốm</option>
              <option value="Nghỉ việc riêng">Nghỉ việc riêng</option>
              <option value="Nghỉ chế độ">Nghỉ chế độ</option>
              <option value="Nghỉ khác">Nghỉ khác</option>
            </select>
            <input
              type="date"
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="number"
              step={0.5}
              min={0.5}
              value={leaveForm.total_days === 0 ? '' : leaveForm.total_days}
              onChange={(e) => setLeaveForm({ ...leaveForm, total_days: Number(e.target.value) })}
              placeholder="Số ngày"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="text"
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="Lý do xin nghỉ *"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <button
              disabled={isCreatingLeave}
              onClick={async () => {
                if (!leaveForm.reason.trim() || isCreatingLeave) return;
                setIsCreatingLeave(true);
                try {
                  await createLeaveRequest({
                    ...leaveForm,
                    employee_id: leaveForm.employee_id || activeEmpId,
                  });
                  setLeaveForm({ ...leaveForm, reason: '' });
                } finally {
                  setIsCreatingLeave(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isCreatingLeave ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi...
                </>
              ) : (
                'Gửi đơn nghỉ'
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Loại nghỉ</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3 text-center">Số ngày</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leaveRequests.map((l) => {
                  const emp = employees.find((e) => e.id === l.employee_id);
                  const isUpdatingThisLeave = updatingLeaveId === l.id;
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-bold">{emp?.full_name}</td>
                      <td className="px-4 py-3">{l.leave_type}</td>
                      <td className="px-4 py-3">
                        {formatDate(l.start_date)} → {formatDate(l.end_date)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{l.total_days} ngày</td>
                      <td className="px-4 py-3">{l.reason}</td>
                      <td className="px-4 py-3 font-semibold">{l.status}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {l.status === 'Chờ duyệt' && canAction('attendance', 'approve') && (
                          <>
                            <button
                              disabled={isUpdatingThisLeave}
                              onClick={async () => {
                                if (isUpdatingThisLeave) return;
                                setUpdatingLeaveId(l.id);
                                try {
                                  await updateLeaveStatus(l.id, 'Đã duyệt');
                                } finally {
                                  setUpdatingLeaveId(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingThisLeave ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Duyệt'}
                            </button>
                            <button
                              disabled={isUpdatingThisLeave}
                              onClick={async () => {
                                if (isUpdatingThisLeave) return;
                                setUpdatingLeaveId(l.id);
                                try {
                                  await updateLeaveStatus(l.id, 'Từ chối');
                                } finally {
                                  setUpdatingLeaveId(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingThisLeave ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Từ chối'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TĂNG CA (Mục 8.5) */}
      {tab === 'overtime' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
            {isAdmin ? (
              <select
                value={otForm.employee_id}
                onChange={(e) => setOtForm({ ...otForm, employee_id: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="">-- Nhân sự tăng ca --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-700 flex items-center">
                [{currentEmployee?.employee_code}] {currentEmployee?.full_name}
              </div>
            )}
            <select
              value={otForm.overtime_type}
              onChange={(e) =>
                setOtForm({ ...otForm, overtime_type: e.target.value as OvertimeRequest['overtime_type'] })
              }
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="Ngày thường">Ngày thường (x1.5)</option>
              <option value="Ngày nghỉ hàng tuần">Ngày nghỉ hàng tuần (x2.0)</option>
              <option value="Ngày lễ, Tết">Ngày lễ, Tết (x3.0)</option>
            </select>
            <input
              type="date"
              value={otForm.overtime_date}
              onChange={(e) => setOtForm({ ...otForm, overtime_date: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="number"
              step={0.5}
              value={otForm.total_hours === 0 ? '' : otForm.total_hours}
              onChange={(e) => setOtForm({ ...otForm, total_hours: Number(e.target.value) })}
              placeholder="Số giờ OT"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="text"
              value={otForm.reason}
              onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
              placeholder="Lý do tăng ca *"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <button
              disabled={isCreatingOt}
              onClick={async () => {
                if (!otForm.reason.trim() || isCreatingOt) return;
                setIsCreatingOt(true);
                try {
                  await createOvertimeRequest({
                    ...otForm,
                    employee_id: otForm.employee_id || activeEmpId,
                  });
                  setOtForm({ ...otForm, reason: '' });
                } finally {
                  setIsCreatingOt(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isCreatingOt ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi...
                </>
              ) : (
                'Đăng ký OT'
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Ngày tăng ca</th>
                  <th className="px-4 py-3">Phân loại</th>
                  <th className="px-4 py-3 text-center">Tổng giờ</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {overtimeRequests.map((ot) => {
                  const emp = employees.find((e) => e.id === ot.employee_id);
                  const isUpdatingThisOt = updatingOtId === ot.id;
                  return (
                    <tr key={ot.id}>
                      <td className="px-4 py-3 font-bold">{emp?.full_name}</td>
                      <td className="px-4 py-3">{formatDate(ot.overtime_date)}</td>
                      <td className="px-4 py-3">
                        {ot.overtime_type} (x{ot.multiplier})
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-indigo-700">{ot.total_hours}h</td>
                      <td className="px-4 py-3">{ot.reason}</td>
                      <td className="px-4 py-3 font-semibold">{ot.status}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {ot.status === 'Chờ duyệt' && canAction('attendance', 'approve') && (
                          <>
                            <button
                              disabled={isUpdatingThisOt}
                              onClick={async () => {
                                if (isUpdatingThisOt) return;
                                setUpdatingOtId(ot.id);
                                try {
                                  await updateOvertimeStatus(ot.id, 'Đã duyệt');
                                } finally {
                                  setUpdatingOtId(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingThisOt ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Duyệt'}
                            </button>
                            <button
                              disabled={isUpdatingThisOt}
                              onClick={async () => {
                                if (isUpdatingThisOt) return;
                                setUpdatingOtId(ot.id);
                                try {
                                  await updateOvertimeStatus(ot.id, 'Từ chối');
                                } finally {
                                  setUpdatingOtId(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingThisOt ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Từ chối'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: CA LÀM VIỆC (Mục 8.2) */}
      {tab === 'shifts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
            <input
              type="text"
              value={shiftForm.code}
              onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value })}
              placeholder="Mã ca (VD: CA_SANG)"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="text"
              value={shiftForm.name}
              onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
              placeholder="Tên ca làm việc"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="time"
              value={shiftForm.start_time}
              onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="time"
              value={shiftForm.end_time}
              onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="number"
              value={shiftForm.grace_late_minutes === 0 ? '' : shiftForm.grace_late_minutes}
              onChange={(e) => setShiftForm({ ...shiftForm, grace_late_minutes: Number(e.target.value) })}
              placeholder="Phút đi muộn cho phép"
              className="px-3 py-2 rounded-lg border border-slate-300"
            />
            <button
              disabled={isCreatingShift}
              onClick={async () => {
                if (!shiftForm.name.trim() || isCreatingShift) return;
                setIsCreatingShift(true);
                try {
                  await createShift(shiftForm);
                  setShiftForm({ ...shiftForm, code: '', name: '' });
                } finally {
                  setIsCreatingShift(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isCreatingShift ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang thêm...
                </>
              ) : (
                'Thêm Ca Làm'
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Mã ca</th>
                  <th className="px-4 py-3">Tên ca làm việc</th>
                  <th className="px-4 py-3">Giờ bắt đầu – Kết thúc</th>
                  <th className="px-4 py-3">Nghỉ giữa ca</th>
                  <th className="px-4 py-3">Đi muộn cho phép</th>
                  <th className="px-4 py-3">Hệ số ngày công</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{s.code}</td>
                    <td className="px-4 py-3 font-bold">{s.name}</td>
                    <td className="px-4 py-3 font-semibold">
                      {s.start_time} – {s.end_time}
                    </td>
                    <td className="px-4 py-3">{s.break_minutes} phút</td>
                    <td className="px-4 py-3">{s.grace_late_minutes} phút</td>
                    <td className="px-4 py-3 font-bold">{s.work_day_ratio} công</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
