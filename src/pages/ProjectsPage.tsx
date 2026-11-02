import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  Copy,
  Archive,
  Trash2,
  Eye,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { Project } from '../types/database';
import { calculateContractTaxes, exportToExcel, formatCurrency, formatDate, getTodayISO } from '../lib/format';
import { ProjectDetailModal } from '../components/ProjectDetailModal';

interface Props {
  onOpenExcelImport: () => void;
}

export const ProjectsPage: React.FC<Props> = ({ onOpenExcelImport }) => {
  const {
    scopedProjects,
    customers,
    employees,
    departments,
    projectStatuses,
    jobTypes,
    defaultVatRate,
    isFieldHidden,
    canAction,
    getProjectFinancials,
    createProject,
    updateProject,
    duplicateProject,
    archiveProject,
    deleteProject,
  } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [saleFilter, setSaleFilter] = useState('all');
  const [designerFilter, setDesignerFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const [sortField, setSortField] = useState<'created_at' | 'deadline' | 'revenue_before_tax' | 'project_code'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Tùy chỉnh ẩn/hiện cột (Mục 2.1)
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    customer: true,
    jobType: true,
    pages: true,
    sale: true,
    designer: true,
    revenue: true,
    paidAndDebt: true,
    deadline: true,
    progress: true,
  });

  // Modal tạo dự án mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [actionError, setActionError] = useState('');

  // Form state tạo dự án
  const [newProj, setNewProj] = useState({
    name: '',
    customer_id: '',
    job_type: 'HSNL',
    page_count: 12,
    tax_input_mode: 'before_tax' as 'before_tax' | 'after_tax',
    input_amount: 0,
    vat_rate: defaultVatRate,
    contract_number: '',
    contract_sign_date: getTodayISO(),
    contract_status: 'Đã ký' as Project['contract_status'],
    sale_id: '',
    designer_id: '',
    team_leader_id: '',
    department_id: '',
    priority: 'Trung bình' as Project['priority'],
    status: 'Chờ tiếp nhận',
    deadline: '',
    notes: '',
  });

  const hideFinance = isFieldHidden('revenue_before_tax');
  const today = getTodayISO();

  const filtered = useMemo(() => {
    return scopedProjects
      .filter((p) => {
        if (p.is_archived !== showArchived) return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (jobFilter !== 'all' && p.job_type !== jobFilter) return false;
        if (saleFilter !== 'all' && p.sale_id !== saleFilter) return false;
        if (designerFilter !== 'all' && p.designer_id !== designerFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const cust = customers.find((c) => c.id === p.customer_id);
          const matchCode = p.project_code.toLowerCase().includes(q);
          const matchName = p.name.toLowerCase().includes(q);
          const matchCust = cust?.name.toLowerCase().includes(q) || false;
          if (!matchCode && !matchName && !matchCust) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let vA: string | number = a[sortField] || '';
        let vB: string | number = b[sortField] || '';
        if (sortField === 'revenue_before_tax') {
          vA = Number(a.revenue_before_tax) || 0;
          vB = Number(b.revenue_before_tax) || 0;
        }
        if (vA < vB) return sortAsc ? -1 : 1;
        if (vA > vB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [scopedProjects, showArchived, statusFilter, jobFilter, saleFilter, designerFilter, searchTerm, sortField, sortAsc, customers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedProjects = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportExcel = () => {
    const rows = filtered.map((p, idx) => {
      const cust = customers.find((c) => c.id === p.customer_id);
      const sale = employees.find((e) => e.id === p.sale_id);
      const des = employees.find((e) => e.id === p.designer_id);
      const fin = getProjectFinancials(p);
      return {
        STT: idx + 1,
        'Mã dự án': p.project_code,
        'Tên dự án': p.name,
        'Khách hàng': cust?.name || '',
        'Loại JOB': p.job_type,
        'Số trang': p.page_count,
        'Sale phụ trách': sale?.full_name || '',
        'Designer phụ trách': des?.full_name || '',
        'Trạng thái': p.status,
        'Tiến độ (%)': p.progress_percent,
        Deadline: p.deadline || '',
        ...(hideFinance
          ? {}
          : {
              'Doanh thu trước thuế': fin.revenueBeforeTax,
              'Tiền VAT': fin.vatAmount,
              'Doanh thu sau thuế': fin.revenueAfterTax,
              'Thực thu đã xác nhận': fin.confirmedPayments,
              'Công nợ còn lại': fin.remainingDebt,
              'Chi phí trực tiếp': fin.directExpenses,
              'Lợi nhuận gộp': fin.grossProfit,
            }),
      };
    });
    exportToExcel(rows, 'Danh_Sach_Du_An', 'DuAn');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taxes = calculateContractTaxes(newProj.input_amount, newProj.vat_rate, newProj.tax_input_mode);
    const res = await createProject({
      name: newProj.name,
      customer_id: newProj.customer_id || null,
      job_type: newProj.job_type,
      page_count: newProj.page_count,
      tax_input_mode: newProj.tax_input_mode,
      revenue_before_tax: taxes.beforeTax,
      vat_rate: newProj.vat_rate,
      vat_amount: taxes.vatAmount,
      revenue_after_tax: taxes.afterTax,
      contract_number: newProj.contract_number,
      contract_sign_date: newProj.contract_sign_date,
      contract_status: newProj.contract_status,
      sale_id: newProj.sale_id || null,
      designer_id: newProj.designer_id || null,
      team_leader_id: newProj.team_leader_id || null,
      department_id: newProj.department_id || null,
      priority: newProj.priority,
      status: newProj.status,
      deadline: newProj.deadline || null,
      notes: newProj.notes,
    });
    if (res.ok) {
      setShowCreateModal(false);
      setNewProj({
        ...newProj,
        name: '',
        input_amount: 0,
        contract_number: '',
        notes: '',
      });
    } else {
      setActionError(res.error || 'Lỗi tạo dự án');
    }
  };

  const previewTaxes = calculateContractTaxes(newProj.input_amount, newProj.vat_rate, newProj.tax_input_mode);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm nhanh theo Mã dự án, Tên dự án, Khách hàng..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-600 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAction('projects', 'create') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm dự án mới
              </button>
            )}
            <button
              onClick={onOpenExcelImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" /> Nhập Excel
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" /> Xuất Excel
            </button>
            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Cột hiển thị
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-20 space-y-2 text-xs">
                  <div className="font-bold text-slate-700 pb-1 border-b">Tùy chỉnh cột (Mục 2.1)</div>
                  {Object.entries({
                    customer: 'Khách hàng',
                    jobType: 'Loại JOB',
                    pages: 'Số trang',
                    sale: 'Sale phụ trách',
                    designer: 'Designer phụ trách',
                    revenue: 'Doanh thu HĐ',
                    paidAndDebt: 'Thực thu & Công nợ',
                    deadline: 'Deadline',
                    progress: 'Tiến độ %',
                  }).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCols[k as keyof typeof visibleCols]}
                        onChange={(e) =>
                          setVisibleCols((prev) => ({ ...prev, [k]: e.target.checked }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-slate-100">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả trạng thái ({projectStatuses.length})</option>
            {projectStatuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={jobFilter}
            onChange={(e) => {
              setJobFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả Loại JOB</option>
            {jobTypes.map((jt) => (
              <option key={jt} value={jt}>
                {jt}
              </option>
            ))}
          </select>

          <select
            value={saleFilter}
            onChange={(e) => {
              setSaleFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả Sale</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                Sale: {e.full_name}
              </option>
            ))}
          </select>

          <select
            value={designerFilter}
            onChange={(e) => {
              setDesignerFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả Designer</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                Designer: {e.full_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
              showArchived
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showArchived ? 'Đang xem: Dự án Lưu trữ' : 'Xem dự án Lưu trữ'}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="font-bold underline ml-4">
            Đóng
          </button>
        </div>
      )}

      {/* Spreadsheet-style Data Table (Mục 2.1: Cập nhật nhanh trực tiếp trên bảng) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort('project_code')}
                  className="px-3 py-3 font-bold cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    Mã DA <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="px-3 py-3 font-bold min-w-[200px]">Tên dự án</th>
                {visibleCols.customer && <th className="px-3 py-3 font-bold">Khách hàng</th>}
                {visibleCols.jobType && <th className="px-3 py-3 font-bold">Loại JOB</th>}
                {visibleCols.pages && <th className="px-3 py-3 font-bold text-center">Trang</th>}
                {visibleCols.sale && <th className="px-3 py-3 font-bold">Sale chính</th>}
                {visibleCols.designer && <th className="px-3 py-3 font-bold">Designer chính</th>}
                {!hideFinance && visibleCols.revenue && (
                  <th
                    onClick={() => handleSort('revenue_before_tax')}
                    className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      DT Trước thuế / Sau thuế <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                )}
                {!hideFinance && visibleCols.paidAndDebt && (
                  <th className="px-3 py-3 font-bold text-right whitespace-nowrap">Thực thu / Công nợ</th>
                )}
                <th className="px-3 py-3 font-bold">Trạng thái (Sửa nhanh)</th>
                {visibleCols.progress && <th className="px-3 py-3 font-bold text-center">Tiến độ</th>}
                {visibleCols.deadline && (
                  <th
                    onClick={() => handleSort('deadline')}
                    className="px-3 py-3 font-bold cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      Deadline <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                )}
                <th className="px-3 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagedProjects.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-slate-400">
                    Chưa có dự án nào. Hãy nhấn <strong>"Thêm dự án mới"</strong> hoặc <strong>"Nhập Excel"</strong> để
                    bắt đầu làm việc với dữ liệu thật.
                  </td>
                </tr>
              ) : (
                pagedProjects.map((p) => {
                  const cust = customers.find((c) => c.id === p.customer_id);
                  const sale = employees.find((e) => e.id === p.sale_id);
                  const des = employees.find((e) => e.id === p.designer_id);
                  const fin = getProjectFinancials(p);
                  const isOverdue =
                    p.deadline &&
                    p.deadline < today &&
                    !['Hoàn thành', 'Đã bàn giao', 'Hủy dự án'].includes(p.status);

                  return (
                    <tr key={p.id} className="hover:bg-indigo-50/30 transition">
                      <td
                        onClick={() => setSelectedProject(p)}
                        className="px-3 py-2.5 font-mono font-bold text-indigo-600 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {p.project_code}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setSelectedProject(p)}
                          className="font-semibold text-slate-900 hover:text-indigo-600 text-left cursor-pointer"
                        >
                          {p.name}
                        </button>
                        <div className="text-[11px] text-slate-400">
                          Ưu tiên: <strong>{p.priority}</strong> • HĐ: {p.contract_status}
                        </div>
                      </td>
                      {visibleCols.customer && (
                        <td className="px-3 py-2.5 text-slate-700">{cust?.name || '—'}</td>
                      )}
                      {visibleCols.jobType && (
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {p.job_type}
                          </span>
                        </td>
                      )}
                      {visibleCols.pages && <td className="px-3 py-2.5 text-center font-medium">{p.page_count}</td>}
                      {visibleCols.sale && (
                        <td className="px-3 py-2.5 font-medium text-indigo-900">{sale?.full_name || '—'}</td>
                      )}
                      {visibleCols.designer && (
                        <td className="px-3 py-2.5 font-medium text-emerald-900">{des?.full_name || '—'}</td>
                      )}
                      {!hideFinance && visibleCols.revenue && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="font-bold text-slate-900">{formatCurrency(fin.revenueBeforeTax)}</div>
                          <div className="text-[11px] text-slate-500">
                            Sau VAT ({p.vat_rate}%): {formatCurrency(fin.revenueAfterTax)}
                          </div>
                        </td>
                      )}
                      {!hideFinance && visibleCols.paidAndDebt && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="font-bold text-emerald-700">{formatCurrency(fin.confirmedPayments)}</div>
                          <div className="text-[11px] text-rose-600">Nợ: {formatCurrency(fin.remainingDebt)}</div>
                        </td>
                      )}
                      {/* Inline status update */}
                      <td className="px-3 py-2.5">
                        <select
                          value={p.status}
                          onChange={(e) => updateProject(p.id, { status: e.target.value })}
                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                        >
                          {projectStatuses.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      {visibleCols.progress && (
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={p.progress_percent}
                            onChange={(e) =>
                              updateProject(p.id, { progress_percent: Number(e.target.value) })
                            }
                            className="w-14 px-1.5 py-1 text-center rounded border border-slate-300 text-xs font-semibold"
                          />
                          %
                        </td>
                      )}
                      {visibleCols.deadline && (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                            {formatDate(p.deadline)}
                          </span>
                          {isOverdue && (
                            <span className="block text-[10px] font-bold text-rose-600 uppercase">Quá hạn!</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            title="Xem chi tiết 8 Tab"
                            onClick={() => setSelectedProject(p)}
                            className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Nhân bản dự án"
                            onClick={() => duplicateProject(p)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            title={p.is_archived ? 'Khôi phục' : 'Lưu trữ dự án'}
                            onClick={() => archiveProject(p.id, !p.is_archived)}
                            className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 cursor-pointer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          {canAction('projects', 'delete') && (
                            <button
                              title="Xóa dự án (chỉ cho phép khi chưa phát sinh tài chính)"
                              onClick={async () => {
                                const res = await deleteProject(p.id);
                                if (!res.ok && res.error) setActionError(res.error);
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            Hiển thị <strong>{pagedProjects.length}</strong> / <strong>{filtered.length}</strong> dự án
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
            >
              Trước
            </button>
            <span>
              Trang <strong>{page}</strong> / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tạo Dự Án Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Khởi Tạo Dự Án Mới</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Tên dự án *</label>
                  <input
                    type="text"
                    required
                    value={newProj.name}
                    onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
                    placeholder="VD: Thiết kế Hồ sơ năng lực Công ty Cổ phần ABC"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khách hàng</label>
                  <select
                    value={newProj.customer_id}
                    onChange={(e) => setNewProj({ ...newProj, customer_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn khách hàng --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.customer_code}] {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Loại JOB</label>
                    <select
                      value={newProj.job_type}
                      onChange={(e) => setNewProj({ ...newProj, job_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      {jobTypes.map((jt) => (
                        <option key={jt} value={jt}>
                          {jt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số trang</label>
                    <input
                      type="number"
                      min={1}
                      value={newProj.page_count}
                      onChange={(e) => setNewProj({ ...newProj, page_count: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                {/* Hợp đồng & Doanh thu */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phương thức nhập giá HĐ</label>
                  <select
                    value={newProj.tax_input_mode}
                    onChange={(e) =>
                      setNewProj({ ...newProj, tax_input_mode: e.target.value as 'before_tax' | 'after_tax' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="before_tax">Nhập giá Trước thuế → Tính Sau thuế</option>
                    <option value="after_tax">Nhập giá Sau thuế → Tính ngược Trước thuế</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số tiền hợp đồng (VNĐ)</label>
                    <input
                      type="number"
                      value={newProj.input_amount || ''}
                      onChange={(e) => setNewProj({ ...newProj, input_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">VAT (%)</label>
                    <input
                      type="number"
                      value={newProj.vat_rate}
                      onChange={(e) => setNewProj({ ...newProj, vat_rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 flex flex-wrap justify-between gap-2">
                  <span>
                    Trước thuế: <strong>{formatCurrency(previewTaxes.beforeTax)}</strong>
                  </span>
                  <span>
                    Tiền VAT: <strong>{formatCurrency(previewTaxes.vatAmount)}</strong>
                  </span>
                  <span>
                    Sau thuế: <strong className="text-indigo-700">{formatCurrency(previewTaxes.afterTax)}</strong>
                  </span>
                </div>

                {/* Phân công Sale & Designer (Quy tắc 4) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sale phụ trách chính (Ghi nhận 100% DT)
                  </label>
                  <select
                    value={newProj.sale_id}
                    onChange={(e) => setNewProj({ ...newProj, sale_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn Sale --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        [{e.employee_code}] {e.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Designer phụ trách chính (Ghi nhận 100% DT)
                  </label>
                  <select
                    value={newProj.designer_id}
                    onChange={(e) => setNewProj({ ...newProj, designer_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn Designer --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        [{e.employee_code}] {e.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phòng ban phụ trách</label>
                  <select
                    value={newProj.department_id}
                    onChange={(e) => setNewProj({ ...newProj, department_id: e.target.value })}
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mức độ ưu tiên</label>
                    <select
                      value={newProj.priority}
                      onChange={(e) =>
                        setNewProj({ ...newProj, priority: e.target.value as Project['priority'] })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="Thấp">Thấp</option>
                      <option value="Trung bình">Trung bình</option>
                      <option value="Cao">Cao</option>
                      <option value="Khẩn cấp">Khẩn cấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Deadline</label>
                    <input
                      type="date"
                      value={newProj.deadline}
                      onChange={(e) => setNewProj({ ...newProj, deadline: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Ghi chú yêu cầu thiết kế</label>
                  <textarea
                    rows={2}
                    value={newProj.notes}
                    onChange={(e) => setNewProj({ ...newProj, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
                >
                  Lưu & Tạo dự án
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cửa sổ Chi tiết dự án 8 Tab */}
      <ProjectDetailModal
        project={
          selectedProject
            ? scopedProjects.find((p) => p.id === selectedProject.id) || selectedProject
            : null
        }
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
};
