import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Target, Award, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PerformanceBenchmark {
  metric_type: string;
  current_value: number;
  target_value: number;
  industry_average: number;
  performance_percentage: number;
}

interface ROICalculation {
  subscription_cost: number;
  fuel_savings: number;
  compliance_savings: number;
  time_savings_value: number;
  total_savings: number;
  roi_percentage: number;
  calculation_period_start: string;
  calculation_period_end: string;
}

interface FleetKPI {
  total_vehicles: number;
  active_vehicles: number;
  total_drivers: number;
  active_drivers: number;
  total_miles_driven: number;
  fuel_consumed_gallons: number;
  average_mpg: number;
  compliance_rate: number;
  safety_incidents: number;
  on_time_delivery_rate: number;
}

const CustomerSuccessDashboard: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<PerformanceBenchmark[]>([]);
  const [roi, setRoi] = useState<ROICalculation | null>(null);
  const [kpis, setKpis] = useState<FleetKPI | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const [benchmarksData, roiData, kpisData] = await Promise.all([
        supabase
          .from('performance_benchmarks')
          .select('*')
          .eq('user_id', user.data.user.id)
          .order('period_start', { ascending: false })
          .limit(5),
        supabase
          .from('roi_calculations')
          .select('*')
          .eq('user_id', user.data.user.id)
          .order('calculation_period_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('fleet_kpi_snapshots')
          .select('*')
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (benchmarksData.data) setBenchmarks(benchmarksData.data);
      if (roiData.data) setRoi(roiData.data);
      if (kpisData.data) setKpis(kpisData.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading customer data:', error);
      setLoading(false);
    }
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceStatus = (percentage: number) => {
    if (percentage >= 100) return 'Exceeding Target';
    if (percentage >= 80) return 'Meeting Target';
    return 'Below Target';
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
          <h1 className="text-3xl font-bold text-white">Customer Success Dashboard</h1>
          <p className="text-slate-400 mt-2">Track your fleet performance and ROI</p>
        </div>

        {roi && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-900/60 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Savings</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    ${roi.total_savings.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">ROI</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {roi.roi_percentage.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Fuel Savings</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    ${roi.fuel_savings.toLocaleString()}
                  </p>
                </div>
                <Award className="h-8 w-8 text-yellow-600" />
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Monthly Cost</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    ${roi.subscription_cost.toLocaleString()}
                  </p>
                </div>
                <Target className="h-8 w-8 text-slate-400" />
              </div>
            </div>
          </div>
        )}

        {kpis && (
          <div className="bg-slate-900/60 rounded-lg shadow mb-8">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Fleet Overview</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <p className="text-sm text-slate-400">Active Vehicles</p>
                  <p className="text-3xl font-bold text-white mt-1">{kpis.active_vehicles}</p>
                  <p className="text-xs text-slate-400">of {kpis.total_vehicles} total</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Active Drivers</p>
                  <p className="text-3xl font-bold text-white mt-1">{kpis.active_drivers}</p>
                  <p className="text-xs text-slate-400">of {kpis.total_drivers} total</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Average MPG</p>
                  <p className="text-3xl font-bold text-white mt-1">{kpis.average_mpg?.toFixed(1) || 'N/A'}</p>
                  <p className="text-xs text-slate-400">{kpis.fuel_consumed_gallons.toFixed(0)} gal</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Compliance Rate</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{kpis.compliance_rate?.toFixed(1) || 'N/A'}%</p>
                  <p className="text-xs text-slate-400">DOT compliant</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Safety Incidents</p>
                  <p className="text-3xl font-bold text-white mt-1">{kpis.safety_incidents}</p>
                  <p className="text-xs text-slate-400">this period</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-900/60 rounded-lg shadow mb-8">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Performance Benchmarks</h2>
            <p className="text-sm text-slate-400 mt-1">Compare your performance against targets and industry averages</p>
          </div>
          <div className="p-6">
            {benchmarks.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-slate-400">No benchmark data available yet</p>
                <p className="text-sm text-slate-400 mt-2">Data will be collected as you use the platform</p>
              </div>
            ) : (
              <div className="space-y-6">
                {benchmarks.map((benchmark, index) => (
                  <div key={index} className="border-b pb-6 last:border-b-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white capitalize">
                          {benchmark.metric_type.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-sm text-slate-400">
                          Target: {benchmark.target_value} | Industry Avg: {benchmark.industry_average || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${getPerformanceColor(benchmark.performance_percentage || 0)}`}>
                          {benchmark.current_value}
                        </p>
                        <p className="text-sm text-slate-400">
                          {getPerformanceStatus(benchmark.performance_percentage || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            (benchmark.performance_percentage || 0) >= 100
                              ? 'bg-green-600'
                              : (benchmark.performance_percentage || 0) >= 80
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{
                            width: `${Math.min((benchmark.performance_percentage || 0), 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>0%</span>
                        <span>{(benchmark.performance_percentage || 0).toFixed(1)}% of target</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {roi && (
          <div className="bg-slate-900/60 rounded-lg shadow">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Savings Breakdown</h2>
              <p className="text-sm text-slate-400 mt-1">
                Period: {new Date(roi.calculation_period_start).toLocaleDateString()} - {new Date(roi.calculation_period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-white">Fuel Savings</p>
                    <p className="text-sm text-slate-400">Optimized routes and driver behavior</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">${roi.fuel_savings.toLocaleString()}</p>
                </div>

                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-white">Compliance Savings</p>
                    <p className="text-sm text-slate-400">Avoided fines and penalties</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">${roi.compliance_savings.toLocaleString()}</p>
                </div>

                <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-white">Time Savings</p>
                    <p className="text-sm text-slate-400">Operational efficiency improvements</p>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">${roi.time_savings_value.toLocaleString()}</p>
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-800 rounded-lg border-2 border-gray-300">
                  <div>
                    <p className="font-semibold text-white">Subscription Cost</p>
                    <p className="text-sm text-slate-400">Platform monthly fee</p>
                  </div>
                  <p className="text-2xl font-bold text-white">-${roi.subscription_cost.toLocaleString()}</p>
                </div>

                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg mt-6">
                  <div>
                    <p className="font-bold text-white text-lg">Net Savings</p>
                    <p className="text-sm text-white opacity-90">Total value delivered</p>
                  </div>
                  <p className="text-3xl font-bold text-white">${roi.total_savings.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSuccessDashboard;
