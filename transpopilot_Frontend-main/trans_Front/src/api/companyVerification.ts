import { supabase } from '../lib/supabase';

export interface CompanyVerification {
  id: string;
  organization_id: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  legal_name: string;
  business_type: string;
  tax_id: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_id: string | null;
  rejection_reason: string | null;
}

export const getCompanyVerification = async (orgId: string): Promise<CompanyVerification | null> => {
  const { data, error } = await supabase
    .from('company_verifications')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
};

export const submitCompanyVerification = async (orgId: string, legalName: string, businessType: string, taxId: string) => {
  const { error } = await supabase
    .from('company_verifications')
    .upsert({
      organization_id: orgId,
      status: 'PENDING',
      legal_name: legalName,
      business_type: businessType,
      tax_id: taxId,
      submitted_at: new Date().toISOString(),
      rejection_reason: null
    }, { onConflict: 'organization_id' });

  if (error) throw error;
};

export const updateCompanyVerificationStatus = async (orgId: string, status: string, rejectionReason: string | null = null, reviewerId: string) => {
  const { error } = await supabase
    .from('company_verifications')
    .update({
      status,
      rejection_reason: rejectionReason,
      reviewed_at: new Date().toISOString(),
      reviewer_id: reviewerId
    })
    .eq('organization_id', orgId);

  if (error) throw error;
};
