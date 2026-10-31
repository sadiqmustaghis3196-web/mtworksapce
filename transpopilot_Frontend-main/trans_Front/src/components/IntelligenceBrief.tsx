import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, AlertTriangle, Truck, Shield, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';

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

interface IntelligenceBriefProps {
  onNavigate?: (page: string) => void;
  userName?: string;
  data: IntelligenceData | null;
  loading: boolean;
  error: string | null;
}

const IntelligenceBrief: React.FC<IntelligenceBriefProps> = ({ 
  onNavigate, 
  userName,
  data,
  loading,
  error 
}) => {
  if (loading) {
    return (
      <div className="bg-brand-bg-secondary rounded-2xl border border-slate-700/50 p-6 animate-pulse mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <Sparkles className="w-6 h-6 text-indigo-400" />
          <div className="h-6 w-48 bg-slate-700 rounded-md"></div>
        </div>
        <div className="h-8 w-3/4 bg-slate-800 rounded-md mb-6"></div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-800 rounded-md"></div>
          <div className="h-4 w-5/6 bg-slate-800 rounded-md"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-900/20 border border-rose-500/30 rounded-2xl p-6 mb-8 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <h3 className="text-rose-100 font-semibold mb-2">Unable to load fleet intelligence right now</h3>
        <p className="text-rose-300 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 mb-8 text-center">
        <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <h3 className="text-slate-200 font-semibold mb-2">Fleet intelligence is not available yet</h3>
        <p className="text-slate-400 text-sm">Not enough synced fleet data to generate insights.</p>
      </div>
    );
  }

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
    <div className="bg-gradient-to-br from-indigo-900/40 via-brand-bg-secondary to-brand-bg-secondary rounded-2xl border border-indigo-500/30 p-6 mb-8 relative overflow-hidden shadow-2xl">
      {/* Background glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            TranspoPilot Intelligence
          </h2>
        </div>
        <div className="text-xs text-slate-400">
          Generated: {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 flex flex-col justify-center">
          {userName && (
            <h3 className="text-xl lg:text-2xl font-semibold text-slate-300 mb-2">
              Good morning, {userName.split(' ')[0]}
            </h3>
          )}
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-6 leading-tight">
            {data.headline.replace(/Good morning\.?\s*/i, '')}
          </h3>
          
          <ul className="space-y-3 mb-6">
            {data.summary.map((point, idx) => (
              <li key={idx} className="flex items-start">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-1 mr-3 flex-shrink-0" />
                <span className="text-slate-300 leading-relaxed text-sm lg:text-base">{point}</span>
              </li>
            ))}
          </ul>

          {data.estimatedAvoidableCost > 0 && (
            <div className="inline-flex items-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 mt-2 w-max">
              <span className="text-emerald-400 font-semibold mr-2">Estimated Avoidable Cost:</span>
              <span className="text-white font-bold">${data.estimatedAvoidableCost.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-slate-900/50 rounded-xl p-5 border border-slate-700/50">
          <h4 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider flex items-center">
            Top Priority Actions
          </h4>
          
          <div className="space-y-3">
            {data.topActions && data.topActions.length > 0 ? (
              data.topActions.map((action, idx) => (
                <div key={idx} className="bg-brand-bg rounded-lg p-3 border border-slate-700 hover:border-indigo-500/50 transition-colors group">
                  <div className="flex items-start">
                    <div className="bg-slate-800 p-2 rounded-lg mr-3">
                      {getActionIcon(action.type)}
                    </div>
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-white mb-1">{action.title}</h5>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-2">{action.reason}</p>
                      {onNavigate && (
                        <button 
                          onClick={() => onNavigate(getActionLink(action.type))}
                          className="text-xs text-indigo-400 font-medium flex items-center hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          View Details <ArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">You're clear to begin today's operation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceBrief;
