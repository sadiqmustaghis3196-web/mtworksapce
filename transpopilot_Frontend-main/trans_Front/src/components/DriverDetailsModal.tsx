import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Clock, AlertTriangle, FileText, Check, Lock } from 'lucide-react';
import { getDriverOnboardingDetails } from '../api/safety';
import { getDocumentUrl } from '../api/documentUtils';
import { useAuth } from '../contexts/AuthContext';

interface DriverDetailsModalProps {
  driverId: string;
  onClose: () => void;
}

export const DriverDetailsModal: React.FC<DriverDetailsModalProps> = ({ driverId, onClose }) => {
  const { profile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docLoading, setDocLoading] = useState<Record<string, boolean>>({});
  const [docError, setDocError] = useState<Record<string, string>>({});
  
  const isRestricted = profile?.role === 'dispatcher' || profile?.role === 'driver';

  useEffect(() => {
    if (isRestricted) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    getDriverOnboardingDetails(driverId)
      .then(res => {
        if (!active) return;
        if (res) {
          if (res.documents && Array.isArray(res.documents)) {
            res.documents.sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
          }
          setData(res);
        } else {
          setError('Failed to load driver details.');
        }
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'An error occurred.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [driverId, isRestricted]);

  const handleViewDocument = async (docId: string) => {
    setDocLoading(prev => ({ ...prev, [docId]: true }));
    setDocError(prev => ({ ...prev, [docId]: '' }));
    try {
      const result = await getDocumentUrl(driverId, docId);
      if (result?.is_electronic) {
        alert(result.message || 'This document was submitted electronically.');
      } else if (result?.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setDocError(prev => ({ ...prev, [docId]: 'Failed to generate view link.' }));
      }
    } catch (err) {
      setDocError(prev => ({ ...prev, [docId]: 'An error occurred.' }));
    } finally {
      setDocLoading(prev => ({ ...prev, [docId]: false }));
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return <span className="flex items-center text-emerald-400 gap-1 text-xs font-semibold uppercase"><CheckCircle className="w-3.5 h-3.5"/> Approved</span>;
      case 'rejected':
        return <span className="flex items-center text-rose-400 gap-1 text-xs font-semibold uppercase"><AlertTriangle className="w-3.5 h-3.5"/> Rejected</span>;
      case 'expired':
        return <span className="flex items-center text-rose-500 gap-1 text-xs font-semibold uppercase"><AlertTriangle className="w-3.5 h-3.5"/> Expired</span>;
      case 'submitted':
      case 'uploaded':
      case 'pending':
      case 'pending_review':
        return <span className="flex items-center text-amber-400 gap-1 text-xs font-semibold uppercase"><Clock className="w-3.5 h-3.5"/> Pending Review</span>;
      default:
        return <span className="text-slate-500 text-xs font-semibold uppercase">Not submitted yet</span>;
    }
  };

  const calculateProgress = () => {
    if (!data?.onboarding || !data.onboarding.length) return 0;
    const ob = data.onboarding[0];
    const items = [
      ob.cdl_status,
      ob.medical_status,
      ob.drug_screen_status,
      ob.mvr_check_status,
      ob.background_check_status,
      ob.clearinghouse_status
    ];
    const approved = items.filter(s => s === 'approved' || s === 'verified').length;
    return Math.round((approved / items.length) * 100) || 0;
  };

  const renderItemCard = (title: string, statusField: string, docType?: string) => {
    const ob = data?.onboarding?.[0];
    const status = ob?.[statusField] || 'not_submitted';
    const document = data?.documents?.find((d: any) => {
      if (statusField === 'cdl_status') return d.metadata?.license_number || d.metadata?.front_path || d.metadata?.type === 'cdl';
      if (statusField === 'medical_status') return d.metadata?.type === 'medical_qualification';
      if (statusField === 'drug_screen_status') return d.metadata?.type === 'drug_consent';
      if (statusField === 'mvr_check_status') return d.metadata?.type === 'mvr_consent';
      if (statusField === 'background_check_status') return d.metadata?.type === 'background_consent';
      if (statusField === 'clearinghouse_status') return d.metadata?.type === 'clearinghouse_consent';
      return d.requirement_id === docType;
    });

    const isElectronic = document?.document_url === 'digital_consent' || document?.document_url === 'electronic_record_confirmed';

    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex flex-col space-y-3">
        <div className="flex justify-between items-start">
          <h4 className="text-slate-200 font-medium text-sm">{title}</h4>
          {renderStatus(status)}
        </div>
        
        <div className="text-xs text-brand-muted flex-1">
          {document ? (
            <div className="space-y-1">
              <p>Uploaded: {document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString() : 'N/A'}</p>
              {document.expires_at && <p>Expires: {new Date(document.expires_at).toLocaleDateString()}</p>}
              
              {document.rejection_reason && (
                <div className="mt-2 p-2 bg-red-900/30 border border-red-500/30 rounded text-red-200">
                  <span className="font-semibold block mb-1">Rejection Reason:</span>
                  {document.rejection_reason}
                </div>
              )}
            </div>
          ) : (
            <p className="italic">No document submitted.</p>
          )}
          {ob?.notes && <p className="mt-2 text-slate-300">Notes: {ob.notes}</p>}
        </div>

        {document && (
          <div className="pt-2 border-t border-slate-700">
            {isElectronic ? (
              <div className="space-y-1 bg-brand-bg/50 p-2 rounded border border-brand-border text-xs">
                <p className="text-emerald-400 font-medium mb-1 flex items-center">
                  <Check className="w-3 h-3 mr-1" /> Electronic consent record — no physical file uploaded.
                </p>
                <p><span className="font-semibold text-slate-300">Electronic Signature:</span> {document.metadata?.signature_base64 ? 'Yes' : 'No'}</p>
                <p><span className="font-semibold text-slate-300">Timestamp:</span> {document.metadata?.timestamp || 'N/A'}</p>
                {document.metadata?.ip_address && <p><span className="font-semibold text-slate-300">IP Address:</span> {document.metadata.ip_address}</p>}
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleViewDocument(document.id)}
                  disabled={docLoading[document.id]}
                  className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {docLoading[document.id] ? 'Loading...' : 'View Uploaded File(s)'}
                </button>
                {docError[document.id] && <p className="text-rose-400 text-xs mt-1 text-center">{docError[document.id]}</p>}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md h-full bg-brand-bg-secondary border-l border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-brand-bg-secondary/50">
          <div>
            <h2 className="text-xl font-bold text-white">Driver Compliance</h2>
            {data && (
              <p className="text-sm text-brand-muted mt-1">
                {data.first_name} {data.last_name} • {data.vehicle?.[0]?.vehicle_number || 'Unassigned'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-brand-muted hover:text-white hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isRestricted ? (
            <div className="text-center py-10">
              <Lock className="w-10 h-10 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-300 font-medium">Driver compliance details are available to Admin and Fleet Manager roles.</p>
              <p className="text-slate-400 text-sm mt-2">You have operational access. Detailed compliance records are restricted.</p>
            </div>
          ) : loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 bg-slate-800 rounded-xl"></div>
              <div className="h-32 bg-slate-800 rounded-xl"></div>
              <div className="h-32 bg-slate-800 rounded-xl"></div>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
              <p className="text-slate-300 mb-4">{error}</p>
              <button onClick={() => { setLoading(true); setError(''); getDriverOnboardingDetails(driverId).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Overall Progress */}
              <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-300 font-medium">Overall Progress</span>
                  <span className="text-blue-400 font-bold">{calculateProgress()}%</span>
                </div>
                <div className="w-full bg-brand-bg-secondary rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 gap-4">
                {renderItemCard('CDL / License', 'cdl_status')}
                {renderItemCard('Medical Card', 'medical_status')}
                {renderItemCard('Drug Screen', 'drug_screen_status')}
                {renderItemCard('MVR Check', 'mvr_check_status')}
                {renderItemCard('Background Check', 'background_check_status')}
                {renderItemCard('Clearinghouse', 'clearinghouse_status')}
              </div>
              
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-300 leading-relaxed">
                  <strong>Note:</strong> Admin approval workflows are currently managed outside of this modal (via direct database queries). Read-only view provided.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
