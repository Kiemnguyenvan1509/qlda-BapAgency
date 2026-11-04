import * as XLSX from 'xlsx';

export function formatCurrency(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTodayISO(): string {
  const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split('T')[0];
}

export function generateCode(prefix: string, existingCount: number): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `${prefix}${y}${m}-${seq}`;
}

/**
 * Tính toán doanh thu trước thuế, tiền VAT, và doanh thu sau thuế theo 2 phương thức nhập (Mục 4.1)
 */
export function calculateContractTaxes(
  inputAmount: number,
  vatRate: number,
  mode: 'before_tax' | 'after_tax'
): { beforeTax: number; vatAmount: number; afterTax: number } {
  const cleanAmount = Math.max(0, Number(inputAmount) || 0);
  const cleanRate = Math.max(0, Number(vatRate) || 0);
  if (mode === 'before_tax') {
    const beforeTax = Math.round(cleanAmount);
    const vatAmount = Math.round((beforeTax * cleanRate) / 100);
    const afterTax = beforeTax + vatAmount;
    return { beforeTax, vatAmount, afterTax };
  } else {
    const afterTax = Math.round(cleanAmount);
    const beforeTax = Math.round(afterTax / (1 + cleanRate / 100));
    const vatAmount = afterTax - beforeTax;
    return { beforeTax, vatAmount, afterTax };
  }
}

/**
 * Xuất dữ liệu ra file Excel (.xlsx)
 */
export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  fileName: string,
  sheetName = 'DuLieu'
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}_${getTodayISO()}.xlsx`);
}

/**
 * Đọc dữ liệu từ file Excel (.xlsx / .xls / .csv) phục vụ chuyển đổi dữ liệu cũ (Phần 15)
 */
export async function parseExcelFile(file: File): Promise<{
  headers: string[];
  rows: Record<string, unknown>[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
  return { headers, rows: jsonRows };
}
