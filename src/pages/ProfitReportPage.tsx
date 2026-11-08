import React, { useState, useMemo } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { exportToExcel, formatCurrency } from '../lib/format';

export const ProfitReportPage: React.FC = () => {
  const { scopedProjects, employees, expenses, getProjectFinancials } = useErp();

  const [tab, setTab] = useState<'by_project' | 'company' | 'by_staff'>('by_project');
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [quarterFilter, setQuarterFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const filteredProjects = useMemo(() => {
    return scopedProjects.filter((p) => {
      if (p.is_archived || p.status === 'Hủy dự án' || p.contract_status === 'Hủy') return false;
      const d = p.contract_sign_date || p.received_date || p.created_at.slice(0, 10);
      if (yearFilter !== 'all' && !d.startsWith(yearFilter)) return false;
      const m = Number(d.slice(5, 7));
      if (quarterFilter !== 'all') {
        const q = Math.ceil(m / 3);
        if (String(q) !== quarterFilter) return false;
      }
      if (monthFilter !== 'all' && m !== Number(monthFilter)) return false;
      return true;
    });
  }, [scopedProjects, yearFilter, quarterFilter, monthFilter]);

  const companyProfit = useMemo(() => {
    let revBefore = 0;
    let vatOut = 0;
    let revAfter = 0;
    let confirmedPaid = 0;
    let debt = 0;
    let directCost = 0;
    let allocHr = 0;
    let allocGeneral = 0;

    for (const p of filteredProjects) {
      const f = getProjectFinancials(p);
      revBefore += f.revenueBeforeTax;
      vatOut += f.vatAmount;
      revAfter += f.revenueAfterTax;
      confirmedPaid += f.confirmedPayments;
      debt += f.remainingDebt;
      directCost += f.directExpenses;
      allocHr += f.allocatedHrCost;
      allocGeneral += f.allocatedGeneralCost;
    }

    // Chi phí vận hành & nhân sự toàn công ty chưa phân bổ hết
    const validStatuses = ['Đã duyệt', 'Chờ thanh toán', 'Đã thanh toán'];
    const rawHrExpenses = expenses
      .filter((e) => e.expense_scope === 'hr' && validStatuses.includes(e.status))
      .reduce((s, e) => s + (e.is_vat_deductible ? Number(e.amount_before_tax) : Number(e.amount_after_tax)), 0);
    const rawOperatingExpenses = expenses
      .filter(
        (e) =>
          ['general', 'marketing', 'other'].includes(e.expense_scope) && validStatuses.includes(e.status)
      )
      .reduce((s, e) => s + (e.is_vat_deductible ? Number(e.amount_before_tax) : Number(e.amount_after_tax)), 0);

    const effectiveHrCost = Math.max(allocHr, rawHrExpenses);
    const effectiveOperatingCost = Math.max(allocGeneral, rawOperatingExpenses);
    const totalCost = directCost + effectiveHrCost + effectiveOperatingCost;
    const grossProfit = revBefore - directCost;
    const netProfit = revBefore - totalCost;
    const margin = revBefore > 0 ? Number(((netProfit / revBefore) * 100).toFixed(2)) : 0;

    return {
      revBefore,
      vatOut,
      revAfter,
      confirmedPaid,
      debt,
      directCost,
      effectiveHrCost,
      effectiveOperatingCost,
      totalCost,
      grossProfit,
      netProfit,
      margin,
    };
  }, [filteredProjects, expenses, getProjectFinancials]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('by_project')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'by_project' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            1. Báo cáo Lợi nhuận từng Dự án
          </button>
          <button
            onClick={() => setTab('company')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'company' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Báo cáo Lợi nhuận Toàn công ty
          </button>
          <button
            onClick={() => setTab('by_staff')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'by_staff' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            3. Lợi nhuận theo Sale & Designer
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả năm</option>
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
          </select>
          <select
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả Quý</option>
            <option value="1">Quý I</option>
            <option value="2">Quý II</option>
            <option value="3">Quý III</option>
            <option value="4">Quý IV</option>
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả Tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>
                Tháng {m}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              exportToExcel(
                filteredProjects.map((p) => {
                  const f = getProjectFinancials(p);
                  return {
                    'Mã DA': p.project_code,
                    'Tên dự án': p.name,
                    'Doanh thu trước thuế': f.revenueBeforeTax,
                    'VAT đầu ra': f.vatAmount,
                    'Doanh thu sau thuế': f.revenueAfterTax,
                    'Chi phí trực tiếp': f.directExpenses,
                    'CP Nhân sự phân bổ': f.allocatedHrCost,
                    'CP Chung phân bổ': f.allocatedGeneralCost,
                    'Tổng chi phí': f.totalCost,
                    'Lợi nhuận gộp': f.grossProfit,
                    'Lợi nhuận sau phân bổ': f.netProfitAfterAllocation,
                    'Tỷ suất LN (%)': f.profitMarginPercent,
                  };
                }),
                'Bao_Cao_Loi_Nhuan_Du_An'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* TAB 1: LỢI NHUẬN DỰ ÁN */}
      {tab === 'by_project' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[950px]">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-3">Mã DA / Dự án</th>
                  <th className="px-3 py-3 text-right">DT Trước thuế</th>
                  <th className="px-3 py-3 text-right">VAT đầu ra</th>
                  <th className="px-3 py-3 text-right">DT Sau thuế</th>
                  <th className="px-3 py-3 text-right">CP Trực tiếp</th>
                  <th className="px-3 py-3 text-right">CP Nhân sự PB</th>
                  <th className="px-3 py-3 text-right">CP Chung PB</th>
                  <th className="px-3 py-3 text-right">Lợi nhuận gộp</th>
                  <th className="px-3 py-3 text-right">LN Sau phân bổ</th>
                  <th className="px-3 py-3 text-right">Tỷ suất LN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProjects.map((p) => {
                  const f = getProjectFinancials(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <span className="font-mono font-bold text-indigo-600 mr-1.5">{p.project_code}</span>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold">{formatCurrency(f.revenueBeforeTax)}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{formatCurrency(f.vatAmount)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(f.revenueAfterTax)}</td>
                      <td className="px-3 py-3 text-right text-rose-600">{formatCurrency(f.directExpenses)}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(f.allocatedHrCost)}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(f.allocatedGeneralCost)}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700">
                        {formatCurrency(f.grossProfit)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-indigo-700">
                        {formatCurrency(f.netProfitAfterAllocation)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">{f.profitMarginPercent}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LỢI NHUẬN TOÀN CÔNG TY */}
      {tab === 'company' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-500">Chỉ tiêu Doanh thu & Công nợ</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Tổng doanh thu trước thuế:</span>
                <strong className="text-sm">{formatCurrency(companyProfit.revBefore)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tổng doanh thu sau thuế:</span>
                <strong className="text-sm text-indigo-700">{formatCurrency(companyProfit.revAfter)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tổng thực thu đã xác nhận:</span>
                <strong className="text-emerald-700">{formatCurrency(companyProfit.confirmedPaid)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tổng công nợ còn lại:</span>
                <strong className="text-rose-600">{formatCurrency(companyProfit.debt)}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-500">Chỉ tiêu Chi phí (Không tính trùng)</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Tổng chi phí trực tiếp dự án:</span>
                <strong className="text-rose-600">{formatCurrency(companyProfit.directCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tổng chi phí nhân sự:</span>
                <strong>{formatCurrency(companyProfit.effectiveHrCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tổng chi phí vận hành chung:</span>
                <strong>{formatCurrency(companyProfit.effectiveOperatingCost)}</strong>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Tổng toàn bộ chi phí:</span>
                <strong className="text-sm text-rose-700">{formatCurrency(companyProfit.totalCost)}</strong>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase text-indigo-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Kết Quả Lợi Nhuận Công Ty
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Lợi nhuận gộp:</span>
                <strong className="text-base text-emerald-400">{formatCurrency(companyProfit.grossProfit)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tổng lợi nhuận ròng sau phân bổ:</span>
                <strong className="text-lg text-amber-300">{formatCurrency(companyProfit.netProfit)}</strong>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">Tỷ suất lợi nhuận / DT trước thuế:</span>
                <strong className="text-base text-white">{companyProfit.margin}%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BÁO CÁO LỢI NHUẬN THEO SALE & DESIGNER (Mục 6.5) */}
      {tab === 'by_staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[750px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3 text-center">Số dự án</th>
                <th className="px-4 py-3 text-right">DT Trước thuế</th>
                <th className="px-4 py-3 text-right">DT Sau thuế</th>
                <th className="px-4 py-3 text-right">Thực thu</th>
                <th className="px-4 py-3 text-right">Công nợ</th>
                <th className="px-4 py-3 text-right">Chi phí DA</th>
                <th className="px-4 py-3 text-right">Lợi nhuận DA gắn nhân sự</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((emp) => {
                const empProjs = filteredProjects.filter(
                  (p) => p.sale_id === emp.id || p.designer_id === emp.id
                );
                if (empProjs.length === 0) return null;
                let revBefore = 0;
                let revAfter = 0;
                let paid = 0;
                let debt = 0;
                let cost = 0;
                let profit = 0;
                for (const p of empProjs) {
                  const f = getProjectFinancials(p);
                  revBefore += f.revenueBeforeTax;
                  revAfter += f.revenueAfterTax;
                  paid += f.confirmedPayments;
                  debt += f.remainingDebt;
                  cost += f.directExpenses;
                  profit += f.grossProfit;
                }
                return (
                  <tr key={emp.id}>
                    <td className="px-4 py-3 font-bold">
                      [{emp.employee_code}] {emp.full_name}
                    </td>
                    <td className="px-4 py-3 uppercase font-semibold text-slate-500">{emp.role_code}</td>
                    <td className="px-4 py-3 text-center font-bold">{empProjs.length}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(revBefore)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(revAfter)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(paid)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(debt)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(cost)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatCurrency(profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};
