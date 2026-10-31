import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Clock, Building, Shield, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CompanyVerification, getCompanyVerification, submitCompanyVerification } from '../api/companyVerification';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const CompanyVerificationPage: React.FC = () => {
  const { profile } = useAuth();
  const [verification, setVerification] = useState<CompanyVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    legalName: '',
    businessType: 'llc',
    taxId: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadVerification();
    }
  }, [profile?.organization_id]);

  const loadVerification = async () => {
    try {
      setLoading(true);
      const data = await getCompanyVerification(profile!.organization_id!);
      setVerification(data);
      if (data) {
        setFormData({
          legalName: data.legal_name || '',
          businessType: data.business_type || 'llc',
          taxId: data.tax_id || ''
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load company verification status');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      setSubmitting(true);
      setError('');
      await submitCompanyVerification(
        profile.organization_id,
        formData.legalName,
        formData.businessType,
        formData.taxId
      );
      await loadVerification();
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-3 bg-blue-100 rounded-xl">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Verification</h1>
          <p className="text-gray-600">Verify your business to unlock full platform access</p>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Status Banner */}
      {verification && (
        <div className={`p-4 rounded-xl border ${
          verification.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-800' :
          verification.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-800' :
          verification.status === 'UNDER_REVIEW' ? 'bg-blue-50 border-blue-200 text-blue-800' :
          'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <div className="flex items-center space-x-3">
            {verification.status === 'APPROVED' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {verification.status === 'REJECTED' && <AlertTriangle className="h-6 w-6 text-red-600" />}
            {(verification.status === 'PENDING' || verification.status === 'UNDER_REVIEW') && <Clock className="h-6 w-6" />}
            
            <div>
              <h3 className="font-bold text-lg">
                Status: {verification.status.replace('_', ' ')}
              </h3>
              {verification.status === 'REJECTED' && (
                <p className="text-sm mt-1">
                  <strong>Reason:</strong> {verification.rejection_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building className="h-5 w-5 text-gray-500" />
            Business Information
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal Business Name</label>
              <input
                type="text"
                required
                disabled={verification?.status === 'APPROVED' || verification?.status === 'UNDER_REVIEW'}
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                required
                disabled={verification?.status === 'APPROVED' || verification?.status === 'UNDER_REVIEW'}
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="llc">LLC</option>
                <option value="inc">Corporation (Inc.)</option>
                <option value="sole">Sole Proprietorship</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / EIN</label>
              <input
                type="text"
                required
                disabled={verification?.status === 'APPROVED' || verification?.status === 'UNDER_REVIEW'}
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3 text-blue-800 text-sm">
            <FileText className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>
              Please ensure the information matches your official IRS documents. Incorrect information may result in delays or rejection of your verification request.
            </p>
          </div>

          {(!verification || verification.status === 'REJECTED' || verification.status === 'PENDING') && (
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {submitting ? <LoadingSpinner /> : (verification?.status === 'REJECTED' ? 'Resubmit Verification' : 'Submit for Review')}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CompanyVerificationPage;
