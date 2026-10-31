import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Truck, MapPin, Clock, Navigation, AlertTriangle, PlayCircle, Square } from 'lucide-react';
import { API_BASE_URL } from '../lib/apiConfig';

// ==========================================
// 🚀 GLOBAL QUEUE SYSTEM (To prevent Geotab rate-limit blocks)
// Now allows a small amount of concurrency instead of one-at-a-time,
// since the backend already caches synced trips in Supabase — repeat
// loads are fast DB reads and don't need heavy throttling. Only the
// *first* sync of a vehicle actually hits Geotab.
// ==========================================
const fetchQueue: (() => Promise<void>)[] = [];
let activeQueueWorkers = 0;
const MAX_CONCURRENT_QUEUE_WORKERS = 2;
const QUEUE_GAP_MS = 300;

const processFetchQueue = () => {
    while (activeQueueWorkers < MAX_CONCURRENT_QUEUE_WORKERS && fetchQueue.length > 0) {
        const task = fetchQueue.shift();
        if (!task) continue;
        activeQueueWorkers++;
        (async () => {
            try {
                await task();
            } finally {
                await new Promise(res => setTimeout(res, QUEUE_GAP_MS));
                activeQueueWorkers--;
                processFetchQueue();
            }
        })();
    }
};

// Map ko auto-center karne ke liye component
function ChangeView({ center, bounds }: { center?: [number, number], bounds?: any }) {
   const map = useMap();
   if (bounds) {
       map.fitBounds(bounds, { padding: [20, 20] });
   } else if (center) {
       map.setView(center, 12);
   }
   return null;
}

// Combine a "user cancelled" signal with a hard timeout signal, so a stuck
// backend call can never leave the UI stuck on "Loading..." forever.
function combineSignals(userSignal: AbortSignal, timeoutMs: number): AbortSignal {
   if (typeof (AbortSignal as any).any === 'function') {
      return (AbortSignal as any).any([userSignal, AbortSignal.timeout(timeoutMs)]);
   }
   // Fallback for older runtimes without AbortSignal.any
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
   userSignal.addEventListener('abort', () => { clearTimeout(timer); controller.abort(userSignal.reason); });
   return controller.signal;
}

const VEHICLE_TRIPS_TIMEOUT_MS = 45000;
const TRIP_ROUTE_TIMEOUT_MS = 30000;

