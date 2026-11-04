import { Request, Response } from 'express';
import { HrModel } from '../models/HrModel';
import { AttendancePayrollModel } from '../models/AttendancePayrollModel';
import { SystemModel } from '../models/SystemModel';
import { generateSeqCode, getTodayISO, isAdminActor } from '../utils/helpers';

export class HrController {
  static async createDepartment(req: Request, res: Response) {
    try {
      const { code, name, managerId, description } = req.body;
      const created = await HrModel.createDepartment({
        code: String(code || '').trim().toUpperCase(),
        name: String(name || '').trim(),
        manager_id: managerId || null,
        description: description || null,
      });
      await SystemModel.writeAuditLog(req.actor, 'Nhân sự', 'Tạo phòng ban mới', created.id, null, created);
      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo phòng ban' });
    }
  }

  static async createTeam(req: Request, res: Response) {
    try {
      const { code, name, departmentId, leaderId } = req.body;
      const created = await HrModel.createTeam({
        code: String(code || '').trim().toUpperCase(),
        name: String(name || '').trim(),
        department_id: departmentId || null,
        leader_id: leaderId || null,
      });
      await SystemModel.writeAuditLog(req.actor, 'Nhân sự', 'Tạo nhóm mới', created.id, null, created);
      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo nhóm' });
    }
  }

  static async createEmployee(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({ ok: false, error: 'Chỉ tài khoản Admin mới có quyền thêm nhân sự mới.' });
        return;
      }

      const { employee: payload, account: accountPayload } = req.body;
      const [employees, shifts] = await Promise.all([
        HrModel.getEmployees(),
        AttendancePayrollModel.getShifts(),
      ]);

      const empCode = payload.employee_code?.trim() || generateSeqCode('NV-', employees.length);
      const emp = await HrModel.createEmployee({
        employee_code: empCode,
        full_name: payload.full_name?.trim() || 'Nhân viên mới',
        birth_date: payload.birth_date || null,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address || null,
        department_id: payload.department_id || null,
        team_id: payload.team_id || null,
        shift_id: payload.shift_id || shifts[0]?.id || null,
        position: payload.position || 'Nhân viên',
        role_code: payload.role_code || 'sale',
        hire_date: payload.hire_date || getTodayISO(),
        contract_type: payload.contract_type || 'Chính thức',
        work_status: payload.work_status || 'Đang làm việc',
        base_salary: Number(payload.base_salary) || 0,
        default_allowance: Number(payload.default_allowance) || 0,
        salary_formula_type: payload.salary_formula_type || 'standard_day',
        monthly_kpi_target: Number(payload.monthly_kpi_target) || 0,
      });

      if (accountPayload && accountPayload.username?.trim() && accountPayload.password) {
        await HrModel.createUser({
          username: accountPayload.username.trim(),
          email: payload.email || null,
          password_hash: accountPayload.password,
          employee_id: emp.id,
          role_id: accountPayload.roleId || null,
          is_locked: false,
        });
      }

      await SystemModel.writeAuditLog(req.actor, 'Nhân sự', 'Thêm nhân viên mới', emp.id, null, emp);
      res.json({ ok: true, data: emp });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi thêm nhân viên' });
    }
  }

  static async updateEmployee(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const payload = req.body;
      const oldEmp = await HrModel.getEmployeeById(id);
      const updated = await HrModel.updateEmployee(id, payload);

      // Mục 11.6: Khi nhân viên nghỉ việc, tự động khóa tài khoản nhưng không xóa dữ liệu lịch sử
      if (payload.work_status === 'Đã nghỉ việc') {
        await HrModel.lockUserByEmployeeId(id);
      }

      await SystemModel.writeAuditLog(req.actor, 'Nhân sự', 'Cập nhật hồ sơ nhân viên', id, oldEmp, payload);
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật nhân sự' });
    }
  }

  static async transferEmployee(req: Request, res: Response) {
    try {
      const employeeId = String(req.params.id);
      const { toDeptId, toTeamId, reason } = req.body;
      const emp = await HrModel.getEmployeeById(employeeId);
      if (!emp) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy nhân viên' });
        return;
      }

      await HrModel.createEmployeeTransfer({
        employee_id: employeeId,
        from_department_id: emp.department_id,
        to_department_id: toDeptId || null,
        from_team_id: emp.team_id,
        to_team_id: toTeamId || null,
        transfer_date: getTodayISO(),
        reason: reason || 'Điều chuyển nội bộ',
        created_by: req.actor.actorName,
      });

      const updated = await HrModel.updateEmployee(employeeId, {
        department_id: toDeptId || null,
        team_id: toTeamId || null,
      });

      await SystemModel.writeAuditLog(req.actor, 'Nhân sự', 'Điều chuyển phòng ban / nhóm', employeeId, emp, {
        toDeptId,
        toTeamId,
        reason,
      });

      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi điều chuyển nhân sự' });
    }
  }

  static async deleteEmployee(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({ ok: false, error: 'Chỉ tài khoản Admin mới có quyền xóa nhân sự.' });
        return;
      }

      const id = String(req.params.id);
      const emp = await HrModel.getEmployeeById(id);
      if (!emp) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy hồ sơ nhân sự' });
        return;
      }

      // Bảo vệ tài khoản Super Admin gốc (NV-0001) không bị xóa nhầm
      if (emp.employee_code === 'NV-0001') {
        res.status(400).json({
          ok: false,
          error: 'Không thể xóa tài khoản Super Admin gốc (NV-0001) của hệ thống.',
        });
        return;
      }

      await HrModel.deleteEmployee(id);
      await SystemModel.writeAuditLog(req.actor, 'Nhân sự', 'Xóa hồ sơ nhân viên & tài khoản', id, emp, null);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi xóa hồ sơ nhân viên' });
    }
  }
}
