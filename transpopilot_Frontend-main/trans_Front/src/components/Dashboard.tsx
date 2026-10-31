import React, { useState, useEffect,  } from 'react';
import {
  Activity,
  Shield,
  Users,
  Truck,
  Clock,
  CheckCircle,
  ArrowRight,
  Wifi,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats, getRecentAlerts, getTodayOperations, dispatchFleet } from '../api/dashboard';
import { API_BASE_URL } from '../lib/apiConfig';
import WelcomeModal from './WelcomeModal';
import OnboardingChecklist from './OnboardingChecklist';
import IntelligenceBrief from './IntelligenceBrief';
import MorningBriefModal from './MorningBriefModal';
import { useAppCache } from '../hooks/useAppCache';

interface VehicleStatus {
  id: string;
  vehicle_number: string;
  status: string;
  current_location?: unknown;
  driver_name?: string;
}

interface RecentTrip {
  id: string;
  vehicle_number: string;
  driver_name: string;
  distance: number;
  duration: number;
  status?: string;
  timestamp?: number;
}

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, profile, isAdmin, isFleetManager } = useAuth();
  const [tripsTimeframe, setTripsTimeframe] = useState<string>('week');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showChecklist, setShowChecklist] = useState(true);
  
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  // Caching
  const { data: statsData, isLoading: statsLoading, isValidating: statsValidating, revalidate: reloadStats } = useAppCache(
    'dashboard_stats',
    () => getDashboardStats()
  );

  const { data: alertsData, isLoading: alertsLoading, isValidating: alertsValidating, revalidate: reloadAlerts } = useAppCache(
    'dashboard_alerts',
    async () => {
      const data = await getRecentAlerts();
      const severityMap: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'INFO': 0, 'error': 4, 'warning': 3, 'info': 1, 'success': 0 };
      return [...(data || [])].sort((a: Alert, b: Alert) => {
        const aSev = severityMap[a.priority?.toUpperCase()] ?? severityMap[a.type?.toLowerCase()] ?? 0;
        const bSev = severityMap[b.priority?.toUpperCase()] ?? severityMap[b.type?.toLowerCase()] ?? 0;
        if (bSev !== aSev) return bSev - aSev;
        return new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime();
      });
    }
  );

  const { data: opsData, isLoading: opsLoading, isValidating: opsValidating, revalidate: reloadOps } = useAppCache(
    'dashboard_operations',
    () => getTodayOperations()
  );

  const { data: vehiclesData, isLoading: vehiclesLoading, isValidating: vehiclesValidating, revalidate: reloadVehicles } = useAppCache(
    'dashboard_vehicles',
    async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !profile?.organization_id) return [];
      const res = await fetch(`${API_BASE_URL}/api/vehicles-list?organizationId=${profile?.organization_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      return (json?.success && json?.data) ? json.data.slice(0, 4) : [];
    }
  );

  const { data: tripsData, isLoading: tripsLoading, isValidating: tripsValidating, revalidate: reloadTrips } = useAppCache(
    `dashboard_trips_${tripsTimeframe}`,
    async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !profile?.organization_id) return [];
      const res = await fetch(`${API_BASE_URL}/api/vehicle-trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationId: profile?.organization_id, timeframe: tripsTimeframe })
      });
      const json = await res.json();
      if (!json?.success || !json?.data) return [];
      
      const mapped = json.data.map((t: {id: string, vehicle_name: string, driver_name: string, distance: number | string, drivingDurationSec: number, start_time: string}) => ({
        id: t.id,
        vehicle_number: t.vehicle_name || 'Unknown',
        driver_name: t.driver_name || 'Unassigned',
        distance: typeof t.distance === 'number' ? Number(t.distance.toFixed(1)) : 0,
        duration: Math.round((t.drivingDurationSec || 0) / 60),
        status: 'Completed',
        timestamp: t.start_time ? new Date(t.start_time).getTime() : 0
      }));

      // Deduplicate by vehicle + distance + duration + timestamp approximation
      const seen = new Set();
      const deduped = mapped.filter((t: RecentTrip) => {
        const key = `${t.vehicle_number}_${t.distance}_${t.duration}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduped.slice(0, 10);
    },
    [tripsTimeframe]
  );

  const { data: integrationData, isLoading: integrationLoading, revalidate: reloadIntegrations } = useAppCache(
    'dashboard_integrations',
    async () => {
      if (!isAdmin()) return { connectedProviders: [], hasConnected: false };
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${API_BASE_URL}/api/admin/integrations/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const connected = json.data.filter((d: {status: string, provider_id: string}) => d.status === 'connected');
        if (connected.length > 0) {
          return { connectedProviders: connected.map((d: {provider_id: string}) => d.provider_id), hasConnected: true };
        }
      }
      return { connectedProviders: [], hasConnected: false };
    }
  );

  const { data: briefData, isLoading: briefLoading, error: briefError } = useAppCache(
    'dashboard_morning_brief',
    async () => {
      if (!isAdmin() && !isFleetManager()) return null;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Authentication required');
      const res = await fetch(`${API_BASE_URL}/api/fleet-intelligence/morning-brief`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load fleet intelligence');
      const json = await res.json();
      
      if (user && json && !json.error && json.confidence !== 'error') {
        const today = new Date().toISOString().split('T')[0];
        const key = `transpopilot_morning_brief_seen_${user.id}_${today}`;
        if (!localStorage.getItem(key)) {
          setShowMorningBriefModal(true);
        }
      }
      return json;
    }
  );

  const [showMorningBriefModal, setShowMorningBriefModal] = useState(false);

  const briefErrorMessage = briefError instanceof Error ? briefError.message : typeof briefError === 'string' ? briefError : undefined;

  useEffect(() => {
    if (user && profile) {
      checkOnboardingStatus();
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          reloadStats();
          reloadAlerts();
          reloadOps();
          reloadVehicles();
          reloadTrips();
          if (isAdmin()) reloadIntegrations();
        }
      }, 120000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  const checkOnboardingStatus = async () => {
    if (!profile) return;
    const welcomeSeen = localStorage.getItem(`welcome_modal_seen_${user?.id}`);
    if (!welcomeSeen || sessionStorage.getItem('trigger_onboarding_modal') === 'true') {
      sessionStorage.removeItem('trigger_onboarding_modal');
      setShowWelcomeModal(true);
    }
    const savedSteps = localStorage.getItem(`onboarding_steps_${user?.id}`);
    if (savedSteps) setCompletedSteps(JSON.parse(savedSteps));
    const dismissed = localStorage.getItem(`onboarding_dismissed_${user?.id}`);
    if (dismissed === 'true') setShowChecklist(false);
  };


  const closeMorningBriefModal = () => {
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const key = `transpopilot_morning_brief_seen_${user.id}_${today}`;
      localStorage.setItem(key, 'true');
    }
    setShowMorningBriefModal(false);
  };

  const isValidatingAny = statsValidating || alertsValidating || opsValidating || vehiclesValidating || tripsValidating;

  const getAlertStyle = (priority: string, type: string) => {
    const sev = priority?.toUpperCase() || type?.toUpperCase();
    if (sev === 'CRITICAL' || sev === 'ERROR') return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    if (sev === 'HIGH') return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    if (sev === 'MEDIUM' || sev === 'WARNING') return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    if (sev === 'INFO' || sev === 'SUCCESS') return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    return 'bg-slate-800 border-slate-700 text-slate-300';
  };

  const getAlertIconColor = (priority: string, type: string) => {
    const sev = priority?.toUpperCase() || type?.toUpperCase();
    if (sev === 'CRITICAL' || sev === 'ERROR') return 'bg-rose-500';
    if (sev === 'HIGH') return 'bg-orange-500';
    if (sev === 'MEDIUM' || sev === 'WARNING') return 'bg-amber-500';
    if (sev === 'INFO' || sev === 'SUCCESS') return 'bg-blue-500';
    return 'bg-slate-500';
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 space-y-8 font-sans text-slate-200">
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={async () => { setShowWelcomeModal(false); localStorage.setItem('welcome_modal_seen_' + user?.id, 'true'); }}
        onGetStarted={async () => { setShowWelcomeModal(false); localStorage.setItem('welcome_modal_seen_' + user?.id, 'true'); }}
        onConnectIntegration={async () => { setShowWelcomeModal(false); localStorage.setItem('welcome_modal_seen_' + user?.id, 'true'); if (onNavigate) onNavigate('integrations'); }}
        userName={profile?.full_name}
      />

      <MorningBriefModal
        isOpen={showMorningBriefModal && !showWelcomeModal}
        onClose={closeMorningBriefModal}
        data={briefData}
        loading={briefLoading}
        error={briefErrorMessage}
        userName={profile?.full_name}
        onNavigate={onNavigate}
      />

      {showChecklist && localStorage.getItem(`onboarding_completed_${user?.id}`) !== 'true' && (
        <OnboardingChecklist
          completedSteps={completedSteps}
          onStepClick={(route) => onNavigate && onNavigate(route)}
          onDismiss={async () => { setShowChecklist(false); localStorage.setItem('onboarding_dismissed_' + user?.id, 'true'); }}
          isVisible={true}
        />
      )}

      {(isAdmin() || isFleetManager()) && (
        <IntelligenceBrief 
          onNavigate={onNavigate} 
          userName={profile?.full_name} 
          data={briefData}
          loading={briefLoading}
          error={briefErrorMessage}
        />
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Good Morning, {profile?.full_name?.split(' ')[0] || 'Commander'}
            {isValidatingAny && (
               <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                 <RefreshCw className="h-3 w-3 animate-spin" />
                 Updating...
               </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Here's what needs your attention across the fleet today.</p>
        </div>
        <div className="flex items-center gap-3">
            {integrationLoading ? (
               <div className="animate-pulse bg-slate-800 h-8 w-32 rounded-md"></div>
            ) : integrationData?.hasConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {integrationData.connectedProviders.join(' & ').toUpperCase()} CONNECTED
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-500 text-xs font-semibold">
                 <Wifi className="h-3 w-3" />
                 TELEMATICS OFFLINE
              </div>
            )}
        </div>
      </div>

      {/* TOP KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Vehicles</p>
            <Truck className="h-5 w-5 text-blue-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">
            {statsLoading ? <span className="animate-pulse bg-slate-800 h-8 w-16 rounded-md inline-block"></span> : (statsData?.activeVehicles || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Tracking flawlessly</p>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Duty Drivers</p>
            <Users className="h-5 w-5 text-indigo-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">
            {statsLoading ? <span className="animate-pulse bg-slate-800 h-8 w-16 rounded-md inline-block"></span> : (statsData?.activeDrivers || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium"><span className="text-emerald-400">Stable</span> vs last week</p>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet Safety</p>
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">
            {statsLoading ? <span className="animate-pulse bg-slate-800 h-8 w-16 rounded-md inline-block"></span> : Math.round(statsData?.safetyScore || 0)}<span className="text-xl text-slate-500 font-medium ml-1">%</span>
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">Compliance met</p>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Time Rate</p>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">
            {statsLoading ? <span className="animate-pulse bg-slate-800 h-8 w-16 rounded-md inline-block"></span> : (statsData?.onTimeRate || 0).toFixed(1)}<span className="text-xl text-slate-500 font-medium ml-1">%</span>
          </h3>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${statsData?.onTimeRate || 0}%` }}></div>
          </div>
        </div>
      </div>

      {/* SECOND ROW: Priority Actions & AI Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Today's Priority Actions
            </h2>
            <p className="text-slate-400 text-sm mb-6">
               {opsLoading ? (
                 <span className="animate-pulse bg-slate-800 h-4 w-48 rounded inline-block"></span>
               ) : opsData ? (
                  opsData.stage === 'live_operations' 
                    ? `${opsData.liveOperations?.activeVehicles || 0} active routes in progress.` 
                    : `${opsData.dispatchableRoutes?.length || 0} routes ready for dispatch.`
               ) : (
                  "No pending fleet operations."
               )}
            </p>
          </div>
          <div>
            <button 
               onClick={() => onNavigate && onNavigate('fleet-operations')}
               className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-500 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-blue-500/20"
            >
               View Fleet Operations
            </button>
          </div>
        </div>

        {/* AI Copilot */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              TranspoPilot AI Copilot
            </h2>
            <div className="space-y-2 mb-6">
               <p className="text-sm text-slate-300">
                 Identified <strong className="text-white">Optimization Opportunities</strong> across active routes today.
               </p>
               <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                 <li>Review recent telemetry and idle times to save fuel.</li>
                 <li>Check vehicle health reports for preventative maintenance.</li>
               </ul>
            </div>
          </div>
          <div>
            <button
              onClick={() => onNavigate && onNavigate('route-optimization')}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              View Optimization Plan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* THIRD ROW: Telematics Stream & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Telematics Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Telematics Stream</h3>
            <button onClick={() => onNavigate && onNavigate('live-tracking')} className="text-xs text-blue-400 font-semibold hover:text-blue-300 transition-colors">
              View Map &rarr;
            </button>
          </div>
          <div className="p-3 flex-1">
            {vehiclesLoading && (!vehiclesData || vehiclesData.length === 0) ? (
               <div className="space-y-2">
                 {[1,2,3].map(i => <div key={i} className="animate-pulse bg-slate-800 h-12 w-full rounded-lg"></div>)}
               </div>
            ) : (!vehiclesData || vehiclesData.length === 0) ? (
              <div className="flex flex-col items-center justify-center text-center h-full py-8 text-slate-500">
                <Wifi className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-sm font-medium">No live vehicles streaming.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehiclesData.map((vehicle: VehicleStatus) => (
                  <div key={vehicle.id} className="p-3 hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-2.5 w-2.5">
                        {vehicle.status === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${vehicle.status === 'active' ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">{vehicle.vehicle_number}</p>
                        <p className="text-xs text-slate-500">{vehicle.driver_name || 'Unassigned'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">{vehicle.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Alerts</h3>
            <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 font-medium">{alertsData?.length || 0} Active</span>
          </div>
          <div className="p-3 flex-1 overflow-y-auto max-h-64">
            {alertsLoading && (!alertsData || alertsData.length === 0) ? (
               <div className="space-y-2">
                 {[1,2].map(i => <div key={i} className="animate-pulse bg-slate-800 h-16 w-full rounded-lg"></div>)}
               </div>
            ) : (!alertsData || alertsData.length === 0) ? (
              <div className="flex flex-col items-center justify-center text-center h-full py-8 text-slate-500">
                <CheckCircle className="h-6 w-6 mb-2 opacity-50 text-emerald-500" />
                <p className="text-sm font-medium">All systems clear.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertsData.map((alert: {id: string, priority?: string, type?: string, time: string, message: string}) => {
                  const styleStr = getAlertStyle(alert.priority, alert.type);
                  const iconColor = getAlertIconColor(alert.priority, alert.type);
                  const severityText = alert.priority?.toUpperCase() || alert.type?.toUpperCase() || 'INFO';
                  
                  return (
                    <div key={alert.id} className={`p-3 rounded-lg border flex gap-3 items-start ${styleStr}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${iconColor}`}></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{severityText}</span>
                          <span className="text-[10px] font-medium opacity-60">{alert.time}</span>
                        </div>
                        <p className="text-sm font-semibold mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOURTH ROW: Recent AI-Logged Trips */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Telematics Trips</h3>
          <select
            value={tripsTimeframe}
            onChange={(e) => setTripsTimeframe(e.target.value)}
            className="bg-slate-800 border-none text-xs text-slate-300 rounded px-2 py-1 focus:ring-0 outline-none cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
        <div className="p-0">
          {tripsLoading && (!tripsData || tripsData.length === 0) ? (
             <div className="p-4 space-y-3">
               {[1,2,3].map(i => <div key={i} className="animate-pulse bg-slate-800 h-12 w-full rounded-lg"></div>)}
             </div>
          ) : (!tripsData || tripsData.length === 0) ? (
             <div className="p-8 text-center text-slate-500">
               <p className="text-sm font-medium">No recent trips recorded for this timeframe.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3 rounded-tl-xl">Vehicle</th>
                    <th className="px-5 py-3">Driver</th>
                    <th className="px-5 py-3">Distance</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tripsData.map((trip: RecentTrip) => (
                    <tr key={trip.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3 font-semibold text-white">{trip.vehicle_number}</td>
                      <td className="px-5 py-3 text-slate-400">{trip.driver_name}</td>
                      <td className="px-5 py-3 text-slate-300">{trip.distance} mi</td>
                      <td className="px-5 py-3 text-slate-300">{Math.floor(trip.duration / 60)}h {trip.duration % 60}m</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400">
                          {trip.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-slate-800 text-center">
                 <button onClick={() => onNavigate && onNavigate('live-tracking')} className="text-xs font-bold text-blue-400 hover:text-blue-300">
                    View All Trips
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Dispatch Modal */}
      {showDispatchModal && opsData?.dispatchableRoutes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-800">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Confirm Dispatch</h2>
              <p className="text-slate-400 mt-1 text-sm">You are about to dispatch {opsData.dispatchableRoutes.length} route(s).</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {dispatchError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm font-semibold mb-4">
                  {dispatchError}
                </div>
              )}
              {opsData.dispatchableRoutes.map((r: {route_id: string, route_name: string, vehicle_name?: string, distance: number, pre_trip_status?: string}) => (
                <div key={r.route_id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Route</p>
                      <p className="font-semibold text-white text-sm">{r.route_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vehicle</p>
                      <p className="font-semibold text-white text-sm">{r.vehicle_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Distance</p>
                      <p className="font-semibold text-white text-sm">{r.distance} mi</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pre-Trip</p>
                      <p className="font-semibold uppercase text-emerald-400 text-sm">{r.pre_trip_status || 'passed'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-950">
              <button onClick={() => setShowDispatchModal(false)} disabled={dispatching} className="px-5 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 transition-colors">Cancel</button>
              <button 
                onClick={async () => {
                  setDispatching(true);
                  setDispatchError(null);
                  const res = await dispatchFleet(opsData.dispatchableRoutes.map((r: {route_id: string, route_name: string, vehicle_name?: string, distance: number, pre_trip_status?: string}) => r.route_id));
                  setDispatching(false);
                  if (res && res.success) {
                    setShowDispatchModal(false);
                    reloadOps();
                  } else {
                    setDispatchError(res?.message || "Unable to dispatch this route right now. Please retry.");
                  }
                }} 
                disabled={dispatching} 
                className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-500 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {dispatching && <Loader2 className="w-4 h-4 animate-spin" />}
                {dispatching ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;