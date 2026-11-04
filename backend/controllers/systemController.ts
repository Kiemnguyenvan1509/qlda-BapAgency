import { Request, Response } from 'express';
import {
  getBackendSupabaseConfig,
  saveBackendSupabaseConfig,
  clearBackendSupabaseConfig,
  getSupabaseDb,
} from '../config/supabase';
import { SystemModel } from '../models/SystemModel';
import { HrModel } from '../models/HrModel';
import { CustomerModel } from '../models/CustomerModel';
import { ProjectModel } from '../models/ProjectModel';
import { FinanceModel } from '../models/FinanceModel';
import { AttendancePayrollModel } from '../models/AttendancePayrollModel';
import { extractClientIp, isAdminActor } from '../utils/helpers';

export class SystemController {
  static async getClientIp(req: Request, res: Response) {
    const ip = extractClientIp(req);
    res.json({ ok: true, ip });
  }
  static async checkHealth(_req: Request, res: Response) {
    const cfg = getBackendSupabaseConfig();
    const db = getSupabaseDb();
    if (!db || cfg.source === 'none') {
      res.json({
        configured: false,
        connected: false,
        schemaReady: false,
        source: 'none',
        url: '',
        errorMessage: 'Backend chưa được cấu hình SUPABASE_URL và SUPABASE_ANON_KEY.',
      });
      return;
    }

    try {
      const { data, error } = await db.from('roles').select('id').limit(1);
      if (error) {
        const msg = error.message || '';
        if (
          msg.includes('relation') ||
          msg.includes('does not exist') ||
          error.code === '42P01' ||
          error.code === 'PGRST205'
        ) {
          res.json({
            configured: true,
            connected: true,
            schemaReady: false,
            source: cfg.source,
            url: cfg.url,
            errorMessage: 'Backend đã kết nối Supabase nhưng chưa chạy file khởi tạo bảng (supabase/schema.sql).',
          });
          return;
        }
        res.json({
          configured: true,
          connected: false,
          schemaReady: false,
          source: cfg.source,
          url: cfg.url,
          errorMessage: `Lỗi kết nối Supabase từ Backend: ${msg}`,
        });
        return;
      }

      res.json({
        configured: true,
        connected: true,
        schemaReady: Array.isArray(data),
        source: cfg.source,
        url: cfg.url,
      });
    } catch (err: unknown) {
      res.json({
        configured: true,
        connected: false,
        schemaReady: false,
        source: cfg.source,
        url: cfg.url,
        errorMessage: err instanceof Error ? err.message : 'Không thể kết nối tới Supabase',
      });
    }
  }

  static async saveSupabaseConfig(req: Request, res: Response) {
    const { url, anonKey } = req.body;
    if (!url || !anonKey) {
      res.status(400).json({ ok: false, error: 'Vui lòng cung cấp đầy đủ URL và Anon Key.' });
      return;
    }
    saveBackendSupabaseConfig(url, anonKey);
    res.json({ ok: true });
  }

  static async clearSupabaseConfig(_req: Request, res: Response) {
    clearBackendSupabaseConfig();
    res.json({ ok: true });
  }

