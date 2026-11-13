import React, { useState } from 'react';
import { Plus, Split, Download, Loader2 } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { AllocationMethod, ExpenseScope } from '../types/database';
import { exportToExcel, formatCurrency, formatDate, getTodayISO } from '../lib/format';

export const ExpensesPage: React.FC = () => {
  const {
    expenses,
    expenseCategories,
    costAllocations,
    scopedProjects,
    canAction,
    createExpense,
    updateExpenseStatus,
    runCostAllocation,
  } = useErp();

  const [tab, setTab] = useState<'list' | 'allocation'>('list');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [updatingExpStatusId, setUpdatingExpStatusId] = useState<string | null>(null);
  const [isRunningAlloc, setIsRunningAlloc] = useState(false);

  const [form, setForm] = useState({
    expense_scope: 'project' as ExpenseScope,
    project_id: '',
    title: '',
    category_name: 'Thuê cộng tác viên',
    amount_before_tax: 0,
    vat_rate: 8,
    is_vat_deductible: true,
    expense_date: getTodayISO(),
    recipient_name: '',
    notes: '',
  });

  // State cho công cụ phân bổ chi phí chung (Mục 5.4)
  const [allocMonth, setAllocMonth] = useState<number>(new Date().getMonth() + 1);
  const [allocYear, setAllocYear] = useState<number>(new Date().getFullYear());
  const [allocType, setAllocType] = useState<'general' | 'hr'>('general');
  const [allocMethod, setAllocMethod] = useState<AllocationMethod>('revenue_ratio');
  const [allocTotal, setAllocTotal] = useState<number>(0);
  const [allocMessage, setAllocMessage] = useState('');

  const filtered = expenses.filter((e) => {
    if (scopeFilter !== 'all' && e.expense_scope !== scopeFilter) return false;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || form.amount_before_tax <= 0 || isSubmittingExpense) return;
    setIsSubmittingExpense(true);
    try {
      const res = await createExpense(form);
      if (res.ok) {
        setShowAddModal(false);
        setForm({ ...form, title: '', amount_before_tax: 0, notes: '' });
      }
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleRunAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allocTotal <= 0 || isRunningAlloc) return;
    setIsRunningAlloc(true);
    try {
      const res = await runCostAllocation({
        month: allocMonth,
        year: allocYear,
        costType: allocType,
        method: allocMethod,
        totalAmountToAllocate: allocTotal,
      });
      if (res.ok) {
        setAllocMessage(`Đã phân bổ thành công ${formatCurrency(allocTotal)} vào các dự án hoạt động!`);
      } else {
        setAllocMessage(res.error || 'Lỗi phân bổ');
      }
    } finally {
      setIsRunningAlloc(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('list')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'list' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            1. Danh sách Chi phí Dự án & Chi phí Chung ({expenses.length})
          </button>
          <button
            onClick={() => setTab('allocation')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'allocation' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Phân bổ Chi phí chung & Nhân sự vào Dự án
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Tất cả nhóm chi phí</option>
            <option value="project">Chi phí trực tiếp dự án</option>
            <option value="general">Chi phí vận hành chung</option>
            <option value="hr">Chi phí nhân sự</option>
            <option value="marketing">Chi phí Marketing</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo đề xuất chi phí
          </button>
          <button
            onClick={() =>
              exportToExcel(
                filtered.map((ex) => ({
                  'Mã CP': ex.expense_code,
                  'Phân loại': ex.expense_scope,
                  'Nội dung chi': ex.title,
                  'Danh mục': ex.category_name,
                  'Trước thuế': ex.amount_before_tax,
                  'VAT (%)': ex.vat_rate,
                  'Tiền VAT': ex.vat_amount,
                  'Sau thuế': ex.amount_after_tax,
                  'Khấu trừ VAT': ex.is_vat_deductible ? 'Có' : 'Không',
                  'Ngày phát sinh': ex.expense_date,
                  'Người đề xuất': ex.proposer_name || '',
                  'Người duyệt': ex.approver_name || '',
                  'Trạng thái': ex.status,
                })),
                'Danh_Sach_Chi_Phi'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {tab === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[850px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Mã CP</th>
                <th className="px-4 py-3">Nội dung & Danh mục</th>
                <th className="px-4 py-3">Phạm vi / Dự án</th>
                <th className="px-4 py-3 text-right">Trước thuế</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3 text-right">Tổng sau thuế</th>
                <th className="px-4 py-3">Đề xuất / Duyệt</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Phê duyệt / Thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Chưa có khoản chi phí nào.
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => {
                  const proj = scopedProjects.find((p) => p.id === exp.project_id);
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">{exp.expense_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{exp.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {exp.category_name} • Ngày: {formatDate(exp.expense_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {exp.expense_scope === 'project' ? (
                          <span className="font-semibold text-indigo-700">
                            DA: {proj?.project_code || 'Dự án'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            Chi phí chung ({exp.expense_scope})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(exp.amount_before_tax)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatCurrency(exp.vat_amount)}
                        <div className="text-[10px]">
                          {exp.is_vat_deductible ? '(Được khấu trừ)' : '(K.khấu trừ)'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatCurrency(exp.amount_after_tax)}
                      </td>
                      <td className="px-4 py-3">
                        <div>ĐX: {exp.proposer_name || '—'}</div>
                        <div className="text-slate-500">Duyệt: {exp.approver_name || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            exp.status === 'Đã thanh toán' || exp.status === 'Đã duyệt'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exp.status === 'Chờ duyệt'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {exp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {exp.status === 'Chờ duyệt' && canAction('expenses', 'approve') && (
                          <>
                            <button
                              disabled={updatingExpStatusId === exp.id}
                              onClick={async () => {
                                if (updatingExpStatusId) return;
                                setUpdatingExpStatusId(exp.id);
                                try {
                                  await updateExpenseStatus(exp.id, 'Đã duyệt');
                                } finally {
                                  setUpdatingExpStatusId(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {updatingExpStatusId === exp.id ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                              Duyệt
                            </button>
                            <button
                              disabled={updatingExpStatusId === exp.id}
                              onClick={async () => {
                                if (updatingExpStatusId) return;
                                if (
                                  !window.confirm(
                                    `Từ chối khoản chi "${exp.expense_code}"? Khoản chi sẽ bị xóa vĩnh viễn.`
                                  )
                                )
                                  return;
                                setUpdatingExpStatusId(exp.id);
                                try {
                                  await updateExpenseStatus(exp.id, 'Từ chối');
                                } finally {
                                  setUpdatingExpStatusId(null);
                                }
                              }}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {updatingExpStatusId === exp.id ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                              Từ chối
                            </button>
                          </>
                        )}
                        {exp.status === 'Đã duyệt' && canAction('expenses', 'confirm_tx') && (
                          <button
                            disabled={updatingExpStatusId === exp.id}
                            onClick={async () => {
                              if (updatingExpStatusId) return;
                              setUpdatingExpStatusId(exp.id);
                              try {
                                await updateExpenseStatus(exp.id, 'Đã thanh toán');
                              } finally {
                                setUpdatingExpStatusId(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {updatingExpStatusId === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                            Xác nhận đã chi
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={handleRunAllocation}
            className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Split className="w-4 h-4 text-indigo-600" />
              Cấu hình Phân bổ Chi phí chung / Chi phí nhân sự vào Dự án
            </div>
            {allocMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                {allocMessage}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tháng phân bổ</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="1"
                  value={allocMonth === 0 ? '' : allocMonth}
                  onChange={(e) => setAllocMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Năm</label>
                <input
                  type="number"
                  placeholder="2026"
                  value={allocYear === 0 ? '' : allocYear}
                  onChange={(e) => setAllocYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Loại chi phí phân bổ</label>
                <select
                  value={allocType}
                  onChange={(e) => setAllocType(e.target.value as 'general' | 'hr')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="general">Chi phí vận hành chung</option>
                  <option value="hr">Chi phí nhân sự phân bổ</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Phương pháp phân bổ</label>
                <select
                  value={allocMethod}
                  onChange={(e) => setAllocMethod(e.target.value as AllocationMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="revenue_ratio">1. Theo tỷ lệ doanh thu trước thuế</option>
                  <option value="work_hours">2. Theo số giờ làm việc / khối lượng trang</option>
                  <option value="project_count">3. Chia đều theo số lượng dự án</option>
                  <option value="fixed_ratio">4. Theo tỷ lệ cố định</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tổng số tiền phân bổ (VNĐ)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={allocTotal || ''}
                    onChange={(e) => setAllocTotal(Number(e.target.value))}
                    placeholder="VD: 30000000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                  <button
                    type="submit"
                    disabled={isRunningAlloc}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isRunningAlloc ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang phân bổ...
                      </>
                    ) : (
                      'Phân bổ'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full text-xs text-left min-w-[750px]">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Kỳ</th>
                  <th className="px-4 py-3">Dự án nhận phân bổ</th>
                  <th className="px-4 py-3">Loại chi phí</th>
                  <th className="px-4 py-3">Phương pháp</th>
                  <th className="px-4 py-3 text-right">Tỷ lệ (%)</th>
                  <th className="px-4 py-3 text-right">Số tiền phân bổ</th>
                  <th className="px-4 py-3">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {costAllocations.map((ca) => {
                  const proj = scopedProjects.find((p) => p.id === ca.project_id);
                  return (
                    <tr key={ca.id}>
                      <td className="px-4 py-3 font-semibold">
                        T{ca.period_month}/{ca.period_year}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        [{proj?.project_code}] {proj?.name}
                      </td>
                      <td className="px-4 py-3">
                        {ca.cost_type === 'general' ? 'Chi phí vận hành chung' : 'Chi phí nhân sự'}
                      </td>
                      <td className="px-4 py-3">{ca.allocation_method}</td>
                      <td className="px-4 py-3 text-right">{ca.allocation_ratio}%</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-700">
                        {formatCurrency(ca.allocated_amount)}
                      </td>
                      <td className="px-4 py-3">{ca.created_by}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo đề xuất chi phí */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Đề Xuất Khoản Chi Phí Mới</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhóm chi phí *</label>
                  <select
                    value={form.expense_scope}
                    onChange={(e) => setForm({ ...form, expense_scope: e.target.value as ExpenseScope })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="project">Chi phí trực tiếp theo dự án</option>
                    <option value="general">Chi phí vận hành chung</option>
                    <option value="hr">Chi phí nhân sự</option>
                    <option value="marketing">Chi phí Marketing</option>
                    <option value="other">Chi phí khác</option>
                  </select>
                </div>
                {form.expense_scope === 'project' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dự án liên quan *</label>
                    <select
                      required
                      value={form.project_id}
                      onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="">-- Chọn dự án --</option>
                      {scopedProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.project_code}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên khoản chi *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="VD: Thuê chụp ảnh sản phẩm / Mua font bản quyền..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Danh mục chi phí</label>
                  <select
                    value={form.category_name}
                    onChange={(e) => setForm({ ...form, category_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Người nhận tiền</label>
                  <input
                    type="text"
                    value={form.recipient_name}
                    onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số tiền trước thuế (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    value={form.amount_before_tax || ''}
                    onChange={(e) => setForm({ ...form, amount_before_tax: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thuế VAT (%)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.vat_rate === 0 ? '' : form.vat_rate}
                    onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_vat_deductible}
                  onChange={(e) => setForm({ ...form, is_vat_deductible: e.target.checked })}
                />
                VAT đầu vào có hóa đơn hợp lệ được khấu trừ
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSubmittingExpense}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingExpense ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...
                    </>
                  ) : (
                    'Gửi đề xuất duyệt'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
