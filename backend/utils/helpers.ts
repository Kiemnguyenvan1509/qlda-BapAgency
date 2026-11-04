import { Request } from 'express';
import { HrModel } from '../models/HrModel';

export function getTodayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
}

export function extractClientIp(req: Request, clientPublicIp?: string): string {
  const cleanClientIp = String(clientPublicIp || '').trim();
  const xff = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const cfIp = String(req.headers['cf-connecting-ip'] || '').trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  const rawSocketIp = String(req.ip || req.socket?.remoteAddress || '').trim();
  const normalizedServerIp = rawSocketIp.replace(/^::ffff:/, '');

  const headerIp = xff || cfIp || realIp;
  if (headerIp && headerIp !== '::1' && headerIp !== '127.0.0.1') {
    return headerIp.replace(/^::ffff:/, '');
  }
  if (cleanClientIp) {
    return cleanClientIp;
  }
  if (normalizedServerIp === '::1') {
    return '127.0.0.1';
  }
  return normalizedServerIp || '127.0.0.1';
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

export async function isAdminActor(req: Request): Promise<boolean> {
  if (!req.actor?.userId) {
    return req.actor?.actorRole === 'Super Admin' || req.actor?.actorRole === 'Admin';
  }
  const actorUser = await HrModel.getUserById(req.actor.userId);
  if (!actorUser || !actorUser.employee_id) {
    return req.actor.actorRole === 'Super Admin' || req.actor.actorRole === 'Admin';
  }
  const actorEmp = await HrModel.getEmployeeById(actorUser.employee_id);
  if (actorEmp) {
    return actorEmp.role_code === 'super_admin' || actorEmp.role_code === 'admin';
  }
  return req.actor.actorRole === 'Super Admin' || req.actor.actorRole === 'Admin';
}

export async function verifySelfOrAdmin(req: Request, targetEmployeeId: string): Promise<string | null> {
  if (!req.actor?.userId) return null;
  const actorUser = await HrModel.getUserById(req.actor.userId);
  if (!actorUser || !actorUser.employee_id) return null;

  const isAdmin = await isAdminActor(req);
  if (!isAdmin && actorUser.employee_id !== targetEmployeeId) {
    return 'Bạn chỉ được phép chấm công cho chính mình. Chỉ Admin mới có quyền chấm công cho nhân sự khác.';
  }
  return null;
}
