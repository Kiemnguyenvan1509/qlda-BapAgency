import { Request, Response } from 'express';
import { AttendancePayrollModel } from '../models/AttendancePayrollModel';
import { HrModel } from '../models/HrModel';
import { SystemModel } from '../models/SystemModel';
import { getTodayISO } from '../utils/helpers';

export class AttendancePayrollController {
  static async createShift(req: Request, res: Response) {
    try {
      const payload = req.body;
      const shifts = await AttendancePayrollModel.getShifts();
      const created = await AttendancePayrollModel.createShift({
        code: payload.code?.trim() || `CA-${shifts.length + 1}`,
        name: payload.name?.trim() || 'Ca làm việc mới',
        start_time: payload.start_time || '08:30',
        end_time: payload.end_time || '17:30',
        break_minutes: Number(payload.break_minutes ?? 60),
        grace_late_minutes: Number(payload.grace_late_minutes ?? 15),
        work_day_ratio: Number(payload.work_day_ratio ?? 1.0),
      });
      await SystemModel.writeAuditLog(req.actor, 'Chấm công', 'Tạo ca làm việc', created.id, null, created);
      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo ca làm' });
    }
  }

  static async checkIn(req: Request, res: Response) {
    try {
      const { employeeId, method, gpsLocation } = req.body;
      const [emp, shifts] = await Promise.all([
        HrModel.getEmployeeById(employeeId),
        AttendancePayrollModel.getShifts(),
      ]);
      const shift = shifts.find((s) => s.id === emp?.shift_id) || shifts[0];
      const now = new Date();
      const today = getTodayISO();

      let lateMinutes = 0;
      if (shift) {
        const [sh, sm] = String(shift.start_time).split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(sh || 8, sm || 30, 0, 0);
        const diffMins = Math.floor((now.getTime() - shiftStart.getTime()) / 60000);
        if (diffMins > (Number(shift.grace_late_minutes) || 0)) {
          lateMinutes = diffMins;
        }
      }

      const created = await AttendancePayrollModel.createAttendance({
        employee_id: employeeId,
        work_date: today,
        shift_id: shift?.id || null,
        check_in: now.toISOString(),
        method: method || 'Web',
        gps_location: gpsLocation || 'Văn phòng công ty',
        device_info: req.actor.ipOrDevice,
        late_minutes: lateMinutes,
        work_day_credit: shift?.work_day_ratio || 1.0,
      });

      await SystemModel.writeAuditLog(req.actor, 'Chấm công', 'Check-in chấm công', employeeId, null, {
        today,
        method,
        lateMinutes,
      });

      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi check-in';
      res.status(400).json({
        ok: false,
        error: msg.includes('duplicate') ? 'Nhân sự này đã Check-in trong ngày hôm nay.' : msg,
      });
    }
  }

  static async checkOut(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const rec = await AttendancePayrollModel.getAttendanceById(id);
      if (!rec) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy bản ghi chấm công' });
        return;
      }

      const shifts = await AttendancePayrollModel.getShifts();
      const shift = shifts.find((s) => s.id === rec.shift_id) || shifts[0];
      const now = new Date();
      let earlyLeaveMinutes = 0;
      if (shift) {
        const [eh, em] = String(shift.end_time).split(':').map(Number);
        const shiftEnd = new Date(now);
        shiftEnd.setHours(eh || 17, em || 30, 0, 0);
        const diffMins = Math.floor((shiftEnd.getTime() - now.getTime()) / 60000);
        if (diffMins > 0) earlyLeaveMinutes = diffMins;
      }

      const updated = await AttendancePayrollModel.updateAttendance(id, {
        check_out: now.toISOString(),
        early_leave_minutes: earlyLeaveMinutes,
      });

