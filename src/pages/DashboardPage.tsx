import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { formatCurrency, formatDate, getTodayISO } from '../lib/format';

interface Props {
  onOpenExcelImport: () => void;
}

export const DashboardPage: React.FC<Props> = ({ onOpenExcelImport }) => {
  const {
    scopedProjects,
    employees,
    departments,
    teams,
    expenses,
    attendance,
    leaveRequests,
    currentRole,
    currentEmployee,
    isFieldHidden,
    getProjectFinancials,
  } = useErp();

  const [viewMode, setViewMode] = useState<'executive' | 'sale' | 'designer'>('executive');
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterDeptId, setFilterDeptId] = useState<string>('all');
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [filterStaffId, setFilterStaffId] = useState<string>('all');

  const today = getTodayISO();
  const hideFinance = isFieldHidden('revenue_before_tax');

  // Lọc dự án theo bộ lọc thời gian, phòng ban, nhóm, nhân sự (Mục 10.2)
  const filteredProjects = useMemo(() => {
    return scopedProjects.filter((p) => {
      if (p.is_archived) return false;
      const dateStr = p.contract_sign_date || p.received_date || p.created_at.slice(0, 10);
      if (filterYear !== 'all' && !dateStr.startsWith(filterYear)) return false;
      if (filterMonth !== 'all') {
        const ym = `${filterYear}-${filterMonth.padStart(2, '0')}`;
        if (!dateStr.startsWith(ym)) return false;
      }
      if (filterDeptId !== 'all' && p.department_id !== filterDeptId) return false;
      if (filterTeamId !== 'all') {
        const teamEmpIds = new Set(employees.filter((e) => e.team_id === filterTeamId).map((e) => e.id));
        if (
          (!p.sale_id || !teamEmpIds.has(p.sale_id)) &&
          (!p.designer_id || !teamEmpIds.has(p.designer_id))
        ) {
          return false;
        }
      }
      if (filterStaffId !== 'all' && p.sale_id !== filterStaffId && p.designer_id !== filterStaffId) {
        return false;
      }
      return true;
    });
  }, [scopedProjects, filterYear, filterMonth, filterDeptId, filterTeamId, filterStaffId, employees]);

  // Tổng hợp KPI Dự án & Tài chính (Quy tắc 5 & 7: mỗi dự án chỉ tính 1 lần vào tổng công ty)
  const kpi = useMemo(() => {
    let totalProjects = filteredProjects.length;
    let newProjects = 0;
    let activeProjects = 0;
    let waitingCustomer = 0;
    let completedProjects = 0;
    let overdueProjects = 0;

    let revBeforeTax = 0;
    let revAfterTax = 0;
    let totalConfirmedPaid = 0;
    let totalDebt = 0;
    let directCost = 0;
    let allocGeneral = 0;
    let allocHr = 0;

    for (const p of filteredProjects) {
      if (p.status === 'Chờ tiếp nhận') newProjects++;
      else if (['Đang lên ý tưởng', 'Đang thiết kế', 'Đang chỉnh sửa', 'Chờ duyệt'].includes(p.status)) {
        activeProjects++;
      } else if (p.status === 'Chờ khách phản hồi') {
        waitingCustomer++;
      } else if (['Hoàn thành', 'Đã bàn giao'].includes(p.status)) {
        completedProjects++;
      }

      if (
        p.deadline &&
        p.deadline < today &&
        !['Hoàn thành', 'Đã bàn giao', 'Hủy dự án'].includes(p.status)
      ) {
        overdueProjects++;
      }

      if (p.status !== 'Hủy dự án' && p.contract_status !== 'Hủy') {
        const f = getProjectFinancials(p);
        revBeforeTax += f.revenueBeforeTax;
        revAfterTax += f.revenueAfterTax;
        totalConfirmedPaid += f.confirmedPayments;
        totalDebt += f.remainingDebt;
        directCost += f.directExpenses;
        allocGeneral += f.allocatedGeneralCost;
        allocHr += f.allocatedHrCost;
      }
    }

    // Chi phí chung chưa phân bổ hoặc tổng chi phí vận hành trong kỳ
    const generalExpensesTotal = expenses
      .filter(
        (e) =>
          e.expense_scope !== 'project' &&
          ['Đã duyệt', 'Chờ thanh toán', 'Đã thanh toán'].includes(e.status) &&
          (filterYear === 'all' || e.expense_date.startsWith(filterYear))
      )
      .reduce((s, e) => s + (e.is_vat_deductible ? Number(e.amount_before_tax) : Number(e.amount_after_tax)), 0);

    const effectiveGeneralCost = Math.max(allocGeneral + allocHr, generalExpensesTotal);
    const totalCost = directCost + effectiveGeneralCost;
    const grossProfit = revBeforeTax - directCost;
    const netProfit = revBeforeTax - totalCost;
    const onTimeRate =
      totalProjects > 0 ? Math.round(((totalProjects - overdueProjects) / totalProjects) * 100) : 100;

    return {
      totalProjects,
      newProjects,
      activeProjects,
      waitingCustomer,
      completedProjects,
      overdueProjects,
      revBeforeTax,
      revAfterTax,
      totalConfirmedPaid,
      totalDebt,
      directCost,
      effectiveGeneralCost,
      totalCost,
      grossProfit,
      netProfit,
      onTimeRate,
    };
  }, [filteredProjects, expenses, filterYear, getProjectFinancials, today]);

  // Nhân sự & Chấm công hôm nay (Mục 10.1)
  const hrStats = useMemo(() => {
    const activeEmps = employees.filter((e) => e.work_status !== 'Đã nghỉ việc');
    const activeSales = activeEmps.filter((e) => e.role_code === 'sale');
    const activeDesigners = activeEmps.filter((e) => e.role_code === 'designer');
    const todayAtt = attendance.filter((a) => a.work_date === today);
    const lateToday = todayAtt.filter((a) => (a.late_minutes || 0) > 0);
    const onLeaveToday = leaveRequests.filter(
      (l) => l.status === 'Đã duyệt' && l.start_date <= today && l.end_date >= today
    );

    return {
      totalActive: activeEmps.length,
      salesCount: activeSales.length,
      designersCount: activeDesigners.length,
      checkedInToday: todayAtt.length,
      lateTodayCount: lateToday.length,
      onLeaveTodayCount: onLeaveToday.length,
    };
  }, [employees, attendance, leaveRequests, today]);

  // Thống kê Doanh thu theo Sale & Designer (Quy tắc 4: cả Sale & Designer đều nhận 100% doanh thu dự án)
  const staffPerformance = useMemo(() => {
    const saleMap = new Map<string, { name: string; count: number; revBefore: number; paid: number; debt: number }>();
    const desMap = new Map<
      string,
      { name: string; count: number; pages: number; revBefore: number; overdue: number }
    >();

    for (const p of filteredProjects) {
      if (p.status === 'Hủy dự án') continue;
      const fin = getProjectFinancials(p);

      if (p.sale_id) {
        const emp = employees.find((e) => e.id === p.sale_id);
        const cur = saleMap.get(p.sale_id) || {
          name: emp?.full_name || 'Sale',
          count: 0,
          revBefore: 0,
          paid: 0,
          debt: 0,
        };
        cur.count += 1;
        cur.revBefore += fin.revenueBeforeTax;
        cur.paid += fin.confirmedPayments;
        cur.debt += fin.remainingDebt;
        saleMap.set(p.sale_id, cur);
      }

      if (p.designer_id) {
        const emp = employees.find((e) => e.id === p.designer_id);
        const cur = desMap.get(p.designer_id) || {
          name: emp?.full_name || 'Designer',
          count: 0,
          pages: 0,
          revBefore: 0,
          overdue: 0,
        };
        cur.count += 1;
        cur.pages += Number(p.page_count) || 0;
        cur.revBefore += fin.revenueBeforeTax;
        if (p.deadline && p.deadline < today && !['Hoàn thành', 'Đã bàn giao'].includes(p.status)) {
          cur.overdue += 1;
        }
        desMap.set(p.designer_id, cur);
      }
    }

    return {
      sales: Array.from(saleMap.values()).sort((a, b) => b.revBefore - a.revBefore),
      designers: Array.from(desMap.values()).sort((a, b) => b.revBefore - a.revBefore),
    };
  }, [filteredProjects, employees, getProjectFinancials, today]);

  // Biểu đồ Doanh thu & Thực thu 12 tháng trong năm
  const monthlySeries = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      revBefore: 0,
      paid: 0,
      profit: 0,
    }));
    for (const p of scopedProjects) {
      if (p.is_archived || p.status === 'Hủy dự án') continue;
      const d = p.contract_sign_date || p.received_date || p.created_at.slice(0, 10);
      if (filterYear !== 'all' && !d.startsWith(filterYear)) continue;
      const m = Number(d.slice(5, 7));
      if (m >= 1 && m <= 12) {
        const f = getProjectFinancials(p);
        arr[m - 1].revBefore += f.revenueBeforeTax;
        arr[m - 1].paid += f.confirmedPayments;
        arr[m - 1].profit += f.grossProfit;
      }
    }
    return arr;
  }, [scopedProjects, filterYear, getProjectFinancials]);

  const maxMonthlyVal = Math.max(1, ...monthlySeries.map((m) => Math.max(m.revBefore, m.paid)));

  return (
    <div className="space-y-6">
      {/* Top Filter Bar & View Switcher */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('executive')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              viewMode === 'executive'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Dashboard Ban Lãnh Đạo
          </button>
          <button
            onClick={() => setViewMode('sale')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              viewMode === 'sale' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Góc nhìn Cá nhân Sale
          </button>
          <button
            onClick={() => setViewMode('designer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              viewMode === 'designer'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Góc nhìn Cá nhân Designer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" /> Bộ lọc:
          </span>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="all">Tất cả năm</option>
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
            <option value="2024">Năm 2024</option>
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="all">Cả năm</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>
                Tháng {m}
              </option>
            ))}
          </select>

          <select
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="all">Tất cả Phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="all">Tất cả Nhóm</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="all">Tất cả Nhân sự</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>

          <button
            onClick={onOpenExcelImport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Nhập từ Google Sheets/Excel
          </button>
        </div>
      </div>

      {/* 4 Nhóm KPI Chính (Mục 10.1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Khối 1: Dự án */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Tiến Độ Dự Án</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{kpi.totalProjects} dự án</div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            <div className="text-slate-600">
              Mới tiếp nhận: <strong className="text-slate-900">{kpi.newProjects}</strong>
            </div>
            <div className="text-slate-600">
              Đang triển khai: <strong className="text-indigo-600">{kpi.activeProjects}</strong>
            </div>
            <div className="text-slate-600">
              Chờ khách: <strong className="text-amber-600">{kpi.waitingCustomer}</strong>
            </div>
            <div className="text-slate-600">
              Hoàn thành: <strong className="text-emerald-600">{kpi.completedProjects}</strong>
            </div>
            <div className="col-span-2 flex items-center justify-between pt-1 text-rose-600 font-semibold">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Quá deadline: {kpi.overdueProjects}
              </span>
              <span className="text-emerald-700">Đúng hạn: {kpi.onTimeRate}%</span>
            </div>
          </div>
        </div>

        {/* Khối 2: Doanh thu & Thực thu */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Doanh Thu & Thực Thu
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          {hideFinance ? (
            <div className="py-6 text-xs text-slate-400">Đã ẩn theo phân quyền trường dữ liệu ({currentRole?.name})</div>
          ) : (
            <>
              <div>
                <span className="text-[11px] text-slate-400 block">Doanh thu trước thuế (Toàn công ty)</span>
                <div className="text-xl font-extrabold text-slate-900">{formatCurrency(kpi.revBeforeTax)}</div>
              </div>
              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Doanh thu sau thuế:</span>
                  <strong className="text-slate-800">{formatCurrency(kpi.revAfterTax)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổng thực thu (Đã xác nhận):</span>
                  <strong className="text-emerald-700">{formatCurrency(kpi.totalConfirmedPaid)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Công nợ còn lại:</span>
                  <strong className="text-rose-600">{formatCurrency(kpi.totalDebt)}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Khối 3: Chi phí & Lợi nhuận */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Chi Phí & Lợi Nhuận
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          {hideFinance ? (
            <div className="py-6 text-xs text-slate-400">Đã ẩn theo phân quyền trường dữ liệu ({currentRole?.name})</div>
          ) : (
            <>
              <div>
                <span className="text-[11px] text-slate-400 block">Lợi nhuận gộp dự án</span>
                <div className="text-xl font-extrabold text-emerald-700">{formatCurrency(kpi.grossProfit)}</div>
              </div>
              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chi phí trực tiếp dự án:</span>
                  <strong className="text-slate-800">{formatCurrency(kpi.directCost)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chi phí chung / vận hành:</span>
                  <strong className="text-slate-800">{formatCurrency(kpi.effectiveGeneralCost)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lợi nhuận sau phân bổ:</span>
                  <strong className="text-indigo-700">{formatCurrency(kpi.netProfit)}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Khối 4: Nhân sự & Chấm công hôm nay */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              4. Nhân Sự & Chấm Công
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{hrStats.totalActive} nhân sự</div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            <div className="text-slate-600">
              Sale hoạt động: <strong className="text-indigo-600">{hrStats.salesCount}</strong>
            </div>
            <div className="text-slate-600">
              Designer hoạt động: <strong className="text-emerald-600">{hrStats.designersCount}</strong>
            </div>
            <div className="text-slate-600">
              Đã chấm công: <strong className="text-emerald-700">{hrStats.checkedInToday}</strong>
            </div>
            <div className="text-slate-600">
              Đi muộn hôm nay: <strong className="text-amber-600">{hrStats.lateTodayCount}</strong>
            </div>
            <div className="col-span-2 text-slate-600">
              Đang nghỉ phép hôm nay: <strong className="text-rose-600">{hrStats.onLeaveTodayCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Cá nhân Sale hoặc Designer (Mục 10.3) */}
      {viewMode !== 'executive' && (
        <div className="bg-indigo-950 text-white rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">
                {viewMode === 'sale'
                  ? 'Dashboard Cá Nhân Sale (Mục 10.3)'
                  : 'Dashboard Cá Nhân Designer (Mục 10.3)'}
              </h3>
              <p className="text-xs text-indigo-200">
                Nhân sự đang đăng nhập: <strong>{currentEmployee?.full_name || 'Quản trị viên'}</strong> • KPI mục tiêu
                tháng: <strong>{formatCurrency(currentEmployee?.monthly_kpi_target || 0)}</strong>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/10 text-indigo-200 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Mã DA</th>
                  <th className="px-4 py-2.5">Tên dự án</th>
                  <th className="px-4 py-2.5">Loại JOB / Số trang</th>
                  <th className="px-4 py-2.5">Trạng thái & Tiến độ</th>
                  <th className="px-4 py-2.5">Deadline</th>
                  {!hideFinance && (
                    <>
                      <th className="px-4 py-2.5 text-right">Doanh thu ghi nhận (100%)</th>
                      <th className="px-4 py-2.5 text-right">Thực thu</th>
                      <th className="px-4 py-2.5 text-right">Công nợ</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-indigo-300">
                      Chưa có dự án nào trong phạm vi bộ lọc hiện tại
                    </td>
                  </tr>
                ) : (
                  filteredProjects.slice(0, 10).map((p) => {
                    const f = getProjectFinancials(p);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 font-mono font-bold text-indigo-300">{p.project_code}</td>
                        <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                        <td className="px-4 py-2.5">
                          {p.job_type} ({p.page_count} trang)
                        </td>
                        <td className="px-4 py-2.5">
                          {p.status} ({p.progress_percent}%)
                        </td>
                        <td className="px-4 py-2.5">{formatDate(p.deadline)}</td>
                        {!hideFinance && (
                          <>
                            <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(f.revenueBeforeTax)}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-300">
                              {formatCurrency(f.confirmedPayments)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-rose-300">{formatCurrency(f.remainingDebt)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Biểu đồ Doanh thu - Thực thu - Lợi nhuận theo Tháng & Bảng hiệu suất Sale / Designer */}
      {!hideFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Biểu đồ cột 12 tháng */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Biểu Đồ Doanh Thu Hợp Đồng – Thực Thu – Lợi Nhuận Theo Tháng ({filterYear})
                </h3>
                <p className="text-xs text-slate-500">
                  Phân biệt rõ Doanh thu hợp đồng trước thuế, Thực thu đã xác nhận và Lợi nhuận gộp
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-indigo-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" /> Doanh thu trước thuế
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Thực thu
                </span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 items-end h-52 pt-6 px-2 border-b border-slate-200">
              {monthlySeries.map((item) => {
                const hRev = Math.round((item.revBefore / maxMonthlyVal) * 100);
                const hPaid = Math.round((item.paid / maxMonthlyVal) * 100);
                return (
                  <div key={item.month} className="flex flex-col items-center gap-1 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-40">
                      <div
                        style={{ height: `${Math.max(4, hRev)}%` }}
                        title={`T${item.month} - Doanh thu: ${formatCurrency(item.revBefore)}`}
                        className="w-3 bg-indigo-600 rounded-t transition-all"
                      />
                      <div
                        style={{ height: `${Math.max(4, hPaid)}%` }}
                        title={`T${item.month} - Thực thu: ${formatCurrency(item.paid)}`}
                        className="w-3 bg-emerald-500 rounded-t transition-all"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">T{item.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Doanh thu theo Sale & Designer (Quy tắc 4 & 5) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Doanh Thu Ghi Nhận Sale & Designer</h3>
              <p className="text-[11px] text-slate-500">
                Quy tắc 4 & 5: Sale và Designer cùng nhận 100% doanh thu dự án; Tổng công ty chỉ tính 1 lần (
                <strong>{formatCurrency(kpi.revBeforeTax)}</strong>).
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase text-indigo-700">Top Sale phụ trách</div>
              {staffPerformance.sales.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có dữ liệu dự án gắn Sale</p>
              ) : (
                staffPerformance.sales.slice(0, 4).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl">
                    <div>
                      <strong className="text-slate-900">{s.name}</strong>
                      <span className="text-slate-500 ml-1.5">({s.count} DA)</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-700">{formatCurrency(s.revBefore)}</div>
                      <div className="text-[11px] text-emerald-600">Thực thu: {formatCurrency(s.paid)}</div>
                    </div>
                  </div>
                ))
              )}

              <div className="text-xs font-bold uppercase text-emerald-700 pt-2">Top Designer phụ trách</div>
              {staffPerformance.designers.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có dữ liệu dự án gắn Designer</p>
              ) : (
                staffPerformance.designers.slice(0, 4).map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl">
                    <div>
                      <strong className="text-slate-900">{d.name}</strong>
                      <span className="text-slate-500 ml-1.5">
                        ({d.count} DA • {d.pages} trang)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-700">{formatCurrency(d.revBefore)}</div>
                      {d.overdue > 0 ? (
                        <div className="text-[11px] text-rose-600">Quá hạn: {d.overdue} DA</div>
                      ) : (
                        <div className="text-[11px] text-slate-400">Đúng tiến độ</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
