import axios from 'axios';
import { supabase } from '../lib/supabase';

import { API_BASE_URL } from '../lib/apiConfig';

async function getAuthHeaders() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return { Authorization: `Bearer ${token}` };
}

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  organization_id: string;
  created_at: string;
  last_login_at: string | null;
  // Enriched fields
  driver_status: string | null;
  driver_id: string | null;
  driver_onboarding_status: string | null;
  driver_employee_type: string | null;
  driver_created_at: string | null;
  invitation_status: string | null;
  invitation_id: string | null;
  invitation_created_at: string | null;
}

export interface MakeDriverResult {
  driver: {
    id: string;
    user_id: string;
    organization_id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: string;
    onboarding_status: string;
    employee_type: string;
    created_at: string;
  };
  message: string;
}

// ─────────────────────────────────────────────────
// GET /api/admin/users
// ─────────────────────────────────────────────────
export async function getOrganizationUsers(): Promise<OrgUser[]> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_BASE_URL}/api/admin/users`, { headers });
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch users');
  }
  return response.data.data as OrgUser[];
}

// ─────────────────────────────────────────────────
// POST /api/admin/users/:userId/make-driver
// ─────────────────────────────────────────────────
export async function makeDriver(userId: string): Promise<MakeDriverResult> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/users/${userId}/make-driver`,
    {},
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to promote user to driver');
  }
  return response.data.data as MakeDriverResult;
}

// ─────────────────────────────────────────────────
// POST /api/admin/drivers/:driverId/activate
// ─────────────────────────────────────────────────
export async function activateDriver(driverId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/drivers/${driverId}/activate`,
    {},
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to activate driver');
  }
}

// ─────────────────────────────────────────────────
// POST /api/admin/drivers/:driverId/deactivate
// ─────────────────────────────────────────────────
export async function deactivateDriver(driverId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/drivers/${driverId}/deactivate`,
    {},
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to deactivate driver');
  }
}

// ─────────────────────────────────────────────────
// POST /api/admin/drivers/:driverId/assign-vehicle
// ─────────────────────────────────────────────────
export async function assignVehicleToDriver(
  driverId: string,
  vehicleId: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/drivers/${driverId}/assign-vehicle`,
    { vehicle_id: vehicleId },
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to assign vehicle');
  }
}

// ─────────────────────────────────────────────────
// POST /api/admin/drivers/:driverId/unassign-vehicle
// ─────────────────────────────────────────────────
export async function unassignVehicleFromDriver(driverId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/drivers/${driverId}/unassign-vehicle`,
    {},
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to unassign vehicle');
  }
}

// ─────────────────────────────────────────────────
// POST /api/admin/users/invite
// ─────────────────────────────────────────────────
export async function inviteTeamMember(email: string, role: string): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/users/invite`,
    { email, role },
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to invite team member');
  }
  return response.data;
}

// ─────────────────────────────────────────────────
// GET /api/admin/users/invite/:id/token
// ─────────────────────────────────────────────────
export async function getInviteToken(inviteId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await axios.get(
    `${API_BASE_URL}/api/admin/users/invite/${inviteId}/token`,
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get invite token');
  }
  return response.data.data.token;
}

// ─────────────────────────────────────────────────
// POST /api/admin/users/invitations/:invitationId/resend
// ─────────────────────────────────────────────────
export async function resendTeamMemberInvite(invitationId: string): Promise<{
  success: boolean;
  emailSent: boolean;
  warning?: string;
  error?: string;
  message?: string;
}> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${API_BASE_URL}/api/admin/users/invitations/${invitationId}/resend`,
    {},
    { headers }
  );
  return response.data;
}

