/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { 
  Truck, CheckCircle, Navigation, 
  Play, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getTodayOperations, dispatchFleet } from '../api/dashboard';

interface FleetOperationsProps {
  onNavigate?: (tab: string) => void;
}

interface Waypoint {
  status: string;
}

interface OperationRoute {
  id?: string;
  route_id?: string;
  waypoints?: Waypoint[];
  vehicle_number?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  [key: string]: unknown;
}

interface BlockersData {
  id: string;
  description: string;
  vehicle_number?: string;
}

interface OperationsData {
  dispatchableRoutes?: OperationRoute[];
  liveOperations?: {
    inProgressRoutes?: OperationRoute[];
  };
  completedRoutes?: OperationRoute[];
  blockers?: BlockersData[];
}

const FleetManagerDashboard: React.FC<FleetOperationsProps> = ({ onNavigate }) => {
  const { profile, isAdmin, isFleetManager, isDispatcher } = useAuth();
  const [activeTab, setActiveTab] = useState<'ready' | 'live' | 'completed'>('ready');
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedRoutesToDispatch, setSelectedRoutesToDispatch] = useState<OperationRoute[]>([]);

  const canAccessFleetOperations = isAdmin() || isFleetManager() || isDispatcher();

  const loadData = async () => {
    if (!profile?.organization_id) {
      setOperations({ dispatchableRoutes: [], liveOperations: { inProgressRoutes: [] }, completedRoutes: [], blockers: [] });
      setLoading(false);
      return;
    }
    try {
      const data = await getTodayOperations();
      if (data) setOperations(data);
    } catch (err) {
      console.error('Failed to load fleet operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessFleetOperations) {
      setLoading(false);
      return;
    }
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [profile?.organization_id, canAccessFleetOperations]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDispatch = async () => {
    setDispatching(true);
    const routeIds = selectedRoutesToDispatch.map(r => r.route_id || r.id);
    const res = await dispatchFleet(routeIds);
    setDispatching(false);
    if (res && res.success) {
      setShowDispatchModal(false);
      loadData();
      setActiveTab('live');
    } else {
      alert(res?.message || 'Failed to dispatch');
    }
  };

  const handleTrackVehicle = (vehicleId: string, routeId: string) => {
    if (onNavigate) {
      const params = new URLSearchParams();
      params.set('vehicle', vehicleId);
      params.set('route', routeId);
      window.history.pushState({}, '', '?' + params.toString());
      onNavigate('live-tracking');
    }
  };

  if (!canAccessFleetOperations) {
    return (
      <div className="p-4 sm:p-8 space-y-8 min-h-screen bg-brand-bg flex flex-col items-center justify-center font-sans">
        <div className="max-w-md text-center bg-slate-900 p-8 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-black text-white mb-2">Access Restricted</h2>
          <p className="text-slate-400 mb-8 font-medium">You do not have permission to view Fleet Operations.</p>
          <div className="flex gap-4">
            <button 
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="flex-1 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold py-3 px-4 rounded-xl transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !operations) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const dispatchableRoutes = operations?.dispatchableRoutes || [];
  const liveRoutes = operations?.liveOperations?.inProgressRoutes || [];
  const completedRoutes = operations?.completedRoutes || [];

  return (
    <div className="p-4 sm:p-8 space-y-8 min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white">Fleet Operations</h1>
        <p className="text-slate-400 mt-2 font-medium">Manage today's dispatch and live routes.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ready to Dispatch</p>
          <p className="text-3xl font-black text-white">{dispatchableRoutes.length}</p>
        </div>
        <div className="bg-indigo-900/20 border border-indigo-500/30 p-5 rounded-2xl">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">In Progress</p>
          <p className="text-3xl font-black text-indigo-100">{liveRoutes.length}</p>
        </div>
        <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Needs Attention</p>
          <p className="text-3xl font-black text-red-100">{operations?.blockers?.length || 0}</p>
        </div>
        <div className="bg-emerald-900/20 border border-emerald-500/30 p-5 rounded-2xl">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Completed Today</p>
          <p className="text-3xl font-black text-emerald-100">{completedRoutes.length}</p>
        </div>
      </div>

      <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl mb-6 w-full md:w-fit">
        <button
          onClick={() => setActiveTab('ready')}
          className={`flex-1 md:w-32 py-2.5 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'ready' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          READY
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 md:w-32 py-2.5 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'live' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          LIVE
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 md:w-32 py-2.5 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'completed' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          COMPLETED
        </button>
      </div>

      {activeTab === 'ready' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Routes Ready for Dispatch</h2>
            {dispatchableRoutes.length > 0 && (
              <button
                onClick={() => {
                  setSelectedRoutesToDispatch(dispatchableRoutes);
                  setShowDispatchModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" /> Dispatch All Ready
              </button>
            )}
          </div>

          {dispatchableRoutes.length === 0 ? (
            <div className="text-center p-12 bg-slate-900 rounded-2xl border border-white/5">
              <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No routes pending dispatch.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {dispatchableRoutes.map((r: OperationRoute) => (
                <div key={r.route_id} className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/20 transition-colors">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Route</p>
                      <p className="font-semibold text-white">{r.route_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Vehicle & Driver</p>
                      <p className="font-semibold text-white">{r.vehicle_name || 'N/A'}</p>
                      <p className="text-sm text-slate-400">Driver Assigned</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Trip Details</p>
                      <p className="font-semibold text-white">{r.distance} mi • {r.duration} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Pre-Trip</p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 uppercase">
                        <CheckCircle className="w-3 h-3" /> {r.pre_trip_status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRoutesToDispatch([r]);
                      setShowDispatchModal(true);
                    }}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-2.5 rounded-xl font-bold transition-colors whitespace-nowrap"
                  >
                    Dispatch
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'live' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Active Routes</h2>
          </div>
          
          {liveRoutes.length === 0 ? (
            <div className="text-center p-12 bg-slate-900 rounded-2xl border border-white/5">
              <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No live routes in progress.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {liveRoutes.map((r: any) => {
                const totalStops = r.waypoints ? r.waypoints.length : 0;
                const completedStops = r.waypoints ? r.waypoints.filter((w: any) => w.status === 'completed').length : 0;
                
                return (
                  <div key={r.id} className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 flex-1">
                      <div className="md:col-span-2">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Route</p>
                        <p className="font-bold text-white flex items-center gap-2">
                          {r.name}
                          <span className="px-2 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-400 rounded-md uppercase tracking-wider">In Progress</span>
                        </p>
                        <p className="text-sm text-slate-400 mt-1">Started: {r.started_at ? new Date(r.started_at).toLocaleTimeString() : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Vehicle</p>
                        <p className="font-semibold text-white">{r.vehicle?.vehicle_number || 'N/A'}</p>
                        <p className="text-sm text-slate-400">{r.driver?.first_name || 'Driver'} {r.driver?.last_name || ''}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Stops</p>
                        <p className="font-semibold text-white">{completedStops} / {totalStops}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Distance</p>
                        <p className="font-semibold text-white">{r.estimated_distance} mi</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleTrackVehicle(r.vehicle_id, r.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Navigation className="w-4 h-4" /> Track Vehicle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Completed Today</h2>
          </div>
          
          {completedRoutes.length === 0 ? (
            <div className="text-center p-12 bg-slate-900 rounded-2xl border border-white/5">
              <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No routes completed yet today.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {completedRoutes.map((r: any) => {
                const totalStops = r.waypoints ? r.waypoints.length : 0;
                const completedStops = r.waypoints ? r.waypoints.filter((w: any) => w.status === 'completed').length : 0;
                
                return (
                  <div key={r.id} className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1 opacity-70">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Route</p>
                        <p className="font-bold text-white">{r.name}</p>
                        <p className="text-sm text-slate-400 mt-1">Finished: {r.completed_at ? new Date(r.completed_at).toLocaleTimeString() : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Vehicle</p>
                        <p className="font-semibold text-white">{r.vehicle?.vehicle_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Stops</p>
                        <p className="font-semibold text-white">{completedStops} / {totalStops}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Status</p>
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 uppercase">
                          <CheckCircle className="w-3 h-3" /> Completed
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/10">
            <div className="p-6 border-b border-white/10 bg-slate-800">
              <h2 className="text-2xl font-black text-white">Confirm Dispatch</h2>
              <p className="text-slate-400 mt-1">You are about to dispatch {selectedRoutesToDispatch.length} route(s).</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {selectedRoutesToDispatch.map((r: any) => (
                <div key={r.route_id || r.id} className="bg-slate-800 p-4 rounded-xl border border-white/10">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Route Name</p>
                      <p className="text-sm font-medium text-white truncate" title={r.route_name || r.name}>{r.route_name || r.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Vehicle</p>
                      <p className="text-sm font-medium text-white">{r.vehicle_name || r.vehicle?.vehicle_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Distance</p>
                      <p className="text-sm font-medium text-white">{r.distance || r.estimated_distance} mi</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Pre-Trip</p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 uppercase">
                        <CheckCircle size={12} /> {r.pre_trip_status || r.preTripStatus || 'passed'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-white/10 bg-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setShowDispatchModal(false)} 
                className="px-6 py-2 rounded-lg text-slate-400 hover:text-white font-medium transition-colors"
                disabled={dispatching}
              >
                Cancel
              </button>
              <button 
                onClick={handleDispatch} 
                disabled={dispatching}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {dispatching ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManagerDashboard;
