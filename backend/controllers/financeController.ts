import { Request, Response } from 'express';
import { FinanceModel } from '../models/FinanceModel';
import { ProjectModel } from '../models/ProjectModel';
import { SystemModel } from '../models/SystemModel';
import { generateSeqCode, getTodayISO, isAdminActor } from '../utils/helpers';

export class FinanceController {
  static async createPayment(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (!payload.project_id) {
        res.status(400).json({ ok: false, error: 'Vui lòng chọn dự án thanh toán' });
        return;
      }

      const payments = await FinanceModel.getPayments();
      const txCode = payload.transaction_code?.trim() || generateSeqCode('PT-', payments.length);

      const created = await FinanceModel.createPayment({
        transaction_code: txCode,
        project_id: payload.project_id,
        installment_name: payload.installment_name || 'Đợt 1',
        amount: Number(payload.amount) || 0,
        payment_date: payload.payment_date || getTodayISO(),
        payment_method: payload.payment_method || 'Chuyển khoản',
        receiving_account: payload.receiving_account || null,
        bank_tx_code: payload.bank_tx_code || null,
        attachment_url: payload.attachment_url || null,
        updated_by: req.actor.actorName,
        confirmed_by: payload.status === 'Đã xác nhận' ? req.actor.actorName : null,
        confirmed_at: payload.status === 'Đã xác nhận' ? new Date().toISOString() : null,
        status: payload.status || 'Chờ xác nhận',
        notes: payload.notes || null,
      });

      await SystemModel.writeAuditLog(req.actor, 'Thanh toán', 'Ghi nhận đợt thanh toán', created.id, null, created);
      await SystemModel.createNotification({
        title: `Khoản thanh toán mới: ${txCode}`,
        message: `Khoản thu ${Number(payload.amount || 0).toLocaleString('vi-VN')}đ (${
          payload.installment_name
        }) vừa được tạo.`,
        category: 'payment',
        project_id: payload.project_id,
      });

      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo thanh toán' });
    }
  }

  static async confirmPayment(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const oldPay = await FinanceModel.getPaymentById(id);
      const updated = await FinanceModel.updatePayment(id, {
        status: 'Đã xác nhận',
        confirmed_by: req.actor.actorName,
        confirmed_at: new Date().toISOString(),
      });

      await SystemModel.writeAuditLog(req.actor, 'Thanh toán', 'Xác nhận thực thu', id, oldPay, updated);
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi xác nhận thanh toán' });
    }
  }

  // Mục 4.4: Không xóa giao dịch đã xác nhận mà phải lập giao dịch điều chỉnh hoặc hoàn tiền
  static async cancelOrRefundPayment(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { reason } = req.body;
      const oldPay = await FinanceModel.getPaymentById(id);
      if (!oldPay) {
        res.status(404).json({ ok: false, error: 'Giao dịch không tồn tại' });
        return;
      }

      const newStatus = oldPay.status === 'Đã xác nhận' ? 'Hoàn tiền/Điều chỉnh' : 'Hủy';
      const updated = await FinanceModel.updatePayment(id, {
        status: newStatus,
        notes: `${oldPay.notes ? oldPay.notes + ' | ' : ''}Lý do ${newStatus}: ${reason} (bởi ${
          req.actor.actorName
        })`,
      });

      await SystemModel.writeAuditLog(req.actor, 'Thanh toán', `Chuyển trạng thái ${newStatus}`, id, oldPay, {
        newStatus,
        reason,
      });
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi hủy/điều chỉnh thanh toán' });
    }
  }

  // Chỉ Admin / Super Admin mới được xóa vĩnh viễn giao dịch thanh toán
  static async deletePayment(req: Request, res: Response) {
    try {
      if (!(await isAdminActor(req))) {
        res.status(403).json({ ok: false, error: 'Chỉ Admin mới có quyền xóa giao dịch thanh toán.' });
        return;
      }
      const id = String(req.params.id);
      const oldPay = await FinanceModel.getPaymentById(id);
      if (!oldPay) {
        res.status(404).json({ ok: false, error: 'Giao dịch không tồn tại' });
        return;
      }

      await FinanceModel.deletePayment(id);
      await SystemModel.writeAuditLog(req.actor, 'Thanh toán', 'Xóa giao dịch thanh toán', id, oldPay, null);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi xóa thanh toán' });
    }
  }

  static async createExpense(req: Request, res: Response) {
    try {
      const payload = req.body;
      const expenses = await FinanceModel.getExpenses();
      const code = payload.expense_code?.trim() || generateSeqCode('CP-', expenses.length);
      const beforeTax = Number(payload.amount_before_tax) || 0;
      const vatRate = Number(payload.vat_rate) || 0;
      const vatAmount = Math.round((beforeTax * vatRate) / 100);
      const afterTax = beforeTax + vatAmount;

      const created = await FinanceModel.createExpense({
        expense_code: code,
        expense_scope: payload.expense_scope || 'project',
        project_id: payload.expense_scope === 'project' ? payload.project_id || null : null,
        title: payload.title?.trim() || 'Khoản chi mới',
        category_name: payload.category_name || 'Chi phí khác',
        amount_before_tax: beforeTax,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        amount_after_tax: afterTax,
        is_vat_deductible: payload.is_vat_deductible ?? true,
        expense_date: payload.expense_date || getTodayISO(),
        proposer_id: payload.proposer_id || null,
        proposer_name: payload.proposer_name || req.actor.actorName,
        recipient_name: payload.recipient_name || null,
        attachment_url: payload.attachment_url || null,
        status: payload.status || 'Chờ duyệt',
        notes: payload.notes || null,
      });

      await SystemModel.writeAuditLog(req.actor, 'Chi phí', 'Tạo đề xuất chi phí', created.id, null, created);
      await SystemModel.createNotification({
        title: `Đề xuất chi phí mới: ${code}`,
        message: `${req.actor.actorName} đề xuất khoản chi "${created.title}" (${afterTax.toLocaleString('vi-VN')}đ).`,
        category: 'expense',
        project_id: created.project_id,
      });

      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo chi phí' });
    }
  }

  static async updateExpenseStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { newStatus, comment, approverId } = req.body;
      const oldExp = await FinanceModel.getExpenseById(id);
      if (!oldExp) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy khoản chi' });
        return;
      }

      // Từ chối => xóa luôn khoản chi (lịch sử duyệt bị xóa theo ON DELETE CASCADE)
      if (newStatus === 'Từ chối') {
        await FinanceModel.deleteExpense(id);
        await SystemModel.writeAuditLog(req.actor, 'Chi phí', 'Từ chối & xóa khoản chi', id, oldExp, {
          newStatus,
          comment,
        });
        res.json({ ok: true, data: null });
        return;
      }

      const updated = await FinanceModel.updateExpense(id, {
        status: newStatus,
        approver_id: approverId || null,
        approver_name: req.actor.actorName,
      });

      await FinanceModel.createExpenseApproval({
        expense_id: id,
        action: newStatus,
        old_status: oldExp.status,
        new_status: newStatus,
        actor_name: req.actor.actorName,
        comment: comment || null,
      });

      await SystemModel.writeAuditLog(
        req.actor,
        'Chi phí',
        `Cập nhật trạng thái chi phí: ${newStatus}`,
        id,
        oldExp,
        { newStatus, comment }
      );

      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi duyệt chi phí' });
    }
  }

  // Phân bổ chi phí chung theo 5 phương pháp (Mục 5.4)
  static async runCostAllocation(req: Request, res: Response) {
    try {
      const payload = req.body;
      const [allProjects, workLogs] = await Promise.all([
        ProjectModel.getAll(),
        ProjectModel.getWorkLogs(),
      ]);

      const activeProjects = allProjects.filter((p) => !p.is_archived && p.status !== 'Hủy dự án');
      if (activeProjects.length === 0) {
        res.status(400).json({ ok: false, error: 'Không có dự án đang hoạt động để nhận phân bổ chi phí.' });
        return;
      }

      const rowsToInsert: Array<Record<string, unknown>> = [];
      const totalPool = Number(payload.totalAmountToAllocate) || 0;

      if (payload.method === 'revenue_ratio') {
        const totalRev = activeProjects.reduce((s, p) => s + (Number(p.revenue_before_tax) || 0), 0);
        for (const p of activeProjects) {
          const ratio = totalRev > 0 ? (Number(p.revenue_before_tax) || 0) / totalRev : 1 / activeProjects.length;
          rowsToInsert.push({
            period_month: payload.month,
            period_year: payload.year,
            project_id: p.id,
            cost_type: payload.costType,
            allocation_method: payload.method,
            allocation_ratio: Number((ratio * 100).toFixed(4)),
            allocated_amount: Math.round(totalPool * ratio),
            notes: payload.notes || `Phân bổ theo tỷ lệ doanh thu T${payload.month}/${payload.year}`,
            created_by: req.actor.actorName,
          });
        }
      } else if (payload.method === 'work_hours') {
        const hoursByProj = new Map<string, number>();
        let totalHours = 0;
        for (const p of activeProjects) {
          const hrs = workLogs
            .filter((w) => w.project_id === p.id)
            .reduce((s, w) => s + (Number(w.work_hours) || 0), 0);
          const effectiveHrs = hrs > 0 ? hrs : Number(p.page_count) || 1;
          hoursByProj.set(p.id, effectiveHrs);
          totalHours += effectiveHrs;
        }
        for (const p of activeProjects) {
          const ratio = totalHours > 0 ? (hoursByProj.get(p.id) || 0) / totalHours : 1 / activeProjects.length;
          rowsToInsert.push({
            period_month: payload.month,
            period_year: payload.year,
            project_id: p.id,
            cost_type: payload.costType,
            allocation_method: payload.method,
            allocation_ratio: Number((ratio * 100).toFixed(4)),
            allocated_amount: Math.round(totalPool * ratio),
            notes: payload.notes || `Phân bổ theo giờ công / khối lượng T${payload.month}/${payload.year}`,
            created_by: req.actor.actorName,
          });
        }
      } else if (payload.method === 'project_count' || payload.method === 'fixed_ratio') {
        const ratio = 1 / activeProjects.length;
        for (const p of activeProjects) {
          rowsToInsert.push({
            period_month: payload.month,
            period_year: payload.year,
            project_id: p.id,
            cost_type: payload.costType,
            allocation_method: payload.method,
            allocation_ratio: Number((ratio * 100).toFixed(4)),
            allocated_amount: Math.round(totalPool * ratio),
            notes: payload.notes || `Phân bổ đồng đều theo số lượng dự án T${payload.month}/${payload.year}`,
            created_by: req.actor.actorName,
          });
        }
      } else if (payload.method === 'manual' && payload.manualMap) {
        const manualSum = Object.values(payload.manualMap as Record<string, number>).reduce(
          (a, b) => a + Number(b || 0),
          0
        );
        for (const p of activeProjects) {
          const amt = Number(payload.manualMap[p.id] || 0);
          if (amt > 0) {
            rowsToInsert.push({
              period_month: payload.month,
              period_year: payload.year,
              project_id: p.id,
              cost_type: payload.costType,
              allocation_method: 'manual',
              allocation_ratio: manualSum > 0 ? Number(((amt / manualSum) * 100).toFixed(4)) : 0,
              allocated_amount: Math.round(amt),
              notes: payload.notes || `Phân bổ thủ công T${payload.month}/${payload.year}`,
              created_by: req.actor.actorName,
            });
          }
        }
      }

      await FinanceModel.replaceCostAllocations(
        Number(payload.month),
        Number(payload.year),
        payload.costType,
        rowsToInsert
      );

      await SystemModel.writeAuditLog(
        req.actor,
        'Phân bổ chi phí',
        `Phân bổ chi phí (${payload.costType})`,
        `${payload.month}/${payload.year}`,
        null,
        payload
      );

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi phân bổ chi phí' });
    }
  }
}