      await SystemModel.writeAuditLog(req.actor, 'Chấm công', 'Check-out chấm công', id, null, {
        earlyLeaveMinutes,
      });

      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi check-out' });
    }
  }

  static async submitExplanation(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { reason } = req.body;
      const updated = await AttendancePayrollModel.updateAttendance(id, {
        explanation_reason: reason,
        explanation_status: 'Chờ duyệt',
      });
      await SystemModel.writeAuditLog(req.actor, 'Chấm công', 'Gửi giải trình chấm công', id, null, { reason });
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi gửi giải trình' });
    }
  }

  static async approveAdjustment(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const {
        newCheckIn,
        newCheckOut,
        lateMinutes,
        earlyLeaveMinutes,
        workDayCredit,
        approveStatus,
        reason,
      } = req.body;

      const rec = await AttendancePayrollModel.getAttendanceById(id);
      if (!rec) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy bản ghi chấm công' });
        return;
      }

      const updatedLog = [
        ...(Array.isArray(rec.adjustment_log) ? rec.adjustment_log : []),
        {
          adjusted_at: new Date().toISOString(),
          adjusted_by: req.actor.actorName,
          old_check_in: rec.check_in,
          new_check_in: newCheckIn,
          old_check_out: rec.check_out,
          new_check_out: newCheckOut,
          reason,
        },
      ];

      const updated = await AttendancePayrollModel.updateAttendance(id, {
        check_in: newCheckIn,
        check_out: newCheckOut,
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes,
        work_day_credit: workDayCredit,
        explanation_status: approveStatus,
        approved_by: req.actor.actorName,
        adjustment_log: updatedLog,
      });

      await SystemModel.writeAuditLog(req.actor, 'Chấm công', 'Duyệt điều chỉnh chấm công', id, rec, updated);
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi duyệt điều chỉnh công' });
    }
  }

  static async createLeaveRequest(req: Request, res: Response) {
    try {
      const payload = req.body;
      const isPaid = payload.leave_type !== 'Nghỉ không lương';
      const created = await AttendancePayrollModel.createLeaveRequest({
        employee_id: payload.employee_id,
        leave_type: payload.leave_type || 'Nghỉ phép năm',
        is_paid: isPaid,
        start_date: payload.start_date || getTodayISO(),
        end_date: payload.end_date || getTodayISO(),
        total_days: Number(payload.total_days) || 1,
        reason: payload.reason || 'Nghỉ phép cá nhân',
        attachment_url: payload.attachment_url || null,
        status: 'Chờ duyệt',
      });

      await SystemModel.writeAuditLog(req.actor, 'Nghỉ phép', 'Đăng ký nghỉ phép', created.id, null, created);
      await SystemModel.createNotification({
        title: 'Đơn xin nghỉ phép mới',
        message: `${req.actor.actorName} vừa gửi đơn đăng ký nghỉ phép.`,
        category: 'hr',
      });

      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi đăng ký nghỉ phép' });
    }
  }

  static async updateLeaveStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      const updated = await AttendancePayrollModel.updateLeaveRequest(id, {
        status,
        approver_name: req.actor.actorName,
      });
      await SystemModel.writeAuditLog(req.actor, 'Nghỉ phép', `${status} đơn nghỉ phép`, id, null, { status });
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi duyệt nghỉ phép' });
    }
  }

  static async createOvertimeRequest(req: Request, res: Response) {
    try {
      const payload = req.body;
      const mult =
        payload.overtime_type === 'Ngày lễ, Tết'
          ? 3.0
          : payload.overtime_type === 'Ngày nghỉ hàng tuần'
          ? 2.0
          : 1.5;

      const created = await AttendancePayrollModel.createOvertimeRequest({
        employee_id: payload.employee_id,
        project_id: payload.project_id || null,
        overtime_date: payload.overtime_date || getTodayISO(),
        start_time: payload.start_time || '18:00',
        end_time: payload.end_time || '20:00',
        total_hours: Number(payload.total_hours) || 2,
        overtime_type: payload.overtime_type || 'Ngày thường',
        multiplier: mult,
        reason: payload.reason || 'Tăng ca xử lý tiến độ dự án',
        status: 'Chờ duyệt',
      });

      await SystemModel.writeAuditLog(req.actor, 'Tăng ca', 'Đăng ký tăng ca', created.id, null, created);
      await SystemModel.createNotification({
        title: 'Đơn đăng ký tăng ca mới',
        message: `${req.actor.actorName} vừa gửi yêu cầu tăng ca.`,
        category: 'hr',
      });

      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi đăng ký tăng ca' });
    }
  }

  static async updateOvertimeStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      const updated = await AttendancePayrollModel.updateOvertimeRequest(id, {
        status,
        approver_name: req.actor.actorName,
      });
      await SystemModel.writeAuditLog(req.actor, 'Tăng ca', `${status} đơn tăng ca`, id, null, { status });
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi duyệt tăng ca' });
    }
  }

  static async generatePayroll(req: Request, res: Response) {
    try {
      const month = Number(req.body.month);
      const year = Number(req.body.year);
      const standardDays = Number(req.body.standardDays || 26);

      const existing = await AttendancePayrollModel.getPayrollByPeriod(month, year);
      if (existing && existing.status === 'Đã khóa') {
        res.status(400).json({
          ok: false,
          error: `Bảng lương Tháng ${month}/${year} đã bị KHÓA. Vui lòng mở khóa có ghi nhật ký trước khi tính lại.`,
        });
        return;
      }

      let payrollId = existing?.id;
      if (!payrollId) {
        const code = `BL-${year}${String(month).padStart(2, '0')}`;
        const created = await AttendancePayrollModel.createPayroll({
          payroll_code: code,
          month,
          year,
          standard_work_days: standardDays,
          status: 'Nháp',
          created_by: req.actor.actorName,
        });
        payrollId = created.id;
      }

      const [employees, attendance, leaveRequests, overtimeRequests] = await Promise.all([
        HrModel.getEmployees(),
        AttendancePayrollModel.getAttendance(),
        AttendancePayrollModel.getLeaveRequests(),
        AttendancePayrollModel.getOvertimeRequests(),
      ]);

      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const activeEmployees = employees.filter((e) => e.work_status !== 'Đã nghỉ việc');

      const detailsToInsert = activeEmployees.map((emp) => {
        const empAtt = attendance.filter((a) => a.employee_id === emp.id && String(a.work_date).startsWith(prefix));
        const actualDays = empAtt.reduce((s, a) => s + (Number(a.work_day_credit) || 0), 0);
        const lateCount = empAtt.filter((a) => (Number(a.late_minutes) || 0) > 0).length;
        const lateMins = empAtt.reduce((s, a) => s + (Number(a.late_minutes) || 0), 0);

        const empLeaves = leaveRequests.filter(
          (l) => l.employee_id === emp.id && l.status === 'Đã duyệt' && String(l.start_date).startsWith(prefix)
        );
        const paidLeaveDays = empLeaves
          .filter((l) => l.is_paid)
          .reduce((s, l) => s + (Number(l.total_days) || 0), 0);
        const unpaidLeaveDays = empLeaves
          .filter((l) => !l.is_paid)
          .reduce((s, l) => s + (Number(l.total_days) || 0), 0);

        const empOt = overtimeRequests.filter(
          (o) => o.employee_id === emp.id && o.status === 'Đã duyệt' && String(o.overtime_date).startsWith(prefix)
        );
        const otHours = empOt.reduce((s, o) => s + (Number(o.total_hours) || 0), 0);

        const baseSalary = Number(emp.base_salary) || 0;
        const hourlyRate = standardDays > 0 ? baseSalary / standardDays / 8 : 0;
        const overtimePay = Math.round(
          empOt.reduce(
            (s, o) => s + (Number(o.total_hours) || 0) * hourlyRate * (Number(o.multiplier) || 1.5),
            0
          )
        );

        const totalPaidDays = actualDays + paidLeaveDays;
        const salaryByWorkdays =
          emp.salary_formula_type === 'fixed_month'
            ? baseSalary
            : standardDays > 0
            ? Math.round((baseSalary / standardDays) * totalPaidDays)
            : baseSalary;

        const allowance = Number(emp.default_allowance) || 0;
        const bonus = 0;
        const validDeductions = 0;
        const insuranceTax = 0;
        const advanceAmount = 0;
        const netSalary =
          salaryByWorkdays + allowance + bonus + overtimePay - validDeductions - insuranceTax - advanceAmount;

        return {
          payroll_id: payrollId,
          employee_id: emp.id,
          base_salary: baseSalary,
          standard_days: standardDays,
          actual_work_days: actualDays,
          paid_leave_days: paidLeaveDays,
          unpaid_leave_days: unpaidLeaveDays,
          late_count: lateCount,
          late_minutes: lateMins,
          overtime_hours: otHours,
          salary_by_workdays: salaryByWorkdays,
          allowance,
          bonus,
          overtime_pay: overtimePay,
          valid_deductions: validDeductions,
          insurance_tax: insuranceTax,
          advance_amount: advanceAmount,
          net_salary: netSalary,
        };
      });

      await AttendancePayrollModel.replacePayrollDetails(payrollId, detailsToInsert);
      await SystemModel.writeAuditLog(
        req.actor,
        'Bảng lương',
        `Tổng hợp bảng lương T${month}/${year}`,
        payrollId,
        null,
        { month, year, employeeCount: detailsToInsert.length }
      );

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo bảng lương' });
    }
  }

  static async updatePayrollDetail(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const payload = req.body;
      const oldItem = await AttendancePayrollModel.getPayrollDetailById(id);
      if (!oldItem) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy dòng lương' });
        return;
      }

      const parentPayroll = await AttendancePayrollModel.getPayrollById(oldItem.payroll_id);
      if (parentPayroll?.status === 'Đã khóa') {
        res.status(400).json({ ok: false, error: 'Bảng lương đã khóa, không thể chỉnh sửa trực tiếp.' });
        return;
      }

      const salaryByWorkdays = Number(payload.salary_by_workdays ?? oldItem.salary_by_workdays);
      const allowance = Number(payload.allowance ?? oldItem.allowance);
      const bonus = Number(payload.bonus ?? oldItem.bonus);
      const overtimePay = Number(payload.overtime_pay ?? oldItem.overtime_pay);
      const validDeductions = Number(payload.valid_deductions ?? oldItem.valid_deductions);
      const insuranceTax = Number(payload.insurance_tax ?? oldItem.insurance_tax);
      const advanceAmount = Number(payload.advance_amount ?? oldItem.advance_amount);

      const netSalary =
        salaryByWorkdays + allowance + bonus + overtimePay - validDeductions - insuranceTax - advanceAmount;

      const updated = await AttendancePayrollModel.updatePayrollDetail(id, {
        ...payload,
        net_salary: netSalary,
      });

      await SystemModel.writeAuditLog(req.actor, 'Bảng lương', 'Điều chỉnh chi tiết phiếu lương', id, oldItem, {
        ...payload,
        netSalary,
      });

      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật dòng lương' });
    }
  }

  static async changePayrollStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { newStatus, unlockReason } = req.body;
      const oldPayroll = await AttendancePayrollModel.getPayrollById(id);
      if (!oldPayroll) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy bảng lương' });
        return;
      }

      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'Đã duyệt') {
        updates.approved_by = req.actor.actorName;
      } else if (newStatus === 'Đã khóa') {
        updates.locked_at = new Date().toISOString();
      } else if (oldPayroll.status === 'Đã khóa') {
        updates.unlock_history = [
          ...(Array.isArray(oldPayroll.unlock_history) ? oldPayroll.unlock_history : []),
          {
            unlocked_at: new Date().toISOString(),
            unlocked_by: req.actor.actorName,
            reason: unlockReason || 'Mở khóa để điều chỉnh số liệu',
          },
        ];
      }

      const updated = await AttendancePayrollModel.updatePayroll(id, updates);
      await SystemModel.writeAuditLog(
        req.actor,
        'Bảng lương',
        `Chuyển trạng thái bảng lương: ${newStatus}`,
        id,
        oldPayroll,
        { newStatus, unlockReason }
      );

      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái lương' });
    }
  }
}
