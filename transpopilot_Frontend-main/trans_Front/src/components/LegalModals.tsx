import React from 'react';
import { X, Shield, FileText, Lock } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | 'security';
}

const LegalModal: React.FC<ModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const getContent = () => {
    switch (type) {
      case 'privacy':
        return {
          title: 'Privacy Policy',
          icon: <Shield className="h-6 w-6 text-emerald-600" />,
          content: (
            <div className="space-y-4 text-gray-600">
              <p><strong>Last Updated: February 2026</strong></p>
              <p>At TranspoPilot, we prioritize the privacy of our fleet partners and drivers.</p>
              <h3 className="text-lg font-bold text-gray-800">1. Data Collection</h3>
              <p>We collect telemetry data, vehicle diagnostics, and driver behavior metrics solely for optimization purposes.</p>
              <h3 className="text-lg font-bold text-gray-800">2. Usage of Information</h3>
              <p>Your data is used to generate safety scores, fuel reports, and route optimizations. We do not sell your data to third parties.</p>
              <h3 className="text-lg font-bold text-gray-800">3. Data Retention</h3>
              <p>Fleet data is retained for the duration of your subscription and can be exported at any time.</p>
            </div>
          )
        };
      case 'terms':
        return {
          title: 'Terms of Service',
          icon: <FileText className="h-6 w-6 text-blue-600" />,
          content: (
            <div className="space-y-4 text-gray-600">
              <p><strong>Last Updated: February 2026</strong></p>
              <h3 className="text-lg font-bold text-gray-800">1. Agreement</h3>
              <p>By using TranspoPilot, you agree to these terms. This service is for authorized fleet management use only.</p>
              <h3 className="text-lg font-bold text-gray-800">2. Account Responsibility</h3>
              <p>You are responsible for maintaining the confidentiality of your API tokens and account credentials.</p>
              <h3 className="text-lg font-bold text-gray-800">3. Limitation of Liability</h3>
              <p>While our AI provides high-accuracy predictions, final operational decisions remain with the fleet manager.</p>
            </div>
          )
        };
      case 'security':
        return {
          title: 'Security Standards',
          icon: <Lock className="h-6 w-6 text-red-600" />,
          content: (
            <div className="space-y-4 text-gray-600">
              <h3 className="text-lg font-bold text-gray-800">Bank-Grade Encryption</h3>
              <p>All data in transit is encrypted via TLS 1.3. Data at rest is encrypted using AES-256 standards.</p>
              <h3 className="text-lg font-bold text-gray-800">SOC 2 Compliance</h3>
              <p>Our infrastructure is designed to meet SOC 2 Type II requirements, ensuring enterprise-level security controls.</p>
              <h3 className="text-lg font-bold text-gray-800">API Security</h3>
              <p>We use OAuth 2.0 and secure API Key management. Keys are never exposed to the client-side browser unnecessarily.</p>
            </div>
          )
        };
      default:
        return { title: '', icon: null, content: null };
    }
  };

  const { title, icon, content } = getContent();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto">
          {content}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;