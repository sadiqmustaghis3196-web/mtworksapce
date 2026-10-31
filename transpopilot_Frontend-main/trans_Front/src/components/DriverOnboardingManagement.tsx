import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, FileText, Download, X, Check, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getTrainingModules, calculateAndUpdateProgress } from '../api/driverOnboarding';
import { supabase } from '../lib/supabase';
import { getDocumentUrl } from '../api/documentUtils';
import { API_BASE_URL } from '../lib/apiConfig';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const DriverOnboardingManagement: React.FC = () => {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('drivers');
  const [fileError, setFileError] = useState('');

  const [rejectionModal, setRejectionModal] = useState<{ open: boolean; documentId: string | null }>({ open: false, documentId: null });
  const [rejectionReason, setRejectionReason] = useState('');

  const [trainingModules, setTrainingModules] = useState<any[]>([]);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '', video_url: '', required_for_onboarding: true, quiz_data: { passing_score: 80, questions: [] } });

  const [selectedDriverDetails, setSelectedDriverDetails] = useState<any>(null);
  const [driverAllDocs, setDriverAllDocs] = useState<any[]>([]);
  const [driverTraining, setDriverTraining] = useState<any[]>([]);

  // Check roles
  const canApproveSafety = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'safety_manager';
  const canApproveHR = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'hr';
  const isDispatcher = profile?.role === 'dispatcher';

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const fetchDocuments = async () => {
    try {
      // Admin should only see documents for their org
      const { data: orgData } = await supabase.from('users').select('organization_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      if (!orgData?.organization_id) return;

      const { data, error } = await supabase
        .from('driver_documents')
        .select(`
          *,
          driver:drivers(first_name, last_name, employee_type)
        `)
        .eq('organization_id', orgData.organization_id)
        .eq('status', 'uploaded')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  };

  const getDocumentTypeLabel = (doc: any) => {
    let type = doc.metadata?.type;
    if (!type && doc.metadata?.license_number) type = 'cdl';
    if (!type) return 'Unknown Document';

    const map: Record<string, string> = {
      'cdl': 'CDL / Driver License',
      'medical_qualification': 'Medical Certificate',
      'mvr_consent': 'MVR Consent Form',
      'drug_consent': 'Drug Test Consent',
      'clearinghouse_consent': 'Clearinghouse Consent',
      'background_consent': 'Background Check Consent',
      'consent': 'Background Check Consent',
      'w4': 'W-4 Form',
      'i9': 'I-9 Form',
      'w9': 'W-9 Form',
      'employment_docs': 'Employment Agreement'
    };
    return map[type] || type.replace(/_/g, ' ').toUpperCase();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const orgId = profile!.organization_id;

      // Parallelize drivers, documents, and training modules requests
      const [driversRes, docsRes, tmRes] = await Promise.all([
        supabase
          .from('drivers')
          .select(`*, onboarding:driver_onboarding_progress(*)`)
          .eq('organization_id', orgId),
        supabase
          .from('driver_documents')
          .select(`*, driver:drivers(first_name, last_name)`)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('training_modules')
          .select('*')
          .eq('organization_id', orgId)
      ]);

      if (driversRes.error) throw driversRes.error;
      setDrivers(driversRes.data || []);

      if (docsRes.error) throw docsRes.error;
      const docsData = docsRes.data || [];

      // Deduplicate: only keep the most recent submission per driver per document type
      const seen = new Set<string>();
      const uniqueDocs = docsData.filter(doc => {
        let type = doc.metadata?.type;
        if (!type && doc.metadata?.license_number) type = 'cdl';
        const key = `${doc.driver_id}_${type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setDocuments(uniqueDocs);
      setTrainingModules(tmRes.data || []);

    } catch (err: any) {
      setError(err.message || 'Failed to load onboarding management data');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentAction = async (docId: string, action: 'verified' | 'rejected', reason?: string) => {
    if (isDispatcher) {
      setError("Dispatchers cannot approve or reject compliance documents.");
      return;
    }

    try {
      setError('');
      const { error } = await supabase
        .from('driver_documents')
        .update({
          status: action,
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
          verified_by: user!.id
        })
        .eq('id', docId);

      if (error) throw error;

      // Update onboarding progress table
      const doc = documents.find(d => d.id === docId);
      if (doc && doc.metadata) {
        let type = doc.metadata.type;
        // CDL doesn't have a 'type' field in metadata, but it has 'license_number'
        if (!type && doc.metadata.license_number) {
          type = 'cdl';
        }

        let progressColumn = '';
        if (type === 'cdl') progressColumn = 'cdl_status';
        else if (type === 'medical_qualification') progressColumn = 'medical_status';
        else if (['w4', 'i9', 'w9', 'employment_docs'].includes(type)) progressColumn = 'employment_docs_status';
        else if (type === 'consent' || type === 'background_consent') progressColumn = 'background_check_status';
        else if (type === 'mvr_consent') progressColumn = 'mvr_check_status';
        else if (type === 'drug_consent') progressColumn = 'drug_screen_status';
        else if (type === 'clearinghouse_consent') progressColumn = 'clearinghouse_status';

        if (progressColumn) {
          const progressStatus = action === 'verified' ? 'approved' : 'rejected';
          const { error: updateProgressErr } = await supabase
            .from('driver_onboarding_progress')
            .update({ [progressColumn]: progressStatus })
            .eq('driver_id', doc.driver_id);
          if (updateProgressErr) throw updateProgressErr;
        }

        await calculateAndUpdateProgress(doc.user_id, doc.driver_id, doc.organization_id);
      }

      setRejectionModal({ open: false, documentId: null });
      setRejectionReason('');
      loadData();
      if (selectedDriverDetails) {
        viewDriverDetails(drivers.find(d => d.id === selectedDriverDetails.id) || selectedDriverDetails);
      }
    } catch (err: any) {
      setError(err.message || `Failed to ${action} document`);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/training-modules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(newModule)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setShowCreateModule(false);
      setNewModule({ title: '', description: '', video_url: '', required_for_onboarding: true, quiz_data: { passing_score: 80, questions: [] } });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create training module');
      setLoading(false);
    }
  };

  const viewDriverDetails = async (driver: any) => {
    setSelectedDriverDetails(driver);
    try {
      const { data: docs } = await supabase.from('driver_documents').select('*').eq('driver_id', driver.id).order('uploaded_at', { ascending: false });
      setDriverAllDocs(docs || []);

      const { data: training } = await supabase.from('driver_training_completions').select('*, module:training_modules(title)').eq('driver_id', driver.id);
      setDriverTraining(training || []);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const pendingDocuments = documents.filter(doc => ['uploaded', 'pending', 'pending_review'].includes(doc.status));

  return (
    <div className="min-h-screen bg-brand-bg p-6 sm:p-8 space-y-6 max-w-[1600px] mx-auto selection:bg-brand-accent/30 selection:text-brand-accent">
      <div className="flex justify-between items-center bg-brand-bg-secondary text-white border-brand-border p-6 rounded-lg shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-white">Driver Onboarding</h2>
          <p className="text-brand-muted">Manage and review driver documentation</p>
        </div>
      </div>

      {fileError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mb-6 flex justify-between items-center">
          <div>
            <h3 className="text-red-800 font-medium">Document Fetch Failed</h3>
            <p className="text-red-700 text-sm mt-1">{fileError}</p>
          </div>
          <button
            onClick={() => setFileError('')}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex border-b border-brand-border">
        <button
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'drivers' ? 'border-b-2 border-brand-accent text-blue-400 font-bold' : 'text-slate-300 hover:text-white font-medium'}`}
          onClick={() => setActiveTab('drivers')}
        >
          Drivers Overview
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm flex items-center ${activeTab === 'documents' ? 'border-b-2 border-brand-accent text-blue-400 font-bold' : 'text-slate-300 hover:text-white font-medium'}`}
          onClick={() => setActiveTab('documents')}
        >
          Pending Review
          {pendingDocuments.length > 0 && (
            <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">{pendingDocuments.length}</span>
          )}
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'training' ? 'border-b-2 border-brand-accent text-blue-400 font-bold' : 'text-slate-300 hover:text-white font-medium'}`}
          onClick={() => setActiveTab('training')}
        >
          Training Modules
        </button>
      </div>

      {activeTab === 'drivers' && (
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-brand-bg-secondary text-white uppercase text-xs font-bold border-b border-brand-border">
              <tr>
                <th className="px-6 py-4 text-white font-bold tracking-wider">Driver</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider">Type</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider">Status</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">CDL</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">Medical</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">Drug Test</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">MVR</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">Background</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">Clearinghouse</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-center">Emp. Docs</th>
                <th className="px-6 py-4 text-white font-bold tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {drivers.map(d => (
                <tr key={d.id}>
                  <td className="px-6 py-4 font-bold text-white">{d.first_name} {d.last_name}</td>
                  <td className="px-6 py-4 capitalize text-slate-300 font-medium">{d.employee_type}</td>
                  <td className="px-6 py-4 text-slate-300">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                      {d.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.onboarding?.[0]?.cdl_status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <Clock className="h-5 w-5 text-slate-500 mx-auto opacity-50" />}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.onboarding?.[0]?.medical_status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <Clock className="h-5 w-5 text-slate-500 mx-auto opacity-50" />}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.onboarding?.[0]?.drug_screen_status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <Clock className="h-5 w-5 text-slate-500 mx-auto opacity-50" />}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.onboarding?.[0]?.mvr_check_status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <Clock className="h-5 w-5 text-slate-500 mx-auto opacity-50" />}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.onboarding?.[0]?.background_check_status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <Clock className="h-5 w-5 text-slate-500 mx-auto opacity-50" />}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.onboarding?.[0]?.clearinghouse_status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <Clock className="h-5 w-5 text-slate-500 mx-auto opacity-50" />}
                  </td>
                  <td className="px-6 py-4 text-right space-y-2">
                    <button
                      onClick={() => viewDriverDetails(d)}
                      className="px-3 py-1.5 bg-brand-bg-secondary text-white border border-brand-border hover:bg-brand-bg-secondary/70 text-xs font-medium rounded-lg hover:bg-gray-200 block w-full text-center"
                    >
                      View Details
                    </button>
                    {d.status !== 'active' && (
                      <button
                        onClick={async () => {
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${d.id}/activate`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${session?.access_token}` }
                            });
                            const result = await res.json();
                            if (!result.success) throw new Error(result.error);
                            alert('Driver activated successfully!');
                            loadData(); // reload the data
                          } catch (err: any) {
                            alert(err.message || 'Failed to activate driver');
                          }
                        }}
                        disabled={
                          !(
                            d.onboarding?.[0]?.cdl_status === 'approved' &&
                            d.onboarding?.[0]?.medical_status === 'approved' &&
                            d.onboarding?.[0]?.mvr_check_status === 'approved' &&
                            d.onboarding?.[0]?.drug_screen_status === 'approved' &&
                            d.onboarding?.[0]?.clearinghouse_status === 'approved' &&
                            d.onboarding?.[0]?.background_check_status === 'approved' &&
                            d.onboarding?.[0]?.employment_docs_status === 'approved'
                          )
                        }
                        className="px-3 py-1.5 bg-brand-accent text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          (d.onboarding?.[0]?.cdl_status === 'approved' && d.onboarding?.[0]?.medical_status === 'approved' && d.onboarding?.[0]?.mvr_check_status === 'approved' && d.onboarding?.[0]?.drug_screen_status === 'approved' && d.onboarding?.[0]?.clearinghouse_status === 'approved' && d.onboarding?.[0]?.background_check_status === 'approved' && d.onboarding?.[0]?.employment_docs_status === 'approved')
                            ? "Activate Driver"
                            : "All steps must be approved first"
                        }
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingDocuments.map(doc => (
            <div key={doc.id} className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-white">{doc.driver.first_name} {doc.driver.last_name}</h3>
                  <p className="text-sm text-brand-muted">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                </div>
                <div
                  className={`p-2 rounded-lg ${doc.document_url ? 'bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100' : 'bg-brand-bg-secondary text-brand-muted'}`}
                  onClick={async () => {
                    if (doc.document_url) {
                      if (doc.document_url === 'electronic_record_confirmed' || doc.document_url === 'digital_consent') {
                        alert(`This document was submitted electronically.\n\nForm/Signature details:\nTimestamp: ${doc.metadata?.timestamp || 'N/A'}\nIP: ${doc.metadata?.ip_address || 'N/A'}\nReference: ${doc.metadata?.signature_base64 || 'N/A'}`);
                      } else {
                        try {
                          const result = await getDocumentUrl(doc.driver_id, doc.id);
                          if (result?.is_electronic) {
                            alert(result.message || 'This document was submitted electronically.');
                          } else if (result?.url) {
                            setFileError(''); // Clear previous error
                            window.open(result.url, '_blank');
                          } else {
                            setFileError(`This document's file could not be found or access was denied. Contact support or ask the driver to re-upload.`);
                            setTimeout(() => setFileError(''), 10000);
                          }
                        } catch (err: any) {
                          setFileError(`Error viewing document: ${err.message}`);
                          setTimeout(() => setFileError(''), 10000);
                        }
                      }
                    }
                  }}
                  title={doc.document_url ? "View Document" : "No file available"}
                >
                  <FileText className="h-5 w-5" />
                </div>
              </div>

              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-full border border-indigo-100 mb-2">
                  {getDocumentTypeLabel(doc)}
                </span>
                <p className={`text-sm font-medium uppercase tracking-wider mb-2 ${doc.status === 'verified' || doc.status === 'approved' ? 'text-green-400' : doc.status === 'rejected' ? 'text-red-400' : 'text-white'}`}>
                  {doc.status === 'uploaded' ? 'Pending Review' : doc.status}
                </p>

                {doc.status === 'rejected' && doc.rejection_reason && (
                  <div className="mb-3 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-sm text-red-200">
                    <span className="font-semibold block mb-1">Rejection Reason:</span>
                    {doc.rejection_reason}
                  </div>
                )}

                {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                  <div className="mt-3 bg-brand-bg-secondary rounded p-3 text-xs text-slate-300 border border-brand-border">
                    <h4 className="font-semibold mb-1 text-white">Submitted Details</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {Object.entries(doc.metadata).filter(([k]) => !['signature_base64', 'back_path', 'front_path'].includes(k)).map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <span className="text-brand-muted capitalize">{k.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-white break-words">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(doc.status === 'uploaded' || doc.status === 'pending') && (
                <div className="flex space-x-3 mt-4 pt-4 border-t border-brand-border">
                  <button
                    onClick={() => handleDocumentAction(doc.id, 'verified')}
                    disabled={isDispatcher || !canApproveSafety}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => setRejectionModal({ open: true, documentId: doc.id })}
                    disabled={isDispatcher || !canApproveSafety}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          {pendingDocuments.length === 0 && (
            <div className="col-span-full py-12 text-center bg-brand-bg-secondary text-white border-brand-border rounded-xl border border-dashed">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white">All caught up!</h3>
              <p className="text-brand-muted">No documents pending review at this time.</p>
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-bg-secondary text-white border-brand-border rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Reject Document
            </h2>
            <p className="text-sm text-slate-300 mb-4">Please provide a reason for rejecting this document. This will be sent directly to the driver to help them fix the issue.</p>

            <textarea
              className="w-full p-3 bg-brand-bg text-white border border-brand-border rounded-lg focus:ring-2 focus:ring-red-500 outline-none mb-4 placeholder-slate-500"
              rows={4}
              placeholder="e.g. Image is blurry, missing back of license, expired, etc."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />

            <div className="flex space-x-3">
              <button
                onClick={() => setRejectionModal({ open: false, documentId: null })}
                className="flex-1 py-2 px-4 border border-brand-border text-white rounded-lg hover:bg-brand-bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDocumentAction(rejectionModal.documentId!, 'rejected', rejectionReason.trim())}
                disabled={!rejectionReason.trim()}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
            {!rejectionReason.trim() && (
              <p className="text-red-400 text-xs mt-3 text-center font-medium">Rejection reason is required.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'training' && (
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] shadow-xl border border-brand-border p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Training Modules</h3>
            <button
              onClick={() => setShowCreateModule(true)}
              className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Create Module
            </button>
          </div>

          {showCreateModule && (
            <form onSubmit={handleCreateModule} className="mb-8 p-4 bg-brand-bg-secondary border border-brand-border rounded-lg space-y-4">
              <h4 className="font-bold text-white">New Training Module</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white mb-1">Title</label>
                  <input type="text" required value={newModule.title} onChange={e => setNewModule({ ...newModule, title: e.target.value })} className="w-full p-2 border rounded" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white mb-1">Description</label>
                  <textarea value={newModule.description} onChange={e => setNewModule({ ...newModule, description: e.target.value })} className="w-full p-2 border rounded" rows={2}></textarea>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white mb-1">Video URL (Optional)</label>
                  <input type="url" value={newModule.video_url} onChange={e => setNewModule({ ...newModule, video_url: e.target.value })} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="flex items-center space-x-2 mt-6">
                    <input type="checkbox" checked={newModule.required_for_onboarding} onChange={e => setNewModule({ ...newModule, required_for_onboarding: e.target.checked })} className="rounded text-blue-600" />
                    <span className="text-sm font-medium text-white">Required for Onboarding</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <button type="button" onClick={() => setShowCreateModule(false)} className="px-4 py-2 border rounded text-slate-300 hover:bg-brand-bg-secondary/50">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-accent text-white rounded hover:bg-blue-700 disabled:opacity-50">Save Module</button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {trainingModules.map(mod => (
              <div key={mod.id} className="p-4 border rounded-lg hover:shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white">{mod.title}</h4>
                    <p className="text-sm text-brand-muted mt-1">{mod.description}</p>
                    <div className="flex space-x-2 mt-2">
                      {mod.required && <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded font-medium">Required</span>}
                      {mod.content?.video_url && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-medium">Has Video</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {trainingModules.length === 0 && !showCreateModule && (
              <p className="text-brand-muted text-center py-4">No training modules created yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Driver View Details Modal */}
      {selectedDriverDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-40">
          <div className="bg-brand-bg-secondary text-white border-brand-border w-full max-w-2xl h-full shadow-xl overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-bg-secondary">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedDriverDetails.first_name} {selectedDriverDetails.last_name}</h2>
                <p className="text-sm text-brand-muted capitalize">{selectedDriverDetails.employee_type} Route • Status: {selectedDriverDetails.status}</p>
              </div>
              <button onClick={() => setSelectedDriverDetails(null)} className="text-brand-muted hover:text-slate-300">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 flex-1 space-y-8">
              {/* Submitted Documents & Consents */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 border-b pb-2">Documents & Consents</h3>
                <div className="space-y-4">
                  {driverAllDocs.map(doc => (
                    <div key={doc.id} className="border border-brand-border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="inline-block px-2 py-1 bg-brand-bg-secondary text-white border border-brand-border hover:bg-brand-bg-secondary/70 text-xs rounded font-medium mb-1">
                            {getDocumentTypeLabel(doc)}
                          </span>
                          <p className="text-sm font-medium text-white">
                            Status: <span className={`uppercase ${doc.status === 'verified' ? 'text-green-600' : doc.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{doc.status}</span>
                          </p>
                          <p className="text-xs text-brand-muted">Submitted: {new Date(doc.uploaded_at).toLocaleString()}</p>
                        </div>
                        {doc.status === 'uploaded' && (
                          <div className="flex space-x-2">
                            <button onClick={() => handleDocumentAction(doc.id, 'verified')} className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Approve"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setRejectionModal({ open: true, documentId: doc.id })} className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Reject"><X className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>

                      {doc.rejection_reason && (
                        <p className="text-xs text-red-700 bg-red-50 p-2 rounded mt-2 border border-red-100">
                          <span className="font-bold">Rejection Reason:</span> {doc.rejection_reason}
                        </p>
                      )}

                      <div className="mt-3 bg-brand-bg-secondary p-3 rounded text-xs text-white">
                        {doc.document_url && doc.document_url.includes('/') ? (
                          <button
                            onClick={async () => {
                              try {
                                const result = await getDocumentUrl(doc.driver_id, doc.id);
                                if (result?.is_electronic) {
                                  alert(result.message || 'This document was submitted electronically.');
                                } else if (result?.url) {
                                  window.open(result.url, '_blank', 'noopener,noreferrer');
                                } else {
                                  alert('Failed to view document.');
                                }
                              } catch (err: any) {
                                alert(`Error viewing document: ${err.message}`);
                              }
                            }}
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            <FileText className="h-3 w-3 mr-1" /> View Uploaded File(s)
                          </button>
                        ) : doc.document_url === 'digital_consent' || doc.document_url === 'electronic_record_confirmed' || doc.metadata?.timestamp ? (
                          <div className="space-y-1 bg-brand-bg/50 p-2 rounded border border-brand-border">
                            <p className="text-emerald-400 font-medium mb-2 flex items-center">
                              <Check className="w-3 h-3 mr-1" /> Electronic consent record — no physical file uploaded.
                            </p>
                            <p><span className="font-semibold text-slate-300">Electronic Signature:</span> {doc.metadata?.signature_base64 ? 'Yes' : 'No'}</p>
                            <p><span className="font-semibold text-slate-300">Timestamp:</span> {doc.metadata?.timestamp || 'N/A'}</p>
                            {doc.metadata?.ip_address && <p><span className="font-semibold text-slate-300">IP Address:</span> {doc.metadata.ip_address}</p>}
                          </div>
                        ) : null}
                        {doc.metadata?.license_number && (
                          <div className="mt-2 space-y-1">
                            <p><span className="font-semibold">License:</span> {doc.metadata.license_number}</p>
                            <p><span className="font-semibold">State:</span> {doc.metadata.state}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {driverAllDocs.length === 0 && <p className="text-brand-muted text-sm">No documents submitted yet.</p>}
                </div>
              </div>

              {/* Training Completions */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 border-b pb-2">Safety Training</h3>
                <div className="space-y-3">
                  {driverTraining.map(tc => (
                    <div key={tc.id} className="border border-brand-border rounded p-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-white">{tc.module?.title || 'Unknown Module'}</p>
                        <p className="text-xs text-brand-muted">Completed on {new Date(tc.completed_at || tc.started_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 text-xs rounded font-bold ${tc.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {tc.status.toUpperCase()}
                        </span>
                        {tc.score !== null && <p className="text-xs font-medium mt-1">Score: {tc.score}%</p>}
                      </div>
                    </div>
                  ))}
                  {driverTraining.length === 0 && <p className="text-brand-muted text-sm">No training modules completed yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverOnboardingManagement;