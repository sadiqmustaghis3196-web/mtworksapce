import { getUserOrganizationId } from './organization';
import { supabase } from '../lib/supabase';

export interface DriverBehaviorSummary {
  driver_id: string;
  name: string;
  email: string;
  behavior_score: number | null;
  safety_rating: number | null;
  fuel_efficiency_rating: number | null;
  acceleration_score: number | null;
  braking_score: number | null;
  speed_compliance: number | null;
  idle_time_score: number | null;
  total_miles: number;
  scored_events_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'none';
  recommendations: string[];
  improvement_trend: 'improving' | 'stable' | 'declining' | 'none';
  has_data: boolean;
}

export async function getDriverBehaviorData(isLiveMode: boolean = false): Promise<DriverBehaviorSummary[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return [];

  try {
    const { API_BASE_URL } = await import('../lib/apiConfig');
    const response = await fetch(`${API_BASE_URL}/api/admin/driver-behavior${isLiveMode ? '?sync=true' : ''}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const jsonBody = await response.json();

    if (!response.ok) {
      throw new Error('Failed to fetch driver behavior data');
    }

    const { data } = jsonBody;

    if (!data || data.length === 0) return [];

    const behaviorSummaries = data.map((d: any) => {
      const metrics = d.metrics || emptyMetrics();
      const scoredEventsCount = d.scored_events_count || 0;
      const overall = d.overall_score;
      const scores = calculateDriverScores(metrics, overall);
      const recommendations = generateRecommendations(scores, scoredEventsCount);

      return {
        driver_id: d.driver_id,
        name: d.name,
        email: d.email,
        behavior_score: scores.overall,
        safety_rating: scores.safety,
        fuel_efficiency_rating: scores.fuel_efficiency,
        acceleration_score: scores.acceleration,
        braking_score: scores.braking,
        speed_compliance: scores.speed_compliance,
        idle_time_score: scores.idle_time,
        total_miles: metrics.total_miles || 0,
        total_hours: metrics.total_hours || 0,
        scored_events_count: scoredEventsCount,
        metrics: metrics,
        incidents: d.incidents || [],
        risk_level: scores.overall === null ? 'none' : getRiskLevel(scores.overall, scoredEventsCount),
        recommendations,
        improvement_trend: scores.overall === null ? 'none' : 'stable',
        has_score: scores.overall !== null,
        has_data: metrics.total_miles > 0 || scoredEventsCount > 0
      };
    });

    return behaviorSummaries.sort((a: any, b: any) => (b.behavior_score || 0) - (a.behavior_score || 0));
  } catch (error: any) {
    console.error("Error fetching driver behavior data:", error);
    throw new Error(error.message || 'Failed to load driver behavior data');
  }
}

export async function getDriverMetrics(driverId: string) {
  try {
    const orgId = await getUserOrganizationId();
    if (!orgId) return emptyMetrics();

    const { data: behaviorData, error } = await supabase
      .from('driver_behavior_analytics')
      .select('*')
      .eq('driver_id', driverId)
      .eq('organization_id', orgId)
      .limit(30);

    if (error) {
      console.warn(`Metrics fetch error for ${driverId}:`, error.message);
      return emptyMetrics();
    }

    if (!behaviorData || behaviorData.length === 0) {
      return emptyMetrics();
    }
    
    // Aggregate Data
    return behaviorData.reduce((acc, r) => ({
        harsh_acceleration: acc.harsh_acceleration + (r.harsh_acceleration_count || 0),
        harsh_braking: acc.harsh_braking + (r.harsh_braking_count || 0),
        speed_violations: acc.speed_violations + (r.speed_violations_count || 0),
        idle_time: acc.idle_time + (r.idle_time_minutes || 0),
        total_miles: acc.total_miles + (r.total_distance_miles || 0),
        total_hours: acc.total_hours + (r.total_hours || 0)
    }), emptyMetrics());

  } catch (err) {
    console.error("Unexpected error in getDriverMetrics:", err);
    return emptyMetrics();
  }
}

export async function getDriverIncidents(driverId: string) {
  try {
    const orgId = await getUserOrganizationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from('safety_incident_reports')
      .select('*')
      .eq('driver_id', driverId)
      .eq('organization_id', orgId);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

// --- Helpers ---

function emptyMetrics() {
  return { harsh_acceleration: 0, harsh_braking: 0, speed_violations: 0, idle_time: 0, total_miles: 0, total_hours: 0 };
}



export function calculateDriverScores(metrics: any, overall: number | null) {
  if (metrics.total_miles === 0 || overall === null) {
    return { overall: null, safety: null, fuel_efficiency: null, acceleration: null, braking: null, speed_compliance: null, idle_time: null };
  }

  // Simple Logic
  return { 
    overall: Math.round(overall), 
    safety: Math.round(overall), 
    fuel_efficiency: Math.round(Math.max(0, 100 - (metrics.idle_time / 60))), 
    acceleration: Math.round(Math.max(0, 100 - metrics.harsh_acceleration)), 
    braking: Math.round(Math.max(0, 100 - metrics.harsh_braking)), 
    speed_compliance: Math.round(Math.max(0, 100 - metrics.speed_violations)), 
    idle_time: Math.round(Math.max(0, 100 - metrics.idle_time)) 
  }; 
}

function generateRecommendations(scores: any, count: number) {
  if (scores.overall === null) return ['Drive to generate data'];
  if (scores.overall < 80) return ['Reduce harsh braking', 'Watch speed limits'];
  return ['Excellent driving', 'Maintain current habits'];
}

function getRiskLevel(score: number, count: number): 'low'|'medium'|'high' {
  if (score < 70) return 'high';
  if (score < 90) return 'medium';
  return 'low';
}

async function calculateTrend(driverId: string): Promise<'improving' | 'stable' | 'declining'> {
  return 'stable';
}

async function authenticatedFetch(path: string, options: any = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const { API_BASE_URL } = await import('../lib/apiConfig');
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function getTrainingAssignments() {
  const res = await authenticatedFetch('/admin/training-assignments');
  return res.data;
}

export async function getTrainingModules() {
  const res = await authenticatedFetch('/training-modules');
  return res.data;
}

export async function assignTraining(driver_id: string, due_date: string, payload: { training_module_id?: string, custom_title?: string, custom_description?: string, reason?: string }) {
  const res = await authenticatedFetch('/admin/training-assignments', {
    method: 'POST',
    body: JSON.stringify({
      driver_id,
      due_date,
      ...payload
    })
  });
  return res.data;
}

export async function deleteTrainingAssignment(id: string) {
  const res = await authenticatedFetch(`/admin/training-assignments/${id}`, {
    method: 'DELETE'
  });
  return res.data;
}