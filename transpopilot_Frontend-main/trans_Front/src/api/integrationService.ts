import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';

export interface IntegrationConfig {
  provider_id: 'geotab' | 'samsara' | 'motive';
  username?: string;
  password?: string;
  database?: string;
  api_key?: string;
  apiKey?: string;
}

export const IntegrationService = {
  async getProviders() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) return [];
    const { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', sessionData.session.user.id).maybeSingle();
    if (!profile?.organization_id) return [];

    const { data } = await supabase.from('fleet_integrations').select('*').eq('organization_id', profile.organization_id);
    return [
      { id: 'geotab', name: 'geotab', connection_status: data?.find(p => p.provider_id === 'geotab')?.status || 'disconnected' },
      { id: 'samsara', name: 'samsara', connection_status: data?.find(p => p.provider_id === 'samsara')?.status || 'disconnected' },
      { id: 'motive', name: 'motive', connection_status: data?.find(p => p.provider_id === 'motive')?.status || 'disconnected' }
    ];
  },

  async saveCredentials(config: IntegrationConfig) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) throw new Error("User not logged in");
    
    const user = sessionData.session.user;
    const token = sessionData.session.access_token;

    const { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', user.id).maybeSingle();
    if (!profile?.organization_id) throw new Error("Organization ID missing");

    let endpoint = '';
    let body = {};

    if (config.provider_id === 'geotab') {
      endpoint = '/api/verify-geotab';
      body = {
        username: config.username,
        password: config.password,
        database: config.database,
        organizationId: profile.organization_id,
        userId: user.id
      };
    } 
    else if (config.provider_id === 'samsara') {
      endpoint = '/api/verify-samsara';
      body = {
        apiKey: config.api_key || config.apiKey,
        organizationId: profile.organization_id,
        userId: user.id
      };
    } 
    else if (config.provider_id === 'motive') {
      endpoint = '/api/verify-motive';
      body = {
        apiKey: config.api_key || config.apiKey,
        organizationId: profile.organization_id,
        userId: user.id
      };
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`🚀 Calling Backend Production (Verify): ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const textError = await response.text();
        console.error("Non-JSON Response received:", textError);
        throw new Error("Server returned HTML instead of JSON. Check your API_BASE_URL.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Integration Failed");
    }

    return result;
  },
  
  async testConnection(providerId: string, config: any) {
      try {
          const res = await this.saveCredentials({ provider_id: providerId as any, ...config });
          return { success: true, message: res.message };
      } catch (err: any) {
          return { success: false, message: err.message };
      }
  },

  async syncData(providerId: string) {
      console.log("Manual sync triggered for:", providerId);
      
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) throw new Error("User not logged in");
      const user = sessionData.session.user;
      const token = sessionData.session.access_token;

      const { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', user.id).maybeSingle();
      if (!profile?.organization_id) throw new Error("Organization ID missing");

      // We need the credentials for the sync endpoint, let's fetch them
      const { data: integration } = await supabase.from('fleet_integrations').select('credentials').eq('organization_id', profile.organization_id).eq('provider_id', providerId).maybeSingle();
      if (!integration || !integration.credentials) throw new Error("Credentials not found. Please save credentials first.");

      const endpoint = `/api/sync-${providerId}`;
      let body: any = { organizationId: profile.organization_id, userId: user.id };

      if (providerId === 'geotab') {
          body.username = integration.credentials.username;
          body.password = integration.credentials.password;
          body.database = integration.credentials.database;
      } else if (providerId === 'samsara' || providerId === 'motive') {
          body.apiKey = integration.credentials.apiKey || integration.credentials.api_key;
      }

      const fullUrl = `${API_BASE_URL}${endpoint}`;
      console.log(`🚀 Calling Backend Production (Sync): ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Sync Failed");
      }
      return result;
  },
  
  async getCredentials(providerId: string) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return null;
      
      const user = sessionData.session.user;
      const { data: profile } = await supabase.from('user_profiles').select('organization_id').eq('id', user.id).maybeSingle();
      if (!profile?.organization_id) return null;

      const { data } = await supabase
        .from('fleet_integrations')
        .select('credentials')
        .eq('organization_id', profile.organization_id)
        .eq('provider_id', providerId)
        .maybeSingle();
        
      if (data && data.credentials) {
         if (providerId === 'geotab') {
            return {
               username: data.credentials.username || '',
               database: data.credentials.database || '',
               password: ''
            };
         } else {
            return {
               api_key: data.credentials.apiKey || data.credentials.api_key || ''
            };
         }
      }
      return null; 
  }
};
