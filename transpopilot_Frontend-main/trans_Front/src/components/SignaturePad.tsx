import React, { useState } from 'react';
import { PenTool, CheckCircle2, ShieldCheck, X } from 'lucide-react';

interface SignaturePadProps {
  onSign: (signature: string) => void;
  label?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSign, label = "Sign Here" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  
  const handleAdoptAndSign = () => {
    setIsSigned(true);
    setIsOpen(false);
    // Simulate an envelope ID/token from DocuSign
    const fakeEnvelopeId = "docusign_env_" + Math.random().toString(36).substring(2, 15);
    onSign(`electronic_record_confirmed::${fakeEnvelopeId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div>
          <h4 className="font-semibold text-gray-900 flex items-center">
            <ShieldCheck className="h-5 w-5 text-green-600 mr-2" />
            FMCSA Compliant E-Signature
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Sign securely via our certified E-Signature partner.
          </p>
        </div>
        
        {isSigned ? (
          <div className="flex items-center text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg border border-green-200">
            <CheckCircle2 className="h-5 w-5 mr-2" /> Signed
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <PenTool className="h-4 w-4 mr-2" /> Sign Document
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-75">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-blue-50">
              <div className="flex items-center">
                <span className="font-bold text-xl text-blue-900 tracking-tight">DocuSign</span>
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded uppercase tracking-wider border border-blue-200">Demo</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Document Body */}
            <div className="flex-1 p-8 overflow-y-auto bg-gray-50 flex flex-col items-center">
              <div className="w-full max-w-2xl bg-white p-8 shadow-sm border border-gray-200 rounded-lg min-h-full">
                <h2 className="text-2xl font-bold text-center mb-6 border-b pb-4">Consent and Disclosure</h2>
                
                <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                  <p>
                    <strong>AUTHORIZATION REGARDING BACKGROUND INVESTIGATION</strong>
                  </p>
                  <p>
                    By proceeding, I acknowledge and consent to Transpopilot (the "Company") procuring a consumer report and/or investigative consumer report on me for employment purposes.
                  </p>
                  <p>
                    This may include, but is not limited to, my Motor Vehicle Record (MVR), FMCSA Clearinghouse records, and pre-employment drug screening results. I authorize any law enforcement agency, institution, information service bureau, school, employer, reference, or insurance company contacted by the Company or its agent to furnish the information described herein.
                  </p>
                  
                  <div className="mt-8 pt-8 border-t border-dashed border-gray-300">
                    <p className="mb-2 text-gray-500 italic text-center text-xs">Please review the signature below to bind this document.</p>
                    
                    <div className="bg-yellow-50 border-2 border-yellow-200 p-6 rounded-lg text-center cursor-pointer hover:bg-yellow-100 transition-colors" onClick={handleAdoptAndSign}>
                      <span className="font-[cursive] text-4xl text-blue-900">John Doe</span>
                      <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-mono">DocuSign ID: E1A2B3C4-D5E6</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-100 flex justify-between items-center">
              <p className="text-xs text-gray-500">I agree to use Electronic Records and Signatures.</p>
              <div className="space-x-3">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-700 hover:underline font-medium text-sm">Cancel</button>
                <button type="button" onClick={handleAdoptAndSign} className="px-6 py-2 bg-yellow-400 text-gray-900 rounded shadow font-bold hover:bg-yellow-500 transition-colors">
                  Adopt and Sign
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
