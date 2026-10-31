import React, { useState, useEffect } from 'react';
import { Truck, Users, MapPin, AlertTriangle, TrendingUp, Clock, Fuel, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  todayRoutes: number;
  completedRoutes: number;
  activeIncidents: number;
  avgFuelEfficiency: number;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  make: string;
  model: string;
  status: string;
  current_location?: string;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  current_location?: string;
}

interface RecentActivity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  severity?: string;
}

const FleetManagerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    todayRoutes: 0,
    completedRoutes: 0,
    activeIncidents: 0,
    avgFuelEfficiency: 0
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!profile?.organization_id) return;
      const orgId = profile.organization_id;

      const [vehiclesData, driversData, routesData, incidentsData, fuelData] = await Promise.all([
        supabase.from('vehicles').select('*').eq('organization_id', orgId),
        supabase.from('drivers').select('*').eq('organization_id', orgId),
        supabase
          .from('routes')
          .select('*')
          .eq('organization_id', orgId)
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('safety_incident_reports').select('*').eq('organization_id', orgId),
        supabase
          .from('fuel_records')
          .select('mpg')
          .eq('organization_id', orgId)
          .gte('transaction_date', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString())
      ]);

      if (vehiclesData.data) {
        setVehicles(vehiclesData.data);
        setStats(prev => ({
          ...prev,
          totalVehicles: vehiclesData.data.length,
          activeVehicles: vehiclesData.data.filter(v => v.status === 'active').length
        }));
      }

      if (driversData.data) {
        setDrivers(driversData.data);
        setStats(prev => ({
          ...prev,
          totalDrivers: driversData.data.length,
          activeDrivers: driversData.data.filter(d => d.status === 'active').length
        }));
      }

      if (routesData.data) {
        setStats(prev => ({
          ...prev,
          todayRoutes: routesData.data.length,
          completedRoutes: routesData.data.filter(r => r.status === 'completed').length
        }));
      }

      if (incidentsData.data) {
        // filter open incidents here instead to avoid 400 Bad Request
        const openIncidents = incidentsData.data.filter((i: any) => ['open', 'investigating', 'pending'].includes(i.status || 'open'));
        setStats(prev => ({
          ...prev,
          activeIncidents: openIncidents.length
        }));

        const activities: RecentActivity[] = incidentsData.data.slice(0, 5).map(incident => ({
          id: incident.id,
          type: 'incident',
          message: `Safety incident: ${incident.incident_type}`,
          timestamp: incident.created_at,
          severity: incident.severity
        }));
        setRecentActivity(activities);
      }

      if (fuelData.data && fuelData.data.length > 0) {
        const avgEfficiency = fuelData.data.reduce((sum, record) =>
          sum + (record.mpg || 0), 0) / fuelData.data.length;
        setStats(prev => ({
          ...prev,
          avgFuelEfficiency: Math.round(avgEfficiency * 10) / 10
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-slate-400 bg-slate-800';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      case 'out_of_service': return 'text-red-600 bg-red-100';
      default: return 'text-slate-400 bg-slate-800';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070f] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Fleet Operations Dashboard</h1>
          <p className="text-slate-400 mt-2">Your assigned fleet overview and performance metrics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Vehicles</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.activeVehicles}/{stats.totalVehicles}
                </p>
                <p className="text-xs text-slate-400 mt-1">Active</p>
              </div>
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Drivers</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.activeDrivers}/{stats.totalDrivers}
                </p>
                <p className="text-xs text-slate-400 mt-1">On Duty</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Today's Routes</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.completedRoutes}/{stats.todayRoutes}
                </p>
                <p className="text-xs text-slate-400 mt-1">Completed</p>
              </div>
              <MapPin className="h-8 w-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Incidents</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.activeIncidents}</p>
                <p className="text-xs text-slate-400 mt-1">Requiring Attention</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${stats.activeIncidents > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-slate-400">Avg Fuel Efficiency</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.avgFuelEfficiency} MPG</p>
              </div>
              <Fuel className="h-8 w-8 text-amber-600" />
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>Last 30 days</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-slate-400">On-Time Performance</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.todayRoutes > 0 ? Math.round((stats.completedRoutes / stats.todayRoutes) * 100) : 0}%
                </p>
              </div>
              <Clock className="h-8 w-8 text-teal-600" />
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm text-slate-400">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>Today's routes</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-slate-400">Fleet Utilization</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalVehicles > 0 ? Math.round((stats.activeVehicles / stats.totalVehicles) * 100) : 0}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm text-slate-400">
                <span>{stats.activeVehicles} vehicles in use</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 rounded-lg shadow">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Your Vehicles</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {vehicles.slice(0, 5).map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#05070f]">
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="font-semibold text-white">{vehicle.vehicle_number}</p>
                        <p className="text-sm text-slate-400">{vehicle.make} {vehicle.model}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </div>
                ))}
                {vehicles.length === 0 && (
                  <p className="text-center text-slate-400 py-8">No vehicles assigned yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg shadow">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Your Drivers</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {drivers.slice(0, 5).map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#05070f]">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="font-semibold text-white">{driver.first_name} {driver.last_name}</p>
                        <p className="text-sm text-slate-400">{driver.current_location || 'Location unknown'}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(driver.status)}`}>
                      {driver.status}
                    </span>
                  </div>
                ))}
                {drivers.length === 0 && (
                  <p className="text-center text-slate-400 py-8">No drivers assigned yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {recentActivity.length > 0 && (
          <div className="bg-slate-900/60 rounded-lg shadow mt-6">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-4 border rounded-lg">
                    <AlertTriangle className={`h-5 w-5 mt-0.5 ${getSeverityColor(activity.severity)}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{activity.message}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FleetManagerDashboard;
