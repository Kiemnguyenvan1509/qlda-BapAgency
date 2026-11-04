import React from 'react';
import { Download, FileSpreadsheet, BarChart3, Upload } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { exportToExcel } from '../lib/format';

interface Props {
  onOpenExcelImport: () => void;
}

export const ReportsPage: React.FC<Props> = ({ onOpenExcelImport }) => {
  const {
    scopedProjects,
    payments,
    expenses,
    employees,
    attendance,
    payrollDetails,
    getProjectFinancials,
  } = useErp();

  const reportCards = [
    {
      title: '1. Báo cáo Doanh thu Hợp đồng',
      desc: 'Tổng hợp toàn bộ dự án, giá trị trước thuế, thuế VAT và sau thuế theo ngày ký.',
      count: `${scopedProjects.length} dự án`,
      onExport: () =>
        exportToExcel(
          scopedProjects.map((p) => ({
            'Mã DA': p.project_code,
            'Tên dự án': p.name,
            'Số hợp đồng': p.contract_number || '',
            'Ngày ký': p.contract_sign_date || '',
            'Doanh thu trước thuế': p.revenue_before_tax,
            'VAT (%)': p.vat_rate,
            'Tiền VAT': p.vat_amount,
            'Doanh thu sau thuế': p.revenue_after_tax,
          })),
          '1_Bao_Cao_Doanh_Thu'
        ),
    },
    {
      title: '2. Báo cáo Thực thu',
      desc: 'Danh sách các đợt khách hàng chuyển tiền đã xác nhận và đang đối soát.',
      count: `${payments.length} giao dịch`,
      onExport: () =>
        exportToExcel(
          payments.map((pay) => ({
            'Mã GD': pay.transaction_code,
            'Đợt': pay.installment_name,
            'Số tiền': pay.amount,
            'Ngày nhận': pay.payment_date,
            'Phương thức': pay.payment_method,
            'Trạng thái': pay.status,
            'Người xác nhận': pay.confirmed_by || '',
          })),
          '2_Bao_Cao_Thuc_Thu'
        ),
    },
    {
      title: '3. Báo cáo Công nợ Khách hàng',
      desc: 'Đối chiếu Giá trị hợp đồng sau thuế trừ Thực thu đã xác nhận và tiền thừa.',
      count: `${scopedProjects.length} dự án`,
      onExport: () =>
        exportToExcel(
          scopedProjects.map((p) => {
            const f = getProjectFinancials(p);
            return {
              'Mã DA': p.project_code,
              'Tên dự án': p.name,
              'Giá trị HĐ sau thuế': f.revenueAfterTax,
              'Tổng thực thu': f.confirmedPayments,
              'Công nợ còn lại': f.remainingDebt,
              'Thanh toán thừa': f.overpaidAmount,
              'Trạng thái TT': f.paymentStatusLabel,
            };
          }),
          '3_Bao_Cao_Cong_No'
        ),
    },
    {
      title: '4. Báo cáo Chi phí Dự án & Vận hành',
      desc: 'Chi tiết chi phí trực tiếp dự án, chi phí chung, trạng thái phê duyệt và khấu trừ VAT.',
      count: `${expenses.length} khoản chi`,
      onExport: () =>
        exportToExcel(
          expenses.map((e) => ({
            'Mã CP': e.expense_code,
            'Nhóm': e.expense_scope,
            'Khoản chi': e.title,
            'Danh mục': e.category_name,
            'Trước thuế': e.amount_before_tax,
            'Sau thuế': e.amount_after_tax,
            'Ngày chi': e.expense_date,
            'Trạng thái': e.status,
          })),
          '4_Bao_Cao_Chi_Phi'
        ),
    },
    {
      title: '5. Báo cáo Lợi nhuận Dự án & Công ty',
      desc: 'Lợi nhuận gộp và lợi nhuận ròng sau phân bổ chi phí chung cho từng dự án.',
      count: `${scopedProjects.length} dự án`,
      onExport: () =>
        exportToExcel(
          scopedProjects.map((p) => {
            const f = getProjectFinancials(p);
            return {
              'Mã DA': p.project_code,
              'Tên dự án': p.name,
              'Doanh thu trước thuế': f.revenueBeforeTax,
              'Chi phí trực tiếp': f.directExpenses,
              'Chi phí chung phân bổ': f.allocatedGeneralCost,
              'Lợi nhuận gộp': f.grossProfit,
              'Lợi nhuận sau phân bổ': f.netProfitAfterAllocation,
              'Tỷ suất LN (%)': f.profitMarginPercent,
            };
          }),
          '5_Bao_Cao_Loi_Nhuan'
        ),
    },
    {
      title: '6. Báo cáo Doanh thu & Hiệu suất Sale',
      desc: 'Ghi nhận 100% doanh thu dự án phụ trách, thực thu, công nợ và tỷ lệ đạt KPI của từng Sale.',
      count: `${employees.filter((e) => e.role_code === 'sale').length} Sale`,
      onExport: () =>
        exportToExcel(
          employees
            .filter((e) => e.role_code === 'sale')
            .map((emp) => {
              const projs = scopedProjects.filter((p) => p.sale_id === emp.id);
              const rev = projs.reduce((s, p) => s + Number(p.revenue_before_tax || 0), 0);
              return {
                'Mã NV': emp.employee_code,
                'Họ tên Sale': emp.full_name,
                'Số dự án': projs.length,
                'Doanh thu trước thuế (100%)': rev,
                'Mục tiêu KPI': emp.monthly_kpi_target,
              };
            }),
          '6_Bao_Cao_Hieu_Suat_Sale'
        ),
    },
    {
      title: '7. Báo cáo Khối lượng & Doanh thu Designer',
      desc: 'Ghi nhận 100% doanh thu dự án, tổng số trang thiết kế và tỷ lệ hoàn thành đúng deadline.',
      count: `${employees.filter((e) => e.role_code === 'designer').length} Designer`,
      onExport: () =>
        exportToExcel(
          employees
            .filter((e) => e.role_code === 'designer')
            .map((emp) => {
              const projs = scopedProjects.filter((p) => p.designer_id === emp.id);
              const pages = projs.reduce((s, p) => s + Number(p.page_count || 0), 0);
              const rev = projs.reduce((s, p) => s + Number(p.revenue_before_tax || 0), 0);
              return {
                'Mã NV': emp.employee_code,
                'Họ tên Designer': emp.full_name,
                'Số dự án': projs.length,
                'Tổng số trang thiết kế': pages,
                'Doanh thu ghi nhận (100%)': rev,
              };
            }),
          '7_Bao_Cao_Hieu_Suat_Designer'
        ),
    },
    {
      title: '8. Báo cáo Chấm công',
      desc: 'Chi tiết giờ check-in, check-out, số phút đi muộn, về sớm và giải trình.',
      count: `${attendance.length} lượt chấm công`,
      onExport: () =>
        exportToExcel(
          attendance.map((a) => {
            const emp = employees.find((e) => e.id === a.employee_id);
            return {
              'Ngày': a.work_date,
              'Mã NV': emp?.employee_code || '',
              'Họ tên': emp?.full_name || '',
              'Check-in': a.check_in || '',
              'Check-out': a.check_out || '',
              'Đi muộn (phút)': a.late_minutes,
              'Ngày công': a.work_day_credit,
            };
          }),
          '8_Bao_Cao_Cham_Cong'
        ),
    },
    {
      title: '9. Báo cáo Tổng hợp Lương',
      desc: 'Chi tiết bảng lương, phụ cấp, thưởng, tăng ca, khấu trừ và thực lĩnh.',
      count: `${payrollDetails.length} phiếu lương`,
      onExport: () =>
        exportToExcel(
          payrollDetails.map((d) => {
            const emp = employees.find((e) => e.id === d.employee_id);
            return {
              'Mã NV': emp?.employee_code || '',
              'Họ tên': emp?.full_name || '',
              'Lương cơ bản': d.base_salary,
              'Lương theo công': d.salary_by_workdays,
              'Phụ cấp': d.allowance,
              'Thưởng': d.bonus,
              'Tăng ca': d.overtime_pay,
              'Khấu trừ': d.valid_deductions,
              'Thực nhận': d.net_salary,
            };
          }),
          '9_Bao_Cao_Bang_Luong'
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Trung Tâm 9 Báo Cáo Thống Kê & Chuyển Đổi Dữ Liệu
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            Xuất trực tiếp dữ liệu thật từ Supabase ra file Excel (.xlsx) hoặc nhập file Excel từ hệ thống Google Sheets
            cũ.
          </p>
        </div>
        <button
          onClick={onOpenExcelImport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
        >
          <Upload className="w-4 h-4" /> Nhập dữ liệu từ Google Sheets / Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-slate-500">{card.count}</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 pt-1">{card.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
            </div>
            <button
              onClick={card.onExport}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất báo cáo Excel (.xlsx)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
