import { Request, Response } from 'express';
import { CustomerModel } from '../models/CustomerModel';
import { SystemModel } from '../models/SystemModel';
import { generateSeqCode } from '../utils/helpers';

export class CustomerController {
  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      // Mục 3.2: Kiểm tra chống trùng Mã số thuế hoặc SĐT tại tầng Backend Controller
      const dup = await CustomerModel.findDuplicateByTaxOrPhone(payload.tax_code, payload.phone);
      if (dup) {
        const label = dup.type === 'tax_code' ? `Mã số thuế "${payload.tax_code}"` : `Số điện thoại "${payload.phone}"`;
        res.status(400).json({
          ok: false,
          error: `${label} đã tồn tại ở khách hàng [${dup.customer.customer_code}] ${dup.customer.name}.`,
        });
        return;
      }

      const allCusts = await CustomerModel.getAll();
      const code = payload.customer_code?.trim() || generateSeqCode('KH', allCusts.length + 1);

      const created = await CustomerModel.create({
        customer_code: code,
        name: payload.name?.trim() || 'Khách hàng mới',
        company_name: payload.company_name || null,
        contact_person: payload.contact_person || null,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address || null,
        tax_code: payload.tax_code || null,
        customer_type: payload.customer_type || 'Doanh nghiệp',
        sale_id: payload.sale_id || null,
        source: payload.source || 'Trực tiếp',
        notes: payload.notes || null,
      });

      await SystemModel.writeAuditLog(req.actor, 'Khách hàng', 'Tạo khách hàng mới', created.id, null, created);
      res.json({ ok: true, data: created });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo khách hàng' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const oldCust = await CustomerModel.getById(id);
      const updated = await CustomerModel.update(id, req.body);
      await SystemModel.writeAuditLog(req.actor, 'Khách hàng', 'Cập nhật khách hàng', id, oldCust, req.body);
      res.json({ ok: true, data: updated });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật khách hàng' });
    }
  }

  static async addCareLog(req: Request, res: Response) {
    try {
      const customerId = String(req.params.id);
      const { channel, content } = req.body;
      const log = await CustomerModel.createCareLog({
        customer_id: customerId,
        channel: channel || 'Điện thoại',
        content,
        staff_name: req.actor.actorName,
      });
      res.json({ ok: true, data: log });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi lưu CSKH' });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const oldCust = await CustomerModel.getById(id);
      if (!oldCust) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy khách hàng' });
        return;
      }
      await CustomerModel.deleteById(id);
      await SystemModel.writeAuditLog(req.actor, 'Khách hàng', 'Xóa hồ sơ khách hàng', id, oldCust, null);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Lỗi xóa khách hàng' });
    }
  }
}
