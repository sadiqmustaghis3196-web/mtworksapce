import { supabase } from '../lib/supabase';

export interface OnboardingProgress {
  id: string;
  driver_id: string;
  user_id: string;
  organization_id: string;
  current_step: string;
  completion_percentage: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingModule {
  id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  content_type: 'video' | 'document' | 'quiz' | 'interactive';
  content_url: string | null;
  duration_minutes: number;
  is_required: boolean;
  passing_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingCompletion {
  id: string;
  driver_id: string;
  user_id: string;
  training_module_id: string;
  organization_id: string;
  completed_at: string;
  time_spent_minutes: number;
  quiz_score: number | null;
  status: 'completed' | 'in_progress' | 'failed';
  created_at: string;
}

export interface DocumentRequirement {
  id: string;
  organization_id: string | null;
  document_type: string;
  title: string;
  description: string | null;
  is_required: boolean;
  accepted_file_types: string[];
  max_file_size_mb: number;
  created_at: string;
  updated_at: string;
}

export interface DriverDocument {
  id: string;
  driver_id: string;
  user_id: string;
  document_requirement_id: string | null;
  organization_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  file_type: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleWithCompletion extends TrainingModule {
  completion?: TrainingCompletion;
}

export interface RequirementWithDocument extends DocumentRequirement {
  document?: DriverDocument;
}

// Get driver onboarding progress by driver ID
export async function getDriverOnboardingProgress(driverId: string): Promise<OnboardingProgress | null> {
  const { data, error } = await supabase
    .from('driver_onboarding_progress')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();
  return data;
}

// Get or create driver onboarding progress
export async function getOrCreateOnboardingProgress(
  userId: string,
  driverId: string,
  organizationId: string
): Promise<OnboardingProgress> {
  let progress = await getDriverOnboardingProgress(driverId);

  if (!progress) {
    const { data, error } = await supabase
      .from('driver_onboarding_progress')
      .insert({
        driver_id: driverId,
        organization_id: organizationId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    progress = data;
  }

  return progress;
}

// Update onboarding progress
export async function updateOnboardingProgress(
  driverId: string,
  updates: Partial<OnboardingProgress>
): Promise<OnboardingProgress> {
  const { data, error } = await supabase
    .from('driver_onboarding_progress')
    .update(updates)
    .eq('driver_id', driverId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get all training modules for organization
export async function getTrainingModules(organizationId: string | null): Promise<TrainingModule[]> {
  const { data, error } = await supabase
    .from('training_modules')
    .select('*')
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get training modules with completion status for a driver
export async function getTrainingModulesWithCompletion(
  userId: string,
  driverId: string,
  organizationId: string | null
): Promise<ModuleWithCompletion[]> {
  const modules = await getTrainingModules(organizationId);

  const { data: completions, error } = await supabase
    .from('driver_training_completions')
    .select('*')
    .eq('driver_id', driverId);

  if (error) throw error;

  const completionMap = new Map(
    (completions || []).map(c => [c.module_id, c])
  );

  return modules.map(module => ({
    ...module,
    completion: completionMap.get(module.id),
  }));
}

// Mark training module as complete
export async function completeTrainingModule(
  userId: string,
  driverId: string,
  trainingModuleId: string,
  organizationId: string,
  timeSpentMinutes: number,
  quizScore?: number
): Promise<TrainingCompletion> {
  const { data, error } = await supabase
    .from('driver_training_completions')
    .upsert({
      driver_id: driverId,
      module_id: trainingModuleId,
      organization_id: organizationId,
      score: quizScore,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }, { onConflict: 'driver_id,module_id' })
    .select()
    .single();

  if (error) throw error;

  // Recalculate progress
  await calculateAndUpdateProgress(userId, driverId, organizationId);

  return data;
}

// Get all document requirements
export async function getDocumentRequirements(organizationId: string | null): Promise<DocumentRequirement[]> {
  const { data, error } = await supabase
    .from('document_requirements')
    .select('*')
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Get document requirements with uploaded documents for a driver
export async function getDocumentRequirementsWithUploads(
  userId: string,
  driverId: string,
  organizationId: string | null
): Promise<RequirementWithDocument[]> {
  const requirements = await getDocumentRequirements(organizationId);

  const { data: documents, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId);

  if (error) throw error;

  const documentMap = new Map(
    (documents || []).map(d => [d.document_requirement_id, d])
  );

  return requirements.map(req => ({
    ...req,
    document: documentMap.get(req.id),
  }));
}

// Upload driver document
export async function uploadDriverDocument(
  file: File,
  userId: string,
  driverId: string,
  requirementId: string,
  organizationId: string
): Promise<DriverDocument> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${requirementId}/${Date.now()}.${fileExt}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('driver-documents')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: docData, error: docError } = await supabase
    .from('driver_documents')
    .insert({
      driver_id: driverId,
      document_requirement_id: requirementId,
      organization_id: organizationId,
      file_name: file.name,
      file_path: uploadData.path,
      file_size_bytes: file.size,
      file_type: file.type,
      status: 'uploaded', // Mapping backend enum 'uploaded'
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (docError) throw docError;

  // We map 'status' to 'approval_status' in the response to not break UI
  const mappedData = {
    ...docData,
    approval_status: 'pending'
  };

  // Recalculate progress
  await calculateAndUpdateProgress(userId, driverId, organizationId);

  return mappedData;
}

// Get driver documents
export async function getDriverDocuments(
  userId: string,
  driverId: string
): Promise<DriverDocument[]> {
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get document download URL
export async function getDocumentDownloadUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('driver-documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}

// Admin: Approve document
export async function approveDocument(documentId: string, reviewerId: string): Promise<DriverDocument> {
  const { data, error } = await supabase
    .from('driver_documents')
    .update({
      status: 'verified',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw error;

  // Recalculate progress for this driver
  if (data) {
    await calculateAndUpdateProgress(data.user_id, data.driver_id, data.organization_id);
  }

  return data;
}

// Admin: Reject document
export async function rejectDocument(
  documentId: string,
  reviewerId: string,
  reason: string
): Promise<DriverDocument> {
  const { data, error } = await supabase
    .from('driver_documents')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Admin: Get all drivers in onboarding
export async function getAllDriversInOnboarding(organizationId: string) {
  // WORKAROUND: Fetching data in separate queries to avoid "Relationship not found" schema cache errors
  const { data: progressData, error: progressError } = await supabase
    .from('driver_onboarding_progress')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (progressError) throw progressError;
  if (!progressData || progressData.length === 0) return [];

  // Fetch associated drivers
  const driverIds = progressData.map(p => p.driver_id).filter(Boolean);
  const { data: driversData, error: driversError } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, email, status')
    .in('id', driverIds);

  if (driversError) throw driversError;

  // Map drivers by ID for quick lookup
  const driversMap = new Map(driversData?.map(d => [d.id, d]));

  // Join data in JS to maintain expected structure
  return progressData.map(p => ({
    ...p,
    drivers: driversMap.get(p.driver_id)
  }));
}

// Admin: Get pending documents for review
export async function getPendingDocuments(organizationId: string) {
  // WORKAROUND: Fetching data in separate queries to avoid "Relationship not found" schema cache errors
  const { data: docsData, error: docsError } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'uploaded')
    .order('uploaded_at', { ascending: true });

  if (docsError) throw docsError;
  if (!docsData || docsData.length === 0) return [];

  // Fetch associated drivers and requirements
  const driverIds = Array.from(new Set(docsData.map(d => d.driver_id).filter(Boolean)));
  const reqIds = Array.from(new Set(docsData.map(d => d.document_requirement_id).filter(Boolean)));

  const [driversRes, reqsRes] = await Promise.all([
    supabase.from('drivers').select('id, first_name, last_name, email').in('id', driverIds),
    supabase.from('document_requirements').select('id, title, document_type').in('id', reqIds)
  ]);

  if (driversRes.error) throw driversRes.error;
  if (reqsRes.error) throw reqsRes.error;

  const driversMap = new Map(driversRes.data?.map(d => [d.id, d]));
  const reqsMap = new Map(reqsRes.data?.map(r => [r.id, r]));

  // Join data in JS to maintain expected structure
  return docsData.map(d => ({
    ...d,
    approval_status: d.status === 'uploaded' ? 'pending' : (d.status === 'verified' ? 'approved' : 'rejected'),
    drivers: driversMap.get(d.driver_id),
    document_requirements: reqsMap.get(d.document_requirement_id) // mapping column name to expectation
  }));
}

// Calculate and update onboarding progress
export async function calculateAndUpdateProgress(
  userId: string,
  driverId: string,
  organizationId: string
): Promise<void> {
  // Get required modules count and completed count
  const modules = await getTrainingModules(organizationId);
  const requiredModules = modules.filter(m => m.is_required);

  const { data: completions } = await supabase
    .from('driver_training_completions')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'completed'); // status for training completions is typically 'completed' not 'passed' based on earlier code

  const completedRequiredModules = requiredModules.filter(m =>
    completions?.some(c => c.module_id === m.id && c.status === 'completed')
  ).length;

  // Fetch current driver progress to check document statuses
  const { data: progress } = await supabase
    .from('driver_onboarding_progress')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  if (!progress) return;

  const docStatuses = [
    progress.cdl_status,
    progress.medical_status,
    progress.mvr_check_status,
    progress.drug_screen_status,
    progress.clearinghouse_status,
    progress.background_check_status,
    progress.employment_docs_status
  ];

  const allApproved = docStatuses.every(s => s === 'approved');
  const anySubmittedOrApproved = docStatuses.some(s => s === 'submitted' || s === 'approved' || s === 'verified');

  // Fetch current driver status to avoid downgrading an ACTIVE driver
  const { data: currentDriver } = await supabase
    .from('drivers')
    .select('onboarding_status')
    .eq('id', driverId)
    .single();

  if (currentDriver?.onboarding_status === 'active') {
    return; // Don't downgrade active drivers through auto-calculation
  }

  // Determine status
  let newStatus = 'invited';

  if (anySubmittedOrApproved) {
    newStatus = 'onboarding';
  }

  // If they have submitted all but not all are approved yet
  const allSubmittedOrApproved = docStatuses.every(s => s === 'submitted' || s === 'approved' || s === 'verified');
  if (allSubmittedOrApproved && !allApproved) {
    newStatus = 'under_review';
  }

  if (allApproved) {
    if (requiredModules.length > 0 && completedRequiredModules < requiredModules.length) {
      newStatus = 'training_required';
    } else {
      newStatus = 'final_review';
    }
  }

  // Update progress table (overall_status instead of status/completion_percentage)
  await supabase
    .from('driver_onboarding_progress')
    .update({ overall_status: newStatus })
    .eq('driver_id', driverId);

  // Sync to drivers table
  await supabase
    .from('drivers')
    .update({ onboarding_status: newStatus })
    .eq('id', driverId);
}

// Get driver ID for current user
export async function getDriverIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}


export const updateDriverOnboardingStatus = async (driverId: string, newStatus: 'not_started' | 'in_progress' | 'completed') => {
  const { data, error } = await supabase
    .from('driver_onboarding_progress')
    .update({ 
      status: newStatus,
      // Agar complete hua to 100%, agar start hua to 10%, nahi to waisa hi rakho
      completion_percentage: newStatus === 'completed' ? 100 : (newStatus === 'in_progress' ? 10 : 0),
      updated_at: new Date().toISOString()
    })
    .eq('driver_id', driverId)
    .select();

  if (error) throw error;
  return data;
};