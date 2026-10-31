import axios from 'axios';
import { IntegrationProvider, IntegrationCredentials, IntegrationSyncLog } from '../types/tracking';

// --- Local Storage Keys (Database ki jagah browser memory) ---
const STORAGE_KEY_CREDS = 'fleet_integration_creds';
const STORAGE_KEY_LOGS = 'fleet_integration_logs';

// --- 1. SAMSARA API LOGIC ---
const fetchSamsaraData = async (apiKey: string, endpoint: string) => {
  try {
    const response = await axios.get(`https://api.samsara.com/fleet/${endpoint}`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    return response.data.data;
  } catch (error) {
    console.error("Samsara API Error:", error);
    throw new Error("Samsara connection failed. Check API Key or CORS extension.");
  }
};

// --- 2. MOTIVE (KEEPTRUCKIN) API LOGIC ---
const fetchMotiveData = async (apiKey: string, endpoint: string) => {
  try {
    const response = await axios.get(`https://api.keeptruckin.com/v1/${endpoint}`, {
      headers: { 
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      }
    });
    return response.data[endpoint] || response.data;
  } catch (error) {
    console.error("Motive API Error:", error);
    throw new Error("Motive connection failed. Check API Key or CORS extension.");
  }
};

// --- 3. GEOTAB API LOGIC ---
const fetchGeotabData = async (creds: any, typeName: string) => {
  try {
    // Authenticate
    const authResponse = await axios.post('https://my.geotab.com/apiv1', {
      method: "Authenticate",
      params: {
        userName: creds.username,
        password: creds.api_secret, 
        database: creds.database_name
      }
    });

    if (authResponse.data.error) throw new Error(authResponse.data.error.message);

    const result = authResponse.data.result;
    const credentials = result.credentials;
    const path = result.path === "ThisServer" ? "my.geotab.com" : result.path;

    // Fetch Data
    const dataResponse = await axios.post(`https://${path}/apiv1`, {
      method: "Get",
      params: {
        typeName: typeName,
        credentials: credentials,
        resultsLimit: 100
      }
    });

    if (dataResponse.data.error) throw new Error(dataResponse.data.error.message);
    
    return dataResponse.data.result;
  } catch (error: any) {
    console.error("Geotab API Error:", error);
    throw new Error(error.message || "Geotab connection failed.");
  }
};

// --- EXPORTED FUNCTIONS (UI ke liye zaroori) ---

export const getIntegrationProviders = async (): Promise<IntegrationProvider[]> => {
  return [
    { id: '1', name: 'geotab', display_name: 'Geotab', connection_status: 'disconnected', is_enabled: true, created_at: '', updated_at: '' },
    { id: '2', name: 'samsara', display_name: 'Samsara', connection_status: 'disconnected', is_enabled: true, created_at: '', updated_at: '' },
    { id: '3', name: 'motive', display_name: 'Motive', connection_status: 'disconnected', is_enabled: true, created_at: '', updated_at: '' },
  ];
};

export const getIntegrationCredentials = async (providerId: string): Promise<IntegrationCredentials | null> => {
  const allCreds = JSON.parse(localStorage.getItem(STORAGE_KEY_CREDS) || '{}');
  return allCreds[providerId] || null;
};

export const upsertIntegrationCredentials = async (data: Partial<IntegrationCredentials>): Promise<void> => {
  const allCreds = JSON.parse(localStorage.getItem(STORAGE_KEY_CREDS) || '{}');
  if (data.provider_id) {
    allCreds[data.provider_id] = { ...data, updated_at: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify(allCreds));
  }
};

// **TEST CONNECTION FUNCTION**
export const testIntegrationConnection = async (
  providerName: string, 
  credentials: any
): Promise<{ success: boolean; message: string }> => {
  try {
    if (providerName === 'samsara') {
      const data = await fetchSamsaraData(credentials.api_key, 'vehicles');
      if (Array.isArray(data)) return { success: true, message: `Connected! Found ${data.length} vehicles.` };
    }
    
    if (providerName === 'motive') {
      const data = await fetchMotiveData(credentials.api_key, 'vehicles');
      if (Array.isArray(data)) return { success: true, message: `Connected! Found ${data.length} vehicles.` };
    }

    if (providerName === 'geotab') {
      const data = await fetchGeotabData(credentials, 'Device');
      if (Array.isArray(data)) return { success: true, message: `Connected! Found ${data.length} devices.` };
    }

    return { success: false, message: "Unknown provider or no data returned" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// **TRIGGER SYNC FUNCTION** (Real Data Fetching)
export const triggerSync = async (providerId: string, syncType: string): Promise<void> => {
  const allCreds = JSON.parse(localStorage.getItem(STORAGE_KEY_CREDS) || '{}');
  const credentials = allCreds[providerId];
  
  let providerName = '';
  if (providerId === '1') providerName = 'geotab';
  if (providerId === '2') providerName = 'samsara';
  if (providerId === '3') providerName = 'motive';

  if (!credentials) throw new Error("No credentials found");

  let fetchedCount = 0;
  let status: 'success' | 'failed' = 'success';
  let errorMsg = '';

  try {
    let data = [];

    if (providerName === 'samsara') {
      if (syncType === 'drivers') data = await fetchSamsaraData(credentials.api_key, 'drivers');
      else data = await fetchSamsaraData(credentials.api_key, 'vehicles');
    } 
    else if (providerName === 'motive') {
      if (syncType === 'drivers') data = await fetchMotiveData(credentials.api_key, 'users');
      else data = await fetchMotiveData(credentials.api_key, 'vehicles');
    }
    else if (providerName === 'geotab') {
      if (syncType === 'drivers') data = await fetchGeotabData(credentials, 'User');
      else data = await fetchGeotabData(credentials, 'Device');
    }

    fetchedCount = Array.isArray(data) ? data.length : 0;
    console.log(`Synced ${fetchedCount} records from ${providerName}`);

  } catch (err: any) {
    status = 'failed';
    errorMsg = err.message;
    console.error("Sync Error:", err);
  }

  // Log Update
  const newLog: IntegrationSyncLog = {
    id: Date.now().toString(),
    provider_id: providerId,
    sync_type: syncType as any,
    status: status,
    started_at: new Date().toISOString(),
    records_processed: fetchedCount,
    records_success: fetchedCount,
    records_failed: status === 'failed' ? 1 : 0,
    error_message: errorMsg,
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  const logs = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]');
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify([newLog, ...logs]));
};

export const getIntegrationSyncLogs = async (providerId: string, limit: number): Promise<IntegrationSyncLog[]> => {
  const logs = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]');
  return logs.filter((l: any) => l.provider_id === providerId).slice(0, limit);
};

export const updateIntegrationProvider = async () => {};
export const activateMonitoring = async () => {};