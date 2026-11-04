import { requireSupabaseDb } from '../config/supabase';

export class ProjectModel {
  static async getAll() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async getById(id: string) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async create(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('projects').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async update(id: string, payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('projects')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteById(id: string) {
    const db = requireSupabaseDb();
    await db.from('payments').delete().eq('project_id', id);
    await db.from('expenses').delete().eq('project_id', id);
    const { error } = await db.from('projects').delete().eq('id', id);
    if (error) throw error;
  }

  static async getAssignments() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('project_assignments').select('*').order('assigned_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createAssignment(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('project_assignments').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getContractRevisions() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('contract_revisions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createContractRevision(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('contract_revisions').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getWorkLogs() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('work_logs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createWorkLog(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('work_logs').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  static async getProjectFiles() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('project_files').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createProjectFile(payload: Record<string, unknown>) {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('project_files').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
}
