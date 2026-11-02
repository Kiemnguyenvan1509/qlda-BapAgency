import { requireSupabaseDb } from '../config/supabase';

export class HrModel {
  static async getDepartments() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('departments').select('*').order('name');
    if (error) throw error;
    return data || [];
  }

  static async createDepartment(payload: {
    code: string;
    name: string;
    manager_id: string | null;
    description?: string | null;
  }) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('departments').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getTeams() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('teams').select('*').order('name');
    if (error) throw error;
    return data || [];
  }

  static async createTeam(payload: {
    code: string;
    name: string;
    department_id: string | null;
    leader_id: string | null;
  }) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('teams').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getEmployees() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('employees').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getEmployeeById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('employees').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async createEmployee(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('employees').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updateEmployee(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('employees')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async getEmployeeTransfers() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('employee_transfers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createEmployeeTransfer(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('employee_transfers').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getUsers() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('users').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async createUser(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('users').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async updateUser(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('users').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  static async lockUserByEmployeeId(employeeId: string) {
    const db = requireSupabaseDb();
    await db.from('users').update({ is_locked: true }).eq('employee_id', employeeId);
  }

  static async deleteEmployee(id: string) {
    const db = requireSupabaseDb();
    // Xóa bảng lương chi tiết liên quan (do FK ON DELETE RESTRICT) và tài khoản user liên kết
    await db.from('payroll_details').delete().eq('employee_id', id);
    await db.from('users').delete().eq('employee_id', id);
    const { error } = await db.from('employees').delete().eq('id', id);
    if (error) throw error;
  }
}
