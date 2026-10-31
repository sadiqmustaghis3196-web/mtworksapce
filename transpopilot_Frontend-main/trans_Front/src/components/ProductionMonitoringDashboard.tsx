import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, Clock, Zap, Database, Cloud } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    edgeFunctions: ServiceHealth;
    integrations: ServiceHealth;
    aiServices: ServiceHealth;
  };
  metrics: {
    responseTime: number;
    uptime: number;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
  lastCheck?: string;
}

interface IntegrationStatus {
  name: string;
  status: string;
  lastSync: string;
  syncCount: number;
}

interface AuditLog {
  id: string;
  action: string;
  success: boolean;
  created_at: string;
  error_message?: string;
}

export default function ProductionMonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadMonitoringData() {
    try {
      await Promise.all([
        loadHealthStatus(),
        loadIntegrations(),
        loadAuditLogs(),
      ]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }

  async function loadHealthStatus() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/health-check`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      }
    } catch (err) {
      console.error('Failed to load health status:', err);
    }
  }

  async function loadIntegrations() {
    const { data, error } = await supabase
      .from('telematics_integrations')
      .select(`
        id,
        provider:integration_providers(name),
        status,
        last_sync_at,
        configuration
      `)
      .order('last_sync_at', { ascending: false });

    if (error) {
      console.error('Failed to load integrations:', error);
      return;
    }

    const integrationStats = await Promise.all(
      (data || []).map(async (integration: any) => {
        const { count } = await supabase
          .from('integration_sync_logs')
          .select('*', { count: 'exact', head: true })
          .eq('provider_id', integration.provider?.id || '')
          .eq('status', 'success');

        return {
          name: integration.provider?.name || 'Unknown',
          status: integration.status,
          lastSync: integration.last_sync_at || 'Never',
          syncCount: count || 0,
        };
      })
    );

    setIntegrations(integrationStats);
  }

  async function loadAuditLogs() {
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('id, action, success, created_at, error_message')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to load audit logs:', error);
      return;
    }

    setRecentLogs(data || []);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'up':
      case 'healthy':
      case 'active':
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'down':
      case 'unhealthy':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'up':
      case 'healthy':
      case 'active':
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'down':
      case 'unhealthy':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Production Monitoring</h1>
        <p className="mt-2 text-gray-600">Real-time system health and performance metrics</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {healthStatus && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
            <div className="flex items-center space-x-2">
              {getStatusIcon(healthStatus.status)}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(healthStatus.status)}`}>
                {healthStatus.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">{healthStatus.metrics.responseTime}ms</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-2xl font-bold text-gray-900">{healthStatus.metrics.uptime.toFixed(2)}%</p>
                </div>
                <Zap className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Database</p>
                  <p className="text-sm font-medium text-gray-900">{healthStatus.services.database.latency}ms</p>
                </div>
                <Database className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Edge Functions</p>
                  <p className="text-sm font-medium text-gray-900">{healthStatus.services.edgeFunctions.status}</p>
                </div>
                <Cloud className="h-8 w-8 text-indigo-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Service Status</h3>
              <div className="space-y-2">
                {Object.entries(healthStatus.services).map(([name, service]) => (
                  <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700 capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="flex items-center space-x-2">
                      {service.latency && (
                        <span className="text-xs text-gray-500">{service.latency}ms</span>
                      )}
                      {getStatusIcon(service.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Integration Status</h3>
              <div className="space-y-2">
                {integrations.length === 0 ? (
                  <p className="text-sm text-gray-500">No integrations configured</p>
                ) : (
                  integrations.map((integration, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm text-gray-700 font-medium">{integration.name}</span>
                        <p className="text-xs text-gray-500">{integration.syncCount} syncs</p>
                      </div>
                      {getStatusIcon(integration.status)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                <div className="flex items-center space-x-3">
                  {log.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    {log.error_message && (
                      <p className="text-xs text-red-600">{log.error_message}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
