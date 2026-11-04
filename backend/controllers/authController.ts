import { Request, Response } from 'express';
import { HrModel } from '../models/HrModel';
import { SystemModel } from '../models/SystemModel';
import { AttendancePayrollModel } from '../models/AttendancePayrollModel';
import { decryptPasswordForAdmin, hashPassword, isAdminActor, verifyPassword } from '../utils/helpers';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const users = await HrModel.getUsers();
      const q = String(username || '').trim().toLowerCase();

      const candidate = users.find(
        (u) =>
          String(u.username || '').toLowerCase() === q ||
          (u.email && String(u.email).toLowerCase() === q)
      );

      const pwdCheck = candidate
        ? verifyPassword(String(password || ''), String(candidate.password_hash || ''))
        : { valid: false, needsRehash: false };

      if (!candidate || !pwdCheck.valid) {
        res.status(401).json({ ok: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        return;
      }

      const [emp, roles] = await Promise.all([
        candidate.employee_id ? HrModel.getEmployeeById(candidate.employee_id) : Promise.resolve(null),
        SystemModel.getRoles(),
      ]);
      const roleObj = roles.find((r) => r.id === candidate.role_id);
      const isCandidateAdmin =
        emp?.role_code === 'super_admin' ||
        emp?.role_code === 'admin' ||
        roleObj?.code === 'super_admin' ||
        roleObj?.code === 'admin';

      if (candidate.is_locked && !isCandidateAdmin) {
        res.status(403).json({
          ok: false,
          error: 'Tài khoản này đã bị khóa (Nhân sự đã nghỉ việc hoặc tạm ngưng).',
        });
        return;
      }

      const updatePayload: Record<string, unknown> = {
        last_login_at: new Date().toISOString(),
      };
      if (candidate.is_locked && isCandidateAdmin) {
        updatePayload.is_locked = false;
      }
      if (pwdCheck.needsRehash) {
        updatePayload.password_hash = hashPassword(String(password || ''));
      }

      await HrModel.updateUser(candidate.id, updatePayload);
      await SystemModel.writeAuditLog(req.actor, 'Hệ thống', 'Đăng nhập', candidate.id, null, {
        username: candidate.username,
      });

      const safeUser = { ...candidate, password_hash: undefined };
      res.json({ ok: true, user: safeUser });
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
        password_hash: hashPassword(String(password || '')),
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

      res.json({ ok: true, user: { ...usr, password_hash: undefined }, employee: emp });
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
      if (Boolean(isLocked) && req.actor?.userId && String(req.actor.userId) === String(id)) {
        res.status(400).json({
          ok: false,
          error: 'Bạn không thể tự khóa tài khoản Admin đang đăng nhập của chính mình.',
        });
        return;
      }
      const updated = await HrModel.updateUser(String(id), { is_locked: Boolean(isLocked) });
      await SystemModel.writeAuditLog(
        req.actor,
        'Tài khoản',
        isLocked ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
        String(id),
        null,
        { isLocked }
      );
      res.json({ ok: true, data: { ...updated, password_hash: undefined } });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi khóa/mở khóa tài khoản' });
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const userId = req.actor?.userId || String(req.body.userId || '').trim();
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        res.status(401).json({ ok: false, error: 'Phiên đăng nhập không hợp lệ.' });
        return;
      }
      if (!currentPassword || !newPassword) {
        res.status(400).json({ ok: false, error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
        return;
      }
      if (String(newPassword).trim().length < 4) {
        res.status(400).json({ ok: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
        return;
      }

      const user = await HrModel.getUserById(userId);
      if (!user) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản người dùng.' });
        return;
      }

      const pwdCheck = verifyPassword(String(currentPassword), String(user.password_hash || ''));
      if (!pwdCheck.valid) {
        res.status(400).json({ ok: false, error: 'Mật khẩu hiện tại không chính xác.' });
        return;
      }

      await HrModel.updateUser(user.id, {
        password_hash: hashPassword(String(newPassword)),
      });

      await SystemModel.writeAuditLog(
        req.actor,
        'Tài khoản',
        'Đổi mật khẩu cá nhân',
        user.id,
        null,
        { username: user.username }
      );

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi đổi mật khẩu' });
    }
  }

  static async adminResetPassword(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({
          ok: false,
          error: 'Chỉ tài khoản Admin mới được phép cấp lại mật khẩu cho nhân sự.',
        });
        return;
      }

      const targetUserId = String(req.params.id);
      const { newPassword } = req.body;
      if (!newPassword || String(newPassword).trim().length < 4) {
        res.status(400).json({ ok: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
        return;
      }

      const targetUser = await HrModel.getUserById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản cần đặt lại mật khẩu.' });
        return;
      }

      await HrModel.updateUser(targetUserId, {
        password_hash: hashPassword(String(newPassword)),
      });

      await SystemModel.writeAuditLog(
        req.actor,
        'Tài khoản',
        'Admin cấp lại mật khẩu tài khoản',
        targetUserId,
        null,
        { username: targetUser.username }
      );

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi đặt lại mật khẩu' });
    }
  }

  static async adminRevealPassword(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({
          ok: false,
          error: 'Chỉ tài khoản Admin mới được phép xem mật khẩu nhân sự.',
        });
        return;
      }

      const targetUserId = String(req.params.id);
      const targetUser = await HrModel.getUserById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản.' });
        return;
      }

      const plainPassword = decryptPasswordForAdmin(String(targetUser.password_hash || ''));
      res.json({ ok: true, password: plainPassword });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi giải mã mật khẩu' });
    }
  }
}
