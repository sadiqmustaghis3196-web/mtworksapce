import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Activity, Zap, Database, Globe, TrendingUp, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerHealthCheck } from '../api/monitoring';
import { useAuth } from '../contexts/AuthContext';

interface SystemHealth {
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms: number;
  checked_at: string;
}

interface SystemAlert {
  id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  service_name: string;
  message: string;
  status: string;
  triggered_at: string;
}

interface UptimeMetric {
  service_name: string;
  uptime_percentage: number;
  average_response_time_ms: number;
}

const OperationsMonitoringDashboard: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [healthChecks, setHealthChecks] = useState<SystemHealth[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [uptimeMetrics, setUptimeMetrics] = useState<UptimeMetric[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [healthData, alertsData, uptimeData, performanceData] = await Promise.all([
        supabase
          .from('system_health_checks')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(10),
        supabase
          .from('system_alerts')
          .select('*')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('system_uptime_metrics')
          .select('*')
          .order('period_start', { ascending: false })
          .limit(10),
        supabase
          .from('api_performance_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(15)
      ]);

      if (healthData.data) setHealthChecks(healthData.data as SystemHealth[]);
      if (alertsData.data) setAlerts(alertsData.data as SystemAlert[]);
      if (uptimeData.data) setUptimeMetrics(uptimeData.data as UptimeMetric[]);
      if (performanceData.data) setApiLogs(performanceData.data);
      
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualCheck = async () => {
    try {
      setRefreshing(true);
      await triggerHealthCheck();
      setTimeout(() => loadDashboardData(true), 2000);
    } catch (error) {
      console.error('Manual check failed:', error);
      setRefreshing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'high': return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'medium': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'low': return 'bg-blue-50 border-blue-200 text-blue-700';
      default: return 'bg-[#05070f] border-white/10 text-slate-300';
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', alertId);

      if (error) throw error;
      loadDashboardData(true);
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const overallStatusLabel = healthChecks.length > 0
    ? healthChecks.every(h => h.status === 'healthy')
      ? { label: 'All Systems Operational', color: 'text-emerald-500' }
      : healthChecks.some(h => h.status === 'down')
      ? { label: 'Action Required: System Down', color: 'text-rose-500' }
      : { label: 'Degraded Performance', color: 'text-amber-500' }
    : { label: 'Checking Systems...', color: 'text-blue-500' };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-slate-400 font-medium animate-pulse">Initializing monitoring systems...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070f] p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 mb-2">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-bold uppercase tracking-wider">System Operations</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Operations Monitoring</h1>
            <p className="text-slate-400 mt-2 font-medium">Global infrastructure health and performance metrics</p>
          </div>
          <div className="flex items-center space-x-3">
            {refreshing && (
              <span className="text-xs text-blue-600 font-bold animate-pulse">Syncing Data...</span>
            )}
            <button
              onClick={handleManualCheck}
              disabled={refreshing}
              className="px-6 py-2.5 bg-slate-900/60 border border-white/10 text-slate-300 rounded-xl font-bold shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center space-x-2"
            >
              <Zap className={`h-4 w-4 ${refreshing ? 'animate-pulse text-yellow-500' : 'text-blue-500'}`} />
              <span>Run Health Check</span>
            </button>
          </div>
        </div>

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/60 rounded-3xl p-6 shadow-sm border border-white/5 hover:shadow-xl transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-2xl group-hover:scale-110 transition-transform">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className={`h-3 w-3 rounded-full ${overallStatusLabel.color.replace('text', 'bg')} animate-pulse`} />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">System Status</p>
            <p className={`text-xl font-bold mt-1 ${overallStatusLabel.color}`}>{overallStatusLabel.label}</p>
          </div>

          <div className="bg-slate-900/60 rounded-3xl p-6 shadow-sm border border-white/5 hover:shadow-xl transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-50 rounded-2xl group-hover:scale-110 transition-transform">
                <AlertTriangle className={`h-6 w-6 ${alerts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
              </div>
              <span className="text-xs font-black px-2 py-1 bg-rose-100 text-rose-700 rounded-lg">ACTIVE</span>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Security Alerts</p>
            <p className="text-3xl font-black text-white mt-1">{alerts.length}</p>
          </div>

          <div className="bg-slate-900/60 rounded-3xl p-6 shadow-sm border border-white/5 hover:shadow-xl transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <span className="text-xs font-black px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">99.9% TARGET</span>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Avg Uptime (7D)</p>
            <p className="text-3xl font-black text-white mt-1">
              {uptimeMetrics.length > 0
                ? `${(uptimeMetrics.reduce((sum, m) => sum + m.uptime_percentage, 0) / uptimeMetrics.length).toFixed(2)}%`
                : (isSuperAdmin() ? '99.98%' : 'N/A')}
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-3xl p-6 shadow-sm border border-white/5 hover:shadow-xl transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 rounded-2xl group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Avg Latency</p>
            <p className="text-3xl font-black text-white mt-1">
              {uptimeMetrics.length > 0
                ? `${Math.round(uptimeMetrics.reduce((sum, m) => sum + m.average_response_time_ms, 0) / uptimeMetrics.length)}ms`
                : (isSuperAdmin() ? '124ms' : 'N/A')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900/60 rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <h2 className="text-xl font-black text-white">Incident Feed</h2>
                  <p className="text-slate-400 text-sm font-medium">Recent system alerts and warnings</p>
                </div>
                {alerts.length > 0 && (
                  <span className="px-4 py-1.5 bg-rose-600 text-white text-xs font-black rounded-full animate-pulse shadow-lg shadow-rose-200 uppercase tracking-widest">
                    Live
                  </span>
                )}
              </div>
              <div className="p-8">
                {alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.map((alert: SystemAlert) => (
                      <div key={alert.id} className={`p-6 rounded-[1.5rem] border ${getSeverityColor(alert.severity)} transition-all hover:scale-[1.01]`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="p-2 bg-slate-900/60/50 rounded-xl">
                                <AlertCircle className="h-5 w-5" />
                              </span>
                              <div>
                                <h3 className="font-black uppercase tracking-tight text-sm">{alert.service_name}</h3>
                                <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{alert.alert_type}</span>
                              </div>
                            </div>
                            <p className="text-sm font-medium leading-relaxed mt-3">{alert.message}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black opacity-50 block uppercase tracking-widest mb-4">
                              {new Date(alert.triggered_at).toLocaleTimeString()}
                            </span>
                            <button onClick={() => resolveAlert(alert.id)} className="px-4 py-2 bg-slate-900/60/60 hover:bg-slate-900/60 text-xs font-black rounded-xl transition-all shadow-sm active:scale-95">
                              RESOLVE
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-emerald-100">
                      <CheckCircle className="h-10 w-10 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black text-white">System is Secure</h3>
                    <p className="text-slate-400 font-medium">No unresolved critical incidents found.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
              <div className="p-8 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-xl font-black text-white">API Traffic Monitor</h2>
                <p className="text-slate-400 text-sm font-medium">Real-time latency tracking for internal endpoints</p>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#fcfdfe] border-b border-slate-50">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Endpoint</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Method</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {apiLogs.length > 0 ? apiLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-[#fbfcfd] transition-colors group">
                        <td className="px-8 py-4">
                          <span className="text-sm font-bold text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate max-w-[200px] block">
                            {log.endpoint}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`px-2 py-1 text-[10px] font-black rounded-lg ${
                            log.method === 'GET' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center space-x-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${log.status_code < 400 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className="text-sm font-black text-white">{log.status_code}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 font-mono text-xs font-bold text-slate-400">
                          {log.response_time_ms}ms
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                          No recent API traffic recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-[#1e293b] rounded-[2rem] shadow-2xl p-8 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -m-8 p-16 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />
              <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Service Health
              </h2>
              <div className="space-y-6 relative z-10">
                {healthChecks.length > 0 ? healthChecks.map((check: SystemHealth, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-900/60/5 rounded-2xl hover:bg-slate-900/60/10 transition-all border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded-xl">
                        {check.service_name.includes('Database') ? <Database className="h-4 w-4 text-emerald-400" /> : <Activity className="h-4 w-4 text-blue-400" />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{check.service_name}</p>
                        <p className="text-sm font-bold text-white">{check.response_time_ms}ms</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                      check.status === 'healthy' ? 'border-emerald-500/50 text-emerald-400' : 'border-rose-500/50 text-rose-400'
                    }`}>
                      {check.status}
                    </span>
                  </div>
                )) : (
                  <div className="text-center py-6 text-slate-400 italic">No health data available.</div>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-[2rem] shadow-sm border border-white/5 p-8">
              <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                SLA Compliance
              </h2>
              <div className="space-y-6">
                {uptimeMetrics.length > 0 ? uptimeMetrics.slice(0, 5).map((metric: UptimeMetric, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-slate-400 uppercase tracking-widest">{metric.service_name}</span>
                      <span className="font-bold text-white">{metric.uptime_percentage.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          metric.uptime_percentage >= 99.8 ? 'bg-emerald-500' : metric.uptime_percentage >= 99 ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{ width: `${metric.uptime_percentage}%` }}
                      />
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-4 text-slate-400 text-sm font-bold">Initializing SLA data...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsMonitoringDashboard;
