import { supabase } from '../lib/supabase';
import { getUserOrganizationId, checkVehicleLimit, getOrganizationTierLimits } from './organization';
import { handleSupabaseError } from '../lib/errorHandler';


export interface Vehicle {
  id: string;
  organization_id: string;
  vehicle_number: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  status: 'active' | 'maintenance' | 'inactive';
  current_mileage: number;
  fuel_capacity: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVehicleInput {
  vehicle_number: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  status?: 'active' | 'maintenance' | 'inactive';
  current_mileage?: number;
  fuel_capacity?: number;
}

export interface UpdateVehicleInput {
  vehicle_number?: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  status?: 'active' | 'maintenance' | 'inactive';
  current_mileage?: number;
  fuel_capacity?: number;
}

export const vehicleAPI = {
  async getAll(): Promise<Vehicle[]> {
    const { data: session } = await supabase.auth.getSession();
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/vehicles`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.session?.access_token}`
        }
      });
      const json = await response.json();
      if (json.success) return json.data || [];
      return [];
    } catch (err) {
      console.error("Failed to load vehicles from backend", err);
      return [];
    }
  },

  async getById(id: string): Promise<Vehicle | null> {
    const orgId = await getUserOrganizationId();
    if (!orgId) throw new Error('No organization ID found');

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'load vehicle');
    return data;
  },

  // 🛠️ Yahan Maine Changes Kiye Hain (Create Function)
async create(input: CreateVehicleInput): Promise<Vehicle> {
    const orgId = await getUserOrganizationId();
    console.log("🚀 Debug Org ID:", orgId);

    if (!orgId) throw new Error('No Organization Found');

    // ❌ Limit Check Hata Diya (Testing ke liye)
    // const canAddVehicle = await checkVehicleLimit(); ...

    console.log("📤 Sending Data:", input);

    const { data: session } = await supabase.auth.getSession();
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

    const response = await fetch(`${API_BASE_URL}/api/admin/vehicles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.session?.access_token}`
      },
      body: JSON.stringify(input)
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      console.error("❌ ASAL ERROR YAHAN HAI:", json.error || response.statusText);
      throw new Error(json.error || "Failed to create vehicle");
    }
    
    return json.data;
  },

  // 🛠️ Yahan Bhi Changes Kiye Hain (Update Function)
  async update(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const orgId = await getUserOrganizationId();
    if (!orgId) throw new Error('No organization ID found');

    
    // Update karte waqt bhi number conversion ka khayal rakhna chahiye
    const formattedUpdate: any = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    if (input.year !== undefined) formattedUpdate.year = Number(input.year);
    if (input.current_mileage !== undefined) formattedUpdate.current_mileage = Number(input.current_mileage);
    if (input.fuel_capacity !== undefined) formattedUpdate.fuel_capacity = Number(input.fuel_capacity);

    const { data, error } = await supabase
      .from('vehicles')
      .update(formattedUpdate)
        .eq('id', id)
        .eq('organization_id', orgId)
      .select()
      .single();

    if (error) handleSupabaseError(error, 'update vehicle');
    return data;
  },

  async delete(id: string): Promise<void> {
    const orgId = await getUserOrganizationId();
    if (!orgId) throw new Error('No organization ID found');

    const { error } = await supabase
      .from('vehicles')
      .delete()
        .eq('id', id)
        .eq('organization_id', orgId);

    if (error) handleSupabaseError(error, 'delete vehicle');
  },

  async search(query: string): Promise<Vehicle[]> {
    const orgId = await getUserOrganizationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
        .eq('organization_id', orgId)
        .or(`vehicle_number.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%,vin.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'search vehicles');
    return data || [];
  },

  async filterByStatus(status: string): Promise<Vehicle[]> {
    const orgId = await getUserOrganizationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
        .eq('status', status)
        .eq('organization_id', orgId)
      .limit(1000)
      .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'filter vehicles');
    return data || [];
  },
};