const DriverTracking: React.FC = () => {
   const { profile } = useAuth();
   const [vehicles, setVehicles] = useState<any[]>([]);
   const [filterVehicle, setFilterVehicle] = useState<string>('all');
   const [dateRange, setDateRange] = useState<string>('week'); // Default to This Week
   const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
   const [vehicleTrips, setVehicleTrips] = useState<{ [key: string]: any }>({});
   const [addressCache, setAddressCache] = useState<Record<string, string>>({});
   const [expandedMap, setExpandedMap] = useState<string | null>(null);
   const [expandedWarnings, setExpandedWarnings] = useState<string | null>(null);
   const [page, setPage] = useState<number>(1);
   const [totalPages, setTotalPages] = useState<number>(1);
   const [isSyncing, setIsSyncing] = useState<boolean>(false);
   const [inlinePaths, setInlinePaths] = useState<{ [key: string]: any[] }>({});

   // API Locks & Queue Locks
   const fetchingRef = useRef<Set<string>>(new Set());
   const queuedRef = useRef<Set<string>>(new Set());
   const abortControllersRef = useRef<Record<string, AbortController>>({});

   // Kept in sync with vehicleTrips state but read inside the
   // IntersectionObserver callback via a ref so the observer effect
   // doesn't need to re-run (and disconnect/reconnect) on every fetch.
   const vehicleTripsRef = useRef<{ [key: string]: any }>({});
   useEffect(() => { vehicleTripsRef.current = vehicleTrips; }, [vehicleTrips]);

   const [loadingInlineMap, setLoadingInlineMap] = useState<{ [key: string]: boolean }>({});
   const [speedingEvents, setSpeedingEvents] = useState<{ [key: string]: any[] }>({});
   const [loadingExceptions, setLoadingExceptions] = useState<{ [key: string]: boolean }>({});
   const [activeExceptionTab, setActiveExceptionTab] = useState<{ [key: string]: 'maxSpeed' | 'speeding' | null }>({});

   const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
   const [historyPath, setHistoryPath] = useState<any[]>([]);
   const [mapCenter, setMapCenter] = useState<[number, number]>([30.2672, -97.7431]); // Default Austin, TX

   const [isPlaying, setIsPlaying] = useState(false);
   const [playbackIndex, setPlaybackIndex] = useState(0);

   useEffect(() => {
       let interval: any;
       if (isPlaying && historyPath.length > 0) {
           interval = setInterval(() => {
               setPlaybackIndex(prev => {
                   if (prev >= historyPath.length - 1) {
                       setIsPlaying(false);
                       return prev;
                   }
                   return prev + 1;
               });
           }, 100);
       }
       return () => clearInterval(interval);
   }, [isPlaying, historyPath]);

   useEffect(() => {
       setPlaybackIndex(0);
       setIsPlaying(false);
   }, [historyPath]);

   useEffect(() => {
      const fetchVehicles = async () => {
         if (!profile?.organization_id) return;
         try {
            const res = await fetch(`${API_BASE_URL}/api/vehicles-list?organizationId=${profile.organization_id}`, {
               signal: AbortSignal.timeout(20000)
            });
            const json = await res.json();

            if (json.success && json.data) {
               const sorted = json.data.sort((a: any, b: any) => {
                  const safeA = String(a.name || 'Unknown Vehicle');
                  const safeB = String(b.name || 'Unknown Vehicle');
                  const aIsNum = /^\d/.test(safeA);
                  const bIsNum = /^\d/.test(safeB);
                  if (aIsNum && !bIsNum) return 1;
                  if (!aIsNum && bIsNum) return -1;
                  return safeA.localeCompare(safeB, undefined, { numeric: true, sensitivity: 'base' });
               });
               const mapped = sorted.map((v: any) => ({
                 id: v.vehicleId || v.id,
                 name: v.name,
                 providerVehicleId: v.providerVehicleId,
                 provider: v.provider
               }));
               setVehicles(mapped);
            }
         } catch (e) { console.error('Failed to load vehicle list', e); }
      };
      fetchVehicles();
   }, [profile, dateRange]);

   const fetchVehiclePreview = async (vehicleId: string, vehicleName: string, range: string, targetPage: number = 1) => {
      const fetchKey = `${vehicleId}-${range}-${targetPage}`;

      if (fetchingRef.current.has(fetchKey)) return;
      fetchingRef.current.add(fetchKey);

      if (abortControllersRef.current[vehicleId]) {
         abortControllersRef.current[vehicleId].abort();
      }
      const abortController = new AbortController();
      abortControllersRef.current[vehicleId] = abortController;
      // Combine the "we cancelled this on purpose" signal with a hard
      // timeout — this is the fix for requests that used to hang forever
      // with no signal at all.
      const combinedSignal = combineSignals(abortController.signal, VEHICLE_TRIPS_TIMEOUT_MS);

      try {
         setIsSyncing(true);

         const res = await fetch(`${API_BASE_URL}/api/vehicle-trips`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 organizationId: profile?.organization_id,
                 provider: 'geotab',
                 vehicleId: vehicleId,
                 timeframe: range,
                 page: targetPage,
                 limit: 10
             }),
             signal: combinedSignal
         });
         const json = await res.json();
         if (!json.success) throw new Error(json.error || "Failed to fetch trips from API");

         if (json.syncRequired) {
             setVehicleTrips(prev => ({
                ...prev,
                [vehicleId]: {
                   error: false,
                   empty: true,
                   syncRequired: true,
                   trips: [],
                   summary: { distance: 0, driving: 0, stopped: 0, idle: 0 }
                }
             }));
             setTotalPages(1);
             setIsSyncing(false);
             return;
         }

         const trips = json.data || [];
         const mappedTrips = trips.map((t: any) => ({
             id: t.id,
             start_time: t.start,
             end_time: t.stop,
             distance: t.distance,
             driving_duration: t.drivingDurationSec,
             stopped_duration: t.stopDurationSec,
             idle_duration: t.idleDurationSec,
             start_location: t.start_location,
             end_location: t.end_location,
             start_address: t.startAddress,
             stop_address: t.stopAddress,
             vehicle_name: t.vehicle_name,
             maxSpeed: t.maxSpeed,
             points: t.points || []
         }));

         setVehicleTrips(prev => ({
            ...prev,
            [vehicleId]: {
               error: false,
               empty: mappedTrips.length === 0,
               trips: mappedTrips,
               summary: {
                  distance: mappedTrips.reduce((sum: number, t: any) => sum + (t.distance || 0), 0),
                  driving: mappedTrips.reduce((sum: number, t: any) => sum + (t.driving_duration || 0), 0),
                  stopped: mappedTrips.reduce((sum: number, t: any) => sum + (t.stopped_duration || 0), 0),
                  idle: mappedTrips.reduce((sum: number, t: any) => sum + (t.idle_duration || 0), 0)
               }
            }
         }));
         setTotalPages(json.totalPages || 1);
         setIsSyncing(false);
         setPage(targetPage);
      } catch (err: any) {
         const wasDeliberateCancel = abortController.signal.aborted && err?.name === 'AbortError';
         if (!wasDeliberateCancel) {
             // Includes real timeouts now (err.name === 'TimeoutError'), so the
             // card correctly flips to an error/retry state instead of
             // sitting on the loading skeleton forever.
             console.error('Failed to fetch preview for', vehicleId, err);
             setVehicleTrips(prev => ({
                ...prev,
                [vehicleId]: {
                   error: true,
                   errorMessage: err?.name === 'TimeoutError'
                      ? 'Request timed out. Please retry.'
                      : (err.message || 'Failed to load'),
                   empty: false,
                   trips: [],
                   summary: { distance: 0, driving: 0, stopped: 0, idle: 0 }
                }
             }));
         }
         setIsSyncing(false);
      } finally {
         fetchingRef.current.delete(fetchKey);
      }
   };

   React.useEffect(() => {
       if (vehicles.length > 0 && filterVehicle !== 'all') {
           const v = vehicles.find(x => x.id === filterVehicle || x.name === filterVehicle);
           if (v) {
               const fetchKey = `${v.id}-${dateRange}`;
               queuedRef.current.add(fetchKey);
               fetchVehiclePreview(v.id, v.name, dateRange, 1);
               setExpandedVehicle(v.id);
           }
       }
   }, [filterVehicle, dateRange, vehicles]);

   const handleVehicleExpand = (vehicleId: string, vehicleName: string) => {
      if (expandedVehicle === vehicleId) {
         setExpandedVehicle(null);
         return;
      }
      setExpandedVehicle(vehicleId);
      const fetchKey = `${vehicleId}-${dateRange}`;
      queuedRef.current.add(fetchKey);
      fetchVehiclePreview(vehicleId, vehicleName, dateRange);
   };

   const handleFetchPath = async (trip: any, vehicleId: string) => {
      const tripId = trip.id;
      const isExpanding = expandedMap !== tripId;

      if (!isExpanding) {
         setExpandedMap(null);
         setSelectedTrip(null);
         setHistoryPath([]);
         return;
      }

      setExpandedMap(tripId);
      setSelectedTrip(trip);

      if (inlinePaths[tripId]) {
         setHistoryPath(inlinePaths[tripId]);
         if (inlinePaths[tripId].length > 0) {
            setMapCenter([inlinePaths[tripId][0].lat, inlinePaths[tripId][0].lng]);
         }
         return;
      }

      setLoadingInlineMap(prev => ({ ...prev, [tripId]: true }));
      try {
         const res = await fetch(`${API_BASE_URL}/api/trip-route`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 organizationId: profile?.organization_id,
                 tripId: tripId,
                 vehicleId: vehicleId
             }),
             signal: AbortSignal.timeout(TRIP_ROUTE_TIMEOUT_MS)
         });
         const json = await res.json();
         if (!json.success) throw new Error(json.error || "Failed to fetch trip route");

         const routeData = json.data || [];
         let pathData = routeData.map((p: any) => ({
             lat: Number(p.latitude || p.lat),
             lng: Number(p.longitude || p.lng),
             timestamp: p.timestamp || p.dateTime,
             speed: p.speed || 0
         })).filter((p: any) => {
             return Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
                    p.lat >= -90 && p.lat <= 90 &&
                    p.lng >= -180 && p.lng <= 180 &&
                    !(p.lat === 0 && p.lng === 0);
         }).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

         const uniquePath = [];
         let lastPoint = null;
         for (const pt of pathData) {
            if (!lastPoint || pt.lat !== lastPoint.lat || pt.lng !== lastPoint.lng) {
                uniquePath.push(pt);
                lastPoint = pt;
            }
         }
         pathData = uniquePath;

         setInlinePaths(prev => ({ ...prev, [tripId]: pathData }));
         setHistoryPath(pathData);

         if (pathData.length > 0) {
            setMapCenter([pathData[0].lat, pathData[0].lng]);
         }
      } catch (err) {
         console.error('Failed to fetch/parse trip path', err);
      } finally {
         setLoadingInlineMap(prev => ({ ...prev, [tripId]: false }));
      }
   };

   const fetchTripExceptions = async (trip: any, vehicleId: string) => {
      if (!profile?.organization_id || !trip) return;
      if (speedingEvents[(trip.id)]) return;

      setLoadingExceptions(prev => ({ ...prev, [(trip.id)]: true }));
      try {
         const { data, error } = await supabase
            .from('safety_incident_reports')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('vehicle_id', vehicleId)
            .gte('date', trip.start_time)
            .lte('date', trip.end_time);

         if (error) throw error;

         setSpeedingEvents(prev => ({
            ...prev,
            [(trip.id)]: data || []
         }));
      } catch (err) {
         console.error('Failed to fetch exceptions', err);
         setSpeedingEvents(prev => ({ ...prev, [(trip.id)]: [] }));
      } finally {
         setLoadingExceptions(prev => ({ ...prev, [(trip.id)]: false }));
      }
   };

   const toggleExceptions = (trip: any, vehicleId: string) => {
      const tripId = trip.id;
      if (expandedWarnings === tripId) {
         setExpandedWarnings(null);
      } else {
         setExpandedWarnings(tripId);
         fetchTripExceptions(trip, vehicleId);
      }
   };

   const fetchAddress = async (lat: number, lng: number): Promise<string> => {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (addressCache[key]) return addressCache[key];
      if ((window as any).geocodingQueue && (window as any).geocodingQueue[key]) return (window as any).geocodingQueue[key];

      const fetchPromise = (async () => {
         try {
            const res = await fetch(`${API_BASE_URL}/api/geocode/reverse?lat=${lat}&lon=${lng}`, {
               headers: { 'Accept-Language': 'en' },
               signal: AbortSignal.timeout(10000)
            });
            const data = await res.json();
            const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

            setAddressCache(prev => ({ ...prev, [key]: address }));
            return address;
         } catch (error) {
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
         } finally {
            if ((window as any).geocodingQueue) delete (window as any).geocodingQueue[key];
         }
      })();

      if (!(window as any).geocodingQueue) (window as any).geocodingQueue = {};
      (window as any).geocodingQueue[key] = fetchPromise;
      return fetchPromise;
   };

   const getShortAddress = (addr: string) => {
      if (!addr) return '';
      const parts = addr.split(',');
      if (parts.length <= 2) return addr;
      return `${parts[0].trim()}, ${parts[1].trim()}`;
   };

   useEffect(() => {
      if (vehicles.length === 0) return;

      vehicles.forEach((v) => {
        const asset = vehicleTrips[v.id];
        if (!asset || asset.empty || !asset.trips || asset.trips.length === 0) return;

        const latestTrip = asset.trips[0];
        if (latestTrip) {
          if (latestTrip.start_location?.lat && latestTrip.start_location?.lng) {
            fetchAddress(latestTrip.start_location.lat, latestTrip.start_location.lng);
          }
          if (latestTrip.end_location?.lat && latestTrip.end_location?.lng) {
            fetchAddress(latestTrip.end_location.lat, latestTrip.end_location.lng);
          }
        }

        if (expandedVehicle === v.id) {
          asset.trips.forEach((trip: any) => {
            if (trip.start_location?.lat && trip.start_location?.lng) {
              fetchAddress(trip.start_location.lat, trip.start_location.lng);
            }
            if (trip.end_location?.lat && trip.end_location?.lng) {
              fetchAddress(trip.end_location.lat, trip.end_location.lng);
            }
          });
        }
      });
   }, [vehicles, vehicleTrips, expandedVehicle]);

   return (
      <div className="h-[calc(100vh-64px)] flex">
         <div className="w-80 bg-brand-bg-secondary text-white border-brand-border border-r border-brand-border p-4 flex flex-col gap-4 z-10 shadow-lg h-full overflow-y-auto">
            <h2 className="text-xl font-bold flex items-center gap-2"><MapPin className="text-blue-600" /> Trip History</h2>

            <div className="flex flex-col gap-2 shrink-0">
               <select
                  className="w-full p-2 border border-brand-border rounded-lg bg-brand-bg-secondary text-white border-brand-border text-sm"
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
               >
                  <option value="all">-- All Vehicles --</option>
                  {vehicles.map((v) => (
                     <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
               </select>

               <select
                  className="w-full p-2 border border-brand-border rounded-lg bg-brand-bg-secondary text-white border-brand-border text-sm"
                  value={dateRange}
                  onChange={(e) => {
                     setDateRange(e.target.value);
                     setVehicleTrips({});
                     setExpandedVehicle(null);
                     setPage(1);
                     setTotalPages(1);

                     fetchingRef.current.clear();
                     queuedRef.current.clear();
                     fetchQueue.length = 0;
                  }}
               >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
               </select>
            </div>

            <div className="flex flex-col gap-3">
                {vehicles.filter(v => filterVehicle === 'all' || v.id === filterVehicle).map((v) => {
                   const isExpanded = expandedVehicle === v.id;
                   const asset = vehicleTrips[v.id];
                   const isLoading = !asset;
                   const isError = asset?.error;

                   const fmtTime = (s: number | null | undefined) => {
                      if (s === null || s === undefined || isNaN(s)) return '—';
                      const h = Math.floor(s / 3600);
                      const m = Math.floor((s % 3600) / 60);
                      const sc = Math.floor(s % 60);
                      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
                   };

                   const formatTripDateRange = (startDate: Date | null | undefined, stopDate: Date | null | undefined) => {
                      if (!startDate || isNaN(startDate.getTime()) || !stopDate || isNaN(stopDate.getTime())) return '—';
                      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      const format = (d: Date) => {
                         const dayName = days[d.getDay()];
                         const month = String(d.getMonth() + 1).padStart(2, '0');
                         const day = String(d.getDate()).padStart(2, '0');
                         return `${dayName} ${month}/${day}`;
                      };
                      return `${format(startDate)} - ${format(stopDate)}`;
                   };

                   return (
                      <div key={v.id} className="vehicle-card border border-brand-border rounded-lg bg-brand-bg-secondary text-white border-brand-border shadow-sm overflow-hidden mb-3" data-vehicle-id={v.id} data-vehicle-name={v.name}>
                         <div
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-brand-bg-secondary transition-colors"
                            onClick={() => handleVehicleExpand(v.id, v.name)}
                         >
                            <div className="flex justify-between items-center w-full">
                               <h3 className="font-bold text-blue-400 text-sm">{v.name}</h3>
                               <div className="flex items-center gap-4">
                                  <span className="text-xs text-brand-muted">
                                     {isLoading ? (isExpanded ? 'Loading...' : 'Click to load') : `${vehicleTrips[v.id]?.trips?.length || 0} trips`}
                                  </span>
                                  <div className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                                     {isExpanded ? 'Hide details' : 'See details'}
                                  </div>
                               </div>
                            </div>
                         </div>

                         {isLoading && (
                            <div className="px-4 pb-4 bg-brand-bg-secondary text-white border-brand-border border-t border-brand-border pt-3 animate-pulse">
                               <div className="flex flex-col">
                                  <div className="h-3 bg-brand-bg border border-brand-border rounded w-1/2 mb-3"></div>
                                  <div className="flex items-start gap-2 mb-2">
                                     <div className="w-2.5 h-2.5 rounded-full bg-brand-bg border border-brand-border mt-0.5 shrink-0"></div>
                                     <div className="h-2.5 bg-brand-bg border border-brand-border rounded w-3/4"></div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                     <div className="w-2.5 h-2.5 rounded-sm bg-brand-bg border border-brand-border mt-0.5 shrink-0"></div>
                                     <div className="h-2.5 bg-brand-bg border border-brand-border rounded w-2/3"></div>
                                  </div>
                               </div>
                            </div>
                         )}

                         {isError && (
                            <div className="px-4 pb-4 bg-brand-bg-secondary text-white border-brand-border border-t border-brand-border pt-3 flex flex-col items-center justify-center py-6 text-red-500">
                               <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                               <p className="text-sm font-medium mb-3">{asset.errorMessage}</p>
                               <button
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     queuedRef.current.delete(`${v.id}-${dateRange}`);
                                     fetchVehiclePreview(v.id, v.name, dateRange, 1);
                                  }}
                                  className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm font-medium transition-colors"
                               >
                                  Retry
                               </button>
                            </div>
                         )}

                         {!isLoading && asset?.syncRequired && (
                            <div className="px-4 pb-4 bg-brand-bg-secondary text-white border-brand-border text-xs text-yellow-400">
                               No trip history is currently synced for this date range.
                            </div>
                         )}

                         {!isLoading && asset?.empty && !asset?.syncRequired && (
                            <div className="px-4 pb-4 bg-brand-bg-secondary text-white border-brand-border text-xs text-brand-muted">
                               No trips found in the selected date range.
                            </div>
                         )}

                         {!isExpanded && !isLoading && asset && !asset.empty && asset.trips && asset.trips.length > 0 && (() => {
                            const latestTrip = asset.trips[0];
                            const start = new Date(latestTrip.start_time);
                            const end = new Date(latestTrip.end_time);
                            const tripDateRange = formatTripDateRange(start, end);

                            let startAddr = latestTrip.startAddress || latestTrip.start_address;
                            if (latestTrip.start_location?.lat && latestTrip.start_location?.lng) {
                               const startKey = `${Number(latestTrip.start_location.lat).toFixed(4)},${Number(latestTrip.start_location.lng).toFixed(4)}`;
                               if (addressCache[startKey]) startAddr = addressCache[startKey];
                            }
                            if (!startAddr || startAddr === 'Location unavailable') {
                               startAddr = latestTrip.start_location?.lat ? 'Resolving address...' : 'GPS starting point not recorded';
                            }

                            let endAddr = latestTrip.stopAddress || latestTrip.stop_address || latestTrip.end_address;
                            if (latestTrip.end_location?.lat && latestTrip.end_location?.lng) {
                               const endKey = `${Number(latestTrip.end_location.lat).toFixed(4)},${Number(latestTrip.end_location.lng).toFixed(4)}`;
                               if (addressCache[endKey]) endAddr = addressCache[endKey];
                            }
                            if (!endAddr || endAddr === 'Location unavailable') {
                               endAddr = latestTrip.end_location?.lat ? 'Resolving address...' : 'GPS ending point not recorded';
                            }

                            const shortStart = getShortAddress(startAddr);
                            const shortEnd = getShortAddress(endAddr);

                            const startTimeStr = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                            const endTimeStr = end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});

                            return (
                               <div className="px-4 pb-4 bg-brand-bg-secondary text-white border-brand-border border-t border-brand-border pt-3">
                                  <div className="flex flex-col text-[11px] text-slate-300">
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-white">
                                           {asset.trips[0]?.vehicle_name || v.name || 'Unknown driver'} | {tripDateRange}
                                        </span>
                                     </div>

                                     <div className="flex items-start gap-2 mb-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 bg-brand-bg-secondary text-white border-brand-border mt-0.5 shrink-0"></div>
                                        <span>
                                           <strong className="text-white font-semibold">{startTimeStr}</strong> {shortStart}
                                        </span>
                                     </div>

                                     <div className="flex items-start gap-2">
                                        <div className="w-2.5 h-2.5 flex items-center justify-center border-2 border-blue-600 bg-brand-bg-secondary text-white border-brand-border mt-0.5 shrink-0 text-[6px] font-black text-blue-600 rounded-sm">1</div>
                                        <span>
                                           <strong className="text-white font-semibold">{endTimeStr}</strong> {shortEnd}
                                        </span>
                                     </div>
                                  </div>
                               </div>
                            );
                         })()}

                         {isExpanded && !isLoading && asset && !asset.empty && (
                            <div className="bg-brand-bg-secondary text-white border-brand-border px-4 pb-4 border-t border-brand-border pt-3">
                               <div className="grid grid-cols-4 gap-1 text-[10px] py-1.5 px-2 bg-brand-bg border border-brand-border rounded-lg text-center mb-4 font-bold text-slate-400">
                                  <div>Dist: <span className="text-white font-extrabold ml-1">{isNaN(asset.summary.distance) || asset.summary.distance == null ? '—' : Math.round(asset.summary.distance) + 'km'}</span></div>
                                  <div>Drive: <span className="text-white font-extrabold ml-1">{fmtTime(asset.summary.driving)}</span></div>
                                  <div>Stop: <span className="text-white font-extrabold ml-1">{fmtTime(asset.summary.stopped)}</span></div>
                                  <div>Idle: <span className="text-white font-extrabold ml-1">{fmtTime(asset.summary.idle)}</span></div>
                               </div>

                               <div className="flex flex-col gap-5 max-h-96 overflow-y-auto pr-1">
                                  {asset.trips.map((trip: any, idx: number) => {
                                     const isSelected = selectedTrip?.id === (trip.trip_id);
                                     const start = new Date(trip.start_time);
                                     const end = new Date(trip.end_time);
                                     const tripDateRange = formatTripDateRange(start, end);

                                     let startAddr = trip.startAddress || trip.start_address;
                                     if (trip.start_location?.lat && trip.start_location?.lng) {
                                        const startKey = `${Number(trip.start_location.lat).toFixed(4)},${Number(trip.start_location.lng).toFixed(4)}`;
                                        if (addressCache[startKey]) startAddr = addressCache[startKey];
                                     }
                                     if (!startAddr || startAddr === 'Location unavailable') {
                                        startAddr = trip.start_location?.lat ? 'Resolving address...' : 'GPS starting point not recorded';
                                     }

                                     let endAddr = trip.stopAddress || trip.stop_address || trip.end_address;
                                     if (trip.end_location?.lat && trip.end_location?.lng) {
                                        const endKey = `${Number(trip.end_location.lat).toFixed(4)},${Number(trip.end_location.lng).toFixed(4)}`;
                                        if (addressCache[endKey]) endAddr = addressCache[endKey];
                                     }
                                     if (!endAddr || endAddr === 'Location unavailable') {
                                        endAddr = trip.end_location?.lat ? 'Resolving address...' : 'GPS ending point not recorded';
                                     }

                                     const startTimeStr = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                                     const endTimeStr = end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});

                                     return (
                                        <div key={trip.id} className="relative flex flex-col mb-1 last:mb-0">
                                           <div className={`relative flex flex-col p-3 rounded-lg border transition-all ${isSelected ? 'border-blue-400 bg-blue-50/20 shadow-sm' : 'border-brand-border bg-brand-bg-secondary text-white border-brand-border'}`}>
                                              <div className="flex justify-between items-center mb-2 text-[10px] text-brand-muted">
                                                 <span>{asset.trips[0]?.vehicle_name || v.name || 'Unknown driver'} | {tripDateRange}</span>
                                              </div>

                                              <div className="flex items-start gap-2 mb-1.5 text-[11px] text-slate-300">
                                                 <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 bg-brand-bg-secondary text-white border-brand-border mt-0.5 shrink-0"></div>
                                                 <span className="line-clamp-2">
                                                    <strong className="text-white font-semibold">{startTimeStr}</strong> {startAddr}
                                                 </span>
                                              </div>

                                              <div className="flex items-start gap-2 mb-2 text-[11px] text-slate-300">
                                                 <div className="w-2.5 h-2.5 flex items-center justify-center border-2 border-blue-600 bg-brand-bg-secondary text-white border-brand-border mt-0.5 shrink-0 text-[6px] font-black text-blue-600 rounded-sm">{idx + 1}</div>
                                                 <span className="line-clamp-2">
                                                    <strong className="text-white font-semibold">{endTimeStr}</strong> {endAddr}
                                                 </span>
                                              </div>

                                              <div className="flex gap-2 mt-2 pt-2 border-t border-brand-border">
                                                 <button
                                                    onClick={(e) => { e.stopPropagation(); handleFetchPath(trip, v.id); }}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${expandedMap === trip.id ? 'bg-brand-accent text-white border-blue-600' : 'bg-blue-50 text-blue-400 border-blue-100 hover:bg-blue-100'}`}
                                                 >
                                                    <Truck size={8} /> {Math.round(trip.distance || 0)}km {expandedMap === trip.id ? '▲' : '▼'}
                                                 </button>

                                                 <button
                                                    onClick={(e) => {
                                                       e.stopPropagation();
                                                       toggleExceptions(trip, v.id);
                                                    }}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${expandedWarnings === trip.id ? 'bg-red-600 text-white border-red-600' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}
                                                 >
                                                    <AlertTriangle size={8} /> {Math.round(trip.maxSpeed || 0)} km/h
                                                 </button>
                                              </div>

                                              {expandedWarnings === trip.id && (
                                                 <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-100">
                                                    <div className="flex gap-2 mb-2 border-b border-red-150 pb-1">
                                                       <button
                                                          onClick={(e) => { e.stopPropagation(); setActiveExceptionTab(prev => ({ ...prev, [trip.id]: 'maxSpeed' })); }}
                                                          className={`px-2 py-0.5 rounded text-[9px] font-semibold ${activeExceptionTab[trip.id] !== 'speeding' ? 'bg-red-500/20 text-red-300' : 'text-red-200 hover:bg-red-500/10'}`}
                                                       >
                                                          Max Speed
                                                       </button>
                                                       <button
                                                          onClick={(e) => {
                                                             e.stopPropagation();
                                                             setActiveExceptionTab(prev => ({ ...prev, [trip.id]: 'speeding' }));
                                                             fetchTripExceptions(trip, v.id);
                                                          }}
                                                          className={`px-2 py-0.5 rounded text-[9px] font-semibold ${activeExceptionTab[trip.id] === 'speeding' ? 'bg-red-500/20 text-red-300' : 'text-red-200 hover:bg-red-500/10'}`}
                                                       >
                                                          Speeding Rule
                                                       </button>
                                                    </div>

                                                    {(activeExceptionTab[trip.id] || 'maxSpeed') === 'maxSpeed' && (
                                                       <div>
                                                          <div className="font-semibold text-red-300 mb-1 border-b border-red-500/30 pb-0.5">Maximum Speed Reached</div>
                                                          <div className="text-base font-bold text-red-400 mb-1">{Math.round(trip.maxSpeed || 0)} km/h</div>
                                                       </div>
                                                    )}

                                                    {activeExceptionTab[trip.id] === 'speeding' && (
                                                       <div>
                                                          <div className="font-semibold text-red-300 mb-1 border-b border-red-500/30 pb-0.5">Speeding Events</div>
                                                          {loadingExceptions[trip.id] ? (
                                                             <div className="text-xs text-brand-muted animate-pulse">Fetching speeding events...</div>
                                                          ) : speedingEvents[trip.id] && speedingEvents[trip.id].length > 0 ? (
                                                             <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                                                {speedingEvents[trip.id].map((ev: any, i: number) => {
                                                                   const d = new Date(ev.date || ev.activeFrom);
                                                                   const dur = Math.round((new Date(ev.activeTo || ev.date).getTime() - d.getTime()) / 1000) || 0;
                                                                   return (
                                                                      <div key={i} className="bg-brand-bg-secondary text-white border-brand-border p-1.5 rounded border-red-500/20 flex justify-between items-center text-[10px]">
                                                                         <span>{d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ({dur}s)</span>
                                                                         <span className="text-red-600 font-bold">{ev.type || 'Speeding Rule'}</span>
                                                                      </div>
                                                                   );
                                                                })}
                                                             </div>
                                                          ) : (
                                                             <div className="text-[10px] text-brand-muted">No speeding exceptions recorded.</div>
                                                          )}
                                                       </div>
                                                    )}
                                                 </div>
                                              )}

                                              {expandedMap === trip.id && (
                                                 <div className="mt-2 w-full h-40 rounded border border-brand-border relative overflow-hidden">
                                                    {loadingInlineMap[trip.id] ? (
                                                       <div className="absolute inset-0 bg-brand-bg-secondary flex items-center justify-center text-xs text-brand-muted z-10 animate-pulse">
                                                          Fetching trip route...
                                                       </div>
                                                    ) : inlinePaths[trip.id] && inlinePaths[trip.id].length > 0 ? (
                                                       <MapContainer
                                                          center={[inlinePaths[trip.id][0].lat, inlinePaths[trip.id][0].lng]}
                                                          zoom={13}
                                                          style={{ height: '100%', width: '100%' }}
                                                          zoomControl={false}
                                                       >
                                                          <ChangeView bounds={L.latLngBounds(inlinePaths[trip.id].map((p: any) => [p.lat, p.lng]))} />
                                                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                          <Polyline positions={inlinePaths[trip.id].map((p: any) => [p.lat, p.lng])} color="blue" weight={3} />
                                                          <Marker position={[inlinePaths[trip.id][0].lat, inlinePaths[trip.id][0].lng]}><Popup>Start</Popup></Marker>
                                                          <Marker position={[inlinePaths[trip.id][inlinePaths[trip.id].length - 1].lat, inlinePaths[trip.id][inlinePaths[trip.id].length - 1].lng]}><Popup>End</Popup></Marker>
                                                       </MapContainer>
                                                    ) : (
                                                       <div className="absolute inset-0 bg-brand-bg-secondary flex items-center justify-center text-xs text-brand-muted z-10">
                                                          No GPS points were received from the provider for this trip.
                                                       </div>
                                                    )}
                                                 </div>
                                              )}
                                           </div>
                                        </div>
                                     );
                                  })}
                               </div>
                               {totalPages > 1 && (
                                  <div className="px-4 py-3 bg-brand-bg-secondary border-t border-brand-border flex items-center justify-between text-sm rounded-b-xl">
                                     <button 
                                        disabled={page === 1}
                                        onClick={(e) => { e.stopPropagation(); fetchVehiclePreview(v.id, v.name, dateRange, page - 1); }}
                                        className="px-3 py-1.5 bg-brand-bg-secondary text-white border-brand-border border border-brand-border rounded shadow-sm disabled:opacity-50 hover:bg-brand-bg-secondary font-medium text-white transition-colors"
                                     >
                                        Previous
                                     </button>
                                     <span className="text-slate-300 font-medium">Page {page} of {totalPages}</span>
                                     <button 
                                        disabled={page === totalPages}
                                        onClick={(e) => { e.stopPropagation(); fetchVehiclePreview(v.id, v.name, dateRange, page + 1); }}
                                        className="px-3 py-1.5 bg-brand-bg-secondary text-white border-brand-border border border-brand-border rounded shadow-sm disabled:opacity-50 hover:bg-brand-bg-secondary font-medium text-white transition-colors"
                                     >
                                        Next
                                     </button>
                                  </div>
                               )}
                            </div>
                         )}
                      </div>
                   );
                })}
            </div>
         </div>

         <div className="flex-1 relative">
            <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
               {historyPath.length > 0 ? (
                   <ChangeView bounds={L.latLngBounds(historyPath.map(p => [p.lat, p.lng]))} />
               ) : (
                   <ChangeView center={mapCenter} />
               )}
               <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
               {historyPath.length > 0 && (
                  <>
                     <Polyline positions={historyPath.map(p => [p.lat, p.lng])} color="blue" weight={5} />
                     <Marker position={[historyPath[0].lat, historyPath[0].lng]}><Popup>Start Trip</Popup></Marker>
                     <Marker position={[historyPath[historyPath.length-1].lat, historyPath[historyPath.length-1].lng]}><Popup>End Trip</Popup></Marker>

                     {playbackIndex < historyPath.length && (
                         <Marker
                             position={[historyPath[playbackIndex].lat, historyPath[playbackIndex].lng]}
                             icon={L.divIcon({ className: 'bg-transparent', html: '<div class="w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow shadow-black"></div>', iconSize: [16, 16] })}
                         >
                             <Popup>
                                Speed: {historyPath[playbackIndex].speed || 0} km/h<br/>
                                Time: {new Date(historyPath[playbackIndex].timestamp).toLocaleTimeString()}
                             </Popup>
                         </Marker>
                     )}
                  </>
               )}
            </MapContainer>

            {historyPath.length > 0 && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-brand-bg-secondary text-white border-brand-border px-4 py-2 rounded-full shadow-lg border border-brand-border z-[1000] flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (playbackIndex >= historyPath.length - 1) setPlaybackIndex(0);
                            setIsPlaying(!isPlaying);
                        }}
                        className="flex items-center gap-1 text-blue-600 font-bold hover:text-blue-800"
                    >
                        {isPlaying ? <Square size={20} /> : <PlayCircle size={20} />}
                        {isPlaying ? 'Stop' : 'Play Route'}
                    </button>
                    <div className="text-xs font-semibold text-brand-muted min-w-[100px] text-center">
                        Point {playbackIndex + 1} of {historyPath.length}
                    </div>
                    <div className="text-xs font-bold text-white w-12 text-right">
                        {historyPath[playbackIndex]?.speed || 0} km/h
                    </div>
                </div>
            )}
         </div>
      </div>
   );
};

export default DriverTracking;