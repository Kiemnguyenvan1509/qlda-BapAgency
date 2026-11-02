export function getTodayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
}

export function generateSeqCode(prefix: string, count: number): string {
  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const randSuffix = Math.floor(10 + Math.random() * 89);
  return `${cleanPrefix}${y}${m}-${String(count + 1).padStart(3, '0')}${randSuffix}`;
}

export function calculateTaxes(
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
  }
  const afterTax = Math.round(cleanAmount);
  const beforeTax = Math.round(afterTax / (1 + cleanRate / 100));
  const vatAmount = afterTax - beforeTax;
  return { beforeTax, vatAmount, afterTax };
}
