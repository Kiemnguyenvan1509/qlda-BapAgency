import { Request, Response } from 'express';
import { HrModel } from '../models/HrModel';
import { SystemModel } from '../models/SystemModel';
import { AttendancePayrollModel } from '../models/AttendancePayrollModel';
import { isAdminActor } from '../utils/helpers';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const users = await HrModel.getUsers();
      const q = String(username || '').trim().toLowerCase();

      const found = users.find(
        (u) =>
          (String(u.username || '').toLowerCase() === q ||
            (u.email && String(u.email).toLowerCase() === q)) &&
          u.password_hash === password
      );

      if (!found) {
        res.status(401).json({ ok: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        return;
      }
      if (found.is_locked) {
        res.status(403).json({
          ok: false,
          error: 'Tài khoản này đã bị khóa (Nhân sự đã nghỉ việc hoặc tạm ngưng).',
        });
        return;
      }

      await HrModel.updateUser(found.id, { last_login_at: new Date().toISOString() });
      await SystemModel.writeAuditLog(req.actor, 'Hệ thống', 'Đăng nhập', found.id, null, {
        username: found.username,
      });

      res.json({ ok: true, user: found });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi đăng nhập' });
    }
  }

  static async bootstrapFirstAdmin(req: Request, res: Response) {
    try {
      const { fullName, email, phone, username, password } = req.body;
      const roles = await SystemModel.getRoles();
      const shifts = await AttendancePayrollModel.getShifts();
      const superRole = roles.find((r) => r.code === 'super_admin') || roles[0];
      const defaultShift = shifts[0] || null;

      const emp = await HrModel.createEmployee({
        employee_code: 'NV-0001',
        full_name: String(fullName || 'Quản trị viên').trim(),
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        position: 'Giám đốc / Quản trị hệ thống',
        role_code: 'super_admin',
        shift_id: defaultShift?.id || null,
        work_status: 'Đang làm việc',
        base_salary: 0,
      });

      const usr = await HrModel.createUser({
        username: String(username || 'admin').trim(),
        email: email ? String(email).trim() : null,
        password_hash: password,
        employee_id: emp.id,
        role_id: superRole?.id || null,
        is_locked: false,
        last_login_at: new Date().toISOString(),
      });

      await SystemModel.writeAuditLog(
        req.actor,
        'Quản trị',
        'Khởi tạo Super Admin đầu tiên',
        usr.id,
        null,
        { username: usr.username, full_name: emp.full_name }
      );

      res.json({ ok: true, user: usr, employee: emp });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi khởi tạo Super Admin' });
    }
  }

  static async toggleUserLock(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({
          ok: false,
          error: 'Chỉ tài khoản Admin mới được phép khóa/mở khóa tài khoản.',
        });
        return;
      }

      const { id } = req.params;
      const { isLocked } = req.body;
      const updated = await HrModel.updateUser(String(id), { is_locked: Boolean(isLocked) });
      await SystemModel.writeAuditLog(
        req.actor,
        'Tài khoản',
        isLocked ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
        String(id),
        null,
        { isLocked }
      );
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi khóa/mở khóa tài khoản' });
    }
  }
}
