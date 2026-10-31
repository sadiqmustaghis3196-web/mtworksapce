import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Plus, Trash2, Edit2, TrendingUp, Clock, Save, Play, Pause, RefreshCw, Loader2, X, Map as MapIcon, Maximize2, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRoutes, optimizeRoute, createRoute, updateRoute } from '../api/routes';
import { Route } from '../types/tracking';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiConfig';
import RouteAssignmentModal from './RouteAssignmentModal';
// --- NEW IMPORTS FOR REAL MAP ---
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Truck Icon for the map
const truckMarkerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/741/741407.png', // Using a generic truck icon URL
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -10],
});

const formatNumber = (value: any, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
};

const toNumberOrNull = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Component to loop simulation movement
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

const RouteOptimization: React.FC = () => {
  const { profile } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- NEW: Real Map State ---
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedRouteForTracking, setSelectedRouteForTracking] = useState<Route | null>(null);
  const [trackingPath, setTrackingPath] = useState<[number, number][]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);

  // Form States (Initialized to empty strings to fix the "0" issue)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteDescription, setNewRouteDescription] = useState('');
  const [waypoints, setWaypoints] = useState<Array<{ id?: string; name: string; address: string; lat: string | number; lng: string | number }>>([
    { name: '', address: '', lat: '', lng: '' },
  ]);

  // Integration States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Process States
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Simulation States
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationInterval, setSimulationInterval] = useState<number | null>(null);
  
  const [assigningRouteId, setAssigningRouteId] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<{title: string, type: 'error' | 'success'} | null>(null);
  const showToast = (title: string, type: 'error' | 'success' = 'error') => {
    setToastMsg({ title, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // API_BASE_URL imported from config

  useEffect(() => {
    loadRoutes();
  }, []);

  // Load real Geotab/Samsara vehicles & zones for integration
  useEffect(() => {
    const fetchVehiclesAndZones = async () => {
      if (!profile?.organization_id) return;
      try {
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('vehicles')
          .select(`
             id,
             vehicle_number,
             current_latitude,
             current_longitude,
             status,
             driver_id,
             drivers ( first_name, last_name )
          `)
          .eq('organization_id', profile.organization_id);

        if (!vehiclesError && vehiclesData) {
          const mappedVehicles = vehiclesData.map((v: any) => ({
             id: v.id,
             vehicle_number: v.vehicle_number,
             lat: v.current_latitude || 0,
             lng: v.current_longitude || 0,
             speed: 0,
             is_moving: v.status === 'active',
             driver_name: v.drivers ? `${v.drivers.first_name} ${v.drivers.last_name}` : 'Unassigned',
             status: v.status
          }));
          setVehicles(mappedVehicles);
        }

        // We don't have a zones table, so set empty for now
        setZones([]);
      } catch (error) {
        console.error("Failed to load vehicle or zone integration data:", error);
      }
    };

    fetchVehiclesAndZones();
  }, [profile]);

  useEffect(() => {
    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
    };
  }, [simulationInterval]);

  // --- NEW: Simulate Vehicle Movement on Map ---
  useEffect(() => {
    let movementInterval: number;
    if (showMapModal && trackingPath.length > 0) {
      movementInterval = window.setInterval(() => {
        setCurrentPositionIndex((prevIndex) => (prevIndex + 1) % trackingPath.length);
      }, 1500); // Move every 1.5 seconds
    }
    return () => clearInterval(movementInterval);
  }, [showMapModal, trackingPath]);

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRoutes(); 
      setRoutes(data);
    } catch (error) {
      console.error('Failed to load routes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSimulation = async () => {
    if (simulationActive) {
      if (simulationInterval) clearInterval(simulationInterval);
      setSimulationActive(false);
    } else {
      await generateSampleRoutes();
      const interval = window.setInterval(generateSampleRoutes, 30000);
      setSimulationInterval(interval);
      setSimulationActive(true);
    }
  };

  const generateSampleRoutes = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/route-optimization?action=generate-sample`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) await loadRoutes();
    } catch (error) { console.error(error); }
  };

  // --- HANDLERS ---
  const addWaypoint = () => setWaypoints([...waypoints, { name: '', address: '', lat: '', lng: '' }]);

  const removeWaypoint = (index: number) => {
    if (waypoints.length > 1) setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const updateWaypoint = (index: number, field: string, value: string | number) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], [field]: value };
    setWaypoints(updated);
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    if (!vehicleId) return;

    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    if (selectedVehicle && selectedVehicle.lat && selectedVehicle.lng && selectedVehicle.lat !== 0 && selectedVehicle.lng !== 0) {
      const updated = [...waypoints];
      if (updated.length === 0) {
        updated.push({ name: '', address: '', lat: '', lng: '' });
      }
      
      updated[0] = {
        name: `Start: ${selectedVehicle.vehicle_number}`,
        address: `Live Location (${formatNumber(selectedVehicle.lat, 4)}, ${formatNumber(selectedVehicle.lng, 4)})`,
        lat: selectedVehicle.lat.toString(),
        lng: selectedVehicle.lng.toString()
      };
      setWaypoints(updated);
      console.log(`📍 [DEBUG] Auto-filled starting point with vehicle ${selectedVehicle.vehicle_number}:`, updated[0]);
    }
  };

  // --- NEW: HANDLE LIVE TRACKING CLICK ---
  const handleLiveTracking = async (route: Route) => {
    setSelectedRouteForTracking(route);
    setCurrentPositionIndex(0);

    try {
      const { data: routeWaypoints, error } = await supabase
        .from('route_waypoints')
        .select('*')
        .eq('route_id', route.id)
        .order('sequence_number', { ascending: true });

      if (error) throw error;

      if (routeWaypoints && routeWaypoints.length > 0) {
        const pathCoords: [number, number][] = routeWaypoints.map(wp => [
          Number(wp.latitude),
          Number(wp.longitude)
        ]);
        setTrackingPath(pathCoords);
        console.log("📍 [DEBUG] Loaded route tracking path waypoints:", pathCoords);
      } else {
        setTrackingPath([]);
      }
    } catch (error) {
      console.error("Failed to load tracking path for route:", error);
      setTrackingPath([]);
    }

    setShowMapModal(true);
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!window.confirm("Are you sure?")) return;
    setIsDeleting(routeId);
    try {
      const { error: dbError } = await supabase.from('routes').delete().eq('id', routeId);
      if (dbError) throw dbError;
      setRoutes(routes.filter(r => r.id !== routeId));
    } catch (error: any) { showToast(error.message); } finally { setIsDeleting(null); }
  };

  const handleEditRoute = async (route: Route) => {
    setEditingRouteId(route.id);
    setNewRouteName(route.name);
    setNewRouteDescription(route.description || '');
    if (route.vehicle_id) setSelectedVehicleId(route.vehicle_id);
    try {
      const { data: routeWaypoints, error } = await supabase
        .from('route_waypoints').select('*').eq('route_id', route.id).order('sequence_number', { ascending: true });
      if (error) throw error;
      if (routeWaypoints && routeWaypoints.length > 0) {
        const mappedWaypoints = routeWaypoints.map(wp => ({ id: wp.id, name: wp.name, address: wp.address, lat: wp.latitude, lng: wp.longitude }));
        setWaypoints(mappedWaypoints);
        setOptimizationResult({
          optimizedWaypoints: mappedWaypoints,
          totalDistance: route.estimated_distance || 0,
          estimatedDuration: route.estimated_duration || 0,
          originalDistance: route.estimated_distance || 0,
          originalDuration: route.estimated_duration || 0,
          optimizationScore: (route as any).optimization_score || 0,
          savings: { distance: 0, time: 0, percentage: 0 }
        } as any);
      } else {
        setWaypoints([{ name: '', address: '', lat: '', lng: '' }]);
        setOptimizationResult(null);
      }
      setShowCreateModal(true);
    } catch (error) { console.error(error); showToast("Failed to load details."); }
  };

  const handleOptimizeRoute = async () => {
    let finalWaypoints = [...waypoints];
    if (selectedVehicleId) {
       const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
       const hasValidLive = selectedVehicle && selectedVehicle.lat && selectedVehicle.lng && selectedVehicle.lat !== 0 && selectedVehicle.lng !== 0;
       
       if (hasValidLive) {
         finalWaypoints[0] = {
           name: `Start Point: ${selectedVehicle.vehicle_number}'s Current Location (Live)`,
           address: `Live Location`,
           lat: selectedVehicle.lat.toString(),
           lng: selectedVehicle.lng.toString()
         };
         setWaypoints([...finalWaypoints]);
       } else {
         const startWp = finalWaypoints[0];
         if (!startWp || !startWp.lat || !startWp.lng || startWp.lat === '0' || startWp.lng === '0') {
             return showToast("Live location unavailable. Enter a starting location manually.");
         }
       }
    }

    const validStops = finalWaypoints.filter((wp) => wp.name?.trim());
    
    if (validStops.length < 2) {
      return showToast('Enter a valid starting location and at least one destination.');
    }

    const startWp = validStops[0];
    const startLat = parseFloat(startWp.lat as string);
    const startLng = parseFloat(startWp.lng as string);
    if (isNaN(startLat) || isNaN(startLng) || (startLat === 0 && startLng === 0)) {
        return showToast('Starting coordinates are invalid.');
    }

    for (let i = 1; i < validStops.length; i++) {
        const wp = validStops[i];
        const lat = parseFloat(wp.lat as string);
        const lng = parseFloat(wp.lng as string);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            return showToast('Complete all required stop coordinates.');
        }
    }

    const parsedValidStops = validStops.map(wp => ({
      ...wp,
      lat: parseFloat(wp.lat as string),
      lng: parseFloat(wp.lng as string)
    }));

    try {
      setOptimizing(true);
      const result = await optimizeRoute(parsedValidStops as any);
      setOptimizationResult(result);
    } catch (error: any) { 
      console.error(error); 
      showToast(error.message || 'Optimization failed'); 
    } finally { 
      setOptimizing(false); 
    }
  };

  const handleSaveRoute = async () => {
    if (!newRouteName.trim()) return showToast('Enter a route name');
    setIsSaving(true);
    try {
      const routeData = {
        name: newRouteName, description: newRouteDescription, status: 'planned',
        estimated_distance: optimizationResult ? (toNumberOrNull(optimizationResult.totalDistance) || 0) : 0,
        estimated_duration: optimizationResult ? Math.round(toNumberOrNull(optimizationResult.estimatedDuration) || 0) : 0,
        optimization_score: optimizationResult ? Math.round(toNumberOrNull(optimizationResult.optimizationScore) || 0) : 0,
      };
      let savedRouteId;
      if (editingRouteId) {
        const updatedRoute = await updateRoute(editingRouteId, routeData);
        savedRouteId = updatedRoute.id;
      } else {
        const newRoute = await createRoute(routeData as any);
        savedRouteId = newRoute.id;
      }
      
      const pointsToSave = optimizationResult?.optimizedWaypoints || waypoints;
      
      if (editingRouteId) {
        const existingWpRes = await supabase.from('route_waypoints').select('id').eq('route_id', savedRouteId);
        if (existingWpRes.error) throw new Error("Failed to load existing route stops.");
        
        const existingIds = (existingWpRes.data || []).map(w => w.id);
        const newIdsToKeep = pointsToSave.filter((w: any) => w.id).map((w: any) => w.id);
        const idsToDelete = existingIds.filter(id => !newIdsToKeep.includes(id));
        
        if (idsToDelete.length > 0) {
          const { error: delError } = await supabase.from('route_waypoints').delete().in('id', idsToDelete);
          if (delError) throw new Error("Failed to remove old route stops.");
        }
        
        for (let i = 0; i < pointsToSave.length; i++) {
          const wp = pointsToSave[i];
          const wpData = { route_id: savedRouteId, name: wp.name, address: wp.address || wp.name, latitude: wp.lat || 0, longitude: wp.lng || 0, sequence_number: i + 1 };
          if (wp.id) {
            const { error: updError } = await supabase.from('route_waypoints').update(wpData).eq('id', wp.id);
            if (updError) throw new Error("Route stops could not be saved.");
          } else {
            const { error: insError } = await supabase.from('route_waypoints').insert([wpData]);
            if (insError) throw new Error("Route stops could not be saved.");
          }
        }
      } else {
        const wpData = pointsToSave.map((wp: any, index: number) => ({
          route_id: savedRouteId, name: wp.name, address: wp.address || wp.name,
          latitude: wp.lat || 0, longitude: wp.lng || 0, sequence_number: index + 1
        }));
        const { error: insError } = await supabase.from('route_waypoints').insert(wpData);
        if (insError) throw new Error("Route stops could not be saved.");
      }
      showToast(editingRouteId ? 'Route Updated!' : 'Route Created!', 'success');
      setShowCreateModal(false); resetForm(); loadRoutes();
    } catch (error: any) { console.error(error); showToast(`Error: ${error.message}`); } finally { setIsSaving(false); }
  };

  const resetForm = () => {
    setEditingRouteId(null); setNewRouteName(''); setNewRouteDescription('');
    setWaypoints([{ name: '', address: '', lat: '', lng: '' }]);
    setSelectedVehicleId('');
    setOptimizationResult(null);
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (status === 'active') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Shortest Route Calculator</h1>
          <p className="text-slate-400 mt-1">Distance-based routing and basic pathing diagnostics</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={toggleSimulation} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all border ${
              simulationActive 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            {simulationActive ? <Pause size={16}/> : <Play size={16}/>}
            <span>{simulationActive ? 'Stop Sim' : 'Run Sim'}</span>
          </button>
          <button 
            onClick={loadRoutes} 
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 transition-all font-semibold"
          >
            <RefreshCw size={16}/> Refresh
          </button>
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }} 
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-bold shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
          >
            <Plus size={16}/> Create Route
          </button>
        </div>
      </div>

      {/* Routes List */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-900 overflow-hidden backdrop-blur-sm">
        <div className="p-5 border-b border-slate-900 bg-slate-900/60 flex justify-between items-center">
          <h3 className="font-bold text-white text-lg">Active Enterprise Routes</h3>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {routes.length} total routes
          </span>
        </div>
        {loading ? (
          <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={36}/></div>
        ) : routes.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-700 mb-3"/>
            <p className="text-slate-400 font-semibold">No dispatch routes found</p>
            <p className="text-xs text-slate-600 mt-1">Start by calculating a new shortest distance route or running the simulator.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-900">
            {routes.map((route) => (
              <div key={route.id} className="p-5 hover:bg-slate-900/30 transition-colors">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-bold text-white tracking-tight">{route.name}</h4>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${getStatusColor(route.status)}`}>
                        {route.status}
                      </span>
                    </div>
                    {route.description && (
                      <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-2xl">{route.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-6 mt-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
                        <MapPin size={13} className="text-blue-500"/> {route.estimated_distance || '0 mi'}
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
                        <Clock size={13} className="text-amber-550" style={{color: '#f97316'}}/> {route.estimated_duration || '0 min'}
                      </span>
                      {route.optimization_score && (
                        <span className="flex items-center gap-1.5 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-2.5 py-1 rounded">
                          <TrendingUp size={13}/> {route.optimization_score}% shorter distance
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    {(!route.driver_id || !route.vehicle_id) && route.status !== 'completed' && (
                      <button 
                        onClick={() => setAssigningRouteId(route.id)} 
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 rounded-lg font-bold text-sm transition-all"
                      >
                        <MapIcon size={15} /> Assign Route
                      </button>
                    )}
                    {(route.status === 'active' || route.status === 'in_progress') && (
                      <button 
                        onClick={() => handleLiveTracking(route)} 
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 rounded-lg font-bold text-sm transition-all"
                      >
                        <MapIcon size={15} /> Live Track
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3 ml-2">
                      <button 
                        onClick={() => handleEditRoute(route)} 
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit2 size={16}/>
                      </button>
                      <button 
                        onClick={() => handleDeleteRoute(route.id)} 
                        disabled={isDeleting === route.id} 
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        {isDeleting === route.id ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {editingRouteId ? 'Edit Enterprise Route' : 'Find Shortest Dispatch Route'}
              </h2>
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }} 
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Route Name</label>
                  <input 
                    type="text" 
                    value={newRouteName} 
                    onChange={(e) => setNewRouteName(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 placeholder-slate-600 focus:outline-none transition" 
                    placeholder="e.g. Dallas-Austin Loop" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                  <input 
                    type="text" 
                    value={newRouteDescription} 
                    onChange={(e) => setNewRouteDescription(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 placeholder-slate-600 focus:outline-none transition" 
                    placeholder="Optional route details/assignment notes" 
                  />
                </div>
              </div>

              {/* Vehicle selector for live start */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Select Vehicle (for Live Start)</label>
                  <select 
                    value={selectedVehicleId} 
                    onChange={(e) => handleVehicleSelect(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 focus:outline-none text-slate-200 text-sm font-bold transition-colors"
                  >
                    {vehicles.length === 0 ? (
                      <option value="">No vehicles available for this organization</option>
                    ) : (
                      <>
                        <option value="">-- Manual Starting Stop --</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.vehicle_number} ({v.provider === 'geotab' ? 'Geotab' : 'Samsara'})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div className="text-xs text-slate-400">
                  Selecting a vehicle will automatically populate Stop 1 (Starting Location) with its current live latitude and longitude.
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Stops & Waypoints</label>
                  <button 
                    onClick={addWaypoint} 
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/5 px-2.5 py-1 rounded border border-blue-500/10 hover:bg-blue-500/10"
                  >
                    <Plus size={14}/> Add Stop
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {waypoints.map((wp, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 border border-slate-800 rounded-lg bg-slate-950/40">
                      <div className="md:col-span-4 flex flex-col gap-1.5">
                        <input 
                          type="text" 
                          value={wp.name} 
                          onChange={(e) => updateWaypoint(i, 'name', e.target.value)} 
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" 
                          placeholder="Stop Name / Identifier" 
                        />
                        {zones.length > 0 && (
                          <select
                            onChange={(e) => {
                              const zoneId = e.target.value;
                              if (!zoneId) return;
                              const selectedZone = zones.find(z => z.id === zoneId);
                              if (selectedZone) {
                                updateWaypoint(i, 'name', selectedZone.name);
                                updateWaypoint(i, 'address', `Geotab Zone: ${selectedZone.name}`);
                                updateWaypoint(i, 'lat', selectedZone.lat.toString());
                                updateWaypoint(i, 'lng', selectedZone.lng.toString());
                                console.log(`📍 [DEBUG] Waypoint ${i+1} set to Geotab Zone:`, selectedZone);
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 focus:outline-none focus:border-blue-500"
                            defaultValue=""
                          >
                            <option value="" disabled>-- Or Load Geotab Zone --</option>
                            {zones.map(z => (
                              <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="md:col-span-4">
                        <input 
                          type="text" 
                          value={wp.address} 
                          onChange={(e) => updateWaypoint(i, 'address', e.target.value)} 
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" 
                          placeholder="Street Address or Coordinates" 
                        />
                      </div>
                      <div className="md:col-span-3 flex gap-2">
                        <input 
                          type="number" 
                          step="any" 
                          value={wp.lat} 
                          onChange={(e) => updateWaypoint(i, 'lat', e.target.value)} 
                          className="w-1/2 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" 
                          placeholder="Latitude" 
                        />
                        <input 
                          type="number" 
                          step="any" 
                          value={wp.lng} 
                          onChange={(e) => updateWaypoint(i, 'lng', e.target.value)} 
                          className="w-1/2 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" 
                          placeholder="Longitude" 
                        />
                      </div>
                      <div className="md:col-span-1 flex items-center justify-center">
                        <button 
                          onClick={() => removeWaypoint(i)} 
                          className="text-slate-500 hover:text-rose-400 p-2 hover:bg-rose-500/5 rounded transition"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {optimizationResult && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-emerald-400 font-bold text-sm">Shortest Distance Calculated</p>
                          <span className="text-slate-500 cursor-help" title="This calculates the shortest distance order between stops. It does not account for traffic, road restrictions, or fuel.">
                            <AlertCircle size={13} />
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Saved {formatNumber(optimizationResult.optimizationScore, 0)}% distance vs original order</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-emerald-400">
                          {formatNumber(optimizationResult.totalDistance, 1)} <span className="text-xs font-normal text-slate-400">miles</span>
                        </p>
                        <p className="text-xs text-slate-400 font-medium">{Math.round(optimizationResult.estimatedDuration)} mins total duration</p>
                      </div>
                    </div>
                    {optimizationResult.isFallback && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs py-1.5 px-3 rounded mt-2">
                        ⚠️ Approximate route (road path unavailable)
                      </div>
                    )}
                  </div>
                )}
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-950 rounded-b-xl">
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }} 
                className="px-5 py-2.5 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-900 font-bold text-sm transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleOptimizeRoute} 
                disabled={optimizing} 
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {optimizing ? <Loader2 className="animate-spin" size={16}/> : <Play size={16}/>} Calculate Shortest Route
              </button>
              <button 
                onClick={handleSaveRoute} 
                disabled={isSaving} 
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save Route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REAL LIVE TRACKING MAP MODAL */}
      {showMapModal && selectedRouteForTracking && trackingPath.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center z-[401]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Live Tracking: {selectedRouteForTracking.name}</h2>
                  <p className="text-xs text-slate-400">Real-time GPS dispatch coordinates active</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMapModal(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Leaflet Map */}
            <div className="flex-1 relative z-0">
                 <MapContainer center={trackingPath[0]} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      className="dark-map-tiles"
                    />
                    {/* The Route Path Line */}
                    <Polyline positions={trackingPath} color="#3b82f6" weight={5} opacity={0.8} />
                    
                    {/* The Moving Vehicle Marker */}
                    <Marker position={trackingPath[currentPositionIndex]} icon={truckMarkerIcon}>
                        <Popup className="custom-popup rounded-lg">
                          <div className="p-1 font-semibold text-slate-900">
                            Vehicle on route: {selectedRouteForTracking.name}
                          </div>
                        </Popup>
                    </Marker>
                    
                    {/* Auto re-center map on vehicle */}
                    <MapRecenter center={trackingPath[currentPositionIndex]} />
                </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in-up">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border ${
            toastMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {toastMsg.type === 'success' ? <Save className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-semibold text-sm">{toastMsg.title}</span>
            <button onClick={() => setToastMsg(null)} className="ml-2 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {assigningRouteId && (
        <RouteAssignmentModal
          routeId={assigningRouteId}
          onClose={() => setAssigningRouteId(null)}
          onSuccess={() => {
            setAssigningRouteId(null);
            loadRoutes();
          }}
        />
      )}
    </div>
  );
};

export default RouteOptimization;
