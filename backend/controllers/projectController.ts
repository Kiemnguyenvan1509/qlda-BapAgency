import { Request, Response } from 'express';
import { ProjectModel } from '../models/ProjectModel';
import { CustomerModel } from '../models/CustomerModel';
import { FinanceModel } from '../models/FinanceModel';
import { HrModel } from '../models/HrModel';
import { SystemModel } from '../models/SystemModel';
import { calculateTaxes, generateSeqCode, getTodayISO } from '../utils/helpers';

export class ProjectController {
  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      const allProjects = await ProjectModel.getAll();
      const code = payload.project_code?.trim() || generateSeqCode('DA-', allProjects.length);
      const mode: 'before_tax' | 'after_tax' = payload.tax_input_mode || 'before_tax';
      const vatRate = Number(payload.vat_rate ?? 8);
      const rawAmount =
        mode === 'before_tax' ? Number(payload.revenue_before_tax || 0) : Number(payload.revenue_after_tax || 0);
      const taxes = calculateTaxes(rawAmount, vatRate, mode);

      const created = await ProjectModel.create({
        project_code: code,
        name: payload.name?.trim() || 'Dự án mới',
        customer_id: payload.customer_id || null,
        notes: payload.notes || null,
        page_count: Number(payload.page_count) || 1,
        job_type: payload.job_type || 'HSNL',
        tax_input_mode: mode,
        revenue_before_tax: taxes.beforeTax,
        vat_rate: vatRate,
        vat_amount: taxes.vatAmount,
        revenue_after_tax: taxes.afterTax,
        contract_sign_date: payload.contract_sign_date || null,
        contract_number: payload.contract_number || null,
        contract_status: payload.contract_status || 'Nháp',
        sale_id: payload.sale_id || null,
        designer_id: payload.designer_id || null,
        team_leader_id: payload.team_leader_id || null,
        department_id: payload.department_id || null,
        assigned_date: getTodayISO(),
        priority: payload.priority || 'Trung bình',
        status: payload.status || 'Chờ tiếp nhận',
        received_date: payload.received_date || getTodayISO(),
        start_date: payload.start_date || getTodayISO(),
        deadline: payload.deadline || null,
        progress_percent: Number(payload.progress_percent) || 0,
        progress_notes: payload.progress_notes || null,
        created_by: req.actor.actorName,
      });

      if (created.sale_id) {
        await ProjectModel.createAssignment({
          project_id: created.id,
          role_type: 'Sale',
          old_employee_id: null,
          new_employee_id: created.sale_id,
          note: 'Phân công Sale khi khởi tạo dự án',
          changed_by: req.actor.actorName,
        });
      }
      if (created.designer_id) {
        await ProjectModel.createAssignment({
          project_id: created.id,
          role_type: 'Designer',
          old_employee_id: null,
          new_employee_id: created.designer_id,
          note: 'Phân công Designer khi khởi tạo dự án',
          changed_by: req.actor.actorName,
        });
      }

