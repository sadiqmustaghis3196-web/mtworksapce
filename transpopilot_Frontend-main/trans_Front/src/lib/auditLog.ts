import { supabase } from './supabase';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.signup'
  | 'user.profile.update'
  | 'vehicle.create'
  | 'vehicle.update'
  | 'vehicle.delete'
  | 'driver.create'
  | 'driver.update'
  | 'driver.delete'
  | 'integration.connect'
  | 'integration.disconnect'
  | 'integration.sync'
  | 'route.optimize'
  | 'fuel.analyze'
  | 'ai.prediction'
  | 'admin.role.change'
  | 'data.export'
  | 'settings.update';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const logEntry = {
        action: entry.action,
        user_id: entry.userId || user?.id,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        details: entry.details || {},
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        success: entry.success,
        error_message: entry.errorMessage,
        created_at: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        console.info('[Audit Log]', logEntry);
      }

      await supabase.from('security_audit_logs').insert(logEntry);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  static async logSuccess(
    action: AuditAction,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action,
      details,
      success: true,
    });
  }

  static async logFailure(
    action: AuditAction,
    error: Error | string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action,
      details,
      success: false,
      errorMessage: typeof error === 'string' ? error : error.message,
    });
  }

  static async logEntityOperation(
    action: AuditAction,
    entityType: string,
    entityId: string,
    success: boolean,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action,
      entityType,
      entityId,
      details,
      success,
    });
  }

  static async getRecentLogs(limit: number = 100) {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data || [];
  }

  static async getLogsByUser(userId: string, limit: number = 100) {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch user audit logs:', error);
      return [];
    }

    return data || [];
  }

  static async getLogsByAction(action: AuditAction, limit: number = 100) {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch action audit logs:', error);
      return [];
    }

    return data || [];
  }
}
