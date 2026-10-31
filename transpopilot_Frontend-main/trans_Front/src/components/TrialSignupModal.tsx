import React, { useState } from 'react';
import { X, CheckCircle, Loader2, Truck } from 'lucide-react';

interface TrialSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TrialFormData) => Promise<void>;
}

export interface TrialFormData {
  email: string;
  company_name: string;
  fleet_size: number | null;
  phone: string;
}

const TrialSignupModal: React.FC<TrialSignupModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<TrialFormData>({
    email: '',
    company_name: '',
    fleet_size: null,
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setFormData({
          email: '',
          company_name: '',
          fleet_size: null,
          phone: '',
        });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setTimeout(() => {
        setError(null);
        setIsSuccess(false);
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="p-8">
          {isSuccess ? (
            <div className="text-center py-8">
              <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Welcome Aboard!</h3>
              <p className="text-gray-600 leading-relaxed">
                We'll contact you within 24 hours to set up your 30-day free trial and get you started with TranspoPilot.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-3 rounded-xl">
                  <Truck className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
                Start Your Free Trial
              </h2>
              <p className="text-center text-gray-600 mb-8">
                No credit card required. Get started in 24 hours.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Business Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="john@truckingcompany.com"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="company_name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Your Trucking Company"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="fleet_size" className="block text-sm font-semibold text-gray-700 mb-2">
                    Fleet Size
                  </label>
                  <input
                    type="number"
                    id="fleet_size"
                    min="1"
                    value={formData.fleet_size || ''}
                    onChange={(e) => setFormData({ ...formData, fleet_size: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="How many trucks?"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="(555) 123-4567"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Start My Free Trial'
                  )}
                </button>

                <p className="text-xs text-center text-gray-500 mt-4">
                  By signing up, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialSignupModal;
