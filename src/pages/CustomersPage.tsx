import React, { useState, useRef, useMemo } from 'react';
import { Plus, Search, MessageSquarePlus, X, Trash2, Loader2 } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { Customer } from '../types/database';
import { formatCurrency, formatDateTime } from '../lib/format';

export const CustomersPage: React.FC = () => {
  const {
    customers,
    customerCareLogs,
    projects,
    employees,
    roles,
    users,
    getProjectFinancials,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    addCustomerCareLog,
  } = useErp();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);
  const submitCustLock = useRef(false);
  const [deletingCustId, setDeletingCustId] = useState<string | null>(null);
  const [isSavingCareLog, setIsSavingCareLog] = useState(false);

  const [careChannel, setCareChannel] = useState('Điện thoại');
  const [careContent, setCareContent] = useState('');

  // Lọc chỉ những nhân sự thuộc vai trò Sale
  const saleEmployees = useMemo(() => {
    return employees.filter((e) => {
      const code = e.role_code?.toLowerCase() || '';
      if (code === 'sale') return true;
      const u = users.find((user) => user.employee_id === e.id);
      const r = roles.find((role) => role.id === u?.role_id);
      if (r?.code?.toLowerCase() === 'sale') return true;
      const pos = e.position?.toLowerCase() || '';
      return pos.includes('sale') || pos.includes('kinh doanh');
    });
  }, [employees, users, roles]);

  const [form, setForm] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_code: '',
    customer_type: 'Doanh nghiệp',
    sale_id: '',
    source: 'Website / Marketing',
    notes: '',
  });

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.customer_code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.tax_code && c.tax_code.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormError('');
    setForm({
      name: '',
      company_name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      tax_code: '',
      customer_type: 'Doanh nghiệp',
      sale_id: '',
      source: 'Website / Marketing',
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormError('');
    setForm({
      name: c.name,
      company_name: c.company_name || '',
      contact_person: c.contact_person || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      tax_code: c.tax_code || '',
      customer_type: c.customer_type,
      sale_id: c.sale_id || '',
      source: c.source || '',
      notes: c.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitCustLock.current || isSubmittingCust) return;
    submitCustLock.current = true;
    setIsSubmittingCust(true);
    setFormError('');
    try {
      if (editingCustomer) {
        const res = await updateCustomer(editingCustomer.id, form);
        if (!res.ok) setFormError(res.error || 'Lỗi cập nhật');
        else setShowModal(false);
      } else {
        const res = await createCustomer(form);
        if (!res.ok) setFormError(res.error || 'Lỗi tạo khách hàng');
        else setShowModal(false);
      }
    } finally {
      submitCustLock.current = false;
      setIsSubmittingCust(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm khách hàng theo Mã KH, Tên, Doanh nghiệp, Mã số thuế, SĐT..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 outline-none"
          />
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Thêm khách hàng
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto touch-scroll">
          <table className="w-full text-xs text-left min-w-[850px]">
            <thead className="bg-slate-100 text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Mã KH</th>
                <th className="px-4 py-3">Tên khách hàng / Doanh nghiệp</th>
                <th className="px-4 py-3">Mã số thuế</th>
                <th className="px-4 py-3">Liên hệ</th>
                <th className="px-4 py-3">Sale phụ trách</th>
                <th className="px-4 py-3 text-center">Số dự án</th>
                <th className="px-4 py-3 text-right">Tổng giá trị HĐ (Sau thuế)</th>
                <th className="px-4 py-3 text-right">Tổng thực thu</th>
                <th className="px-4 py-3 text-right">Công nợ</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    Chưa có hồ sơ khách hàng nào.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const custProjects = projects.filter((p) => p.customer_id === c.id && !p.is_archived);
                  let totalContract = 0;
                  let totalPaid = 0;
                  let totalDebt = 0;
                  for (const p of custProjects) {
                    const f = getProjectFinancials(p);
                    totalContract += f.revenueAfterTax;
                    totalPaid += f.confirmedPayments;
                    totalDebt += f.remainingDebt;
                  }
                  const sale = employees.find((e) => e.id === c.sale_id);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">{c.customer_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.company_name && <div className="text-[11px] text-slate-500">{c.company_name}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono">{c.tax_code || '—'}</td>
                      <td className="px-4 py-3">
                        <div>{c.contact_person || c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.phone || c.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">{sale?.full_name || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold">{custProjects.length}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(totalContract)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {formatCurrency(totalDebt)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                        >
                          Hồ sơ & CSKH
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="text-slate-600 font-semibold hover:underline cursor-pointer"
                        >
                          Sửa
                        </button>
                        <button
                          disabled={deletingCustId === c.id}
                          onClick={async () => {
                            if (deletingCustId) return;
                            if (
                              !window.confirm(
                                `Bạn có chắc chắn muốn xóa khách hàng [${c.customer_code}] ${c.name} không?`
                              )
                            ) {
                              return;
                            }
                            setDeletingCustId(c.id);
                            try {
                              const res = await deleteCustomer(c.id);
                              if (!res.ok) {
                                alert(res.error || 'Không thể xóa khách hàng');
                              }
                            } finally {
                              setDeletingCustId(null);
                            }
                          }}
                          className="inline-flex items-center gap-0.5 text-rose-600 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                        >
                          {deletingCustId === c.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xóa...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" /> Xóa
                            </>
                          )}
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

      {/* Modal Thêm / Sửa Khách Hàng */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCustomer ? `Chỉnh sửa khách hàng ${editingCustomer.customer_code}` : 'Tạo Hồ Sơ Khách Hàng Mới'}
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên khách hàng *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên doanh nghiệp</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    value={form.tax_code}
                    onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Người liên hệ</label>
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sale phụ trách</label>
                  <select
                    value={form.sale_id}
                    onChange={(e) => setForm({ ...form, sale_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Chọn Sale ({saleEmployees.length}) --</option>
                    {saleEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        [{e.employee_code}] {e.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nguồn khách hàng</label>
                  <input
                    type="text"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Địa chỉ</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSubmittingCust}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCust}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmittingCust ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    'Lưu hồ sơ khách hàng'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chi Tiết Lịch sử Dự án & Chăm sóc khách hàng */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  [{selectedCustomer.customer_code}] {selectedCustomer.name}
                </h3>
                <p className="text-xs text-slate-400">
                  MST: {selectedCustomer.tax_code || '—'} • SĐT: {selectedCustomer.phone || '—'}
                </p>
              </div>
              <button onClick={() => setSelectedCustomer(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <h4 className="font-bold uppercase text-slate-500 mb-2">Danh sách dự án của khách hàng</h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto touch-scroll">
                  <table className="w-full text-left min-w-[550px]">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Mã DA</th>
                        <th className="px-3 py-2">Tên dự án</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        <th className="px-3 py-2 text-right">Giá trị sau thuế</th>
                        <th className="px-3 py-2 text-right">Đã thu</th>
                        <th className="px-3 py-2 text-right">Công nợ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {projects
                        .filter((p) => p.customer_id === selectedCustomer.id)
                        .map((p) => {
                          const f = getProjectFinancials(p);
                          return (
                            <tr key={p.id}>
                              <td className="px-3 py-2 font-mono font-bold">{p.project_code}</td>
                              <td className="px-3 py-2 font-medium">{p.name}</td>
                              <td className="px-3 py-2">{p.status}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(f.revenueAfterTax)}</td>
                              <td className="px-3 py-2 text-right text-emerald-700">
                                {formatCurrency(f.confirmedPayments)}
                              </td>
                              <td className="px-3 py-2 text-right text-rose-600">{formatCurrency(f.remainingDebt)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lịch sử chăm sóc khách hàng */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase text-slate-500">Lịch sử chăm sóc khách hàng</h4>
                <div className="flex gap-2">
                  <select
                    value={careChannel}
                    onChange={(e) => setCareChannel(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Điện thoại">Điện thoại</option>
                    <option value="Zalo / Tin nhắn">Zalo / Tin nhắn</option>
                    <option value="Email">Email</option>
                    <option value="Gặp trực tiếp">Gặp trực tiếp</option>
                  </select>
                  <input
                    type="text"
                    value={careContent}
                    onChange={(e) => setCareContent(e.target.value)}
                    placeholder="Nhập nội dung trao đổi / chăm sóc khách hàng..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300"
                  />
                  <button
                    disabled={isSavingCareLog}
                    onClick={async () => {
                      if (!careContent.trim() || isSavingCareLog) return;
                      setIsSavingCareLog(true);
                      try {
                        await addCustomerCareLog(selectedCustomer.id, careChannel, careContent);
                        setCareContent('');
                      } finally {
                        setIsSavingCareLog(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCareLog ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                      </>
                    ) : (
                      <>
                        <MessageSquarePlus className="w-4 h-4" /> Lưu CSKH
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  {customerCareLogs
                    .filter((l) => l.customer_id === selectedCustomer.id)
                    .map((l) => (
                      <div key={l.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold mr-2">
                            {l.channel}
                          </span>
                          <span>{l.content}</span>
                        </div>
                        <span className="text-slate-400">
                          {l.staff_name} • {formatDateTime(l.care_date)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
