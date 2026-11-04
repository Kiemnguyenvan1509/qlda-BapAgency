import crypto from 'crypto';
import { Request } from 'express';
import { HrModel } from '../models/HrModel';

const AES_SECRET_KEY = crypto
  .createHash('sha256')
  .update(String(process.env.PASSWORD_SECRET || 'bapagency-erp-aes256-master-key-2026'))
  .digest();

export function hashPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_SECRET_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `aes$${iv.toString('hex')}$${authTag.toString('hex')}$${encrypted.toString('hex')}`;
}

export function decryptPasswordForAdmin(stored: string): string {
  const rawStored = String(stored || '');
  if (!rawStored) return '';
  if (rawStored.startsWith('aes$')) {
    try {
      const parts = rawStored.split('$');
      if (parts.length !== 4) return '(Lỗi định dạng mã hóa)';
      const [, ivHex, tagHex, encryptedHex] = parts;
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        AES_SECRET_KEY,
        Buffer.from(ivHex, 'hex')
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      return '(Không thể giải mã)';
    }
  }
  if (rawStored.startsWith('scrypt$')) {
    return '(Đã băm 1 chiều - Bấm Đặt lại mật khẩu hoặc đăng nhập lại để đồng bộ)';
  }
  return rawStored;
}

export function verifyPassword(
  plain: string,
  stored: string
): { valid: boolean; needsRehash: boolean } {
  const rawStored = String(stored || '');
  if (rawStored.startsWith('aes$')) {
    const decrypted = decryptPasswordForAdmin(rawStored);
    return {
      valid: decrypted === String(plain),
      needsRehash: false,
    };
  }
  if (rawStored.startsWith('scrypt$')) {
    const parts = rawStored.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hashHex] = parts;
    const derived = crypto.scryptSync(String(plain), salt, 64);
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (derived.length !== storedBuf.length) return { valid: false, needsRehash: false };
    const isValid = crypto.timingSafeEqual(derived, storedBuf);
    return {
      valid: isValid,
      needsRehash: isValid,
    };
  }
  const matchesPlain = rawStored === String(plain);
  return { valid: matchesPlain, needsRehash: matchesPlain };
}

export function getTodayISO(): string {
  // Luôn lấy ngày theo múi giờ Việt Nam (UTC+7 - Asia/Ho_Chi_Minh), bất kể Server đặt ở đâu (Render UTC+0)
  const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split('T')[0];
}

export function getVietnamMinutesOfDay(date: Date = new Date()): number {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.getUTCHours() * 60 + vnTime.getUTCMinutes();
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

export async function canManagePayrollActor(req: Request): Promise<boolean> {
  if (await isAdminActor(req)) return true;
  if (!req.actor?.userId) return false;
  const actorUser = await HrModel.getUserById(req.actor.userId);
  if (!actorUser || !actorUser.employee_id) return false;
  const actorEmp = await HrModel.getEmployeeById(actorUser.employee_id);
  if (!actorEmp) return false;
  return (
    actorEmp.role_code === 'super_admin' ||
    actorEmp.role_code === 'admin' ||
    actorEmp.role_code === 'director' ||
    actorEmp.role_code === 'accountant'
  );
}
