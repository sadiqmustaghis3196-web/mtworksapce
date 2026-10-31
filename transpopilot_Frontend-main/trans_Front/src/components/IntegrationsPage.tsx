import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Settings,
  RefreshCw,
  Activity,
  Clock,
  Database,
  Save,
  TestTube,
  AlertTriangle,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { IntegrationService } from '../api/integrationService';
import { useAuth } from '../contexts/AuthContext';
import { IntegrationProvider } from '../types/tracking';
import { API_BASE_URL } from '../lib/apiConfig';

const IntegrationsPage: React.FC = () => {
  // ✅ FIX: 'profile' ko destructure kiya taake Organization ID mile
  const { isAdmin, user, profile, session } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'geotab' | 'samsara' | 'motive'>('geotab');
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  
  // Credentials State
  const [geotabConfig, setGeotabConfig] = useState({ username: '', password: '', database: '' });
  const [apiKeyConfig, setApiKeyConfig] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // API_BASE_URL imported from config
  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    loadCredentials(activeTab);
    setMessage(null);
  }, [activeTab]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await IntegrationService.getProviders();
      setProviders(data as any);
    } catch (err) {
      console.error("Failed to load providers", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCredentials = async (providerId: string) => {
    try {
      const creds = await IntegrationService.getCredentials(providerId);
      if (creds) {
        if (providerId === 'geotab') {
          setGeotabConfig({
            username: creds.username || '',
            password: creds.password || '',
            database: creds.database || ''
          });
        } else {
          setApiKeyConfig(creds.api_key || '');
        }
      } else {
        // Reset forms if no creds found
        setGeotabConfig({ username: '', password: '', database: '' });
        setApiKeyConfig('');
      }
    } catch (err) {
      console.error("Error loading credentials", err);
    }
  };

  const handleSave = async () => {
    // ✅ FIX: User ko rokein agar Org ID nahi mili
    if (!profile?.organization_id) {
      setMessage({ type: 'error', text: 'Organization ID missing. Please log in again.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    
    // Check if this provider is already connected BEFORE we save
    const currentProviderStatus = providers.find(p => (p.id === activeTab || p.name?.toLowerCase() === activeTab))?.connection_status;
    
    try {
      const config: any = { 
        provider_id: activeTab,
        organizationId: profile.organization_id, // ✅ Correct ID usage
        userId: user?.id 
      };
      
      if (activeTab === 'geotab') {
        config.username = geotabConfig.username.trim();
        config.password = geotabConfig.password;
        config.database = geotabConfig.database.trim();
      } else {
        // Samsara/Motive ke liye API Key
        config.apiKey = apiKeyConfig.trim();
      }

      // 1. Credentials DB mein save karein
      const data = await IntegrationService.saveCredentials(config);
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: data.message || "Credentials successfully saved and verified."
        });
        
        await loadProviders();
      } else {
        throw new Error(data.error || 'Credentials saved but sync failed.');
      }

    } catch (err: any) {
      console.error("Save/Sync Error:", err);
      setMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const payload: any = activeTab === 'geotab' 
        ? { ...geotabConfig, username: geotabConfig.username.trim(), database: geotabConfig.database.trim(), organizationId: profile?.organization_id } 
        : { apiKey: apiKeyConfig.trim(), organizationId: profile?.organization_id };

      const res = await IntegrationService.testConnection(activeTab, payload);
      setMessage({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Connection Test Failed: Service unreachable.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    if (!profile?.organization_id) return;
    setSyncing(true);
    setMessage(null); // Clear previous messages
    
    try {
      const data = await IntegrationService.syncData(activeTab);

      if (data.success) {
        const parseStats = (category: any) => {
          if (!category) return { processed: 0, new: 0, updated: 0, skipped: 0, failed: 0 };
          const ins = category.inserted || 0;
          const upd = category.updated || 0;
          const skp = category.skipped || 0;
          const fail = category.failed || 0;
          return { processed: ins + upd + skp, new: ins, updated: upd, skipped: skp, failed: fail };
        };

        const v = parseStats(data.vehicles);
        const d = parseStats(data.drivers);
        
        setMessage({ 
          type: 'success', 
          text: `Manual Sync: ${v.processed} vehicles and ${d.processed} drivers updated.` 
        });
        await loadProviders();
      } else {
        throw new Error(data.error || 'Sync failed.');
      }

    } catch (e: any) {
      console.error("Manual sync failed", e);
      setMessage({ type: 'error', text: e.message || 'Manual sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-12 text-center">
          <ShieldAlert className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Admin Access Required</h2>
          <p className="text-red-700">You need administrator privileges to access Fleet Integrations.</p>
        </div>
      </div>
    );
  }

  const currentProvider = providers.find(p => p.id === activeTab || p.name === activeTab);
  const isConnected = currentProvider?.connection_status === 'connected';
  const isAuthFailed = currentProvider?.connection_status === 'auth_failed';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Integrations</h1>
          <p className="text-gray-600">Connect Geotab, Samsara, or Motive to sync vehicles & drivers</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 p-2 flex space-x-2">
          {['geotab', 'samsara', 'motive'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all capitalize ${
                activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab}</span>
              {providers.find(p => p.id === tab)?.connection_status === 'connected' && (
                <CheckCircle className="h-4 w-4 text-green-300 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 flex items-start space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              {activeTab === 'geotab' ? <Database className="h-8 w-8 text-blue-600" /> : <Activity className="h-8 w-8 text-blue-600" />}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 capitalize">{activeTab} Integration</h3>
              <p className="text-gray-700 mb-2">
                {activeTab === 'geotab' && 'Sync vehicles, drivers, and fuel data directly from your Geotab database.'}
                {activeTab === 'samsara' && 'Real-time API connection for Samsara fleet management gateways.'}
                {activeTab === 'motive' && 'Connect Motive (KeepTruckin) ELD data for compliance.'}
              </p>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1 text-sm font-bold ${isConnected ? 'text-green-600' : isAuthFailed ? 'text-red-600' : 'text-gray-500'}`}>
                  {isConnected ? <CheckCircle size={16}/> : isAuthFailed ? <AlertTriangle size={16}/> : <XCircle size={16}/>}
                  {isConnected ? 'Connected' : isAuthFailed ? 'Auth Failed' : 'Not Connected'}
                </span>
                {isAuthFailed ? (
                    <span className="text-xs text-red-500 flex items-center gap-1 font-medium bg-red-50 px-2 py-1 rounded border border-red-100">
                        <AlertTriangle size={12}/> Sync failed — please re-check credentials
                    </span>
                ) : currentProvider?.last_sync_at && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 font-medium bg-gray-50 px-2 py-1 rounded">
                        <Clock size={12}/> 
                        Last synced: {
                          (() => {
                            const diffMs = Date.now() - new Date(currentProvider.last_sync_at).getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            if (diffMins < 1) return 'Just now';
                            if (diffMins < 60) return `${diffMins} minutes ago`;
                            const diffHrs = Math.floor(diffMins / 60);
                            if (diffHrs < 24) return `${diffHrs} hours ago`;
                            return `${Math.floor(diffHrs / 24)} days ago`;
                          })()
                        }
                    </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings size={18} className="text-gray-400"/> Configuration
            </h3>

            {message && (
              <div className={`p-4 mb-4 rounded-lg flex items-center gap-2 whitespace-pre-wrap ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.type === 'success' ? <CheckCircle size={18} className="mt-1 self-start shrink-0"/> : <AlertTriangle size={18} className="mt-1 self-start shrink-0"/>}
                <div className="text-sm font-medium">{message.text}</div>
              </div>
            )}

            {activeTab === 'geotab' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username (Email)</label>
                  <input
                    type="text"
                    value={geotabConfig.username}
                    onChange={(e) => setGeotabConfig({ ...geotabConfig, username: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={geotabConfig.password}
                    onChange={(e) => setGeotabConfig({ ...geotabConfig, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
                  <input
                    type="text"
                    value={geotabConfig.database}
                    onChange={(e) => setGeotabConfig({ ...geotabConfig, database: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="G560..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Token / Key</label>
                  <input
                    type="password"
                    value={apiKeyConfig}
                    onChange={(e) => setApiKeyConfig(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={`Paste your ${activeTab} API key here`}
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <button
                onClick={handleTest}
                disabled={testing || saving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {testing ? <Loader2 className="animate-spin" size={18}/> : <TestTube size={18}/>}
                Test Connection
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving || testing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                Save & Sync
              </button>
            </div>
            
            {isConnected && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                 <button 
                   onClick={handleSync}
                   disabled={syncing}
                   className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1 mx-auto"
                 >
                   <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> 
                   {syncing ? 'Syncing Data...' : 'Trigger Manual Data Sync'}
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;