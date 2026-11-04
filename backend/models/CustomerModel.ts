import { requireSupabaseDb } from '../config/supabase';

export class CustomerModel {
  static async getAll() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('customers').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findDuplicateByTaxOrPhone(taxCode?: string, phone?: string) {
    const db = requireSupabaseDb();
    if (taxCode && taxCode.trim()) {
      const { data } = await db
        .from('customers')
        .select('*')
        .ilike('tax_code', taxCode.trim())
        .maybeSingle();
      if (data) return { type: 'tax_code', customer: data };
    }
    if (phone && phone.trim()) {
      const { data } = await db
        .from('customers')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();
      if (data) return { type: 'phone', customer: data };
    }
    return null;
  }

  static async create(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('customers').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async update(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('customers')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteById(id: string) {
    const db = requireSupabaseDb();
    // Gỡ liên kết dự án của khách hàng này (hoặc cho phép xóa khách hàng sạch sẽ)
    await db.from('projects').update({ customer_id: null }).eq('customer_id', id);
    await db.from('payments').update({ customer_id: null }).eq('customer_id', id);
    await db.from('customer_care_logs').delete().eq('customer_id', id);
    const { error } = await db.from('customers').delete().eq('id', id);
    if (error) throw error;
  }

  static async getCareLogs() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('customer_care_logs').select('*').order('care_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createCareLog(payload: { customer_id: string; channel: string; content: string; staff_name: string }) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('customer_care_logs').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
}
