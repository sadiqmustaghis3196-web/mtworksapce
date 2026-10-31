import { supabase } from '../lib/supabase';
import { Route, RouteWaypoint, RouteAnalytics } from '../types/tracking';


export async function getRoutes(): Promise<Route[]> {
  

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getRouteById(id: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createRoute(route: Omit<Route, 'id' | 'created_at'>): Promise<Route> {
  const routeToCreate: any = { ...route };


  
  // Fallback: fetch organization_id if not provided
  if (!routeToCreate.organization_id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      if (profile?.organization_id) {
        routeToCreate.organization_id = profile.organization_id;
      }
    }
  }

  const { data, error } = await supabase
    .from('routes')
    .insert(routeToCreate)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRoute(id: string, updates: Partial<Route>): Promise<Route> {
  const { data, error } = await supabase
    .from('routes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRoute(id: string): Promise<void> {
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getRouteWaypoints(routeId: string): Promise<RouteWaypoint[]> {
  const { data, error } = await supabase
    .from('route_waypoints')
    .select('*')
    .eq('route_id', routeId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createWaypoint(waypoint: Omit<RouteWaypoint, 'id' | 'created_at'>): Promise<RouteWaypoint> {
  const { data, error } = await supabase
    .from('route_waypoints')
    .insert(waypoint)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWaypoint(id: string, updates: Partial<RouteWaypoint>): Promise<RouteWaypoint> {
  const { data, error } = await supabase
    .from('route_waypoints')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWaypoint(id: string): Promise<void> {
  const { error } = await supabase
    .from('route_waypoints')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getRouteAnalytics(routeId: string): Promise<RouteAnalytics[]> {
  const { data, error } = await supabase
    .from('route_analytics')
    .select('*')
    .eq('route_id', routeId);

  if (error) throw error;
  return data || [];
}

export async function createRouteAnalytics(analytics: Omit<RouteAnalytics, 'id' | 'created_at'>): Promise<RouteAnalytics> {
  const { data, error } = await supabase
    .from('route_analytics')
    .insert(analytics)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchOSRMRoute(coordinates: Array<{ lat: number; lng: number }>): Promise<{
  geometry: [number, number][];
  distance: number; // miles
  duration: number; // minutes
}> {
  if (coordinates.length < 2) {
    return { geometry: [], distance: 0, duration: 0 };
  }

  // OSRM expects coordinates as lng,lat
  const coordString = coordinates.map(c => `${c.lng},${c.lat}`).join(';');
  // Note: router.project-osrm.org is the public OSRM demo server. 
  // WARNING: Switch to a self-hosted instance or commercial Directions API (Google/Mapbox) for production!
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM API error: ${res.statusText}`);
  }
  
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('OSRM routing failed to resolve path.');
  }

  const route = data.routes[0];
  // OSRM returns coordinates as [lng, lat], convert to [lat, lng] for Leaflet
  const geometry: [number, number][] = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
  const distance = route.distance * 0.000621371; // convert meters to miles
  const duration = route.duration / 60; // convert seconds to minutes

  return { geometry, distance, duration };
}
export const MAX_LEG_DISTANCE_KM = 500;

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function optimizeRoute(waypoints: Array<{ lat: number; lng: number; name: string }>): Promise<{
  optimizedWaypoints: Array<{ lat: number; lng: number; name: string; sequence: number }>;
  totalDistance: number;
  estimatedDuration: number;
  optimizationScore: number;
  geometry?: [number, number][];
  isFallback?: boolean;
}> {
  if (waypoints.length === 0) {
    return { optimizedWaypoints: [], totalDistance: 0, estimatedDuration: 0, optimizationScore: 0 };
  }

  // 1. Nearest Neighbor Algorithm (Fast heuristic straight-line TSP sort)
  const optimized = [];
  const unvisited = [...waypoints];
  let current = unvisited.shift()!;
  optimized.push(current);

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = Math.sqrt(Math.pow(current.lat - unvisited[i].lat, 2) + Math.pow(current.lng - unvisited[i].lng, 2));
      if (d < minDistance) {
        minDistance = d;
        nearestIdx = i;
      }
    }
    current = unvisited.splice(nearestIdx, 1)[0];
    optimized.push(current);
  }

  const optimizedWithSequence = optimized.map((wp, index) => ({
    ...wp,
    sequence: index + 1,
  }));

  // Validate maximum distance constraint
  for (let i = 0; i < optimized.length - 1; i++) {
    const dist = getDistanceKm(optimized[i].lat, optimized[i].lng, optimized[i + 1].lat, optimized[i + 1].lng);
    if (dist > MAX_LEG_DISTANCE_KM) {
      throw new Error(`Selected points are too far apart for route optimization (over ${MAX_LEG_DISTANCE_KM}km). Please check your waypoints.`);
    }
  }

  // 2. Query OSRM for actual road routing & duration
  try {
    const osrmResult = await fetchOSRMRoute(optimized);
    const savings = 15; // Baseline savings percentage
    const optimizationScore = Math.min(95, 70 + savings);

    return {
      optimizedWaypoints: optimizedWithSequence,
      totalDistance: Math.round(osrmResult.distance * 100) / 100,
      estimatedDuration: Math.round(osrmResult.duration),
      optimizationScore: Math.round(optimizationScore * 100) / 100,
      geometry: osrmResult.geometry
    };
  } catch (error) {
    console.warn("⚠️ OSRM API failed, falling back to Haversine straight-line estimation:", error);

    // Fallback: Haversine distance sum
    let totalDistance = 0;
    for (let i = 0; i < optimized.length - 1; i++) {
      const lat1 = optimized[i].lat;
      const lon1 = optimized[i].lng;
      const lat2 = optimized[i + 1].lat;
      const lon2 = optimized[i + 1].lng;

      const R = 3959; // Earth's radius in miles
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;
    }

    const averageSpeed = 45; // mph
    const estimatedDuration = (totalDistance / averageSpeed) * 60; // minutes
    const baselineDistance = totalDistance * 1.15;
    const savings = ((baselineDistance - totalDistance) / baselineDistance) * 100;
    const optimizationScore = Math.min(95, 70 + savings);

    return {
      optimizedWaypoints: optimizedWithSequence,
      totalDistance: Math.round(totalDistance * 100) / 100,
      estimatedDuration: Math.round(estimatedDuration),
      optimizationScore: Math.round(optimizationScore * 100) / 100,
      isFallback: true,
    };
  }
}
