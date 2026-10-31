import { supabase } from '../lib/supabase';
import { getUserOrganizationId } from './organization';
import { API_BASE_URL } from '../lib/apiConfig';

export interface MaintenanceRecord {
  id: string;
  organization_id: string;
  vehicle_id: string;
  service_type: string;
  service_date: string;
  odometer?: number;
  engine_hours?: number;
  vendor?: string;
  description?: string;
  parts_repair_notes?: string;
  labor_cost?: number;
  parts_cost?: number;
  total_cost?: number;
  receipt_url?: string;
  technician?: string;
  next_service_due_date?: string;
  next_service_due_mileage?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  data_source: string;
  provider?: string;
  external_record_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type CreateMaintenanceInput = Omit<MaintenanceRecord, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;

export async function createMaintenanceRecord(input: CreateMaintenanceInput): Promise<MaintenanceRecord> {
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(`${API_BASE_URL}/api/admin/maintenance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.session?.access_token}`
    },
    body: JSON.stringify(input)
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    console.error("Backend returned error:", json.error || response.statusText);
    throw new Error(json.error || "Failed to create maintenance record");
  }
  
  return json.data;
}

export async function getMaintenanceRecords(vehicleId?: string): Promise<MaintenanceRecord[]> {
  const { data: session } = await supabase.auth.getSession();
  const url = new URL(`${API_BASE_URL}/api/admin/maintenance`);
  if (vehicleId) url.searchParams.append('vehicleId', vehicleId);
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${session.session?.access_token}`
    }
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data || [];
}

export async function getUpcomingMaintenance(): Promise<MaintenanceRecord[]> {
  const { data: session } = await supabase.auth.getSession();
  const url = new URL(`${API_BASE_URL}/api/admin/maintenance`);
  url.searchParams.append('upcoming', 'true');
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${session.session?.access_token}`
    }
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data || [];
}

export async function uploadMaintenanceReceipt(recordId: string, file: File): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('receipt', file);

  const res = await fetch(`${API_BASE_URL}/api/maintenance/records/${recordId}/receipt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`,
    },
    body: formData
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.path;
}

export async function getMaintenanceReceiptUrl(recordId: string): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/api/maintenance/records/${recordId}/receipt`, {
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`
    }
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.signedUrl;
}

export async function extractMaintenanceReceipt(file: File): Promise<any> {
  const { data: session } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('receipt', file);

  const res = await fetch(`${API_BASE_URL}/api/maintenance/extract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`,
    },
    body: formData
  });
  
  if (!res.ok) {
    if (res.status === 503) return null;
    throw new Error('Extraction failed');
  }
  
  const json = await res.json();
  if (!json.success) return null;
  return json.extraction;
}