  static async getBootstrapData(_req: Request, res: Response) {
    try {
      const [
        roles,
        rolePermissions,
        departments,
        teams,
        shifts,
        employees,
        users,
        employeeTransfers,
        customers,
        customerCareLogs,
        projects,
        projectAssignments,
        contractRevisions,
        payments,
        expenseCategories,
        expenses,
        costAllocations,
        workLogs,
        projectFiles,
        attendance,
        leaveRequests,
        overtimeRequests,
        payrolls,
        payrollDetails,
        settings,
        notifications,
        auditLogs,
      ] = await Promise.all([
        SystemModel.getRoles(),
        SystemModel.getRolePermissions(),
        HrModel.getDepartments(),
        HrModel.getTeams(),
        AttendancePayrollModel.getShifts(),
        HrModel.getEmployees(),
        HrModel.getUsers(),
        HrModel.getEmployeeTransfers(),
        CustomerModel.getAll(),
        CustomerModel.getCareLogs(),
        ProjectModel.getAll(),
        ProjectModel.getAssignments(),
        ProjectModel.getContractRevisions(),
        FinanceModel.getPayments(),
        FinanceModel.getExpenseCategories(),
        FinanceModel.getExpenses(),
        FinanceModel.getCostAllocations(),
        ProjectModel.getWorkLogs(),
        ProjectModel.getProjectFiles(),
        AttendancePayrollModel.getAttendance(),
        AttendancePayrollModel.getLeaveRequests(),
        AttendancePayrollModel.getOvertimeRequests(),
        AttendancePayrollModel.getPayrolls(),
        AttendancePayrollModel.getPayrollDetails(),
        SystemModel.getSettings(),
        SystemModel.getNotifications(),
        SystemModel.getAuditLogs(),
      ]);

      // Tự động khôi phục vai trò gốc 'super_admin' nếu lỡ tay xóa trên Supabase Table Editor
      let finalRoles = roles;
      if (!finalRoles.some((r: { code: string }) => r.code === 'super_admin')) {
        const db = getSupabaseDb();
        if (db) {
          const { data: insertedRole } = await db
            .from('roles')
            .upsert(
              {
                code: 'super_admin',
                name: 'Super Admin',
                data_scope: 'system',
                hidden_fields: [],
                description: 'Toàn quyền quản trị hệ thống và phân quyền',
                is_system: true,
              },
              { onConflict: 'code' }
            )
            .select('*')
            .single();
          if (insertedRole) {
            finalRoles = [insertedRole, ...finalRoles];
          }
        }
      }

      // Tự động khôi phục ca làm việc mặc định 'HC_01' nếu lỡ xóa hết trong bảng shifts
      let finalShifts = shifts;
      if (finalShifts.length === 0) {
        const db = getSupabaseDb();
        if (db) {
          const { data: insertedShift } = await db
            .from('shifts')
            .upsert(
              {
                code: 'HC_01',
                name: 'Ca hành chính (08:30 - 17:30)',
                start_time: '08:30:00',
                end_time: '17:30:00',
                break_minutes: 60,
                grace_late_minutes: 15,
                work_day_ratio: 1.0,
                is_active: true,
              },
              { onConflict: 'code' }
            )
            .select('*')
            .single();
          if (insertedShift) {
            finalShifts = [insertedShift];
          }
        }
      }

      const safeUsers = users.map((u: Record<string, unknown>) => ({
        ...u,
        password_hash: undefined,
      }));

      res.json({
        ok: true,
        data: {
          roles: finalRoles,
          rolePermissions,
          departments,
          teams,
          shifts: finalShifts,
          employees,
          users: safeUsers,
          employeeTransfers,
          customers,
          customerCareLogs,
          projects,
          projectAssignments,
          contractRevisions,
          payments,
          expenseCategories,
          expenses,
          costAllocations,
          workLogs,
          projectFiles,
          attendance,
          leaveRequests,
          overtimeRequests,
          payrolls,
          payrollDetails,
          settings,
          notifications,
          auditLogs,
        },
      });
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Lỗi tải dữ liệu từ Backend Model',
      });
    }
  }

  static async updateRoleConfig(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({
          ok: false,
          error: 'Chỉ tài khoản Admin mới được phép chỉnh sửa cài đặt phân quyền.',
        });
        return;
      }

      const { id } = req.params;
      const { dataScope, hiddenFields } = req.body;
      const updated = await SystemModel.updateRoleConfig(String(id), dataScope, hiddenFields);
      await SystemModel.writeAuditLog(
        req.actor,
        'Phân quyền',
        'Cập nhật phạm vi và trường ẩn của vai trò',
        String(id),
        null,
        { dataScope, hiddenFields }
      );
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật quyền' });
    }
  }

  static async saveSetting(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({
          ok: false,
          error: 'Chỉ tài khoản Admin mới được phép thay đổi cấu hình hệ thống.',
        });
        return;
      }

      const { key, value } = req.body;
      await SystemModel.upsertSetting(key, value);
      await SystemModel.writeAuditLog(
        req.actor,
        'Cấu hình hệ thống',
        `Cập nhật cấu hình: ${key}`,
        key,
        null,
        { value }
      );
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi lưu cấu hình' });
    }
  }

  static async markNotificationRead(req: Request, res: Response) {
    try {
      await SystemModel.markNotificationRead(String(req.params.id));
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật thông báo' });
    }
  }
}