      await SystemModel.writeAuditLog(req.actor, 'Dự án', 'Tạo dự án mới', created.id, null, created);
      await SystemModel.createNotification({
        title: `Dự án mới: ${created.project_code}`,
        message: `Dự án "${created.name}" vừa được khởi tạo bởi ${req.actor.actorName}.`,
        category: 'project',
        recipient_employee_id: created.designer_id || created.sale_id || null,
        project_id: created.id,
      });

      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo dự án' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { reason, ...payload } = req.body;
      const oldProj = await ProjectModel.getById(id);
      if (!oldProj) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy dự án' });
        return;
      }

      const updatedFields: Record<string, unknown> = { ...payload };
      if (payload.status === 'Hoàn thành' && !oldProj.completed_date) {
        updatedFields.completed_date = getTodayISO();
        updatedFields.progress_percent = 100;
      }
      if (payload.status === 'Đã bàn giao' && !oldProj.handover_date) {
        updatedFields.handover_date = getTodayISO();
        updatedFields.progress_percent = 100;
      }

      const updated = await ProjectModel.update(id, updatedFields);
      await SystemModel.writeAuditLog(
        req.actor,
        'Dự án',
        reason || 'Cập nhật thông tin dự án',
        id,
        oldProj,
        updatedFields
      );
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật dự án' });
    }
  }

  // Quy tắc bắt buộc số 10 tại Backend Controller: Chặn xóa vĩnh viễn dự án đã phát sinh dữ liệu tài chính
  static async remove(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const proj = await ProjectModel.getById(id);
      if (!proj) {
        res.status(404).json({ ok: false, error: 'Dự án không tồn tại' });
        return;
      }

      const [payments, expenses] = await Promise.all([
        FinanceModel.getPayments(),
        FinanceModel.getExpenses(),
      ]);

      const hasPayments = payments.some((p) => p.project_id === id);
      const hasExpenses = expenses.some((e) => e.project_id === id);
      const hasSignedContract = proj.contract_status === 'Đã ký' || Number(proj.revenue_before_tax) > 0;

      if (hasPayments || hasExpenses || hasSignedContract) {
        res.status(400).json({
          ok: false,
          error:
            'QUY TẮC BẮT BUỘC SỐ 10 (Backend Guard): Không được xóa vĩnh viễn dự án đã phát sinh hợp đồng, doanh thu, thực thu hoặc chi phí. Vui lòng sử dụng chức năng "Lưu trữ dự án" hoặc chuyển trạng thái "Hủy dự án".',
        });
        return;
      }

      await ProjectModel.deleteById(id);
      await SystemModel.writeAuditLog(req.actor, 'Dự án', 'Xóa dự án chưa phát sinh tài chính', id, proj, null);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi xóa dự án' });
    }
  }

  static async handoverStaff(req: Request, res: Response) {
    try {
      const projectId = String(req.params.id);
      const { roleType, newEmployeeId, note } = req.body;
      const proj = await ProjectModel.getById(projectId);
      if (!proj) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy dự án' });
        return;
      }

      const oldEmpId =
        roleType === 'Sale' ? proj.sale_id : roleType === 'Designer' ? proj.designer_id : proj.team_leader_id;

      const updateCol =
        roleType === 'Sale'
          ? { sale_id: newEmployeeId }
          : roleType === 'Designer'
          ? { designer_id: newEmployeeId }
          : { team_leader_id: newEmployeeId };

      await ProjectModel.update(projectId, { ...updateCol, assigned_date: getTodayISO() });
      await ProjectModel.createAssignment({
        project_id: projectId,
        role_type: roleType,
        old_employee_id: oldEmpId,
        new_employee_id: newEmployeeId,
        note: note || `Chuyển giao ${roleType}`,
        changed_by: req.actor.actorName,
      });

      await SystemModel.writeAuditLog(
        req.actor,
        'Dự án',
        `Bàn giao nhân sự (${roleType})`,
        projectId,
        { oldEmpId },
        { newEmployeeId, note }
      );
      await SystemModel.createNotification({
        title: `Thay đổi ${roleType} dự án ${proj.project_code}`,
        message: `Dự án "${proj.name}" vừa được cập nhật ${roleType} phụ trách.`,
        category: 'project',
        recipient_employee_id: newEmployeeId,
        project_id: projectId,
      });

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi bàn giao nhân sự' });
    }
  }

  static async adjustContract(req: Request, res: Response) {
    try {
      const projectId = String(req.params.id);
      const { inputAmount, vatRate, mode, contractStatus, contractNumber, contractSignDate, reason } = req.body;
      const proj = await ProjectModel.getById(projectId);
      if (!proj) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy dự án' });
        return;
      }

      const taxes = calculateTaxes(Number(inputAmount), Number(vatRate), mode);

      await ProjectModel.createContractRevision({
        project_id: projectId,
        old_before_tax: proj.revenue_before_tax,
        new_before_tax: taxes.beforeTax,
        old_vat_rate: proj.vat_rate,
        new_vat_rate: vatRate,
        old_after_tax: proj.revenue_after_tax,
        new_after_tax: taxes.afterTax,
        old_status: proj.contract_status,
        new_status: contractStatus,
        reason: reason || 'Cập nhật / điều chỉnh giá trị hợp đồng',
        changed_by: req.actor.actorName,
      });

      const updated = await ProjectModel.update(projectId, {
        tax_input_mode: mode,
        revenue_before_tax: taxes.beforeTax,
        vat_rate: vatRate,
        vat_amount: taxes.vatAmount,
        revenue_after_tax: taxes.afterTax,
        contract_status: contractStatus,
        contract_number: contractNumber || null,
        contract_sign_date: contractSignDate || null,
      });

      await SystemModel.writeAuditLog(
        req.actor,
        'Hợp đồng & Doanh thu',
        'Điều chỉnh hợp đồng dự án',
        projectId,
        proj,
        updated
      );

      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi điều chỉnh hợp đồng' });
    }
  }

  static async addWorkLog(req: Request, res: Response) {
    try {
      const projectId = String(req.params.id);
      const { stepName, progressPercent, statusAfter, workHours, note } = req.body;
      await ProjectModel.createWorkLog({
        project_id: projectId,
        step_name: stepName,
        progress_percent: progressPercent,
        status_after: statusAfter,
        work_hours: workHours,
        note,
        updated_by: req.actor.actorName,
      });
      await ProjectModel.update(projectId, {
        progress_percent: progressPercent,
        status: statusAfter,
        progress_notes: note,
      });
      await SystemModel.writeAuditLog(req.actor, 'Tiến độ dự án', 'Cập nhật tiến độ', projectId, null, req.body);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật tiến độ' });
    }
  }

  static async addProjectFile(req: Request, res: Response) {
    try {
      const projectId = String(req.params.id);
      const { category, fileName, fileUrl, fileSize } = req.body;
      await ProjectModel.createProjectFile({
        project_id: projectId,
        file_category: category,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize || 'Liên kết tài liệu',
        uploaded_by: req.actor.actorName,
      });
      await SystemModel.writeAuditLog(req.actor, 'File dự án', 'Tải lên tài liệu', projectId, null, req.body);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi thêm file dự án' });
    }
  }

  static async importExcel(req: Request, res: Response) {
    try {
      const { mappedRows } = req.body;
      if (!Array.isArray(mappedRows)) {
        res.status(400).json({ ok: false, error: 'Dữ liệu nhập không hợp lệ' });
        return;
      }

      const [projects, customers, employees, payments] = await Promise.all([
        ProjectModel.getAll(),
        CustomerModel.getAll(),
        HrModel.getEmployees(),
        FinanceModel.getPayments(),
      ]);

      let successCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      const existingCodes = new Set(projects.map((p) => String(p.project_code).toLowerCase()));
      const customerMap = new Map<string, string>(
        customers.map((c) => [String(c.name).trim().toLowerCase(), String(c.id)])
      );

      for (let i = 0; i < mappedRows.length; i++) {
        const row = mappedRows[i];
        const pCode = String(row.project_code || '').trim() || generateSeqCode('DA-IMP-', projects.length + i);

        if (existingCodes.has(pCode.toLowerCase())) {
          skippedCount++;
          errors.push(`Dòng ${i + 1}: Mã dự án "${pCode}" đã tồn tại (bỏ qua không ghi đè).`);
          continue;
        }
        if (!row.project_name || !String(row.project_name).trim()) {
          skippedCount++;
          errors.push(`Dòng ${i + 1}: Thiếu tên dự án.`);
          continue;
        }

        let custId: string | null = null;
        const cName = String(row.customer_name || '').trim();
        if (cName) {
          const existingCustId = customerMap.get(cName.toLowerCase());
          if (existingCustId) {
            custId = existingCustId;
          } else {
            const newCust = await CustomerModel.create({
              customer_code: generateSeqCode('KH-IMP-', customerMap.size + i),
              name: cName,
              customer_type: 'Doanh nghiệp',
            });
            custId = newCust.id;
            customerMap.set(cName.toLowerCase(), newCust.id);
          }
        }

        const saleEmp = row.sale_name
          ? employees.find((e) =>
              String(e.full_name).toLowerCase().includes(String(row.sale_name).trim().toLowerCase())
            )
          : undefined;
        const designerEmp = row.designer_name
          ? employees.find((e) =>
              String(e.full_name).toLowerCase().includes(String(row.designer_name).trim().toLowerCase())
            )
          : undefined;

        const vatRate = Number(row.vat_rate ?? 8);
        const taxes = calculateTaxes(Number(row.revenue_before_tax) || 0, vatRate, 'before_tax');

        try {
          const newProj = await ProjectModel.create({
            project_code: pCode,
            name: String(row.project_name).trim(),
            customer_id: custId,
            job_type: row.job_type || 'HSNL',
            page_count: Number(row.page_count) || 1,
            tax_input_mode: 'before_tax',
            revenue_before_tax: taxes.beforeTax,
            vat_rate: vatRate,
            vat_amount: taxes.vatAmount,
            revenue_after_tax: taxes.afterTax,
            contract_status: taxes.beforeTax > 0 ? 'Đã ký' : 'Nháp',
            sale_id: saleEmp?.id || null,
            designer_id: designerEmp?.id || null,
            status: row.status || 'Chờ tiếp nhận',
            deadline: row.deadline || null,
            notes: row.notes || null,
            created_by: req.actor.actorName,
          });

          existingCodes.add(pCode.toLowerCase());
          successCount++;

          const paidAmt = Number(row.paid_amount) || 0;
          if (paidAmt > 0) {
            await FinanceModel.createPayment({
              transaction_code: generateSeqCode('PT-IMP-', payments.length + i),
              project_id: newProj.id,
              installment_name: 'Đợt 1 (Chuyển đổi hệ thống cũ)',
              amount: paidAmt,
              payment_date: row.payment_date || getTodayISO(),
              payment_method: 'Chuyển khoản',
              updated_by: req.actor.actorName,
              confirmed_by: req.actor.actorName,
              confirmed_at: new Date().toISOString(),
              status: 'Đã xác nhận',
            });
          }
        } catch (err: unknown) {
          skippedCount++;
          errors.push(`Dòng ${i + 1} (${pCode}): ${err instanceof Error ? err.message : 'Lỗi tạo dự án'}`);
        }
      }

      await SystemModel.writeAuditLog(
        req.actor,
        'Nhập dữ liệu Excel',
        'Chuyển đổi dữ liệu từ Google Sheets/Excel',
        undefined,
        null,
        { successCount, skippedCount }
      );

      res.json({ ok: true, successCount, skippedCount, errors });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi import Excel' });
    }
  }
}
