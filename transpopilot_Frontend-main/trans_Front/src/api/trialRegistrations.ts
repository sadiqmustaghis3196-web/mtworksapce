import { supabase } from '../lib/supabase';
import { TrialFormData } from '../components/TrialSignupModal';

export interface TrialRegistration {
  id: string;
  email: string;
  company_name: string;
  fleet_size: number | null;
  phone: string;
  status: 'pending' | 'contacted' | 'activated' | 'converted' | 'declined';
  created_at: string;
  updated_at: string;
}

export async function createTrialRegistration(data: TrialFormData): Promise<TrialRegistration> {
  const { data: registration, error } = await supabase
    .from('trial_registrations')
    .insert({
      email: data.email.toLowerCase().trim(),
      company_name: data.company_name.trim(),
      fleet_size: data.fleet_size,
      phone: data.phone.trim() || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This email is already registered. Please use a different email or contact support.');
    }
    console.error('Failed to create trial registration:', error);
    throw new Error('Failed to submit registration. Please try again.');
  }

  console.log('Trial registration created successfully:', registration);
  return registration;
}

export async function getTrialRegistrations(): Promise<TrialRegistration[]> {
  const { data, error } = await supabase
    .from('trial_registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch trial registrations:', error);
    throw new Error('Failed to fetch registrations');
  }

  return data || [];
}

export async function updateTrialRegistrationStatus(
  id: string,
  status: TrialRegistration['status']
): Promise<TrialRegistration> {
  const { data, error } = await supabase
    .from('trial_registrations')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update trial registration:', error);
    throw new Error('Failed to update registration');
  }

  return data;
}
