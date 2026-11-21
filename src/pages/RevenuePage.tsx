import React, { useState, useMemo } from 'react';
import { Download, Info } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { exportToExcel, formatCurrency, formatDate, formatDateTime } from '../lib/format';

export const RevenuePage: React.FC = () => {
  const { scopedProjects, customers, employees, departments, users, roles, contractRevisions, getProjectFinancials } =
    useErp();

  const [tab, setTab] = useState<'contracts' | 'staff_revenue' | 'revisions'>('contracts');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isItDepartment = (deptId?: string | null) => {
    if (!deptId) return false;
    const d = departments.find((item) => item.id === deptId);
    if (!d) return false;
    const name = d.name?.trim().toLowerCase() || '';
    const code = d.code?.trim().toLowerCase() || '';
    return (
      code === 'it' ||
      code.includes('_it') ||
      code.includes('it_') ||
      name === 'it' ||
      name.includes('phòng it') ||
      name.includes('phong it') ||
      /\bit\b/.test(name)
    );
  };

  const isItEmployee = (empId?: string | null) => {
    if (!empId) return false;
    const e = employees.find((item) => item.id === empId);
    if (!e) return false;
    const code = e.role_code?.toLowerCase() || '';
    if (code === 'it') return true;
    const u = users.find((user) => user.employee_id === e.id);
    const r = roles.find((role) => role.id === u?.role_id);
    if (r?.code?.toLowerCase() === 'it') return true;
    if (isItDepartment(e.department_id)) return true;
    const pos = e.position?.toLowerCase() || '';
    return /\bit\b/.test(pos) || pos.includes('lập trình') || pos.includes('kỹ thuật');
  };

  const isMarketingDepartment = (deptId?: string | null) => {
    if (!deptId) return false;
    const d = departments.find((item) => item.id === deptId);
    if (!d) return false;
    const name = d.name?.trim().toLowerCase() || '';
    const code = d.code?.trim().toLowerCase() || '';
    return (
      code === 'marketing' ||
      code === 'mkt' ||
      code.includes('marketing') ||
      code.includes('mkt') ||
      name.includes('marketing') ||
      name.includes('mkt') ||
      name.includes('maketing')
    );
  };

  const isMarketingEmployee = (empId?: string | null) => {
    if (!empId) return false;
    const e = employees.find((item) => item.id === empId);
    if (!e) return false;
    const code = e.role_code?.toLowerCase() || '';
    if (code === 'marketing' || code === 'mkt') return true;
    const u = users.find((user) => user.employee_id === e.id);
    const r = roles.find((role) => role.id === u?.role_id);
    const rCode = r?.code?.toLowerCase() || '';
    if (rCode === 'marketing' || rCode === 'mkt') return true;
    if (isMarketingDepartment(e.department_id)) return true;
    const pos = e.position?.toLowerCase() || '';
    return pos.includes('marketing') || pos.includes('mkt') || pos.includes('content') || pos.includes('truyền thông');
  };

  const activeProjects = useMemo(() => {
    return scopedProjects.filter((p) => {
      if (p.is_archived || p.status === 'Hủy dự án' || p.contract_status === 'Hủy') return false;
      const signDate = p.contract_sign_date || p.received_date || p.created_at.slice(0, 10);
      if (dateFrom && signDate < dateFrom) return false;
      if (dateTo && signDate > dateTo) return false;
      return true;
    });
  }, [scopedProjects, dateFrom, dateTo]);

  // Tổng doanh thu công ty (Quy tắc 5: mỗi dự án chỉ tính 1 lần)
  const companySummary = useMemo(() => {
    let beforeTax = 0;
    let vat = 0;
    let afterTax = 0;
    for (const p of activeProjects) {
      beforeTax += Number(p.revenue_before_tax) || 0;
      vat += Number(p.vat_amount) || 0;
      afterTax += Number(p.revenue_after_tax) || 0;
    }
    return { beforeTax, vat, afterTax };
  }, [activeProjects]);

  // Báo cáo doanh thu theo Sale, Designer, IT & Marketing (Quy tắc 4: ghi nhận 100% doanh thu của dự án)
  const staffRevenue = useMemo(() => {
    const saleRows: Array<{
      id: string;
      code: string;
      name: string;
      projectCount: number;
      beforeTax: number;
      afterTax: number;
      confirmedPaid: number;
      debt: number;
    }> = [];
    const designerRows: typeof saleRows = [];
    const itRows: typeof saleRows = [];
    const marketingRows: typeof saleRows = [];

    const saleMap = new Map<string, (typeof saleRows)[0]>();
    const desMap = new Map<string, (typeof saleRows)[0]>();
    const itMap = new Map<string, (typeof saleRows)[0]>();
    const marketingMap = new Map<string, (typeof saleRows)[0]>();

    // Khởi tạo sẵn danh sách nhân sự thuộc IT và Marketing để luôn hiển thị trên bảng
    for (const emp of employees) {
      if (emp.work_status === 'Đã nghỉ việc') continue;
      if (isMarketingEmployee(emp.id)) {
        marketingMap.set(emp.id, {
          id: emp.id,
          code: emp.employee_code || 'MKT',
          name: emp.full_name,
          projectCount: 0,
          beforeTax: 0,
          afterTax: 0,
          confirmedPaid: 0,
          debt: 0,
        });
      } else if (isItEmployee(emp.id)) {
        itMap.set(emp.id, {
          id: emp.id,
          code: emp.employee_code || 'IT',
          name: emp.full_name,
          projectCount: 0,
          beforeTax: 0,
          afterTax: 0,
          confirmedPaid: 0,
          debt: 0,
        });
      }
    }

    for (const p of activeProjects) {
      const f = getProjectFinancials(p);
      if (p.sale_id) {
        const emp = employees.find((e) => e.id === p.sale_id);
        const cur = saleMap.get(p.sale_id) || {
          id: p.sale_id,
          code: emp?.employee_code || 'SALE',
          name: emp?.full_name || 'Sale',
          projectCount: 0,
          beforeTax: 0,
          afterTax: 0,
          confirmedPaid: 0,
          debt: 0,
        };
        cur.projectCount++;
        cur.beforeTax += f.revenueBeforeTax;
        cur.afterTax += f.revenueAfterTax;
        cur.confirmedPaid += f.confirmedPayments;
        cur.debt += f.remainingDebt;
        saleMap.set(p.sale_id, cur);
      }

      if (p.designer_id) {
        const emp = employees.find((e) => e.id === p.designer_id);
        const belongsToMarketing = isMarketingDepartment(p.department_id) || isMarketingEmployee(p.designer_id);
        const belongsToIt = !belongsToMarketing && (isItDepartment(p.department_id) || isItEmployee(p.designer_id));
        const targetMap = belongsToMarketing ? marketingMap : belongsToIt ? itMap : desMap;
        const cur = targetMap.get(p.designer_id) || {
          id: p.designer_id,
          code: emp?.employee_code || (belongsToMarketing ? 'MKT' : belongsToIt ? 'IT' : 'DES'),
          name: emp?.full_name || (belongsToMarketing ? 'Nhân viên Marketing' : belongsToIt ? 'Nhân viên IT' : 'Designer'),
          projectCount: 0,
          beforeTax: 0,
          afterTax: 0,
          confirmedPaid: 0,
          debt: 0,
        };
        cur.projectCount++;
        cur.beforeTax += f.revenueBeforeTax;
        cur.afterTax += f.revenueAfterTax;
        cur.confirmedPaid += f.confirmedPayments;
        cur.debt += f.remainingDebt;
        targetMap.set(p.designer_id, cur);
      }
    }

    saleMap.forEach((v) => saleRows.push(v));
    desMap.forEach((v) => designerRows.push(v));
    itMap.forEach((v) => itRows.push(v));
    marketingMap.forEach((v) => marketingRows.push(v));
    return {
      sales: saleRows.sort((a, b) => b.beforeTax - a.beforeTax),
      designers: designerRows.sort((a, b) => b.beforeTax - a.beforeTax),
      itStaff: itRows.sort((a, b) => b.beforeTax - a.beforeTax),
      marketingStaff: marketingRows.sort((a, b) => b.beforeTax - a.beforeTax),
    };
  }, [activeProjects, employees, departments, users, roles, getProjectFinancials]);

  return (
    <div className="space-y-4">
      {/* Quy tắc nghiệp vụ Banner */}
      <div className="bg-indigo-950 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Info className="w-4 h-4" /> Quy tắc Doanh thu Hợp đồng
          </div>
          <p className="text-xs text-indigo-100 max-w-3xl">
            • <strong>Quy tắc 1 & 2:</strong> Doanh thu là giá trị hợp đồng (Trước thuế & Sau thuế), hoàn toàn độc lập
            với Thực thu. <br />• <strong>Quy tắc 4 & 5:</strong> Mỗi dự án ghi nhận 100% doanh thu cho cả Sale chính và
            Designer chính; nhưng Doanh thu toàn công ty chỉ tính mỗi dự án <strong>một lần duy nhất</strong> (không
            cộng chéo).
          </p>
        </div>
        <div className="flex items-center gap-6 bg-white/10 px-5 py-3 rounded-xl">
          <div>
            <span className="text-[11px] text-indigo-200 block">Tổng DT Công ty (Trước thuế)</span>
            <strong className="text-lg font-extrabold text-white">{formatCurrency(companySummary.beforeTax)}</strong>
          </div>
          <div>
            <span className="text-[11px] text-indigo-200 block">Tổng VAT đầu ra</span>
            <strong className="text-base font-bold text-amber-300">{formatCurrency(companySummary.vat)}</strong>
          </div>
          <div>
            <span className="text-[11px] text-indigo-200 block">Tổng DT Công ty (Sau thuế)</span>
            <strong className="text-lg font-extrabold text-emerald-300">
              {formatCurrency(companySummary.afterTax)}
            </strong>
          </div>
        </div>
      </div>

      {/* Tabs & Date Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('contracts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'contracts' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            1. Danh sách Hợp đồng & Doanh thu ({activeProjects.length})
          </button>
          <button
            onClick={() => setTab('staff_revenue')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'staff_revenue' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Doanh thu ghi nhận theo Sale, Designer, IT & Marketing
          </button>
          <button
            onClick={() => setTab('revisions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'revisions' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            3. Lịch sử điều chỉnh hợp đồng ({contractRevisions.length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Lọc ngày ký HĐ:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
          />
          <span>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300"
          />
          <button
            onClick={() =>
              exportToExcel(
                activeProjects.map((p) => ({
                  'Mã DA': p.project_code,
                  'Tên dự án': p.name,
                  'Số HĐ': p.contract_number || '',
                  'Ngày ký': p.contract_sign_date || '',
                  'Trạng thái HĐ': p.contract_status,
                  'Doanh thu trước thuế': p.revenue_before_tax,
                  'VAT (%)': p.vat_rate,
                  'Tiền VAT': p.vat_amount,
                  'Doanh thu sau thuế': p.revenue_after_tax,
                })),
                'Bao_Cao_Doanh_Thu_Hop_Dong'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {tab === 'contracts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[850px]">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Mã DA</th>
                  <th className="px-4 py-3">Dự án / Khách hàng</th>
                  <th className="px-4 py-3">Số HĐ & Ngày ký</th>
                  <th className="px-4 py-3">Trạng thái HĐ</th>
                  <th className="px-4 py-3">Sale / Designer (100% DT)</th>
                  <th className="px-4 py-3 text-right">Doanh thu trước thuế</th>
                  <th className="px-4 py-3 text-right">VAT</th>
                  <th className="px-4 py-3 text-right">Doanh thu sau thuế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Chưa có dữ liệu hợp đồng
                    </td>
                  </tr>
                ) : (
                  activeProjects.map((p) => {
                    const cust = customers.find((c) => c.id === p.customer_id);
                    const sale = employees.find((e) => e.id === p.sale_id);
                    const des = employees.find((e) => e.id === p.designer_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600">{p.project_code}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{cust?.name || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold">{p.contract_number || '(Chưa cấp số)'}</div>
                          <div className="text-[11px] text-slate-500">{formatDate(p.contract_sign_date)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                            {p.contract_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>Sale: {sale?.full_name || '—'}</div>
                          <div className="text-emerald-700">
                            {isMarketingDepartment(p.department_id) || isMarketingEmployee(p.designer_id)
                              ? 'Marketing'
                              : isItDepartment(p.department_id) || isItEmployee(p.designer_id)
                              ? 'IT'
                              : 'Designer'}
                            : {des?.full_name || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatCurrency(p.revenue_before_tax)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCurrency(p.vat_amount)} ({p.vat_rate}%)
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-700">
                          {formatCurrency(p.revenue_after_tax)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'staff_revenue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bảng Doanh thu Sale */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 font-bold text-xs text-indigo-950">
              Doanh Thu Ghi Nhận Theo Sale Phụ Trách (100% Giá Trị Dự Án)
            </div>
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Nhân sự Sale</th>
                    <th className="px-3 py-2.5 text-center">Số DA</th>
                    <th className="px-3 py-2.5 text-right">DT Trước thuế</th>
                    <th className="px-3 py-2.5 text-right">Thực thu</th>
                    <th className="px-3 py-2.5 text-right">Công nợ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffRevenue.sales.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 font-semibold">
                        [{s.code}] {s.name}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold">{s.projectCount}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-700">{formatCurrency(s.beforeTax)}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(s.confirmedPaid)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-600">{formatCurrency(s.debt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bảng Doanh thu Designer */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 font-bold text-xs text-emerald-950">
              Doanh Thu Ghi Nhận Theo Designer Phụ Trách (100% Giá Trị Dự Án)
            </div>
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Nhân sự Designer</th>
                    <th className="px-3 py-2.5 text-center">Số DA</th>
                    <th className="px-3 py-2.5 text-right">DT Trước thuế</th>
                    <th className="px-3 py-2.5 text-right">Thực thu DA</th>
                    <th className="px-3 py-2.5 text-right">Công nợ DA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffRevenue.designers.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2.5 font-semibold">
                        [{d.code}] {d.name}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold">{d.projectCount}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{formatCurrency(d.beforeTax)}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(d.confirmedPaid)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-600">{formatCurrency(d.debt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bảng Doanh thu Nhân viên IT */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-cyan-50 border-b border-cyan-100 font-bold text-xs text-cyan-950">
              Doanh Thu Ghi Nhận Theo Nhân Viên IT Phụ Trách (100% Giá Trị Dự Án)
            </div>
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Nhân sự IT</th>
                    <th className="px-3 py-2.5 text-center">Số DA</th>
                    <th className="px-3 py-2.5 text-right">DT Trước thuế</th>
                    <th className="px-3 py-2.5 text-right">Thực thu DA</th>
                    <th className="px-3 py-2.5 text-right">Công nợ DA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffRevenue.itStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        Chưa có dữ liệu nhân sự hoặc dự án IT
                      </td>
                    </tr>
                  ) : (
                    staffRevenue.itStaff.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-semibold">
                          [{it.code}] {it.name}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">{it.projectCount}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-cyan-700">
                          {formatCurrency(it.beforeTax)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-emerald-700">
                          {formatCurrency(it.confirmedPaid)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-600">{formatCurrency(it.debt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bảng Doanh thu Nhân viên Marketing */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-fuchsia-50 border-b border-fuchsia-100 font-bold text-xs text-fuchsia-950">
              Doanh Thu Ghi Nhận Theo Nhân Viên Marketing Phụ Trách (100% Giá Trị Dự Án)
            </div>
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Nhân sự Marketing</th>
                    <th className="px-3 py-2.5 text-center">Số DA</th>
                    <th className="px-3 py-2.5 text-right">DT Trước thuế</th>
                    <th className="px-3 py-2.5 text-right">Thực thu DA</th>
                    <th className="px-3 py-2.5 text-right">Công nợ DA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffRevenue.marketingStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        Chưa có dữ liệu nhân sự hoặc dự án Marketing
                      </td>
                    </tr>
                  ) : (
                    staffRevenue.marketingStaff.map((mkt) => (
                      <tr key={mkt.id}>
                        <td className="px-3 py-2.5 font-semibold">
                          [{mkt.code}] {mkt.name}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">{mkt.projectCount}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-fuchsia-700">
                          {formatCurrency(mkt.beforeTax)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-emerald-700">
                          {formatCurrency(mkt.confirmedPaid)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-600">{formatCurrency(mkt.debt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'revisions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[650px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Dự án</th>
                <th className="px-4 py-3 text-right">Trước thuế (Cũ → Mới)</th>
                <th className="px-4 py-3 text-right">Sau thuế (Cũ → Mới)</th>
                <th className="px-4 py-3">Lý do điều chỉnh</th>
                <th className="px-4 py-3">Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contractRevisions.map((r) => {
                const proj = scopedProjects.find((p) => p.id === r.project_id);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3 font-semibold">
                      [{proj?.project_code}] {proj?.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(r.old_before_tax)} → <strong>{formatCurrency(r.new_before_tax)}</strong>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(r.old_after_tax)} →{' '}
                      <strong className="text-indigo-700">{formatCurrency(r.new_after_tax)}</strong>
                    </td>
                    <td className="px-4 py-3">{r.reason}</td>
                    <td className="px-4 py-3">{r.changed_by}</td>
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
