import React, { useState, useEffect } from 'react'; // HMR trigger
import { CheckCircle, Clock, AlertCircle, FileText, Upload, ArrowLeft, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { calculateAndUpdateProgress } from '../api/driverOnboarding';
import { API_BASE_URL } from '../lib/apiConfig';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import SignaturePad from './SignaturePad';

interface DriverSelfOnboardingProps {
  onNavigate?: (tab: string) => void;
}

const DriverSelfOnboarding: React.FC<DriverSelfOnboardingProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [trainingCompletions, setTrainingCompletions] = useState<any[]>([]);

  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);

  // CDL form state
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [licenseClass, setLicenseClass] = useState('A');
  const [endorsements, setEndorsements] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);

  // Medical form state
  const [medicalType, setMedicalType] = useState('upload');
  const [medicalCardImage, setMedicalCardImage] = useState<File | null>(null);

  // Consent form state
  const [signatureData, setSignatureData] = useState('');

  // Employment Docs form state
  const [empDoc1, setEmpDoc1] = useState<File | null>(null);
  const [empDoc2, setEmpDoc2] = useState<File | null>(null);

  const handleFrontImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFrontImage(file);
    if (!file) return;

    try {
      setOcrScanning(true);
      setError('');
      
      const formData = new FormData();
      formData.append('front_image', file);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/driver/onboarding/cdl/ocr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      
      if (result.data) {
        if (result.data.license_number) setLicenseNumber(result.data.license_number);
        if (result.data.state) setLicenseState(result.data.state);
        // Note: Tesseract might return poorly formatted dates, but we try to set it if possible
        if (result.data.expiration_date) {
           // Basic attempt to format to YYYY-MM-DD for date input
           const match = result.data.expiration_date.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
           if (match) setExpiryDate(`${match[3]}-${match[1]}-${match[2]}`);
        }
        if (result.data.endorsements) setEndorsements(result.data.endorsements);
      }
    } catch (err: any) {
      console.error("OCR Error:", err);
      // Don't block the user from manually entering data if OCR fails
    } finally {
      setOcrScanning(false);
    }
  };

  useEffect(() => {
    if (profile === undefined) return; // still loading auth context
    if (!profile?.organization_id) {
      setLoading(false);
      setError('Your account is not linked to an organization.');
      return;
    }
    if (user?.id) {
      loadData();
    }
  }, [user?.id, profile?.organization_id, profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const res = await fetch(`${API_BASE_URL}/api/driver/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch driver data");
      }
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (!result.data.driver) {
        setError('Driver profile not found. Please contact your company administrator.');
        return;
      }
      
      setDriverInfo(result.data.driver);
      setProgress(result.data.onboarding || {});
      setDocuments(result.data.documents || []);
      setTrainingCompletions(result.data.trainingCompletions || []);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  };

  const handleCdlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontImage || !backImage) {
      setError("Front and back images are required.");
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      
      const formData = new FormData();
      formData.append('license_number', licenseNumber);
      formData.append('state', licenseState);
      formData.append('license_class', licenseClass);
      formData.append('endorsements', endorsements);
      formData.append('issue_date', issueDate);
      formData.append('expiry_date', expiryDate);
      formData.append('front_image', frontImage);
      formData.append('back_image', backImage);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/driver/onboarding/cdl`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (user?.id && driverInfo?.id) {
        await calculateAndUpdateProgress(user.id, driverInfo.id, driverInfo.organization_id);
      }

      setActiveStep(null);
      loadData(); // Reload progress
    } catch (err: any) {
      setError(err.message || "Failed to upload CDL");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMedicalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (medicalType === 'upload' && !medicalCardImage) {
      setError("Please upload your medical card.");
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      formData.append('type', medicalType);
      if (medicalCardImage) formData.append('medical_card', medicalCardImage);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/driver/onboarding/medical`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (user?.id && driverInfo?.id) {
        await calculateAndUpdateProgress(user.id, driverInfo.id, driverInfo.organization_id);
      }

      setActiveStep(null);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit medical qualification");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsentSubmit = async (e: React.FormEvent, stepId: string) => {
    e.preventDefault();
    if (!signatureData) {
      setError("Signature is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/driver/onboarding/consent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ stepId, signature: signatureData })
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (user?.id && driverInfo?.id) {
        await calculateAndUpdateProgress(user.id, driverInfo.id, driverInfo.organization_id);
      }

      setSignatureData(''); // Reset for next
      setActiveStep(null);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit consent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmploymentDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empDoc1) {
      setError("Please upload the required document.");
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      formData.append('doc1', empDoc1);
      if (empDoc2) formData.append('doc2', empDoc2);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/driver/onboarding/employment-docs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (user?.id && driverInfo?.id) {
        await calculateAndUpdateProgress(user.id, driverInfo.id, driverInfo.organization_id);
      }

      setActiveStep(null);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit documents");
    } finally {
      setSubmitting(false);
    }
  };

  const calculateCompletion = () => {
    if (!progress) return 0;
    const required = ['cdl_status', 'medical_status', 'mvr_check_status', 'drug_screen_status', 'clearinghouse_status', 'background_check_status'];
    let completed = 0;
    required.forEach(req => {
      if (progress[req] === 'completed' || progress[req] === 'approved') completed++;
    });
    return Math.round((completed / required.length) * 100);
  };

  const getComputedStatus = () => {
    if (!progress) return { label: 'Loading...', color: 'bg-brand-bg-secondary text-brand-muted border border-brand-border' };

    const statuses = [
      progress.cdl_status,
      progress.medical_status,
      progress.mvr_check_status,
      progress.drug_screen_status,
      progress.clearinghouse_status,
      progress.background_check_status,
      progress.employment_docs_status
    ];

    if (statuses.includes('rejected')) {
      return { label: 'Action Required', color: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    }

    if (statuses.some(s => s === 'not_started' || s === 'pending')) {
      return { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
    }

    if (statuses.some(s => s === 'submitted' || s === 'under_review')) {
      return { label: 'Under Review', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    }

    if (progress.overall_status === 'approved') {
      return { label: 'Active', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    }

    // Default if everything is approved but admin hasn't officially activated
    return { label: 'Pending Activation', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-emerald-400" />;
      case 'rejected':
        return <AlertCircle className="h-6 w-6 text-red-400" />;
      case 'pending':
      case 'submitted':
      case 'under_review':
        return <Clock className="h-6 w-6 text-amber-400" />;
      default:
        return <div className="h-6 w-6 rounded-full border-2 border-brand-border bg-white/5" />;
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const isContractor = driverInfo?.employee_type === 'contractor';
  const computedStatus = getComputedStatus();

  return (
    <div className="min-h-screen bg-brand-bg w-full">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        <button 
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="flex items-center text-brand-muted hover:text-white mb-2 transition-colors font-semibold tracking-tight"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-8">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Welcome, {driverInfo?.first_name}</h1>
              <p className="text-slate-400 mt-2 font-medium">Complete your onboarding tasks to get activated.</p>
            </div>
            <span className={`px-4 py-1.5 rounded-full font-bold text-sm uppercase tracking-wide \${computedStatus.color}`}>
              {computedStatus.label}
            </span>
          </div>
          
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wide">Overall Progress</span>
              <span className="text-sm font-bold text-brand-accent">{calculateCompletion()}% complete</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 border border-white/10 overflow-hidden">
              <div className="bg-brand-accent h-3 rounded-full transition-all duration-700 ease-out" style={{ width: `${calculateCompletion()}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border overflow-hidden">
          <div className="p-6 bg-brand-bg/50 border-b border-brand-border flex justify-between items-center">
            <span className="font-bold text-xl tracking-tight text-white">Required Compliance Steps</span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-muted bg-white/5 px-3 py-1.5 rounded-lg border border-brand-border">{driverInfo?.employee_type} Route</span>
          </div>
          <ul className="divide-y divide-brand-border">
          {[
            { id: 'account', label: 'Create Account', status: 'completed' },
            { id: 'personal', label: 'Personal Information', status: 'completed' },
            { id: 'cdl', label: 'Driver License (CDL)', status: progress?.cdl_status || 'not_started' },
            { id: 'medical', label: 'Medical Qualification', status: progress?.medical_status || 'not_started' },
            { id: 'background', label: 'Background Verification', status: progress?.background_check_status || 'not_started' },
            { id: 'mvr', label: 'Motor Vehicle Record (MVR)', status: progress?.mvr_check_status || 'not_started' },
            { id: 'drug', label: 'Pre-Employment Drug Test', status: progress?.drug_screen_status || 'not_started' },
            { id: 'clearinghouse', label: 'Clearinghouse Verification', status: progress?.clearinghouse_status || 'not_started' },
            { id: 'docs', label: isContractor ? 'Contractor Agreement & W-9' : 'Employment Agreement & W-4', status: progress?.employment_docs_status || 'not_started' },
            { id: 'training', label: 'Safety Training', status: progress?.training_status || 'not_started' },
            { id: 'final', label: 'Final Safety Approval', status: progress?.overall_status === 'approved' ? 'completed' : 'not_started' },
          ].map((step, idx) => {
            const stepDocMap: Record<string, string> = {
              'cdl': 'cdl',
              'medical': 'medical',
              'background': 'background_check',
              'mvr': 'mvr_check',
              'drug': 'drug_screen',
              'clearinghouse': 'clearinghouse',
              'docs': 'employment_docs'
            };
            const doc = documents.find(d => d.document_type === stepDocMap[step.id]);

            return (
            <React.Fragment key={step.id}>
              <li className="p-5 flex flex-col md:flex-row md:items-center justify-between hover:bg-white/5 transition-colors group">
              <div className="flex items-start md:items-center space-x-4 mb-4 md:mb-0">
                <div className="mt-1 md:mt-0">{getStatusIcon(step.status)}</div>
                <div>
                  <h3 className="font-bold text-white tracking-tight">{step.label}</h3>
                  <p className="text-sm text-brand-muted capitalize font-medium">{step.status.replace('_', ' ')}</p>
                  
                  {step.status === 'rejected' && (
                    <div className="mt-2">
                      <p className="text-xs text-red-400 font-bold mb-1 uppercase tracking-wide">
                        Action Required: Please resubmit.
                      </p>
                      {doc?.review_notes && (
                        <p className="text-sm text-red-300 bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-2">
                          <span className="font-bold">Reason:</span> {doc.review_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {doc && step.status !== 'rejected' && step.id !== 'training' && (
                    <div className="mt-3 text-sm text-slate-300 bg-brand-bg-secondary p-3 rounded-xl border border-brand-border">
                      <p className="font-bold mb-1 text-white tracking-tight">Your Submission:</p>
                      {doc.document_url && doc.document_url.includes('/') ? (
                        <p>Uploaded Files: {doc.document_url.split(',').length} file(s)</p>
                      ) : doc.metadata?.timestamp ? (
                        <p>Signed electronically on {new Date(doc.metadata.timestamp).toLocaleDateString()}</p>
                      ) : null}
                      {step.id === 'cdl' && doc.metadata?.license_number && (
                        <p className="mt-1">License: <span className="font-semibold text-white">{doc.metadata.license_number}</span> ({doc.metadata.state})</p>
                      )}
                    </div>
                  )}

                  {step.id === 'training' && trainingCompletions.length > 0 && (
                    <div className="mt-3 text-sm text-slate-300 bg-brand-bg-secondary p-3 rounded-xl border border-brand-border">
                      <p className="font-bold mb-2 text-white tracking-tight">Your Completions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {trainingCompletions.map((tc: any) => (
                          <li key={tc.id}>
                            Completed module {tc.status === 'completed' ? <span className="text-emerald-400 font-semibold">successfully</span> : <span className="text-amber-400 font-semibold">partially</span>} 
                            {tc.score !== null && ` (Score: ${tc.score}%)`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex-shrink-0 md:ml-6 flex items-center">
                {(step.status === 'not_started' || step.status === 'pending' || step.status === 'rejected') && step.id !== 'account' && step.id !== 'personal' && step.id !== 'final' && (
                  <button 
                    onClick={() => {
                      if (step.id === 'training') {
                        onNavigate && onNavigate('training');
                      } else {
                        setActiveStep(activeStep === step.id ? null : step.id);
                      }
                    }}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-tight flex items-center transition-all shadow-sm ${
                      step.status === 'rejected' 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                        : 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20 hover:bg-brand-accent/20'
                    }`}
                  >
                    {step.id === 'training' ? (
                        <Play className="h-4 w-4 mr-2" />
                    ) : (
                        <Upload className="h-4 w-4 mr-2" />
                    )}
                    {step.status === 'rejected' ? 'Fix Now' : (step.id === 'training' ? 'Start Training' : 'Complete Task')}
                  </button>
                )}
              </div>
            </li>
            {activeStep === 'cdl' && step.id === 'cdl' && (
              <li className="p-6 md:p-8 bg-brand-bg-secondary border-t border-brand-border">
                <form onSubmit={handleCdlSubmit} className="space-y-6 max-w-3xl">
                  <h4 className="font-bold text-white text-lg tracking-tight">Upload Commercial Driver's License (CDL)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">License Number</label>
                      <input type="text" required value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">State</label>
                      <input type="text" required value={licenseState} onChange={e => setLicenseState(e.target.value)} className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Class</label>
                      <select required value={licenseClass} onChange={e => setLicenseClass(e.target.value)} className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all">
                        <option value="A">Class A</option>
                        <option value="B">Class B</option>
                        <option value="C">Class C</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Endorsements (Optional)</label>
                      <input type="text" value={endorsements} onChange={e => setEndorsements(e.target.value)} className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all" placeholder="e.g., T, N, H, X" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Issue Date</label>
                      <input type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Expiry Date</label>
                      <input type="date" required value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 border-t border-brand-border pt-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Front of CDL 
                        {ocrScanning && <span className="ml-2 text-xs text-brand-accent font-normal italic">Scanning image...</span>}
                      </label>
                      <input type="file" required accept="image/*" onChange={handleFrontImageChange} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Back of CDL</label>
                      <input type="file" required accept="image/*" onChange={e => setBackImage(e.target.files?.[0] || null)} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => setActiveStep(null)} className="px-5 py-2.5 text-brand-muted hover:text-white border border-brand-border rounded-xl hover:bg-white/5 font-semibold transition-all">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-brand-accent text-white rounded-xl hover:bg-brand-accent-hover disabled:opacity-50 font-bold shadow-lg shadow-brand-accent/20 transition-all">
                      {submitting ? 'Uploading...' : 'Submit CDL'}
                    </button>
                  </div>
                </form>
              </li>
            )}
            
            {activeStep === 'medical' && step.id === 'medical' && (
              <li className="p-6 md:p-8 bg-brand-bg-secondary border-t border-brand-border">
                <form onSubmit={handleMedicalSubmit} className="space-y-6 max-w-2xl">
                  <h4 className="font-bold text-white text-lg tracking-tight mb-2">Medical Qualification</h4>
                  
                  <div className="space-y-4">
                    <label className="flex items-start md:items-center space-x-4 p-4 border rounded-xl bg-brand-bg hover:bg-white/5 transition-colors border-brand-border cursor-pointer">
                      <input type="radio" name="medicalType" value="upload" checked={medicalType === 'upload'} onChange={() => setMedicalType('upload')} className="mt-1 md:mt-0 h-4 w-4 text-brand-accent bg-brand-bg-secondary border-brand-border focus:ring-brand-accent focus:ring-offset-brand-bg" />
                      <div>
                        <p className="font-bold text-white tracking-tight">Upload Physical Medical Card</p>
                        <p className="text-sm text-brand-muted mt-1">I have a paper or plastic DOT medical card.</p>
                      </div>
                    </label>
                    <label className="flex items-start md:items-center space-x-4 p-4 border rounded-xl bg-brand-bg hover:bg-white/5 transition-colors border-brand-border cursor-pointer">
                      <input type="radio" name="medicalType" value="electronic" checked={medicalType === 'electronic'} onChange={() => setMedicalType('electronic')} className="mt-1 md:mt-0 h-4 w-4 text-brand-accent bg-brand-bg-secondary border-brand-border focus:ring-brand-accent focus:ring-offset-brand-bg" />
                      <div>
                        <p className="font-bold text-white tracking-tight">Electronic Record (National Registry)</p>
                        <p className="text-sm text-brand-muted mt-1">My medical examiner transmitted it electronically. (Subject to verification)</p>
                      </div>
                    </label>
                  </div>

                  {medicalType === 'upload' && (
                    <div className="mt-6">
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Upload Card Image</label>
                      <input type="file" required accept="image/*,.pdf" onChange={e => setMedicalCardImage(e.target.files?.[0] || null)} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => setActiveStep(null)} className="px-5 py-2.5 text-brand-muted hover:text-white border border-brand-border rounded-xl hover:bg-white/5 font-semibold transition-all">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-brand-accent text-white rounded-xl hover:bg-brand-accent-hover disabled:opacity-50 font-bold shadow-lg shadow-brand-accent/20 transition-all">
                      {submitting ? 'Submitting...' : 'Submit Medical Info'}
                    </button>
                  </div>
                </form>
              </li>
            )}

            {(activeStep === 'mvr' || activeStep === 'drug' || activeStep === 'clearinghouse' || activeStep === 'background') && step.id === activeStep && (
              <li className="p-6 md:p-8 bg-brand-bg-secondary border-t border-brand-border">
                <form onSubmit={(e) => handleConsentSubmit(e, activeStep)} className="space-y-6 max-w-2xl">
                  <h4 className="font-bold text-white text-lg tracking-tight mb-4">Consent & Authorization</h4>
                  <div className="bg-brand-bg text-slate-300 border-brand-border p-5 rounded-xl border text-sm h-40 overflow-y-auto mb-6 leading-relaxed">
                    <p className="mb-3 text-white"><strong>DISCLOSURE AND AUTHORIZATION REGARDING BACKGROUND INVESTIGATION</strong></p>
                    <p>
                      By signing below, I acknowledge and consent to Transpopilot (the "Company") procuring a consumer report and/or investigative consumer report on me for employment purposes. 
                      This may include, but is not limited to, my Motor Vehicle Record (MVR), FMCSA Clearinghouse records, and pre-employment drug screening results.
                    </p>
                  </div>

                  <div className="bg-brand-bg rounded-xl border border-brand-border p-4">
                    <SignaturePad onSign={setSignatureData} label="Electronic Signature" />
                  </div>

                  <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => setActiveStep(null)} className="px-5 py-2.5 text-brand-muted hover:text-white border border-brand-border rounded-xl hover:bg-white/5 font-semibold transition-all">Cancel</button>
                    <button type="submit" disabled={submitting || !signatureData} className="px-5 py-2.5 bg-brand-accent text-white rounded-xl hover:bg-brand-accent-hover disabled:opacity-50 font-bold shadow-lg shadow-brand-accent/20 transition-all">
                      {submitting ? 'Submitting...' : 'I Agree & Sign'}
                    </button>
                  </div>
                </form>
              </li>
            )}

            {activeStep === 'docs' && step.id === 'docs' && (
              <li className="p-6 md:p-8 bg-brand-bg-secondary border-t border-brand-border">
                <form onSubmit={handleEmploymentDocsSubmit} className="space-y-6 max-w-2xl">
                  <h4 className="font-bold text-white text-lg tracking-tight mb-2">
                    {isContractor ? 'Contractor Documents' : 'Employment Documents'}
                  </h4>
                  
                  {isContractor ? (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Upload W-9 Form</label>
                        <input type="file" required onChange={e => setEmpDoc1(e.target.files?.[0] || null)} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Contractor Agreement (Optional)</label>
                        <input type="file" onChange={e => setEmpDoc2(e.target.files?.[0] || null)} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Upload W-4 Form</label>
                        <input type="file" required onChange={e => setEmpDoc1(e.target.files?.[0] || null)} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Upload I-9 Form (Optional)</label>
                        <input type="file" onChange={e => setEmpDoc2(e.target.files?.[0] || null)} className="w-full text-sm text-brand-muted file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-bg file:text-brand-accent hover:file:bg-white/5 file:transition-colors file:border file:border-brand-border" />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => setActiveStep(null)} className="px-5 py-2.5 text-brand-muted hover:text-white border border-brand-border rounded-xl hover:bg-white/5 font-semibold transition-all">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-brand-accent text-white rounded-xl hover:bg-brand-accent-hover disabled:opacity-50 font-bold shadow-lg shadow-brand-accent/20 transition-all">
                      {submitting ? 'Uploading...' : 'Submit Documents'}
                    </button>
                  </div>
                </form>
              </li>
            )}
          </React.Fragment>
            );
          })}
        </ul>
      </div>
      </div>
    </div>
  );
};

export default DriverSelfOnboarding;