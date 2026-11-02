import { requireSupabaseDb } from '../config/supabase';

export class AttendancePayrollModel {
  static async getShifts() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('shifts').select('*').order('created_at');
    if (error) throw error;
    return data || [];
  }

  static async createShift(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('shifts').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getAttendance() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('attendance').select('*').order('work_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getAttendanceById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('attendance').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async createAttendance(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('attendance').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updateAttendance(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('attendance').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getLeaveRequests() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createLeaveRequest(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('leave_requests').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updateLeaveRequest(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('leave_requests').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getOvertimeRequests() {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('overtime_requests')
      .select('*')
      .order('overtime_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createOvertimeRequest(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('overtime_requests').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updateOvertimeRequest(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('overtime_requests').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getPayrolls() {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('payroll')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getPayrollById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payroll').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async getPayrollByPeriod(month: number, year: number) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('payroll')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async createPayroll(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payroll').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updatePayroll(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payroll').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getPayrollDetails() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payroll_details').select('*');
    if (error) throw error;
    return data || [];
  }

  static async getPayrollDetailById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payroll_details').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async replacePayrollDetails(payrollId: string, rows: Array<Record<string, unknown>>) {
    const db = requireSupabaseDb();
    await db.from('payroll_details').delete().eq('payroll_id', payrollId);
    if (rows.length > 0) {
      const { error } = await db.from('payroll_details').insert(rows);
      if (error) throw error;
    }
  }

  static async updatePayrollDetail(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('payroll_details').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
}
