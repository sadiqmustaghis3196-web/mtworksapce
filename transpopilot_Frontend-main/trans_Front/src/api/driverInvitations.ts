import { supabase } from '../lib/supabase';
import axios from 'axios';

import { API_BASE_URL } from '../lib/apiConfig';

export interface DriverInvitation {
  id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_type: 'employee' | 'contractor';
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expires_at: string;
  created_at: string;
}

export const inviteDriver = async (
  orgId: string, 
  email: string, 
  firstName: string, 
  lastName: string, 
  employeeType: 'employee' | 'contractor', 
  createdBy: string
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await axios.post(`${API_BASE_URL}/api/invitations/send`, {
    organization_id: orgId,
    email,
    first_name: firstName,
    last_name: lastName,
    employee_type: employeeType,
    created_by: createdBy
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to send invitation');
  }

  return response.data.data;
};

export const resendInvitation = async (
  invitationId: string,
  orgId: string,
  actorId: string
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await axios.post(`${API_BASE_URL}/api/invitations/resend`, {
    invitation_id: invitationId,
    organization_id: orgId,
    actor_id: actorId
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to resend invitation');
  }

  return response.data.data;
};

export const getDriverInvitations = async (orgId: string): Promise<DriverInvitation[]> => {
  const { data, error } = await supabase
    .from('driver_invitations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const cancelInvitation = async (id: string) => {
  const { error } = await supabase
    .from('driver_invitations')
    .update({ status: 'CANCELLED' })
    .eq('id', id);

  if (error) throw error;
};

export const validateInvitationToken = async (token: string): Promise<DriverInvitation | null> => {
  const response = await axios.post(`${API_BASE_URL}/api/invitations/validate`, { token });
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Invalid invitation');
  }
  
  return response.data.data;
};

export const acceptInvitation = async (token: string, authUserId: string) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const authToken = sessionData.session?.access_token;

  const response = await axios.post(`${API_BASE_URL}/api/invitations/accept`, {
    token,
    authUserId
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to accept invitation');
  }

  return response.data.data;
};
