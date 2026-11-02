import React, { useState } from 'react';
import { Calculator, Lock, Unlock, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { PayrollDetail } from '../types/database';
import { exportToExcel, formatCurrency } from '../lib/format';

export const PayrollPage: React.FC = () => {
  const {
    payrolls,
    payrollDetails,
    employees,
    standardWorkDays,
    canAction,
    generateMonthlyPayroll,
    updatePayrollDetailItem,
    changePayrollStatus,
  } = useErp();

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [stdDays, setStdDays] = useState<number>(standardWorkDays);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const currentPayroll = payrolls.find((p) => p.month === month && p.year === year);
  const details = payrollDetails.filter((d) => d.payroll_id === currentPayroll?.id);
  const isLocked = currentPayroll?.status === 'Đã khóa';

  const handleGenerate = async () => {
    setErrorMsg('');
    const res = await generateMonthlyPayroll(month, year, stdDays);
    if (!res.ok) setErrorMsg(res.error || 'Lỗi tổng hợp bảng lương');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-700">Kỳ lương:</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-xl border border-slate-300 font-semibold"
          />
          <span className="text-slate-500 ml-2">Công chuẩn:</span>
          <input
            type="number"
            value={stdDays}
            onChange={(e) => setStdDays(Number(e.target.value))}
            className="w-16 px-2.5 py-2 rounded-xl border border-slate-300 text-center font-bold"
          />

          <button
            onClick={handleGenerate}
            disabled={isLocked}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-40"
          >
            <Calculator className="w-4 h-4" /> Tổng hợp tự động từ Bảng công
          </button>
        </div>

        {currentPayroll && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-full font-bold bg-slate-100 text-slate-800">
              Trạng thái: {currentPayroll.status}
            </span>
            {currentPayroll.status !== 'Đã khóa' && canAction('payroll', 'approve') && (
              <>
                <button
                  onClick={() => changePayrollStatus(currentPayroll.id, 'Đã duyệt')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt bảng lương
                </button>
                <button
                  onClick={() => changePayrollStatus(currentPayroll.id, 'Đã khóa')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" /> Khóa bảng lương (Mục 9.3)
                </button>
              </>
            )}
            {currentPayroll.status === 'Đã khóa' && canAction('payroll', 'approve') && (
              <button
                onClick={() => {
                  const reason = window.prompt(
                    'Nhập lý do Mở khóa bảng lương (Bắt buộc lưu nhật ký theo Mục 9.3):',
                    'Điều chỉnh bổ sung phụ cấp/thưởng'
                  );
                  if (reason) changePayrollStatus(currentPayroll.id, 'Chờ duyệt', reason);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 text-white font-semibold cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" /> Mở khóa có nhật ký
              </button>
            )}
            <button
              onClick={() =>
                exportToExcel(
                  details.map((d) => {
                    const emp = employees.find((e) => e.id === d.employee_id);
                    return {
                      'Mã NV': emp?.employee_code || '',
                      'Họ tên': emp?.full_name || '',
                      'Lương cơ bản': d.base_salary,
                      'Công chuẩn': d.standard_days,
                      'Công thực tế': d.actual_work_days,
                      'Nghỉ phép hưởng lương': d.paid_leave_days,
                      'Lương theo công': d.salary_by_workdays,
                      'Phụ cấp': d.allowance,
                      'Thưởng': d.bonus,
                      'Giờ OT': d.overtime_hours,
                      'Tiền tăng ca': d.overtime_pay,
                      'Khấu trừ hợp lệ': d.valid_deductions,
                      'BHXH & Thuế': d.insurance_tax,
                      'Tạm ứng': d.advance_amount,
                      'Thực lĩnh': d.net_salary,
                    };
                  }),
                  `Bang_Luong_T${month}_${year}`
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Bảng lương chi tiết */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-3">Nhân viên</th>
                <th className="px-3 py-3 text-right">Lương cơ bản</th>
                <th className="px-3 py-3 text-center">Công hưởng / Chuẩn</th>
                <th className="px-3 py-3 text-right">Lương theo công</th>
                <th className="px-3 py-3 text-right">Phụ cấp</th>
                <th className="px-3 py-3 text-right">Thưởng</th>
                <th className="px-3 py-3 text-right">Tăng ca ({details.reduce((s, d) => s + d.overtime_hours, 0)}h)</th>
                <th className="px-3 py-3 text-right">Khấu trừ hợp lệ</th>
                <th className="px-3 py-3 text-right">Tạm ứng</th>
                <th className="px-3 py-3 text-right">Thực nhận (Net)</th>
                <th className="px-3 py-3 text-right">Phiếu lương</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {details.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                    Chưa có bảng lương cho Tháng {month}/{year}. Hãy nhấn{' '}
                    <strong>"Tổng hợp tự động từ Bảng công"</strong> để tạo.
                  </td>
                </tr>
              ) : (
                details.map((d) => {
                  const emp = employees.find((e) => e.id === d.employee_id);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-bold">
                        [{emp?.employee_code}] {emp?.full_name}
                      </td>
                      <td className="px-3 py-3 text-right">{formatCurrency(d.base_salary)}</td>
                      <td className="px-3 py-3 text-center font-semibold">
                        {Number(d.actual_work_days) + Number(d.paid_leave_days)} / {d.standard_days}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{formatCurrency(d.salary_by_workdays)}</td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={d.allowance}
                          onChange={(e) =>
                            updatePayrollDetailItem(d.id, { allowance: Number(e.target.value) })
                          }
                          className="w-24 px-2 py-1 text-right rounded border border-slate-300 bg-white disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={d.bonus}
                          onChange={(e) => updatePayrollDetailItem(d.id, { bonus: Number(e.target.value) })}
                          className="w-24 px-2 py-1 text-right rounded border border-slate-300 bg-white disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-indigo-700 font-semibold">
                        {formatCurrency(d.overtime_pay)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={d.valid_deductions}
                          onChange={(e) =>
                            updatePayrollDetailItem(d.id, { valid_deductions: Number(e.target.value) })
                          }
                          className="w-24 px-2 py-1 text-right rounded border border-slate-300 bg-white disabled:bg-slate-100 text-rose-600"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={d.advance_amount}
                          onChange={(e) =>
                            updatePayrollDetailItem(d.id, { advance_amount: Number(e.target.value) })
                          }
                          className="w-24 px-2 py-1 text-right rounded border border-slate-300 bg-white disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold text-emerald-700">
                        {formatCurrency(d.net_salary)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => setSelectedPayslip(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" /> Phiếu lương
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Phiếu lương cá nhân (Mục 9.3) */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4 text-xs">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  PHIẾU LƯƠNG CÁ NHÂN THÁNG {month}/{year}
                </h4>
                <p className="text-slate-500">
                  Nhân sự: <strong>{employees.find((e) => e.id === selectedPayslip.employee_id)?.full_name}</strong>
                </p>
              </div>
              <button onClick={() => setSelectedPayslip(null)}>✕</button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Lương cơ bản:</span>
                <strong>{formatCurrency(selectedPayslip.base_salary)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ngày công hưởng lương / Công chuẩn:</span>
                <strong>
                  {Number(selectedPayslip.actual_work_days) + Number(selectedPayslip.paid_leave_days)} /{' '}
                  {selectedPayslip.standard_days} công
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Lương tính theo ngày công:</span>
                <strong>{formatCurrency(selectedPayslip.salary_by_workdays)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Phụ cấp:</span>
                <strong className="text-emerald-700">+{formatCurrency(selectedPayslip.allowance)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Thưởng:</span>
                <strong className="text-emerald-700">+{formatCurrency(selectedPayslip.bonus)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tiền tăng ca ({selectedPayslip.overtime_hours} giờ):</span>
                <strong className="text-emerald-700">+{formatCurrency(selectedPayslip.overtime_pay)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Các khoản khấu trừ hợp lệ:</span>
                <strong className="text-rose-600">-{formatCurrency(selectedPayslip.valid_deductions)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tạm ứng:</span>
                <strong className="text-rose-600">-{formatCurrency(selectedPayslip.advance_amount)}</strong>
              </div>
              <div className="flex justify-between border-t pt-3 text-sm">
                <span className="font-bold">THỰC NHẬN (NET):</span>
                <strong className="font-extrabold text-indigo-700">{formatCurrency(selectedPayslip.net_salary)}</strong>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer"
              >
                In / Lưu PDF Phiếu lương
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
