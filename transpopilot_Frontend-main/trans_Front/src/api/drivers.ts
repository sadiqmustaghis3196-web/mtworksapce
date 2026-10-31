import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';
import { getUserOrganizationId, checkDriverLimit, getOrganizationTierLimits } from './organization';
import { handleSupabaseError } from '../lib/errorHandler'; // ✅ IMPORT ADDED


export interface Driver {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  license_number: string;
  license_expiry: string;
  hire_date: string;
  status: 'active' | 'training' | 'inactive';
  safety_score: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDriverInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  license_number: string;
  license_expiry: string;
  hire_date?: string;
  status?: 'active' | 'training' | 'inactive';
  safety_score?: number;
}

export interface UpdateDriverInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  license_number?: string;
  license_expiry?: string;
  hire_date?: string;
  status?: 'active' | 'training' | 'inactive';
  safety_score?: number;
}

import axios from 'axios';

// API_BASE_URL imported from config

async function getAuthHeaders() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return { Authorization: `Bearer ${token}` };
}

export const driverAPI = {
  async getAll(): Promise<Driver[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/admin/drivers`, { headers });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch drivers');
      }
      return response.data.data as Driver[];
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('not belong to an organization')) {
        return []; // Return empty if admin has no org
      }
      handleSupabaseError(error, 'load drivers');
      return [];
    }
  },

  async getById(id: string): Promise<Driver | null> {
    const orgId = await getUserOrganizationId();
    if (!orgId) throw new Error('No organization ID found');

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'load driver');
    return data;
  },

  // ✅ Fixed Create Function (Limit Removed + Number Conversion)
  async create(input: CreateDriverInput): Promise<Driver> {
    const orgId = await getUserOrganizationId();
    
    if (!orgId) {
      throw new Error('Action failed: No organization found.');
    }

    // ❌ Limit Check Hata diya (Bypass)
    // const canAddDriver = await checkDriverLimit(); 

    const formattedInput = {
      ...input,
      organization_id: orgId,
      status: input.status || 'active',
      safety_score: Number(input.safety_score || 100), // ✅ Safe Number Conversion
      license_expiry: input.license_expiry, 
      hire_date: input.hire_date
    };

    console.log("📤 Creating Driver:", formattedInput);

    const { data, error } = await supabase
      .from('drivers')
      .insert([formattedInput])
      .select()
      .single();

    if (error) {
      console.error('❌ Driver Create Error:', error);
      handleSupabaseError(error, 'create driver');
    }
    
    return data;
  },

  // ✅ Fixed Update Function (Safety Score Conversion Added)
  async update(id: string, input: UpdateDriverInput): Promise<Driver> {
    const orgId = await getUserOrganizationId();
    if (!orgId) throw new Error('No organization ID found');

    
    const formattedUpdate: any = {
        ...input,
        updated_at: new Date().toISOString(),
    };

    // Agar safety score update ho raha hai to number mein convert karein
    if (input.safety_score !== undefined) {
        formattedUpdate.safety_score = Number(input.safety_score);
    }

    const { data, error } = await supabase
      .from('drivers')
      .update(formattedUpdate)
        .eq('id', id)
        .eq('organization_id', orgId)
      .select()
      .single();

    if (error) handleSupabaseError(error, 'update driver');
    return data;
  },

  async delete(id: string): Promise<void> {
    const orgId = await getUserOrganizationId();
    if (!orgId) throw new Error('No organization ID found');

    const { error } = await supabase
      .from('drivers')
      .delete()
        .eq('id', id)
        .eq('organization_id', orgId);

    if (error) handleSupabaseError(error, 'delete driver');
  },

  async search(query: string): Promise<Driver[]> {
    const orgId = await getUserOrganizationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
        .eq('organization_id', orgId)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,license_number.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'search drivers');
    return data || [];
  },

  async filterByStatus(status: string): Promise<Driver[]> {
    const orgId = await getUserOrganizationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
        .eq('status', status)
        .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'filter drivers');
    return data || [];
  },

  async getExpiringLicenses(daysAhead: number = 30): Promise<Driver[]> {
    const orgId = await getUserOrganizationId();
    if (!orgId) return [];

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
        .eq('organization_id', orgId)
        .gte('license_expiry', today.toISOString().split('T')[0])
      .lte('license_expiry', futureDate.toISOString().split('T')[0])
      .order('license_expiry', { ascending: true });

    if (error) handleSupabaseError(error, 'load expiring licenses');
    return data || [];
  },
};
