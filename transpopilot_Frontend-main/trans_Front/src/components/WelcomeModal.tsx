import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  ArrowRight, 
  Plug, 
  Map, 
  Route, 
  ShieldCheck, 
  FileText,
  Play
} from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetStarted: () => void;
  onConnectIntegration?: () => void;
  userName?: string;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ 
  isOpen, 
  onClose, 
  onGetStarted, 
  onConnectIntegration, 
  userName 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Smooth enter/exit animations
  useEffect(() => {
    if (isOpen) {
      // Slight delay to allow display:block to apply before animating opacity/transform
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const features = [
    { icon: Map, title: 'Live Fleet Tracking', desc: 'Real-time GPS visibility for all vehicles.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { icon: Route, title: 'Smart Routing', desc: 'Cut fuel costs with predictive optimization.', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { icon: ShieldCheck, title: 'Predictive Safety', desc: 'Prevent breakdowns before they happen.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { icon: FileText, title: 'Smart Compliance', desc: 'Automate DOT logs and safety records.', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' }
  ];

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden transition-all duration-500 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Modal Container */}
      <div 
        className={`relative bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden transition-all duration-500 ease-out transform ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
      >
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2.5 bg-black/10 hover:bg-black/20 rounded-full text-white transition-all z-20 backdrop-blur-sm"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* --- Top Hero Section (Gradient & Branding) --- */}
        <div className="relative bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 px-6 py-12 sm:px-12 sm:py-16 text-center overflow-hidden flex-shrink-0">
          {/* Abstract Glow Effects */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-50 mix-blend-screen pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-50 mix-blend-screen pointer-events-none"></div>

          
          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6 shadow-xl">
              <Sparkles className="h-4 w-4 text-blue-300" />
              <span className="text-white font-semibold text-sm tracking-wide">TranspoPilot</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
              {userName ? `Welcome, ${userName}!` : 'Welcome Aboard!'}
            </h2>
            
            <p className="text-blue-100/90 text-base sm:text-lg max-w-xl mx-auto font-medium leading-relaxed">
              You're all set to transform your fleet operations. Experience next-generation logistics management today.
            </p>
          </div>
        </div>

        {/* --- Bottom Content Section --- */}
        <div className="p-6 sm:p-10 bg-slate-50 flex-grow">
          
          {/* Feature Grid (Bento Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {features.map((feat, idx) => (
              <div 
                key={idx} 
                className="flex items-start p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all group"
              >
                <div className={`p-3 rounded-xl mr-4 ${feat.bg} ${feat.color} border ${feat.border} group-hover:scale-110 transition-transform duration-300`}>
                  <feat.icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{feat.title}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Telematics Integration Box */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 sm:p-6 border border-blue-100/50 mb-8 relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-white/40 to-transparent pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl shadow-sm border border-blue-100 flex items-center justify-center">
                <Plug className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-slate-900 mb-1">Ready to connect your fleet?</h3>
                <p className="text-sm text-slate-600 font-medium">
                  Sync Geotab, Samsara, or Motive to import your real vehicles. Or explore with demo data first.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {onConnectIntegration && (
              <button
                onClick={onConnectIntegration}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 group"
              >
                <Plug className="h-5 w-5 text-blue-400" />
                Connect Telematics
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
            
            <button
              onClick={onGetStarted}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-700 border-2 border-slate-200 px-6 py-4 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all group"
            >
              <Play className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
              Explore Demo Data
            </button>
          </div>

          {/* Footer Meta */}
          <div className="mt-8 text-center flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black tracking-widest bg-blue-100/50 text-blue-700 uppercase border border-blue-200/50">
              14-Day Free Trial
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <p className="text-xs font-semibold text-slate-500">No credit card required.</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;