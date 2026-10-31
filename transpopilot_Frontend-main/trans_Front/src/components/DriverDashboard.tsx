import React, { useEffect, useState, useCallback } from 'react';
import { Truck, CheckCircle, Navigation, Shield, FileText, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDriverMetrics, getDriverIncidents, calculateDriverScores } from '../api/driverBehaviorAI';
import { API_BASE_URL } from '../lib/apiConfig';
import PreTripModal from './PreTripModal';

const DriverDashboard: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  
  // Only loading state for the main assignment block, not full screen
  const [loading, setLoading] = useState(true);
  
  const [vehicle, setVehicle] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [driverData, setDriverData] = useState<any>(null);
  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [todayOp, setTodayOp] = useState<any>(null);
  
  const [showPreTrip, setShowPreTrip] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeWaypoints, setRouteWaypoints] = useState<any[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [preTripId, setPreTripId] = useState<string | null>(null);
  const [startingPreTrip, setStartingPreTrip] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preTripError, setPreTripError] = useState<string | null>(null);

  // Separate function to allow manual retry
  const fetchDriverData = async (controller: AbortController, isRetry: boolean = false) => {
    // Remove manual timeout to prevent artificial AbortErrors
    // We will let the browser or backend handle real timeouts

    try {
      if (isRetry) setLoading(true);
      setLoadError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch(`${API_BASE_URL}/api/driver/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: controller.signal
      });
      const data = await res.json();
      
      if (data.success && data.data.driver) {
        setDriverData(data.data.driver);
        if (data.data.vehicle) setVehicle(data.data.vehicle);
        if (data.data.onboarding) setOnboarding(data.data.onboarding);
        
        try {
          const metrics = await getDriverMetrics(data.data.driver.id);
          const incidents = await getDriverIncidents(data.data.driver.id);
          const scores = calculateDriverScores(metrics, incidents);
          setSafetyScore(scores.overall);
        } catch (scoreErr) {
          console.error("Failed to load safety score", scoreErr);
        }
      }

      const opRes = await fetch(`${API_BASE_URL}/api/operations/driver/today`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: controller.signal
      });
      const opData = await opRes.json();
      if (opData.success) {
        setTodayOp(opData.data);
      } else {
        throw new Error(opData.message || opData.error || 'Failed to load route assignment');
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // intentional abort (e.g. unmount) should be ignored
        return;
      }
      console.error('Failed to load driver data', error);
      setLoadError(`Unable to load today's assignment. Retry. (Reason: ${error.message})`);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    fetchDriverData(controller);

    return () => {
      controller.abort(); // React StrictMode cleanup will abort immediately, producing no user error
    };
  }, [user?.id]); // Stable dependency

  const handleStartPreTrip = async () => {
    if (!todayOp?.route?.id || !todayOp?.route?.vehicle_id || !todayOp?.driver_id) return;
    
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);
    
    try {
      setStartingPreTrip(true);
      setPreTripError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE_URL}/api/operations/pre-trip/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          route_id: todayOp.route.id,
          vehicle_id: todayOp.route.vehicle_id,
          driver_id: todayOp.driver_id
        }),
        signal: controller.signal
      });
      const data = await res.json();
      if (data.success) {
        setPreTripId(data.data.id);
        setShowPreTrip(true);
      } else {
        setPreTripError("Could not start pre-trip. Please try again.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && timedOut) {
        setPreTripError("Request timed out. Please try again.");
      } else {
        setPreTripError("Could not start pre-trip. Please try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      setStartingPreTrip(false);
    }
  };

  const handlePreTripSuccess = () => {
    setShowPreTrip(false);
    const controller = new AbortController();
    fetchDriverData(controller, true);
  };

  const handleCompleteWaypoint = async (wpId: string) => {
    try {
      const { error } = await supabase.from('route_waypoints').update({ 
        status: 'completed', 
        actual_departure: new Date().toISOString() 
      }).eq('id', wpId);
      
      if (error) throw error;
      
      setRouteWaypoints(prev => prev.map(wp => wp.id === wpId ? { ...wp, status: 'completed' } : wp));
    } catch (err) {
      console.error('Failed to complete waypoint:', err);
    }
  };

  const currentStatus = onboarding?.overall_status || driverData?.onboarding_status || 'PENDING';
  const formatStatus = (s: string) => s?.replace('_', ' ').toUpperCase();
  const isActive = currentStatus === 'active';

  return (
    <div className="min-h-screen bg-brand-bg p-4 sm:p-8 space-y-8 font-sans selection:bg-indigo-500/30">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome, {profile?.full_name}</h1>
        <p className="text-brand-muted mt-2">Here is your driver overview</p>
      </div>

      {/* TODAY'S ASSIGNMENT SECTION */}
      {loadError && (
        <div className="bg-red-900/50 border border-red-500 rounded-[2rem] p-6 mb-8 text-center">
          <p className="text-red-400 font-bold mb-2">{loadError}</p>
          <button 
            onClick={() => fetchDriverData(new AbortController(), true)} 
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      
      {!loadError && (
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] border border-brand-border shadow-sm p-6 mb-8 min-h-[200px]">
          <h3 className="text-xl font-bold text-white mb-4">TODAY'S ASSIGNMENT</h3>
          {preTripError && (
             <div className="mb-4 p-3 bg-red-900/50 text-red-400 border border-red-500 rounded-lg text-sm font-medium">{preTripError}</div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : todayOp?.route ? (
            <div className="bg-brand-bg-secondary rounded-xl p-5 border border-brand-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
                <div>
                  <p className="text-sm text-brand-muted">Route</p>
                  <p className="font-semibold text-lg">{todayOp.route.name}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Vehicle</p>
                  <p className="font-semibold">{todayOp.route.vehicle?.vehicle_number || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Distance</p>
                  <p className="font-semibold">{todayOp.route.estimated_distance} mi</p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Duration</p>
                  <p className="font-semibold">{todayOp.route.estimated_duration} mins</p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Status</p>
                  <p className="font-semibold uppercase text-blue-400">{todayOp.route.status}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-muted">Pre-Trip</p>
                  <p className="font-semibold uppercase text-blue-400">{todayOp.preTrip?.status || 'not_started'}</p>
                </div>
              </div>

              {todayOp.preTrip?.status === 'failed' && (
                <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
                  <p className="text-red-400 font-bold mb-1">Pre-Trip Failed</p>
                  <p className="text-sm text-red-200">Failed items: {todayOp.preTrip.failed_items?.join(', ')}</p>
                  <p className="text-sm text-red-200 mt-2">Awaiting Fleet Manager review</p>
                </div>
              )}

              <div className="mt-6 flex gap-4">
                <button 
                  onClick={async () => {
                    if (todayOp?.route?.id) {
                      setLoadingRoute(true);
                      setRouteError(null);
                      setShowRouteModal(true);
                      try {
                        const { data, error } = await supabase.from('route_waypoints').select('*').eq('route_id', todayOp.route.id).order('sequence_number', { ascending: true });
                        if (error) throw error;
                        setRouteWaypoints(data || []);
                      } catch (err) {
                        console.error('Failed to load waypoints:', err);
                        setRouteError('Unable to load route details. Please retry.');
                      } finally {
                        setLoadingRoute(false);
                      }
                    }
                  }} 
                  className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  View Route
                </button>
                
                {todayOp.route.status === 'planned' && (!todayOp.preTrip || todayOp.preTrip.status === 'in_progress') && (
                  <button 
                    onClick={handleStartPreTrip} 
                    disabled={startingPreTrip}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {startingPreTrip && <Loader2 className="w-4 h-4 animate-spin" />}
                    {startingPreTrip ? 'Starting...' : 'Start Pre-Trip'}
                  </button>
                )}
                {todayOp.route.status === 'planned' && todayOp.preTrip?.status === 'passed' && (
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold px-4 py-2 border border-emerald-500/30 rounded-lg bg-emerald-900/20">
                    <CheckCircle className="w-5 h-5" />
                    Pre-Trip Complete — Waiting for Dispatch
                  </div>
                )}
                {todayOp.route.status === 'in_progress' && (
                  <div className="flex items-center gap-2 text-blue-400 font-semibold px-4 py-2 border border-blue-500/30 rounded-lg bg-blue-900/20">
                    <CheckCircle className="w-5 h-5" />
                    Route In Progress
                  </div>
                )}
                {todayOp.route.status === 'completed' && (
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold px-4 py-2 border border-emerald-500/30 rounded-lg bg-emerald-900/20">
                    <CheckCircle className="w-5 h-5" />
                    Route Completed
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-brand-muted p-4 bg-brand-bg-secondary rounded-lg border border-brand-border">No route assigned for today.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Onboarding Status Card */}
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] border border-brand-border shadow-sm p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white tracking-tight">Onboarding</h3>
            <div className={`p-2 rounded-xl ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mb-1">{formatStatus(currentStatus)}</p>
          <p className="text-sm font-medium text-brand-muted mb-4">
            {isActive ? 'You are fully compliant and ready to drive' : 'Complete your compliance documents'}
          </p>
          {!isActive && (
            <button 
              onClick={() => onNavigate && onNavigate('my-onboarding')}
              className="w-full py-2 bg-brand-bg-secondary text-brand-accent border border-brand-accent rounded-xl font-semibold hover:bg-blue-600/30 transition-colors"
            >
              Go to Onboarding
            </button>
          )}
        </div>

        {/* Safety Score Card */}
        <div className="bg-brand-card backdrop-blur-xl rounded-[2rem] border border-brand-border shadow-sm p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white tracking-tight">Safety Score</h3>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Shield className="h-6 w-6" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <p className="text-3xl font-black text-white">{safetyScore !== null ? safetyScore : '--'}</p>
            <p className="text-sm font-medium text-brand-muted">/ 100</p>
          </div>
          <p className="text-sm font-medium text-brand-muted mb-4">Based on recent driving history</p>
          <button 
            onClick={() => onNavigate && onNavigate('safety-compliance')}
            className="w-full py-2 bg-brand-bg-secondary text-brand-accent border border-brand-accent rounded-xl font-semibold hover:bg-blue-600/30 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
      
      {showPreTrip && preTripId && (
        <PreTripModal 
          inspectionId={preTripId}
          onClose={() => setShowPreTrip(false)}
          onSuccess={handlePreTripSuccess}
        />
      )}

      {showRouteModal && todayOp?.route && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-brand-card rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-brand-border">
            <div className="p-4 border-b border-brand-border flex justify-between items-center bg-brand-bg-secondary">
              <h2 className="text-xl font-bold text-white">Route Details</h2>
              <button onClick={() => setShowRouteModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-brand-bg-secondary rounded-xl border border-brand-border">
                <div><p className="text-sm text-brand-muted">Route Name</p><p className="font-semibold text-white">{todayOp.route.name}</p></div>
                <div><p className="text-sm text-brand-muted">Vehicle</p><p className="font-semibold text-white">{todayOp.route.vehicle?.vehicle_number}</p></div>
                <div><p className="text-sm text-brand-muted">Status</p><p className="font-semibold uppercase text-blue-400">{todayOp.route.status}</p></div>
                <div><p className="text-sm text-brand-muted">Total Stops</p><p className="font-semibold text-white">{routeWaypoints.length}</p></div>
                <div><p className="text-sm text-brand-muted">Distance</p><p className="font-semibold text-white">{todayOp.route.estimated_distance} mi</p></div>
                <div><p className="text-sm text-brand-muted">Estimated Duration</p><p className="font-semibold text-white">{todayOp.route.estimated_duration} mins</p></div>
              </div>
              <h3 className="text-lg font-bold text-white mb-4">Optimized Stops</h3>
              
              {loadingRoute ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
              ) : routeError ? (
                <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-center">
                  <p className="text-red-400 font-bold mb-2">{routeError}</p>
                  <button onClick={() => setShowRouteModal(false)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Close</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {routeWaypoints.length > 0 ? (
                    <>
                      {/* NEXT STOP */}
                      {routeWaypoints.find(w => w.status !== 'completed') && (
                        <div>
                          <h3 className="text-lg font-bold text-white mb-3">NEXT STOP</h3>
                          {(() => {
                            const nextStop = routeWaypoints.find(w => w.status !== 'completed');
                            return (
                              <div className="p-5 bg-indigo-900/40 rounded-xl border border-indigo-500/30">
                                <h4 className="text-xl font-bold text-indigo-100">{nextStop?.name}</h4>
                                <p className="text-indigo-300 mt-1">{nextStop?.address}</p>
                                {todayOp?.route?.status === 'in_progress' && (
                                  <button
                                    onClick={() => nextStop && handleCompleteWaypoint(nextStop.id)}
                                    className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
                                  >
                                    Mark Complete
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      
                      {/* ALL STOPS */}
                      <div>
                        <h3 className="text-lg font-bold text-white mb-3">ALL STOPS</h3>
                        <div className="space-y-3">
                          {routeWaypoints.map((wp, i) => (
                            <div key={wp.id || i} className="p-4 bg-brand-bg-secondary rounded-xl border border-brand-border flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${wp.status === 'completed' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                                  {wp.sequence_number || i + 1}
                                </div>
                                <div>
                                  <h4 className={`font-bold ${wp.status === 'completed' ? 'text-emerald-100' : 'text-white'}`}>
                                    {wp.name}
                                  </h4>
                                  <p className="text-brand-muted text-sm">{wp.address}</p>
                                </div>
                              </div>
                              {wp.status === 'completed' && <CheckCircle className="text-emerald-500 w-6 h-6" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-brand-muted p-4 bg-brand-bg-secondary rounded-xl border border-brand-border text-center">No saved stops are available for this route.</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-brand-border bg-brand-bg-secondary flex justify-end">
              <button onClick={() => setShowRouteModal(false)} className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
