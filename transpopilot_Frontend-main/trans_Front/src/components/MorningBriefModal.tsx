import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle, Shield, Clock, CheckCircle, ArrowRight } from 'lucide-react';

interface TopAction {
  priority: number;
  type: string;
  title: string;
  reason: string;
  vehicleId?: string;
  driverId?: string;
}

interface IntelligenceData {
  headline: string;
  summary: string[];
  topActions: TopAction[];
  estimatedAvoidableCost: number;
  confidence: string;
  generatedAt: string;
}

interface MorningBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: IntelligenceData | null;
  loading: boolean;
  error: string | null;
  userName?: string;
  onNavigate?: (page: string) => void;
}

const MorningBriefModal: React.FC<MorningBriefModalProps> = ({
  isOpen,
  onClose,
  data,
  loading,
  error,
  userName,
  onNavigate
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getActionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'maintenance': return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'safety': return <Shield className="w-5 h-5 text-amber-400" />;
      case 'idle': return <Clock className="w-5 h-5 text-blue-400" />;
      default: return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getActionLink = (type: string) => {
    switch (type.toLowerCase()) {
      case 'maintenance': return 'vehicle-health';
      case 'safety': return 'driver-behavior';
      case 'idle': return 'tracking';
      default: return 'dashboard';
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden transition-all duration-500 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className={`relative bg-[#0b0f19] border border-indigo-500/30 rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden transition-all duration-500 ease-out transform ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}>
        
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 transition-colors z-20"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative bg-gradient-to-br from-indigo-900/50 via-slate-900 to-slate-900 px-8 py-10 overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-6">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-indigo-300 font-medium text-xs tracking-wide uppercase">Morning Intelligence</span>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2">
              Good morning{userName ? `, ${userName.split(' ')[0]}` : ''}
            </h2>
            <p className="text-slate-400 text-lg">
              Here's what needs your attention today.
            </p>
          </div>
        </div>

        <div className="p-8 flex-grow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse mb-4" />
              <p className="text-slate-300">Preparing your fleet intelligence...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
              <p className="text-slate-300">{error === 'Fleet intelligence is temporarily unavailable.' ? error : 'Unable to load fleet intelligence right now.'}</p>
            </div>
          ) : !data ? (
            <div className="text-center py-12">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-300">Fleet intelligence is not available yet because there is not enough synced fleet data.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">
                  {data.headline.replace(/Good morning\.?\s*/i, '')}
                </h3>
                <ul className="space-y-2 mb-4">
                  {data.summary.map((point, idx) => (
                    <li key={idx} className="flex items-start text-slate-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 mr-3 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
                {data.estimatedAvoidableCost > 0 && (
                  <div className="inline-flex items-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 mt-2">
                    <span className="text-emerald-400 font-medium text-sm mr-2">Estimated Avoidable Cost:</span>
                    <span className="text-white font-bold text-sm">${data.estimatedAvoidableCost.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {data.topActions && data.topActions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Top Recommended Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.topActions.map((action, idx) => (
                      <div key={idx} className="bg-slate-900 rounded-lg p-3 border border-slate-700/50 flex items-start">
                        <div className="bg-slate-800 p-2 rounded-lg mr-3">
                          {getActionIcon(action.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-bold text-white truncate">{action.title}</h5>
                          <p className="text-xs text-slate-400 truncate">{action.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border-t border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {data ? `Brief generated at ${new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
            >
              View Full Dashboard
            </button>
            {data?.topActions?.length ? (
              <button 
                onClick={() => {
                  onClose();
                  if (onNavigate) onNavigate(getActionLink(data.topActions[0].type));
                }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
              >
                Review Top Actions <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorningBriefModal;
