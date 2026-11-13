import React, { useState, useMemo } from 'react';
import { Plus, CheckCircle2, Ban, Download, Loader2, Trash2 } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { exportToExcel, formatCurrency, formatDate, getTodayISO } from '../lib/format';

export const PaymentsPage: React.FC = () => {
  const {
    payments,
    scopedProjects,
    customers,
    canAction,
    getProjectFinancials,
    createPayment,
    confirmPayment,
    cancelOrRefundPayment,
    deletePayment,
    currentRole,
  } = useErp();

  const [tab, setTab] = useState<'transactions' | 'debt_by_project'>('transactions');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [cancelingPaymentId, setCancelingPaymentId] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const isAdmin = currentRole?.code === 'super_admin' || currentRole?.code === 'admin';

  const [form, setForm] = useState({
    project_id: '',
    installment_name: 'Đợt 1',
    amount: 0,
    payment_date: getTodayISO(),
    payment_method: 'Chuyển khoản',
    receiving_account: 'Tài khoản Công ty (Vietcombank)',
    bank_tx_code: '',
    notes: '',
  });

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (dateFrom && p.payment_date < dateFrom) return false;
      if (dateTo && p.payment_date > dateTo) return false;
      return true;
    });
  }, [payments, dateFrom, dateTo]);

  const totals = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let totalDebt = 0;
    let totalOverpaid = 0;

    for (const pay of filteredPayments) {
      if (pay.status === 'Đã xác nhận') confirmed += Number(pay.amount) || 0;
      if (pay.status === 'Chờ xác nhận') pending += Number(pay.amount) || 0;
    }

    for (const proj of scopedProjects) {
      if (proj.is_archived || proj.status === 'Hủy dự án') continue;
      const f = getProjectFinancials(proj);
      totalDebt += f.remainingDebt;
      totalOverpaid += f.overpaidAmount;
    }

    return { confirmed, pending, totalDebt, totalOverpaid };
  }, [filteredPayments, scopedProjects, getProjectFinancials]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || form.amount <= 0 || isSubmittingPayment) return;
    setIsSubmittingPayment(true);
    try {
      const res = await createPayment(form);
      if (res.ok) {
        setShowAddModal(false);
        setForm({ ...form, amount: 0, bank_tx_code: '', notes: '' });
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <span className="text-xs text-slate-500 block">Tổng thực thu (Đã xác nhận)</span>
          <strong className="text-xl font-extrabold text-emerald-700">{formatCurrency(totals.confirmed)}</strong>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <span className="text-xs text-slate-500 block">Đang chờ xác nhận / Đối soát</span>
          <strong className="text-xl font-extrabold text-amber-600">{formatCurrency(totals.pending)}</strong>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <span className="text-xs text-slate-500 block">Tổng công nợ phải thu</span>
          <strong className="text-xl font-extrabold text-rose-600">{formatCurrency(totals.totalDebt)}</strong>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <span className="text-xs text-slate-500 block">Khoản khách thanh toán thừa</span>
          <strong className="text-xl font-extrabold text-indigo-700">{formatCurrency(totals.totalOverpaid)}</strong>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('transactions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'transactions' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            1. Nhật ký giao dịch Thực thu ({filteredPayments.length})
          </button>
          <button
            onClick={() => setTab('debt_by_project')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === 'debt_by_project' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Theo dõi Công nợ & Thanh toán theo Dự án
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Lọc ngày nhận tiền:</span>
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
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Ghi nhận thanh toán
          </button>
          <button
            onClick={() =>
              exportToExcel(
                filteredPayments.map((p) => {
                  const proj = scopedProjects.find((pr) => pr.id === p.project_id);
                  return {
                    'Mã GD': p.transaction_code,
                    'Mã DA': proj?.project_code || '',
                    'Tên dự án': proj?.name || '',
                    'Đợt thanh toán': p.installment_name,
                    'Số tiền': p.amount,
                    'Ngày nhận': p.payment_date,
                    'Phương thức': p.payment_method,
                    'Tài khoản nhận': p.receiving_account || '',
                    'Mã GD ngân hàng': p.bank_tx_code || '',
                    'Trạng thái': p.status,
                    'Người xác nhận': p.confirmed_by || '',
                  };
                }),
                'Danh_Sach_Thuc_Thu'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {tab === 'transactions' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[750px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Mã GD</th>
                <th className="px-4 py-3">Dự án</th>
                <th className="px-4 py-3">Đợt</th>
                <th className="px-4 py-3">Ngày nhận tiền</th>
                <th className="px-4 py-3 text-right">Số tiền thực thu</th>
                <th className="px-4 py-3">Phương thức / Ngân hàng</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Người xác nhận</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Chưa có giao dịch thanh toán nào.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const proj = scopedProjects.find((p) => p.id === pay.project_id);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">{pay.transaction_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{proj?.name || '—'}</div>
                        <div className="text-[11px] font-mono text-slate-500">{proj?.project_code}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{pay.installment_name}</td>
                      <td className="px-4 py-3">{formatDate(pay.payment_date)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatCurrency(pay.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div>{pay.payment_method}</div>
                        <div className="text-[11px] text-slate-500">
                          {pay.receiving_account} {pay.bank_tx_code ? `• ${pay.bank_tx_code}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
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
                      <td className="px-4 py-3">{pay.confirmed_by || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                        {pay.status === 'Chờ xác nhận' && canAction('payments', 'confirm_tx') && (
                          <button
                            disabled={confirmingPaymentId === pay.id || cancelingPaymentId === pay.id}
                            onClick={async () => {
                              if (confirmingPaymentId || cancelingPaymentId) return;
                              setConfirmingPaymentId(pay.id);
                              try {
                                await confirmPayment(pay.id);
                              } finally {
                                setConfirmingPaymentId(null);
                              }
                            }}
                            className="inline-flex items-center justify-center gap-1 w-32 h-7 rounded-lg border border-[#1558C9] bg-[#1558C9] hover:opacity-90 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            {confirmingPaymentId === pay.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xác nhận...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận
                              </>
                            )}
                          </button>
                        )}
                        {(pay.status === 'Chờ xác nhận' || pay.status === 'Đã xác nhận') &&
                          canAction('payments', 'confirm_tx') && (
                            <button
                              disabled={confirmingPaymentId === pay.id || cancelingPaymentId === pay.id}
                              onClick={async () => {
                                if (confirmingPaymentId || cancelingPaymentId) return;
                                const reason = window.prompt(
                                  'Nhập lý do hủy hoặc lập giao dịch điều chỉnh/hoàn tiền:',
                                  'Điều chỉnh số liệu đối soát'
                                );
                                if (reason) {
                                  setCancelingPaymentId(pay.id);
                                  try {
                                    await cancelOrRefundPayment(pay.id, reason);
                                  } finally {
                                    setCancelingPaymentId(null);
                                  }
                                }
                              }}
                              className="inline-flex items-center justify-center gap-1 w-32 h-7 rounded-lg border border-[#D4FF24] bg-[#D4FF24] hover:opacity-90 text-[#030407] text-[11px] font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {cancelingPaymentId === pay.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" /> Đang xử lý...
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3 h-3" /> Điều chỉnh/Hủy
                                </>
                              )}
                            </button>
                          )}
                        {isAdmin && (
                          <button
                            disabled={
                              deletingPaymentId === pay.id ||
                              confirmingPaymentId === pay.id ||
                              cancelingPaymentId === pay.id
                            }
                            onClick={async () => {
                              if (deletingPaymentId || confirmingPaymentId || cancelingPaymentId) return;
                              if (
                                !window.confirm(
                                  `Xóa vĩnh viễn giao dịch "${pay.transaction_code}" (${formatCurrency(
                                    pay.amount
                                  )})? Thao tác này không thể hoàn tác.`
                                )
                              )
                                return;
                              setDeletingPaymentId(pay.id);
                              try {
                                const res = await deletePayment(pay.id);
                                if (!res.ok) window.alert(res.error || 'Không thể xóa giao dịch.');
                              } finally {
                                setDeletingPaymentId(null);
                              }
                            }}
                            className="inline-flex items-center justify-center gap-1 w-32 h-7 rounded-lg border border-[#030407] bg-[#030407] hover:opacity-85 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            {deletingPaymentId === pay.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" /> Đang xóa...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3 h-3" /> Xóa
                              </>
                            )}
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
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-xs text-left min-w-[750px]">
            <thead className="bg-slate-100 text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Mã DA</th>
                <th className="px-4 py-3">Dự án / Khách hàng</th>
                <th className="px-4 py-3 text-right">Giá trị HĐ sau thuế</th>
                <th className="px-4 py-3 text-right">Thực thu đã xác nhận</th>
                <th className="px-4 py-3 text-right">Công nợ còn lại</th>
                <th className="px-4 py-3 text-right">Tiền thừa (nếu có)</th>
                <th className="px-4 py-3">Trạng thái thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {scopedProjects
                .filter((p) => !p.is_archived && p.status !== 'Hủy dự án')
                .map((p) => {
                  const cust = customers.find((c) => c.id === p.customer_id);
                  const f = getProjectFinancials(p);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">{p.project_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500">{cust?.name || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(f.revenueAfterTax)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatCurrency(f.confirmedPayments)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">
                        {formatCurrency(f.remainingDebt)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">
                        {f.overpaidAmount > 0 ? formatCurrency(f.overpaidAmount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800">
                          {f.paymentStatusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal thêm khoản thanh toán */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Ghi Nhận Đợt Thanh Toán Mới</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chọn dự án *</label>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đợt thanh toán</label>
                  <input
                    type="text"
                    value={form.installment_name}
                    onChange={(e) => setForm({ ...form, installment_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số tiền thực nhận (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    value={form.amount || ''}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày nhận tiền</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phương thức</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Chuyển khoản">Chuyển khoản</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tài khoản công ty nhận</label>
                  <input
                    type="text"
                    value={form.receiving_account}
                    onChange={(e) => setForm({ ...form, receiving_account: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã giao dịch ngân hàng</label>
                  <input
                    type="text"
                    value={form.bank_tx_code}
                    onChange={(e) => setForm({ ...form, bank_tx_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSubmittingPayment}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    'Lưu giao dịch'
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
