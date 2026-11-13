import { requireSupabaseDb } from '../config/supabase';

export class FinanceModel {
  static async getPayments() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payments').select('*').order('payment_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getPaymentById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payments').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async createPayment(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payments').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async deletePayment(id: string) {
    const db = requireSupabaseDb();
    const { error } = await db.from('payments').delete().eq('id', id);
    if (error) throw error;
  }

  static async updatePayment(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payments').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getExpenseCategories() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('expense_categories').select('*').order('code');
    if (error) throw error;
    return data || [];
  }

  static async getExpenses() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('expenses').select('*').order('expense_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getExpenseById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('expenses').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async createExpense(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('expenses').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updateExpense(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('expenses').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async deleteExpense(id: string) {
    const db = requireSupabaseDb();
    const { error } = await db.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }

  static async createExpenseApproval(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    await db.from('expense_approvals').insert(payload);
  }

  static async getCostAllocations() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('cost_allocations').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async replaceCostAllocations(
    month: number,
    year: number,
    costType: 'general' | 'hr',
    rows: Array<Record<string, unknown>>
  ) {
    const db = requireSupabaseDb();
    await db
      .from('cost_allocations')
      .delete()
      .eq('period_month', month)
      .eq('period_year', year)
      .eq('cost_type', costType);

    if (rows.length > 0) {
      const { error } = await db.from('cost_allocations').insert(rows);
      if (error) throw error;
    }
  }
}
