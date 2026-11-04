import React, { useState } from 'react';
import {
  X,
  FileText,
  CreditCard,
  Receipt,
  Activity,
  Users,
  FolderOpen,
  History,
  Info,
  CheckCircle2,
  Plus,
  ExternalLink,
  Lock,
  Loader2,
} from 'lucide-react';
import { Project, ProjectFile } from '../types/database';
import { useErp } from '../context/ErpContext';
import { calculateContractTaxes, formatCurrency, formatDate, formatDateTime, getTodayISO } from '../lib/format';

interface Props {
  project: Project | null;
  onClose: () => void;
}

type DetailTab =
  | 'overview'
  | 'contract'
  | 'payments'
  | 'expenses'
  | 'progress'
  | 'staff'
  | 'files'
  | 'audit';

export const ProjectDetailModal: React.FC<Props> = ({ project, onClose }) => {
  const {
    customers,
    employees,
    departments,
    payments,
    expenses,
    expenseCategories,
    contractRevisions,
    projectAssignments,
    workLogs,
    projectFiles,
    auditLogs,
    projectStatuses,
    jobTypes,
    isFieldHidden,
    canAction,
    getProjectFinancials,
    updateProject,
    adjustProjectContract,
    createPayment,
    confirmPayment,
    createExpense,
    updateExpenseStatus,
    addWorkLog,
    handoverProjectStaff,
    addProjectFile,
  } = useErp();

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // States for Tab 2: Contract adjustment
  const [taxMode, setTaxMode] = useState<'before_tax' | 'after_tax'>(project?.tax_input_mode || 'before_tax');
  const [inputContractVal, setInputContractVal] = useState<number>(
    project?.tax_input_mode === 'after_tax'
      ? Number(project?.revenue_after_tax || 0)
      : Number(project?.revenue_before_tax || 0)
  );
  const [vatRate, setVatRate] = useState<number>(Number(project?.vat_rate ?? 8));
  const [contractStatus, setContractStatus] = useState<Project['contract_status']>(
    project?.contract_status || 'Nháp'
  );
  const [contractNumber, setContractNumber] = useState<string>(project?.contract_number || '');
  const [contractSignDate, setContractSignDate] = useState<string>(project?.contract_sign_date || '');
  const [contractReason, setContractReason] = useState<string>('');

  // States for Tab 3: Add payment
  const [payInstallment, setPayInstallment] = useState('Đợt 1');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payMethod, setPayMethod] = useState('Chuyển khoản');
  const [payBankCode, setPayBankCode] = useState('');

  // States for Tab 4: Add expense
  const [expTitle, setExpTitle] = useState('');
  const [expCat, setExpCat] = useState('Thuê cộng tác viên');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expVat, setExpVat] = useState<number>(0);
  const [expDeductible, setExpDeductible] = useState<boolean>(true);
  const [expRecipient, setExpRecipient] = useState('');

  // States for Tab 5: Work log
  const [stepName, setStepName] = useState('');
  const [stepProgress, setStepProgress] = useState<number>(project?.progress_percent || 0);
  const [stepStatus, setStepStatus] = useState<string>(project?.status || 'Đang thiết kế');
  const [stepHours, setStepHours] = useState<number>(2);
  const [stepNote, setStepNote] = useState('');

  // States for Tab 6: Staff handover
  const [handoverRole, setHandoverRole] = useState<'Sale' | 'Designer' | 'Trưởng nhóm'>('Designer');
  const [handoverNewEmp, setHandoverNewEmp] = useState<string>('');
  const [handoverNote, setHandoverNote] = useState('');

  // States for Tab 7: File upload
  const [fileCat, setFileCat] = useState<ProjectFile['file_category']>('File thiết kế');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  // Loading states
  const [isAdjustingContract, setIsAdjustingContract] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [confirmingPayId, setConfirmingPayId] = useState<string | null>(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [updatingExpId, setUpdatingExpId] = useState<string | null>(null);
  const [isAddingWorkLog, setIsAddingWorkLog] = useState(false);
  const [isHandingOver, setIsHandingOver] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);

  if (!project) return null;

  const customer = customers.find((c) => c.id === project.customer_id);
  const sale = employees.find((e) => e.id === project.sale_id);
  const designer = employees.find((e) => e.id === project.designer_id);
  const leader = employees.find((e) => e.id === project.team_leader_id);
  const dept = departments.find((d) => d.id === project.department_id);
  const fin = getProjectFinancials(project);

  const projPayments = payments.filter((p) => p.project_id === project.id);
  const projExpenses = expenses.filter((e) => e.project_id === project.id);
  const projRevisions = contractRevisions.filter((r) => r.project_id === project.id);
  const projAssignments = projectAssignments.filter((a) => a.project_id === project.id);
  const projWorkLogs = workLogs.filter((w) => w.project_id === project.id);
  const projFiles = projectFiles.filter((f) => f.project_id === project.id);
  const projAudits = auditLogs.filter((a) => a.target_id === project.id);

  const previewTaxes = calculateContractTaxes(inputContractVal, vatRate, taxMode);
  const hideFinance = isFieldHidden('revenue_before_tax');

  const tabs: Array<{ id: DetailTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: '1. Tổng quan', icon: <Info className="w-4 h-4" /> },
    { id: 'contract', label: '2. Hợp đồng & Doanh thu', icon: <FileText className="w-4 h-4" /> },
    { id: 'payments', label: '3. Thanh toán', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'expenses', label: '4. Chi phí', icon: <Receipt className="w-4 h-4" /> },
    { id: 'progress', label: '5. Tiến độ', icon: <Activity className="w-4 h-4" /> },
    { id: 'staff', label: '6. Nhân sự', icon: <Users className="w-4 h-4" /> },
    { id: 'files', label: '7. File tài liệu', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'audit', label: '8. Nhật ký hoạt động', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold">
                {project.project_code}
              </span>
              <h2 className="text-lg font-bold">{project.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                {project.status} ({project.progress_percent}%)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Khách hàng: <strong className="text-slate-200">{customer?.name || 'Chưa gắn khách hàng'}</strong> • Loại
              JOB: <strong className="text-slate-200">{project.job_type}</strong> ({project.page_count} trang) •
              Deadline: <strong className="text-slate-200">{formatDate(project.deadline)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 8 Tabs Navigation */}
        <div className="bg-slate-100 px-4 pt-2 border-b border-slate-200 flex items-center gap-1 overflow-x-auto shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-indigo-600 border-t border-x border-slate-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: TỔNG QUAN */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Thông tin cơ bản dự án</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-slate-500 block">Mã dự án</span>
                      <span className="font-mono font-bold text-slate-900">{project.project_code}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Khách hàng</span>
                      <span className="font-semibold text-slate-900">{customer?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Loại JOB</span>
                      <select
                        value={project.job_type}
                        onChange={(e) => updateProject(project.id, { job_type: e.target.value })}
                        className="mt-0.5 text-xs font-semibold px-2 py-1 rounded border border-slate-300 bg-white"
                      >
                        {jobTypes.map((jt) => (
                          <option key={jt} value={jt}>
                            {jt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Số trang thiết kế</span>
                      <span className="font-semibold">{project.page_count} trang</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Mức độ ưu tiên</span>
                      <span className="font-semibold">{project.priority}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Trạng thái hiện tại</span>
                      <select
                        value={project.status}
                        onChange={(e) => updateProject(project.id, { status: e.target.value })}
                        className="mt-0.5 text-xs font-semibold px-2 py-1 rounded border border-slate-300 bg-white"
                      >
                        {projectStatuses.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Ngày tiếp nhận</span>
                      <span>{formatDate(project.received_date)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Deadline</span>
                      <span className="font-semibold text-rose-600">{formatDate(project.deadline)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Ngày hoàn thành / Bàn giao</span>
                      <span>
                        {formatDate(project.completed_date)} / {formatDate(project.handover_date)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
                    <strong>Ghi chú dự án:</strong> {project.notes || 'Không có ghi chú'}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Nhân sự phụ trách (Quy tắc 4)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-slate-500 block">Sale chính</span>
                      <span className="font-semibold text-indigo-700">{sale?.full_name || 'Chưa phân công'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Designer chính</span>
                      <span className="font-semibold text-emerald-700">{designer?.full_name || 'Chưa phân công'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Trưởng nhóm</span>
                      <span className="font-medium">{leader?.full_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Phòng ban</span>
                      <span className="font-medium">{dept?.name || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tóm tắt tài chính nhanh */}
              <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tóm tắt Tài chính & Lợi nhuận
                </h4>
                {hideFinance ? (
                  <div className="p-4 rounded-xl bg-slate-800 text-xs text-slate-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    Tài khoản của bạn không hiển thị chỉ tiêu tài chính.
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Doanh thu trước thuế:</span>
                      <span className="font-bold text-sm">{formatCurrency(fin.revenueBeforeTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Thuế VAT ({project.vat_rate}%):</span>
                      <span>{formatCurrency(fin.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Giá trị HĐ sau thuế:</span>
                      <span className="font-bold text-indigo-300 text-sm">{formatCurrency(fin.revenueAfterTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tổng thực thu (Đã xác nhận):</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(fin.confirmedPayments)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Công nợ còn lại:</span>
                      <span className="font-bold text-rose-400">{formatCurrency(fin.remainingDebt)}</span>
                    </div>
                    {fin.overpaidAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-300">Tiền thanh toán thừa:</span>
                        <span className="font-bold text-amber-300">{formatCurrency(fin.overpaidAmount)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-800 pt-2 flex justify-between">
                      <span className="text-slate-400">Chi phí trực tiếp hợp lệ:</span>
                      <span>{formatCurrency(fin.directExpenses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lợi nhuận gộp dự án:</span>
                      <span className="font-bold text-emerald-300 text-sm">{formatCurrency(fin.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lợi nhuận sau phân bổ:</span>
                      <span className="font-bold text-amber-300">{formatCurrency(fin.netProfitAfterAllocation)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HỢP ĐỒNG & DOANH THU */}
          {activeTab === 'contract' && (
            <div className="space-y-6">
              {hideFinance ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  Vai trò của bạn không được cấp quyền xem/chỉnh sửa dữ liệu Hợp đồng & Doanh thu.
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800">
                      Cập nhật / Điều chỉnh Hợp đồng & Doanh thu
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Phương thức nhập giá trị hợp đồng
                        </label>
                        <select
                          value={taxMode}
                          onChange={(e) => setTaxMode(e.target.value as 'before_tax' | 'after_tax')}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="before_tax">Nhập giá Trước thuế → Tính giá Sau thuế</option>
                          <option value="after_tax">Nhập giá Đã gồm thuế → Tính ngược Trước thuế</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {taxMode === 'before_tax' ? 'Giá trị trước thuế (VNĐ)' : 'Tổng giá trị sau thuế (VNĐ)'}
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={inputContractVal === 0 ? '' : inputContractVal}
                          onChange={(e) => setInputContractVal(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Thuế suất VAT (%)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={vatRate === 0 ? '' : vatRate}
                          onChange={(e) => setVatRate(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3.5 rounded-xl border border-indigo-100 text-xs">
                      <div>
                        <span className="text-slate-500 block">Doanh thu trước thuế:</span>
                        <strong className="text-base text-slate-900">{formatCurrency(previewTaxes.beforeTax)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tiền thuế VAT ({vatRate}%):</span>
                        <strong className="text-base text-amber-700">{formatCurrency(previewTaxes.vatAmount)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Doanh thu sau thuế:</span>
                        <strong className="text-base text-indigo-700">{formatCurrency(previewTaxes.afterTax)}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Số hợp đồng</label>
                        <input
                          type="text"
                          value={contractNumber}
                          onChange={(e) => setContractNumber(e.target.value)}
                          placeholder="HĐ-2026/001"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày ký hợp đồng</label>
                        <input
                          type="date"
                          value={contractSignDate}
                          onChange={(e) => setContractSignDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng thái hợp đồng</label>
                        <select
                          value={contractStatus}
                          onChange={(e) => setContractStatus(e.target.value as Project['contract_status'])}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="Nháp">Nháp</option>
                          <option value="Chờ ký">Chờ ký</option>
                          <option value="Đã ký">Đã ký</option>
                          <option value="Điều chỉnh">Điều chỉnh</option>
                          <option value="Hủy">Hủy</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Lý do cập nhật / điều chỉnh *
                        </label>
                        <input
                          type="text"
                          value={contractReason}
                          onChange={(e) => setContractReason(e.target.value)}
                          placeholder="Ký phụ lục / chốt giá..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    {canAction('revenue', 'edit') && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={isAdjustingContract}
                          onClick={async () => {
                            if (isAdjustingContract) return;
                            setIsAdjustingContract(true);
                            try {
                              await adjustProjectContract(
                                project.id,
                                inputContractVal,
                                vatRate,
                                taxMode,
                                contractStatus,
                                contractNumber,
                                contractSignDate,
                                contractReason || 'Cập nhật hợp đồng'
                              );
                            } finally {
                              setIsAdjustingContract(false);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                        >
                          {isAdjustingContract ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu hợp đồng...
                            </>
                          ) : (
                            'Lưu Hợp đồng & Ghi lịch sử điều chỉnh'
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lịch sử điều chỉnh hợp đồng */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                      Lịch sử điều chỉnh hợp đồng ({projRevisions.length})
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Thời gian</th>
                            <th className="px-3 py-2 text-right">Trước thuế (Cũ → Mới)</th>
                            <th className="px-3 py-2 text-right">Sau thuế (Cũ → Mới)</th>
                            <th className="px-3 py-2">Trạng thái</th>
                            <th className="px-3 py-2">Lý do</th>
                            <th className="px-3 py-2">Người sửa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {projRevisions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                                Chưa có lịch sử điều chỉnh hợp đồng
                              </td>
                            </tr>
                          ) : (
                            projRevisions.map((rev) => (
                              <tr key={rev.id}>
                                <td className="px-3 py-2">{formatDateTime(rev.created_at)}</td>
                                <td className="px-3 py-2 text-right">
                                  {formatCurrency(rev.old_before_tax)} →{' '}
                                  <strong>{formatCurrency(rev.new_before_tax)}</strong>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatCurrency(rev.old_after_tax)} →{' '}
                                  <strong className="text-indigo-700">{formatCurrency(rev.new_after_tax)}</strong>
                                </td>
                                <td className="px-3 py-2">
                                  {rev.old_status} → <strong>{rev.new_status}</strong>
                                </td>
                                <td className="px-3 py-2">{rev.reason}</td>
                                <td className="px-3 py-2">{rev.changed_by}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: THANH TOÁN (THỰC THU & CÔNG NỢ) */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {hideFinance ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  Vai trò của bạn không hiển thị dữ liệu Thanh toán & Công nợ.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500 block">Giá trị HĐ sau thuế</span>
                      <strong className="text-base text-slate-900">{formatCurrency(fin.revenueAfterTax)}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-xs text-emerald-700 block">Tổng thực thu (Đã xác nhận)</span>
                      <strong className="text-base text-emerald-800">{formatCurrency(fin.confirmedPayments)}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-xs text-rose-700 block">Công nợ còn lại</span>
                      <strong className="text-base text-rose-800">{formatCurrency(fin.remainingDebt)}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                      <span className="text-xs text-indigo-700 block">Trạng thái thanh toán</span>
                      <strong className="text-sm text-indigo-900">{fin.paymentStatusLabel}</strong>
                    </div>
                  </div>

                  {/* Form thêm đợt thanh toán */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-600">Thêm đợt khách hàng thanh toán</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      <input
                        type="text"
                        value={payInstallment}
                        onChange={(e) => setPayInstallment(e.target.value)}
                        placeholder="Đợt 1 / Tạm ứng..."
                        className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="number"
                        value={payAmount || ''}
                        onChange={(e) => setPayAmount(Number(e.target.value))}
                        placeholder="Số tiền thực nhận (VNĐ)"
                        className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
                      />
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="Chuyển khoản">Chuyển khoản</option>
                        <option value="Tiền mặt">Tiền mặt</option>
                        <option value="Quẹt thẻ">Quẹt thẻ</option>
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={payBankCode}
                          onChange={(e) => setPayBankCode(e.target.value)}
                          placeholder="Mã GD ngân hàng"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                        <button
                          type="button"
                          disabled={isSubmittingPayment}
                          onClick={async () => {
                            if (payAmount <= 0 || isSubmittingPayment) return;
                            setIsSubmittingPayment(true);
                            try {
                              await createPayment({
                                project_id: project.id,
                                installment_name: payInstallment,
                                amount: payAmount,
                                payment_date: payDate,
                                payment_method: payMethod,
                                bank_tx_code: payBankCode,
                                status: 'Chờ xác nhận',
                              });
                              setPayAmount(0);
                              setPayBankCode('');
                            } finally {
                              setIsSubmittingPayment(false);
                            }
                          }}
                          className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bảng các đợt thanh toán */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2.5">Mã GD</th>
                          <th className="px-3 py-2.5">Đợt</th>
                          <th className="px-3 py-2.5">Ngày nhận</th>
                          <th className="px-3 py-2.5 text-right">Số tiền</th>
                          <th className="px-3 py-2.5">Phương thức / Mã NH</th>
                          <th className="px-3 py-2.5">Trạng thái</th>
                          <th className="px-3 py-2.5">Người xác nhận</th>
                          <th className="px-3 py-2.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {projPayments.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                              Dự án chưa có đợt thanh toán nào
                            </td>
                          </tr>
                        ) : (
                          projPayments.map((pay) => (
                            <tr key={pay.id}>
                              <td className="px-3 py-2.5 font-mono font-semibold">{pay.transaction_code}</td>
                              <td className="px-3 py-2.5 font-medium">{pay.installment_name}</td>
                              <td className="px-3 py-2.5">{formatDate(pay.payment_date)}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                                {formatCurrency(pay.amount)}
                              </td>
                              <td className="px-3 py-2.5">
                                {pay.payment_method} {pay.bank_tx_code ? `(${pay.bank_tx_code})` : ''}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    pay.status === 'Đã xác nhận'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : pay.status === 'Chờ xác nhận'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {pay.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">{pay.confirmed_by || '—'}</td>
                              <td className="px-3 py-2.5 text-right">
                                {pay.status === 'Chờ xác nhận' && canAction('payments', 'confirm_tx') && (
                                  <button
                                    type="button"
                                    disabled={confirmingPayId === pay.id}
                                    onClick={async () => {
                                      if (confirmingPayId) return;
                                      setConfirmingPayId(pay.id);
                                      try {
                                        await confirmPayment(pay.id);
                                      } finally {
                                        setConfirmingPayId(null);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {confirmingPayId === pay.id ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang duyệt...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận thu
                                      </>
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: CHI PHÍ DỰ ÁN */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-600">Đề xuất khoản chi phí phát sinh cho dự án</h4>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                  <input
                    type="text"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="Tên khoản chi *"
                    className="sm:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <select
                    value={expCat}
                    onChange={(e) => setExpCat(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {expenseCategories
                      .filter((c) => c.expense_scope === 'project')
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    value={expAmount || ''}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    placeholder="Số tiền trước thuế"
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    type="number"
                    value={expVat === 0 ? '' : expVat}
                    onChange={(e) => setExpVat(Number(e.target.value))}
                    placeholder="% VAT"
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={expRecipient}
                      onChange={(e) => setExpRecipient(e.target.value)}
                      placeholder="Người nhận tiền"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      disabled={isSubmittingExpense}
                      onClick={async () => {
                        if (!expTitle.trim() || expAmount <= 0 || isSubmittingExpense) return;
                        setIsSubmittingExpense(true);
                        try {
                          await createExpense({
                            expense_scope: 'project',
                            project_id: project.id,
                            title: expTitle,
                            category_name: expCat,
                            amount_before_tax: expAmount,
                            vat_rate: expVat,
                            is_vat_deductible: expDeductible,
                            recipient_name: expRecipient,
                            status: 'Chờ duyệt',
                          });
                          setExpTitle('');
                          setExpAmount(0);
                        } finally {
                          setIsSubmittingExpense(false);
                        }
                      }}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {isSubmittingExpense ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={expDeductible}
                    onChange={(e) => setExpDeductible(e.target.checked)}
                  />
                  Có hóa đơn VAT đầu vào được khấu trừ (chỉ tính giá trước thuế vào chi phí dự án)
                </label>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">Mã CP</th>
                      <th className="px-3 py-2.5">Nội dung chi</th>
                      <th className="px-3 py-2.5">Danh mục</th>
                      <th className="px-3 py-2.5 text-right">Trước thuế</th>
                      <th className="px-3 py-2.5 text-right">Sau thuế</th>
                      <th className="px-3 py-2.5">Đề xuất / Duyệt</th>
                      <th className="px-3 py-2.5">Trạng thái</th>
                      <th className="px-3 py-2.5 text-right">Duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {projExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                          Chưa có khoản chi phí phát sinh cho dự án này
                        </td>
                      </tr>
                    ) : (
                      projExpenses.map((exp) => (
                        <tr key={exp.id}>
                          <td className="px-3 py-2.5 font-mono font-semibold">{exp.expense_code}</td>
                          <td className="px-3 py-2.5 font-medium">{exp.title}</td>
                          <td className="px-3 py-2.5">{exp.category_name}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(exp.amount_before_tax)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">
                            {formatCurrency(exp.amount_after_tax)}
                          </td>
                          <td className="px-3 py-2.5">
                            {exp.proposer_name || '—'} / <strong>{exp.approver_name || 'Chờ duyệt'}</strong>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {exp.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right space-x-1">
                            {exp.status === 'Chờ duyệt' && canAction('expenses', 'approve') && (
                              <>
                                <button
                                  disabled={updatingExpId === exp.id}
                                  onClick={async () => {
                                    if (updatingExpId) return;
                                    setUpdatingExpId(exp.id);
                                    try {
                                      await updateExpenseStatus(exp.id, 'Đã duyệt');
                                    } finally {
                                      setUpdatingExpId(null);
                                    }
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                >
                                  {updatingExpId === exp.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Duyệt
                                </button>
                                <button
                                  disabled={updatingExpId === exp.id}
                                  onClick={async () => {
                                    if (updatingExpId) return;
                                    setUpdatingExpId(exp.id);
                                    try {
                                      await updateExpenseStatus(exp.id, 'Từ chối');
                                    } finally {
                                      setUpdatingExpId(null);
                                    }
                                  }}
                                  className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                >
                                  {updatingExpId === exp.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Từ chối
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: TIẾN ĐỘ */}
          {activeTab === 'progress' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-600">Cập nhật bước thực hiện & tiến độ</h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <input
                    type="text"
                    value={stepName}
                    onChange={(e) => setStepName(e.target.value)}
                    placeholder="Bước công việc (VD: Lên layout trang chủ)"
                    className="sm:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <select
                    value={stepStatus}
                    onChange={(e) => setStepStatus(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {projectStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="0"
                      value={stepProgress === 0 ? '' : stepProgress}
                      onChange={(e) => setStepProgress(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="text-xs text-slate-500">%</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="0"
                      value={stepHours === 0 ? '' : stepHours}
                      onChange={(e) => setStepHours(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="text-xs text-slate-500">giờ</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={stepNote}
                      onChange={(e) => setStepNote(e.target.value)}
                      placeholder="Ghi chú..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      disabled={isAddingWorkLog}
                      onClick={async () => {
                        if (!stepName.trim() || isAddingWorkLog) return;
                        setIsAddingWorkLog(true);
                        try {
                          await addWorkLog(project.id, stepName, stepProgress, stepStatus, stepHours, stepNote);
                          setStepName('');
                          setStepNote('');
                        } finally {
                          setIsAddingWorkLog(false);
                        }
                      }}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {isAddingWorkLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lưu'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {projWorkLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Chưa có nhật ký tiến độ nào</p>
                ) : (
                  projWorkLogs.map((wl) => (
                    <div
                      key={wl.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{wl.step_name}</span>
                        <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                          {wl.status_after} ({wl.progress_percent}%)
                        </span>
                        <span className="ml-2 text-slate-500">• {wl.work_hours} giờ làm việc</span>
                        {wl.note && <p className="text-slate-600 mt-1">{wl.note}</p>}
                      </div>
                      <div className="text-right text-slate-400">
                        <div>{wl.updated_by}</div>
                        <div>{formatDateTime(wl.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: NHÂN SỰ & LỊCH SỬ BÀN GIAO */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-600">
                  Chuyển giao / Phân công nhân sự phụ trách (Lưu lịch sử người cũ → người mới)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select
                    value={handoverRole}
                    onChange={(e) => setHandoverRole(e.target.value as 'Sale' | 'Designer' | 'Trưởng nhóm')}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Sale">Sale phụ trách chính</option>
                    <option value="Designer">Designer phụ trách chính</option>
                    <option value="Trưởng nhóm">Trưởng nhóm quản lý</option>
                  </select>
                  <select
                    value={handoverNewEmp}
                    onChange={(e) => setHandoverNewEmp(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn nhân sự mới --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        [{e.employee_code}] {e.full_name} ({e.position})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="Lý do chuyển giao / bàn giao..."
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    disabled={isHandingOver}
                    onClick={async () => {
                      if (!handoverNewEmp || isHandingOver) return;
                      setIsHandingOver(true);
                      try {
                        await handoverProjectStaff(project.id, handoverRole, handoverNewEmp, handoverNote);
                        setHandoverNote('');
                      } finally {
                        setIsHandingOver(false);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {isHandingOver ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chuyển giao...
                      </>
                    ) : (
                      'Xác nhận bàn giao'
                    )}
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">Thời gian</th>
                      <th className="px-3 py-2.5">Vai trò</th>
                      <th className="px-3 py-2.5">Nhân sự cũ</th>
                      <th className="px-3 py-2.5">Nhân sự mới</th>
                      <th className="px-3 py-2.5">Lý do / Ghi chú</th>
                      <th className="px-3 py-2.5">Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {projAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                          Chưa có lịch sử chuyển giao nhân sự
                        </td>
                      </tr>
                    ) : (
                      projAssignments.map((asg) => {
                        const oldE = employees.find((e) => e.id === asg.old_employee_id);
                        const newE = employees.find((e) => e.id === asg.new_employee_id);
                        return (
                          <tr key={asg.id}>
                            <td className="px-3 py-2.5">{formatDateTime(asg.assigned_at)}</td>
                            <td className="px-3 py-2.5 font-semibold">{asg.role_type}</td>
                            <td className="px-3 py-2.5 text-slate-500">{oldE?.full_name || '(Khởi tạo)'}</td>
                            <td className="px-3 py-2.5 font-bold text-indigo-700">{newE?.full_name || '—'}</td>
                            <td className="px-3 py-2.5">{asg.note}</td>
                            <td className="px-3 py-2.5">{asg.changed_by}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: FILE TÀI LIỆU */}
          {activeTab === 'files' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-600">
                  Đính kèm Hợp đồng, Nội dung KH, Logo, Hình ảnh, File thiết kế & File bàn giao
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select
                    value={fileCat}
                    onChange={(e) => setFileCat(e.target.value as ProjectFile['file_category'])}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Hợp đồng">Hợp đồng</option>
                    <option value="Nội dung khách hàng">Nội dung khách hàng</option>
                    <option value="Logo & Brand">Logo & Brand</option>
                    <option value="Hình ảnh">Hình ảnh</option>
                    <option value="File thiết kế">File thiết kế</option>
                    <option value="File bàn giao">File bàn giao</option>
                    <option value="Khác">Khác</option>
                  </select>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Tên tài liệu (VD: File_In_Final.pdf)"
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    type="url"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="Đường dẫn File / Google Drive / Figma / Supabase Storage URL"
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    disabled={isAddingFile}
                    onClick={async () => {
                      if (!fileName.trim() || !fileUrl.trim() || isAddingFile) return;
                      setIsAddingFile(true);
                      try {
                        await addProjectFile(project.id, fileCat, fileName, fileUrl);
                        setFileName('');
                        setFileUrl('');
                      } finally {
                        setIsAddingFile(false);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {isAddingFile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                      </>
                    ) : (
                      'Thêm tài liệu'
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projFiles.length === 0 ? (
                  <p className="col-span-2 text-xs text-slate-400 text-center py-6">Chưa có tài liệu đính kèm</p>
                ) : (
                  projFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs bg-white"
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold mr-2">
                          {f.file_category}
                        </span>
                        <strong className="text-slate-900">{f.file_name}</strong>
                        <div className="text-slate-400 mt-1">
                          Người tải: {f.uploaded_by} • {formatDateTime(f.created_at)}
                        </div>
                      </div>
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-semibold hover:bg-indigo-100"
                      >
                        Mở file <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 8: NHẬT KÝ HOẠT ĐỘNG */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              {projAudits.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có nhật ký thay đổi cho dự án này</p>
              ) : (
                projAudits.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        [{log.action_module}] {log.action_type}
                      </span>
                      <span className="text-slate-500">
                        {log.actor_name} ({log.actor_role}) • {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    {log.new_data && (
                      <pre className="text-[11px] bg-white p-2 rounded border border-slate-200 overflow-x-auto text-slate-600">
                        {JSON.stringify(log.new_data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
