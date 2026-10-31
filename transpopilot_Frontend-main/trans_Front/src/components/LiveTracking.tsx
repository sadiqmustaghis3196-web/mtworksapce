import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Navigation, AlertTriangle, Truck, User, MapPin, Clock, Package } from 'lucide-react';
import { API_BASE_URL } from '../lib/apiConfig';

import { fetchLiveLocations } from '../api/tracking';

// Backend fetchers for history and watch
const fetchVehicleHistory = async (vehicleId: string, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/tracking/${vehicleId}/history`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch history');
  const json = await res.json();
  return json.data || [];
};

const sendWatchHeartbeat = async (vehicleId: string, token: string) => {
  await fetch(`${API_BASE_URL}/api/tracking/${vehicleId}/watch`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

// AUSTIN, TEXAS COORDINATES
const AUSTIN_CENTER: [number, number] = [30.2672, -97.7431];

interface VehicleLocation {
  id: string;
  vehicle_number: string;
  driver_name: string;
  lat: number | null;
  lng: number | null;
  speed: number;
  bearing?: number;
  heading: number;
  is_moving: boolean;
  is_communicating?: boolean;
  last_updated?: string;
  last_update?: string;
  raw_geotab?: any;
  provider?: string;
}

const createTruckIcon = (heading: number, isMoving: boolean, isCommunicating: boolean = true) => {
  let color = '#94a3b8'; // Grey if offline / not communicating
  let shadow = '0 2px 6px rgba(0,0,0,0.3)';

  if (!isCommunicating) {
    color = '#64748b'; // Slate grey for offline
  } else if (isMoving) {
    color = '#10b981'; // Emerald moving
    shadow = '0 0 15px rgba(16,185,129,0.5)';
  } else {
    color = '#f59e0b'; // Amber idle / speed 0
    shadow = '0 2px 8px rgba(245,158,11,0.4)';
  }

  return L.divIcon({
    html: `
      <div style="position: relative;">
        <div style="
          transform: rotate(${heading}deg); 
          background-color: #0f172a; 
          border: 2.5px solid ${color}; 
          border-radius: 50%; 
          padding: 4px; 
          box-shadow: ${shadow}; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          width: 38px; 
          height: 38px;
          transition: transform 0.5s ease;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v5c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
          </svg>
        </div>
        ${isMoving && isCommunicating ? `<div style="position:absolute; top:-4px; right:-4px; width:11px; height:11px; background-color:#10b981; border-radius:50%; border:2px solid #ffffff; animation: pulse 2s infinite;"></div>` : ''}
      </div>
    `,
    className: 'custom-truck-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22]
  });
};

const LiveTracking: React.FC = () => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [mapCenter, setMapCenter] = useState<[number, number]>(AUSTIN_CENTER);

  // Safe Trail & Selection State
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [vehicleTrail, setVehicleTrail] = useState<[number, number][]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vId = params.get('vehicle');
    const rId = params.get('route');
    if (vId) setSelectedVehicleId(vId);
    if (rId) setSelectedRouteId(rId);
  }, []);

  useEffect(() => {
    const fetchRouteInfo = async () => {
      if (!selectedRouteId) {
        setSelectedRoute(null);
        return;
      }
      try {
        const { data } = await supabase.from('routes')
          .select('id, name, status, estimated_distance, estimated_duration, started_at, vehicle:vehicles(id, vehicle_number), driver:drivers(id, first_name, last_name), waypoints:route_waypoints(id, status)')
          .eq('id', selectedRouteId)
          .single();
        if (data) setSelectedRoute(data);
      } catch (err) {
        console.error('Failed to fetch selected route info', err);
      }
    };
    fetchRouteInfo();
  }, [selectedRouteId]);

  // Sorting and Filtering States
  const [sortBy, setSortBy] = useState<string>('status'); // default: moving first
  const [filterProvider, setFilterProvider] = useState<string>('all'); // default: all

  const getProcessedVehicles = () => {
    // 1. Filter by provider
    let list = vehicles.filter(v => {
      if (filterProvider === 'all') return true;
      return v.provider === filterProvider;
    });

    // 2. Sort
    list.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return String(a.vehicle_number || '').localeCompare(String(b.vehicle_number || ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        return String(b.vehicle_number || '').localeCompare(String(a.vehicle_number || ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'speed_desc') {
        return (b.speed || 0) - (a.speed || 0);
      }
      if (sortBy === 'speed_asc') {
        return (a.speed || 0) - (b.speed || 0);
      }
      if (sortBy === 'status') {
        const getPriority = (veh: VehicleLocation) => {
          if (veh.is_communicating === false) return 3; // offline last
          if (veh.is_moving) return 1; // moving first
          return 2; // stopped/idle middle
        };
        const prioA = getPriority(a);
        const prioB = getPriority(b);
        if (prioA !== prioB) return prioA - prioB;
        return String(a.vehicle_number || '').localeCompare(String(b.vehicle_number || ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      return 0;
    });

    return list;
  };

  // API_BASE_URL imported from config

  const formatLastSeen = (isoStr?: string) => {
    if (!isoStr) return 'No signal';
    const updated = new Date(isoStr);
    if (isNaN(updated.getTime())) return 'No signal';
    const diffMs = Date.now() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return updated.toLocaleDateString();
  };

  const [retryCount, setRetryCount] = useState(0);
  const [isPollingPaused, setIsPollingPaused] = useState(false);

  const fetchLocations = async () => {
    if (!profile?.organization_id) {
      setVehicles([]);
      setErrorMessage("No organization assigned. You do not have access to Live Tracking.");
      setIsPollingPaused(true);
      return;
    }

    try {
      const { data } = await fetchLiveLocations(profile.organization_id);

      if (data) {
        const mappedData = data.map((v: any) => ({
           id: v.id,
           vehicle_number: v.vehicle_number,
           lat: v.lat ?? v.current_latitude ?? null,
           lng: v.lng ?? v.current_longitude ?? null,
           speed: v.speed || 0, 
           is_moving: v.is_moving || v.status === 'active',
           driver_name: v.driver_name || (v.drivers ? `${v.drivers.first_name} ${v.drivers.last_name}` : 'Unassigned'),
           status: v.status,
           provider: v.provider
        }));
        
        setVehicles(mappedData);
        setErrorMessage(null);
        setLastSyncedTime(new Date().toLocaleTimeString());
        setRetryCount(0); // Reset retry count on success
        setIsPollingPaused(false); // Ensure polling continues

        // Center map on valid lat/lng if vehicles exist
        const validVehicles = mappedData.filter((v: any) => v.lat != null && v.lng != null && !(v.lat === 0 && v.lng === 0));
        if (validVehicles.length > 0 && validVehicles[0].lat !== undefined) {
          setMapCenter([validVehicles[0].lat, validVehicles[0].lng]);
        }
      } else {
        setVehicles([]);
        setErrorMessage("No active devices returned for this account.");
        setRetryCount(0);
      }
    } catch (error: any) {
      console.error(`❌ Live location fetch exception: ${error.message}`);
      
      if (error.message.includes("access to Live Tracking") || error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
         setVehicles([]);
         setErrorMessage(error.message);
         setIsPollingPaused(true); // Stop polling completely for 401/403
      } else {
         // Network or 5xx error
         const newRetryCount = retryCount + 1;
         if (newRetryCount > 3) {
            setVehicles([]);
            setErrorMessage("Connection failed after multiple retries. Please check your network.");
            setIsPollingPaused(true);
         } else {
            setErrorMessage(`Failed to connect. Retrying... (${newRetryCount}/3)`);
            setRetryCount(newRetryCount);
         }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Immediate fetch on mount
    fetchLocations();

    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    const poll = async () => {
      if (!isActive) return;

      // Skip fetch if document is hidden or polling is paused
      if (document.hidden || isPollingPaused) {
        timeoutId = setTimeout(poll, 15000);
        return;
      }

      await fetchLocations();
      
      if (!isActive) return;
      
      // Exponential backoff logic: 15s normally, or 15s * (2 ^ (retryCount - 1)) if retrying
      const delay = retryCount > 0 ? 15000 * Math.pow(2, retryCount - 1) : 15000;
      timeoutId = setTimeout(poll, delay);
    };

    // Start polling loop
    timeoutId = setTimeout(poll, 15000);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [profile?.organization_id, retryCount, isPollingPaused]);

  // Realtime Subscription Effect
  useEffect(() => {
    if (!profile?.organization_id) return;

    // We subscribe to the 'vehicles' table for this organization
    const channel = supabase
      .channel('vehicles_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vehicles',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => {
          const newRow = payload.new;
          setVehicles((prev) => 
            prev.map((v) => {
              if (v.id === newRow.id) {
                // If this is the currently selected vehicle, extend the trail dynamically!
                if (selectedVehicleId === newRow.id && newRow.current_latitude && newRow.current_longitude) {
                   setVehicleTrail(prevTrail => [...prevTrail, [newRow.current_latitude, newRow.current_longitude]]);
                }
                
                return {
                  ...v,
                  lat: newRow.current_latitude,
                  lng: newRow.current_longitude,
                  speed: newRow.speed || 0,
                  heading: newRow.heading || v.heading,
                  last_updated: new Date().toISOString()
                };
              }
              return v;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, selectedVehicleId]);

  // Selected Vehicle History & Heartbeat Effect
  useEffect(() => {
    if (!selectedVehicleId) {
      setVehicleTrail([]);
      return;
    }
    
    let isActive = true;
    let heartbeatInterval: NodeJS.Timeout;

    const setupWatch = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      try {
        // 1. Fetch initial historical trail
        const history = await fetchVehicleHistory(selectedVehicleId, token);
        if (!isActive) return;
        
        // Reverse so chronological (oldest to newest)
        history.reverse();
        const trailPoints: [number, number][] = history
          .filter((h: any) => h.latitude && h.longitude)
          .map((h: any) => [h.latitude, h.longitude]);
          
        setVehicleTrail(trailPoints);

        // 2. Start heartbeat to tell worker to keep writing
        await sendWatchHeartbeat(selectedVehicleId, token);
        heartbeatInterval = setInterval(() => {
           sendWatchHeartbeat(selectedVehicleId, token).catch(e => console.error("Heartbeat failed", e));
        }, 10000);
      } catch (err) {
        console.error("Failed to setup watch:", err);
      }
    };

    setupWatch();

    return () => {
      isActive = false;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [selectedVehicleId]);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-950 relative">

      {/* Enterprise Dark Header */}
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center z-10 shadow-md">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Navigation className="h-6 w-6" />
            </div>
            Live Fleet Tracking
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1">
            {loading 
              ? "Establishing live satellite connection to providers..." 
              : errorMessage 
              ? errorMessage
              : `Tracking ${vehicles.length} active fleet vehicle${vehicles.length === 1 ? '' : 's'} in real-time`
            }
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-black tracking-wide uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span>
            Live GPS Sync Active
          </span>
          {lastSyncedTime && (
            <span className="text-[10px] text-slate-400 font-semibold">
              Last synced: {lastSyncedTime} (Auto 15s)
            </span>
          )}
        </div>
      </div>

      {selectedRoute && (
        <div className="bg-slate-800/80 backdrop-blur-sm border-b border-white/10 px-6 py-3 flex gap-6 items-center overflow-x-auto z-10 shadow-lg">
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Route</p>
            <p className="text-sm font-black text-white">{selectedRoute.name}</p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle</p>
            <p className="text-sm font-bold text-white">{selectedRoute.vehicle?.vehicle_number || 'N/A'}</p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Driver</p>
            <p className="text-sm font-bold text-white">{selectedRoute.driver?.first_name || 'N/A'} {selectedRoute.driver?.last_name || ''}</p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
            <span className="text-xs font-black uppercase text-indigo-400">{selectedRoute.status}</span>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stops</p>
            <p className="text-sm font-bold text-white">
              {selectedRoute.waypoints?.filter((w: any) => w.status === 'completed').length || 0} / {selectedRoute.waypoints?.length || 0}
            </p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distance</p>
            <p className="text-sm font-bold text-white">{selectedRoute.estimated_distance} mi</p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</p>
            <p className="text-sm font-bold text-white">{selectedRoute.estimated_duration} min</p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Started</p>
            <p className="text-sm font-bold text-white">{selectedRoute.started_at ? new Date(selectedRoute.started_at).toLocaleTimeString() : 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Map Section */}
      <div className="flex-1 relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={11}
          style={{ height: "100%", width: "100%", backgroundColor: '#e8eef2' }}
          zoomControl={false}
        >
          <ChangeView center={mapCenter} />
          {/* Colorful Premium Voyager Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ZoomControl position="bottomright" />

          {selectedVehicleId && vehicleTrail.length > 1 && (
             <Polyline positions={vehicleTrail} color="#3b82f6" weight={4} opacity={0.8} />
          )}

          {getProcessedVehicles().filter(v => v.lat != null && v.lng != null).map((v) => (
            <Marker
              key={v.id}
              position={[v.lat as number, v.lng as number]}
              icon={createTruckIcon(v.heading || 0, v.is_moving, v.is_communicating !== false)}
              eventHandlers={{
                click: () => {
                  setSelectedVehicleId(v.id);
                }
              }}
            >
              <Popup className="enterprise-dark-popup rounded-2xl" closeButton={false}>
                <div className="p-2 min-w-[240px] bg-slate-900 rounded-xl">

                  {/* Title & Driver */}
                  <div className="border-b border-slate-700/50 pb-3 mb-3">
                    <h3 className="font-black text-lg text-white flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        {v.vehicle_number}
                        {v.provider && (
                          <span className={`px-1 rounded text-[8px] uppercase tracking-wider font-extrabold ${
                            v.provider === 'geotab' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                          }`}>
                            {v.provider}
                          </span>
                        )}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold ${
                        v.is_communicating === false 
                          ? "bg-slate-700 text-slate-400 border border-slate-600"
                          : v.is_moving 
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}>
                        {v.is_communicating === false 
                          ? "Offline" 
                          : v.is_moving 
                            ? "Moving" 
                            : (v.last_update || v.last_updated) 
                              ? `Stationary as of ${new Date((v.last_update || v.last_updated) as string).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                              : "Stopped / Idle"}
                      </span>
                    </h3>
                    <p className="text-sm font-medium text-slate-400 flex items-center mt-1">
                      <User className="h-3 w-3 mr-1 text-blue-400" /> {v.driver_name || 'Unassigned'}
                    </p>
                  </div>

                  {/* Core Metrics */}
                  <div className="space-y-2.5 text-sm text-slate-300">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                      <span className="font-bold text-slate-400 text-xs uppercase">Speed</span>
                      <span className="font-black text-blue-400 text-base">
                        {v.is_communicating === false ? "No signal" : `${v.speed} mph`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-1">
                      <span className="font-bold text-slate-400 text-xs uppercase flex items-center"><MapPin className="h-3 w-3 mr-1" /> Coordinates</span>
                      <span className="font-mono text-xs text-slate-200">{v.lat.toFixed(4)}, {v.lng.toFixed(4)}</span>
                    </div>

                    <div className="flex justify-between items-center p-1">
                      <span className="font-bold text-slate-400 text-xs uppercase flex items-center"><Clock className="h-3 w-3 mr-1" /> Last GPS Update</span>
                      <span className="font-bold text-slate-300 text-xs">{formatLastSeen(v.last_updated)}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Empty state overlay on map if no devices returned */}
        {vehicles.length === 0 && !loading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-800 text-center max-w-md shadow-2xl">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No Active Vehicles Found</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMessage || "Your connected Geotab account has no active tracking devices online right now."}</p>
            <button 
              onClick={fetchLocations}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all"
            >
              Retry Live Sync
            </button>
          </div>
        )}

        {/* Floating Fleet List (Dark Theme Overlay) */}
        <div className="absolute top-6 right-6 z-[400] bg-slate-900/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-slate-800 max-w-sm w-full max-h-[500px] overflow-y-auto hidden md:block">
          <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
            <h3 className="font-black text-white text-lg">Active Fleet Overview</h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">{getProcessedVehicles().length}</span>
          </div>

          {/* Controls: Provider Filter & Sort Dropdown */}
          <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-800/20 p-2.5 rounded-xl border border-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Provider</label>
              <select 
                value={filterProvider} 
                onChange={(e) => setFilterProvider(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">All Providers</option>
                <option value="geotab">Geotab Only</option>
                <option value="samsara">Samsara Only</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Sort By</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="status">Status (Active First)</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="speed_desc">Speed (Fastest First)</option>
                <option value="speed_asc">Speed (Slowest First)</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            {getProcessedVehicles().length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No vehicles match filters</p>
            ) : (
              getProcessedVehicles().map(v => {
                const isOffline = v.is_communicating === false;
                return (
                  <div 
                    key={v.id} 
                    onClick={() => {
                      setMapCenter([v.lat as number, v.lng as number]);
                      setSelectedVehicleId(v.id);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedVehicleId === v.id 
                        ? 'bg-blue-500/10 border-blue-500/50' 
                        : 'bg-slate-800/50 border-slate-700 hover:border-blue-500/30 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-3 h-3 rounded-full shadow-inner ${
                          isOffline ? 'bg-slate-500' : v.is_moving ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}></div>
                        {v.is_moving && !isOffline && <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30"></div>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">{v.vehicle_number}</p>
                          {v.provider && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold ${
                              v.provider === 'geotab' ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/25 text-blue-300 border border-blue-500/30'
                            }`}>
                              {v.provider}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400">Driver: {v.driver_name || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isOffline ? (
                        <span className="text-xs text-slate-500 font-bold">Offline</span>
                      ) : (
                        <>
                          <span className="text-base font-black text-blue-400">{v.speed}</span>
                          <span className="text-xs text-slate-500 font-bold ml-1">mph</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Global Style Override for Map Popups + Zoom Control (Dark Premium Theme) */}
      <style>{`
        .leaflet-popup-content-wrapper { 
          background: #0f172a !important; 
          border: 1px solid #1e293b !important;
          border-radius: 16px !important; 
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5) !important; 
          padding: 0 !important; 
        }
        .leaflet-popup-tip { background: #0f172a !important; border-bottom: 1px solid #1e293b !important; border-right: 1px solid #1e293b !important; }
        .leaflet-popup-content { margin: 0 !important; }

        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
          border-radius: 12px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          background-color: #0f172a !important;
          color: #ffffff !important;
          border-bottom: 1px solid #1e293b !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #1e293b !important;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
          70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
};

export default LiveTracking;