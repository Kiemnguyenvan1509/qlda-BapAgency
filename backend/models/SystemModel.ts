import { requireSupabaseDb } from '../config/supabase';
import { ActorContext } from '../middlewares/authMiddleware';

export class SystemModel {
  static async getRoles() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('roles').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async getRolePermissions() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('role_permissions').select('*');
    if (error) throw error;
    return data || [];
  }

  static async updateRoleConfig(roleId: string, dataScope: string, hiddenFields: string[]) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('roles')
      .update({ data_scope: dataScope, hidden_fields: hiddenFields })
      .eq('id', roleId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async getSettings() {
    const db = requireSupabaseDb();
    const { data, error } = await db.from('system_settings').select('*');
    if (error) throw error;
    return data || [];
  }

  static async upsertSetting(key: string, value: unknown) {
    const db = requireSupabaseDb();
    const { error } = await db.from('system_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  static async getNotifications(limit = 100) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async createNotification(payload: {
    title: string;
    message: string;
    category?: string;
    recipient_employee_id?: string | null;
    project_id?: string | null;
  }) {
    const db = requireSupabaseDb();
    await db.from('notifications').insert({
      title: payload.title,
      message: payload.message,
      category: payload.category || 'system',
      recipient_employee_id: payload.recipient_employee_id || null,
      project_id: payload.project_id || null,
    });
  }

  static async markNotificationRead(id: string) {
    const db = requireSupabaseDb();
    const { error } = await db.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  }

  static async getAuditLogs(limit = 200) {
    const db = requireSupabaseDb();
    const { data, error } = await db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async writeAuditLog(
    actor: ActorContext,
    actionModule: string,
    actionType: string,
    targetId?: string,
    oldData?: unknown,
    newData?: unknown
  ) {
    const db = requireSupabaseDb();
    await db.from('audit_logs').insert({
      actor_name: actor.actorName,
      actor_role: actor.actorRole,
      action_module: actionModule,
      action_type: actionType,
      target_id: targetId || null,
      old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
      new_data: newData ? JSON.parse(JSON.stringify(newData)) : null,
      ip_or_device: actor.ipOrDevice,
    });
  }
}
