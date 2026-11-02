import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';
import { parseExcelFile, formatCurrency } from '../lib/format';
import { useErp } from '../context/ErpContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TARGET_FIELDS = [
  { key: 'project_code', label: 'Mã dự án', required: false },
  { key: 'customer_name', label: 'Tên khách hàng', required: false },
  { key: 'project_name', label: 'Tên dự án *', required: true },
  { key: 'job_type', label: 'Loại JOB', required: false },
  { key: 'page_count', label: 'Số trang', required: false },
  { key: 'revenue_before_tax', label: 'Giá trị hợp đồng (trước thuế)', required: false },
  { key: 'vat_rate', label: 'Thuế VAT (%)', required: false },
  { key: 'paid_amount', label: 'Số tiền đã thanh toán', required: false },
  { key: 'payment_date', label: 'Ngày thanh toán', required: false },
  { key: 'sale_name', label: 'Sale phụ trách (Họ tên)', required: false },
  { key: 'designer_name', label: 'Designer phụ trách (Họ tên)', required: false },
  { key: 'status', label: 'Trạng thái', required: false },
  { key: 'deadline', label: 'Deadline (YYYY-MM-DD)', required: false },
  { key: 'notes', label: 'Ghi chú', required: false },
] as const;

export const ExcelImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { importExcelRows, defaultVatRate } = useErp();

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    successCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const parsed = await parseExcelFile(file);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);

    // Tự động gợi ý ánh xạ cột theo tên tiếng Việt
    const autoMap: Record<string, string> = {};
    for (const field of TARGET_FIELDS) {
      const matched = parsed.headers.find((h) => {
        const lower = h.toLowerCase();
        if (field.key === 'project_code') return lower.includes('mã dự án') || lower.includes('mã da');
        if (field.key === 'customer_name') return lower.includes('khách hàng');
        if (field.key === 'project_name') return lower.includes('tên dự án') || lower.includes('dự án');
        if (field.key === 'job_type') return lower.includes('job') || lower.includes('loại');
        if (field.key === 'page_count') return lower.includes('số trang') || lower.includes('trang');
        if (field.key === 'revenue_before_tax') return lower.includes('giá trị') || lower.includes('doanh thu') || lower.includes('hợp đồng');
        if (field.key === 'vat_rate') return lower.includes('vat') || lower.includes('thuế');
        if (field.key === 'paid_amount') return lower.includes('thanh toán') || lower.includes('thực thu');
        if (field.key === 'sale_name') return lower.includes('sale');
        if (field.key === 'designer_name') return lower.includes('design');
        if (field.key === 'status') return lower.includes('trạng thái');
        if (field.key === 'deadline') return lower.includes('deadline') || lower.includes('hạn');
        if (field.key === 'notes') return lower.includes('ghi chú');
        return false;
      });
      if (matched) autoMap[field.key] = matched;
    }
    setColumnMap(autoMap);
  };

  const buildMappedData = () => {
    return rawRows.map((r) => {
      const getVal = (key: string) => {
        const col = columnMap[key];
        return col ? r[col] : '';
      };
      const cleanNum = (v: unknown) => {
        if (typeof v === 'number') return v;
        return Number(String(v || '0').replace(/[^0-9.-]+/g, '')) || 0;
      };
      return {
        project_code: String(getVal('project_code') || '').trim(),
        customer_name: String(getVal('customer_name') || '').trim(),
        project_name: String(getVal('project_name') || '').trim(),
        job_type: String(getVal('job_type') || 'HSNL').trim(),
        page_count: cleanNum(getVal('page_count')) || 1,
        revenue_before_tax: cleanNum(getVal('revenue_before_tax')),
        vat_rate: getVal('vat_rate') !== '' ? cleanNum(getVal('vat_rate')) : defaultVatRate,
        paid_amount: cleanNum(getVal('paid_amount')),
        payment_date: String(getVal('payment_date') || '').trim() || undefined,
        sale_name: String(getVal('sale_name') || '').trim() || undefined,
        designer_name: String(getVal('designer_name') || '').trim() || undefined,
        status: String(getVal('status') || 'Chờ tiếp nhận').trim(),
        deadline: String(getVal('deadline') || '').trim() || undefined,
        notes: String(getVal('notes') || '').trim() || undefined,
      };
    });
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    const mapped = buildMappedData();
    const res = await importExcelRows(mapped);
    setResult(res);
    setImporting(false);
  };

  const previewData = rawRows.length > 0 ? buildMappedData().slice(0, 5) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-8">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">Chuyển Đổi Dữ Liệu Từ Google Sheets / Excel (Phần 15)</h3>
              <p className="text-xs text-slate-400">
                Ánh xạ cột, kiểm tra trùng mã dự án, xem trước và nhập hàng loạt vào Supabase
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Upload */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
            <input
              type="file"
              id="excel-upload"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="excel-upload"
              className="cursor-pointer inline-flex flex-col items-center gap-2 text-slate-600"
            >
              <Upload className="w-8 h-8 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-800">
                Nhấn để chọn file Excel (.xlsx, .xls, .csv) xuất từ Google Sheets
              </span>
              <span className="text-xs text-slate-500">
                Đã đọc: <strong>{rawRows.length}</strong> dòng dữ liệu
              </span>
            </label>
          </div>

          {headers.length > 0 && (
            <>
              {/* Column Mapping */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  1. Ánh xạ cột dữ liệu từ file Excel vào trường Hệ thống
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {TARGET_FIELDS.map((field) => (
                    <div key={field.key} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">{field.label}</label>
                      <select
                        value={columnMap[field.key] || ''}
                        onChange={(e) => setColumnMap((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="">-- Không ánh xạ --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  2. Xem trước 5 dòng đầu tiên sau khi ánh xạ
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase">
                      <tr>
                        <th className="px-3 py-2">Mã DA</th>
                        <th className="px-3 py-2">Tên dự án</th>
                        <th className="px-3 py-2">Khách hàng</th>
                        <th className="px-3 py-2">Loại JOB</th>
                        <th className="px-3 py-2 text-right">DT Trước thuế</th>
                        <th className="px-3 py-2 text-right">Đã thu</th>
                        <th className="px-3 py-2">Sale / Designer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-mono">{row.project_code || '(Tự sinh)'}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{row.project_name || '—'}</td>
                          <td className="px-3 py-2">{row.customer_name || '—'}</td>
                          <td className="px-3 py-2">{row.job_type}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatCurrency(row.revenue_before_tax)}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                            {formatCurrency(row.paid_amount)}
                          </td>
                          <td className="px-3 py-2">
                            {row.sale_name || '—'} / {row.designer_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-4 text-sm font-semibold">
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Nhập thành công: {result.successCount} dòng
                </span>
                <span className="text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Bỏ qua / Thất bại: {result.skippedCount} dòng
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs text-rose-600 list-disc list-inside max-h-32 overflow-y-auto space-y-0.5">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Đóng
          </button>
          {rawRows.length > 0 && (
            <button
              type="button"
              disabled={importing}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {importing ? 'Đang nhập vào Supabase...' : `Xác nhận nhập ${rawRows.length} dòng`}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
