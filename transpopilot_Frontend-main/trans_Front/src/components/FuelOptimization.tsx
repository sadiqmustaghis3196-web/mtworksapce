import React, { useState, useEffect, useMemo } from 'react';
import { useAppCache } from '../hooks/useAppCache';
// Is block ko file ke bilkul top par paste karein
import {
  Fuel,
  TrendingUp,
  MapPin,
  DollarSign,
  Route,
  Zap,
  RefreshCw,
  X,
  Navigation,
  Clock,
  Wifi,
  Coffee,
  Truck,
  Search,
  Users,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BarChart2
} from 'lucide-react';
import {
  getFuelStats,
  getDriverFuelPerformance,
  getFuelTelemetryReport,
  syncFuelTelemetry,
  FuelTelemetryReportItem,
  getFuelReceiptUrl
} from '../api/fuel';
import { getUserOrganizationId } from '../api/organization';
import FuelEntryModal from './FuelEntryModal';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiConfig';

class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private active = 0;
  constructor(private limit: number) {}
  add(fn: () => Promise<void>) {
    this.queue.push(fn);
    this.run();
  }
  private run() {
    if (this.active >= this.limit || this.queue.length === 0) return;
    this.active++;
    const fn = this.queue.shift()!;
    fn().finally(() => {
      this.active--;
      this.run();
    });
  }
}
const geocodeQueue = new RequestQueue(3);

const AddressDisplay: React.FC<{ location: string | undefined }> = ({ location }) => {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!location || location === 'Unknown' || location === 'Company location not configured') {
      setAddress(location === 'Unknown' ? 'Location unavailable' : location || 'Company location not configured');
      return;
    }
    const isCoordinate = /^-?\d+\.\d+,-?\d+\.\d+$/.test(location);
    if (!isCoordinate) {
      setAddress(location);
      return;
    }

    // Geotab coords might have too many decimals, normalize slightly for cache hits
    const [lonStr, latStr] = location.split(',');
    const lon = parseFloat(lonStr).toFixed(5);
    const lat = parseFloat(latStr).toFixed(5);
    const cacheKey = `geocode_${lat}_${lon}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAddress(cached);
      return;
    }

    let isMounted = true;

    geocodeQueue.add(() => {
      if (!isMounted) return Promise.resolve();
      return fetch(`${API_BASE_URL}/api/geocode/reverse?lat=${lat}&lon=${lon}`)
        .then(r => r.json())
        .then(data => {
          if (isMounted) {
            if (data && data.display_name) {
               const parts = data.display_name.split(', ');
               const shortAddress = parts.slice(0, 3).join(', ');
               setAddress(shortAddress || 'Location unavailable');
               localStorage.setItem(cacheKey, shortAddress || 'Location unavailable');
            } else {
               setAddress('Location unavailable');
               localStorage.setItem(cacheKey, 'Location unavailable');
            }
          }
        })
        .catch(() => {
           if (isMounted) setAddress('Location unavailable');
        });
    });
      
    return () => { isMounted = false; };
  }, [location]);

  return <span title={location}>{address || <span className="text-slate-500 animate-pulse">Resolving location...</span>}</span>;
};

interface Station {
  name: string;
  location: string;
  price: string;
  priceValue: number;
  distance: string;
  discount: string;
  status: 'Open' | 'Closed';
  amenities: string[];
}

const FuelOptimization: React.FC = () => {
  const { isDispatcher, user } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('quarter');
  const { data: fuelStatsData, isLoading: statsLoading, isValidating: statsValidating, revalidate: loadFuelStats } = useAppCache(`fuel_stats_${selectedTimeframe}_${user?.id || 'guest'}`, () => getFuelStats(selectedTimeframe), [selectedTimeframe]);
  const { data: topPerformersData, isLoading: performersLoading, revalidate: loadPerformers } = useAppCache(`fuel_performers_${selectedTimeframe}_${user?.id || 'guest'}`, () => getDriverFuelPerformance(5, selectedTimeframe), [selectedTimeframe]);
  const { data: telemetryReportData, isLoading: telemetryLoading, isValidating: telemetryValidating, revalidate: loadTelemetry } = useAppCache(`fuel_telemetry_${selectedTimeframe}_${user?.id || 'guest'}`, () => getFuelTelemetryReport(selectedTimeframe), [selectedTimeframe]);
  const [syncing, setSyncing] = useState(false);
  const topPerformers = topPerformersData || [];
  const telemetryReport = telemetryReportData || [];
  const loadedDevicesCount = Array.from(new Set(telemetryReport.map((t: FuelTelemetryReportItem) => t.vehicle_id || t.vehicle_number))).length;
  
  const fuelStats = fuelStatsData || {
    totalGallons: 0,
    totalCost: 0,
    totalMilesDriven: 0,
    costChange: 0,
    averageMPG: 0,
    mpgChange: 0,
    fuelEfficiency: 0,
    efficiencyChange: 0,
    co2Reduction: 0
  };
  const [telemetrySearch, setTelemetrySearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('device_asc');
  const [filterProvider, setFilterProvider] = useState<'all' | 'geotab' | 'samsara'>('all');
  const [selectedDeviceView, setSelectedDeviceView] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 25;
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!statsValidating && !telemetryValidating && !performersLoading && fuelStats && telemetryReport.length > 0) {
      setLastUpdated(new Date());
    }
  }, [statsValidating, telemetryValidating, performersLoading, fuelStats, telemetryReport]);

  const hasTelemetryData = telemetryReport && telemetryReport.length > 0;
  const isInitialLoad = (statsLoading || telemetryLoading || performersLoading) && !hasTelemetryData && !fuelStats;
  const isRefreshing = (statsValidating || telemetryValidating) && !isInitialLoad;
  
    
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);

  const fuelStations: Station[] = [];

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        console.warn('No organization ID found. Sync might fail.');
      } else {
        await syncFuelTelemetry(orgId);
      }
      await Promise.allSettled([loadFuelStats(false), loadPerformers(false), loadTelemetry(false)]);
    } catch (error) {
      console.error('Failed to manually sync fuel data:', error);
      alert('Failed to sync fuel telemetry from provider. Check console for details.');
    } finally {
      setSyncing(false);
    }
  };

  const { sortedData, totalCount } = useMemo(() => {
    const filtered = telemetryReport.filter(item => {
      const matchesSearch = item.device.toLowerCase().includes(telemetrySearch.toLowerCase());
      const matchesProvider = filterProvider === 'all' || item.provider === filterProvider;
      return matchesSearch && matchesProvider;
    });

    const grouped = Object.entries(
      filtered.reduce((acc, item) => {
        const dev = item.device || 'Unknown Vehicle';
        if (!acc[dev]) acc[dev] = [];
        acc[dev].push(item);
        return acc;
      }, {} as Record<string, FuelTelemetryReportItem[]>)
    );

    const sorted = grouped.sort(([nameA, logsA], [nameB, logsB]) => {
      if (sortBy === 'device_asc') return String(nameA || '').localeCompare(String(nameB || ''));
      if (sortBy === 'device_desc') return String(nameB || '').localeCompare(String(nameA || ''));
      if (sortBy === 'fuel_desc') {
        const volA = logsA.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
        const volB = logsB.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
        return volB - volA;
      }
      if (sortBy === 'fuel_asc') {
        const volA = logsA.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
        const volB = logsB.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
        return volA - volB;
      }
      if (sortBy === 'econ_desc') {
        const valA = parseFloat(logsA[0]?.fuelEconomy) || 0;
        const valB = parseFloat(logsB[0]?.fuelEconomy) || 0;
        return valB - valA;
      }
      if (sortBy === 'econ_asc') {
        const valA = parseFloat(logsA[0]?.fuelEconomy) || 0;
        const valB = parseFloat(logsB[0]?.fuelEconomy) || 0;
        return valA - valB;
      }
      return 0;
    });

    return { filteredReport: filtered, sortedData: sorted, totalCount: sorted.length };
  }, [telemetryReport, telemetrySearch, filterProvider, sortBy]);

  const hasFuelData = fuelStats && fuelStats.totalGallons > 0;
  const hasCostData = fuelStats && fuelStats.totalCost > 0;
  const hasDistanceData = fuelStats && fuelStats.totalMilesDriven > 0;

  const fuelStatsDisplay = [
    {
      name: 'Total Fuel Cost',
      value: hasCostData ? `$${fuelStats.totalCost.toLocaleString()}` : 'Unavailable',
      change: hasCostData ? `${fuelStats.costChange > 0 ? '+' : ''}${fuelStats.costChange.toFixed(1)}%` : '0%',
      changeType: hasCostData && fuelStats.costChange < 0 ? 'decrease' : 'increase',
      icon: DollarSign,
      color: hasCostData ? (fuelStats.costChange < 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400',
      bgColor: 'bg-slate-950/40',
    },
    {
      name: 'Average MPG',
      value: hasDistanceData ? fuelStats.averageMPG.toFixed(1) : 'Insufficient Data',
      change: hasDistanceData ? `${fuelStats.mpgChange > 0 ? '+' : ''}${fuelStats.mpgChange.toFixed(1)}` : '--',
      changeType: 'increase',
      icon: Fuel,
      color: hasDistanceData ? 'text-blue-400' : 'text-slate-400',
      bgColor: 'bg-slate-950/40',
    },
    {
      name: 'Fuel Efficiency',
      value: hasDistanceData ? `${fuelStats.fuelEfficiency.toFixed(1)}%` : 'Insufficient Data',
      change: hasDistanceData ? `${fuelStats.efficiencyChange > 0 ? '+' : ''}${fuelStats.efficiencyChange.toFixed(1)}%` : '--',
      changeType: 'increase',
      icon: TrendingUp,
      color: hasDistanceData ? 'text-indigo-400' : 'text-slate-400',
      bgColor: 'bg-slate-950/40',
    },
    {
      name: 'CO2 Reduction',
      value: hasFuelData ? `${fuelStats.co2Reduction.toFixed(1)}%` : '--',
      change: hasFuelData ? '+3.2%' : '0%',
      changeType: 'increase',
      icon: Zap,
      color: hasFuelData ? 'text-teal-400' : 'text-slate-400',
      bgColor: 'bg-slate-950/40',
    },
  ];



  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 p-4 sm:p-8 space-y-8 font-sans selection:bg-blue-500/30">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>

        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Fuel className="h-6 w-6" />
            </div>
            Fuel Optimization
            {isInitialLoad && (
              <span className="text-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-2 ml-4 shadow-sm shadow-blue-500/20 font-bold">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {loadedDevicesCount > 0 ? 'Loading fleet fuel data' : 'Loading connected fleet devices...'}
                </div>
                {loadedDevicesCount > 0 && (
                  <>
                    <span className="hidden sm:inline text-blue-500/50">|</span>
                    <span className="text-blue-300 font-mono text-[11px]">{loadedDevicesCount} vehicles loaded</span>
                  </>
                )}
              </span>
            )}
            {isRefreshing && (
              <span className="text-xs bg-slate-800/80 text-slate-400 border border-slate-700/50 px-2.5 py-1 rounded-md flex items-center gap-1.5 ml-4 font-medium">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Updating latest data...
              </span>
            )}
            {!isInitialLoad && !isRefreshing && lastUpdated && (
              <span className="text-xs text-slate-500 ml-4 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Updated {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-2 font-medium">Advanced engine telemetry parameters & optimal refueling paths.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">

          {!isDispatcher() && (
            <button
              onClick={() => setIsFuelModalOpen(true)}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Fuel className="h-4 w-4" />
              Log Fuel
            </button>
          )}

          <button
            onClick={handleManualSync}
            disabled={syncing || isInitialLoad}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2 font-bold disabled:opacity-50"
            title="Sync Telematics"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>

          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as never)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fuelStatsDisplay.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-slate-900 rounded-2xl border border-slate-800 p-6 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{stat.name}</p>
                  <p className="text-3xl font-black text-white mt-2 tracking-tight">
                    {statsLoading && !fuelStats ? <span className="animate-pulse bg-slate-800 h-8 w-24 rounded-md inline-block"></span> : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 group-hover:text-blue-400 transition-colors`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs font-bold">
                <span className={`${!hasFuelData ? 'text-slate-500' : 'text-emerald-400'} mr-1.5`}>
                  {stat.change}
                </span>
                <span className="text-slate-500 font-medium">vs last {selectedTimeframe}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Fleet Assets List vs Dedicated Device Fill-Ups Page View */}
      {!selectedDeviceView ? (
        /* VIEW 1: All Fleet Assets / Devices List */
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-400" /> Fleet Telemetry Devices
              </h3>
              <p className="text-xs text-slate-400 mt-1">Select any vehicle / device below to inspect its full Detected Fill-Ups feed</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Provider Filter */}
              <select
                value={filterProvider}
                onChange={(e) => { setFilterProvider(e.target.value as never); setCurrentPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="all">All Providers</option>
                <option value="geotab">Geotab Only</option>
                <option value="samsara">Samsara Only</option>
              </select>

              {/* Custom Sort */}
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="device_asc">Sort by: Name (A-Z)</option>
                <option value="device_desc">Sort by: Name (Z-A)</option>
                <option value="econ_desc">Sort by: Fuel Economy (High to Low)</option>
                <option value="econ_asc">Sort by: Fuel Economy (Low to High)</option>
                <option value="fuel_desc">Sort by: Volume Added (High to Low)</option>
                <option value="fuel_asc">Sort by: Volume Added (Low to High)</option>
              </select>

              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name..."
                  value={telemetrySearch}
                  onChange={(e) => { setTelemetrySearch(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <button
                onClick={handleManualSync}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Sync Data
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5 w-12 text-center">#</th>
                  <th className="py-4 px-6">Device Name</th>
                  <th className="py-4 px-6">Fuel Economy</th>
                  <th className="py-4 px-6">Total Volume Added</th>
                  <th className="py-4 px-6">Detected Fill-Ups</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-200">
                {isInitialLoad || (telemetryLoading && telemetryReport.length === 0) ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-5 text-center"><div className="bg-slate-800/50 h-4 w-4 rounded mx-auto"></div></td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                           <div className="bg-slate-800/50 h-8 w-8 rounded-xl"></div>
                           <div className="space-y-1.5">
                              <div className="bg-slate-800/50 h-4 w-24 rounded"></div>
                              <div className="bg-slate-800/50 h-3 w-32 rounded"></div>
                           </div>
                        </div>
                      </td>
                      <td className="py-4 px-6"><div className="bg-slate-800/50 h-4 w-20 rounded"></div></td>
                      <td className="py-4 px-6"><div className="bg-slate-800/50 h-4 w-16 rounded"></div></td>
                      <td className="py-4 px-6"><div className="bg-slate-800/50 h-6 w-24 rounded-full"></div></td>
                      <td className="py-4 px-6 text-right flex justify-end"><div className="bg-slate-800/50 h-4 w-12 rounded"></div></td>
                    </tr>
                  ))
                ) : (() => {

                  if (sortedData.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500 font-medium">
                          No devices found for current filters and search match "{telemetrySearch}"
                        </td>
                      </tr>
                    );
                  }

                  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                  return paginatedData.map(([devName, logs], idx) => {
                    const totalVol = logs.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
                    const provider = logs[0]?.provider || 'Unknown';
                    return (
                      <tr
                        key={devName}
                        onClick={() => { setSelectedDeviceView(devName); setCurrentPage(1); }}
                        className="hover:bg-slate-800/60 transition-all cursor-pointer group"
                      >
                        <td className="py-4 px-5 text-center font-bold text-slate-500 group-hover:text-blue-400">
                          #{(currentPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className="py-4 px-6 font-bold text-white flex items-center gap-3">
                          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 group-hover:scale-105 transition-transform">
                            <BarChart2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-black text-sm text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                              {devName}
                              {provider === 'geotab' ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  🟢 Geotab
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  🔵 Samsara
                                </span>
                              )}
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {provider === 'geotab' ? 'GO9 Telematics Unit' : 'VG54 Telematics Unit'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-blue-400 font-black">
                          ⛽ {logs[0]?.fuelEconomy || '6.28 L/100 km'}
                        </td>
                        <td className="py-4 px-6 text-emerald-400 font-black">
                          ▲ {Math.round(totalVol)} L
                        </td>
                        <td className="py-4 px-6">
                          <span className="bg-slate-800 text-blue-400 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                            {logs.length} fill-up logs
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDeviceView(devName);
                              setCurrentPage(1);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2 ml-auto"
                          >
                            View Details &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Bar for Main List */}
          {(() => {
            const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

            if (totalCount === 0) return null;

            return (
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="text-slate-400 font-medium">
                  Showing <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
                  <span className="text-white font-bold">{totalCount}</span> fleet assets
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 font-bold transition-all flex items-center gap-1.5"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-xl font-bold transition-all border ${
                        currentPage === page
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 font-bold transition-all flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* VIEW 2: Dedicated Modern Device Fill-Ups Page View */
        <div className="space-y-6">
          {/* Top Bar Navigation */}
          <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedDeviceView(null)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all shadow-md"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Fleet Assets
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-white">{selectedDeviceView}</h2>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live Geotab Telematics Stream
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Detected Fill-Ups & Telemetry Engine Data Log History</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as never); setCurrentPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="date_desc">Sort by: Date (Newest First)</option>
                <option value="date_asc">Sort by: Date (Oldest First)</option>
                <option value="fuel">Sort by: Volume Added</option>
              </select>
              <button
                onClick={handleManualSync}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-sync
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar for Selected Device */}
          {(() => {
            const devLogs = telemetryReport.filter(item => (item.device || 'Unknown Vehicle') === selectedDeviceView);
            const totalVol = devLogs.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
            const avgMpg = devLogs.length > 0 ? devLogs.reduce((sum, l) => sum + (l.rawMpg || 0), 0) / devLogs.length : 0;
            
            let primaryAddress = 'Company location not configured';
            if (devLogs.length > 0) {
              const counts: Record<string, number> = {};
              let maxCount = 0;
              for (const l of devLogs) {
                // Type casting here since we know FuelTelemetryReportItem has location but TS might not infer it fully from usage
                const loc = l.location || (l as Record<string, unknown>).address as string | undefined;
                if (loc && loc !== 'Unknown') {
                  counts[loc] = (counts[loc] || 0) + 1;
                  if (counts[loc] > maxCount) {
                    maxCount = counts[loc];
                    primaryAddress = loc;
                  }
                }
              }
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-slate-400 text-xs font-bold">Avg Fuel Economy</span>
                  <p className="text-xl font-black text-blue-400 mt-1">⛽ {avgMpg.toFixed(1)} MPG</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-slate-400 text-xs font-bold">Total Volume Added</span>
                  <p className="text-xl font-black text-emerald-400 mt-1">▲ {Math.round(totalVol)} L</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-slate-400 text-xs font-bold">Primary Refueling Address</span>
                  <p className="text-xs font-bold text-slate-200 mt-1.5 truncate">
                    <AddressDisplay location={primaryAddress} />
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-slate-400 text-xs font-bold">Total Logged Events</span>
                  <p className="text-xl font-black text-white mt-1">
                    {devLogs.length} Fill-ups
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Full Modern Data Table */}
          <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-4 w-12 text-center font-bold">#</th>
                    <th className="py-4 px-5 font-bold">Date</th>
                    <th className="py-4 px-5 font-bold">Address</th>
                    <th className="py-4 px-5 font-bold">Device</th>
                    <th className="py-4 px-5 font-bold">Driver</th>
                    <th className="py-4 px-5 font-bold">Fuel Economy</th>
                    <th className="py-4 px-5 font-bold">Volume added</th>
                    <th className="py-4 px-5 font-bold">Odometer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs font-medium text-slate-200">
                  {(() => {
                    const devLogs = telemetryReport
                      .filter(item => (item.device || 'Unknown Vehicle') === selectedDeviceView)
                      .sort((a, b) => {
                        if (sortBy === 'date_desc') return (b.rawTimestamp || 0) - (a.rawTimestamp || 0);
                        if (sortBy === 'date_asc') return (a.rawTimestamp || 0) - (b.rawTimestamp || 0);
                        if (sortBy === 'fuel') return (b.rawGallons || 0) - (a.rawGallons || 0);
                        return 0;
                      });

                    const totalLogs = devLogs.length;
                    const paginatedLogs = devLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                    if (totalLogs === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-500 font-medium">
                            No detected fill-ups logged for device {selectedDeviceView}
                          </td>
                        </tr>
                      );
                    }

                    return paginatedLogs.map((log, idx) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedDeviceView(log)}
                        className="hover:bg-blue-950/30 bg-slate-900/40 border-b border-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-4 px-4 text-center font-bold text-slate-500 group-hover:text-blue-400">
                          #{(currentPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-200 flex items-center gap-2 group-hover:text-blue-400 font-bold">
                          <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          {log.date}
                        </td>
                        <td className="py-4 px-5 text-slate-300 font-medium">
                          <AddressDisplay location={log.location} />
                        </td>
                        <td className="py-4 px-5 font-black text-white">{log.device}</td>
                        <td className="py-4 px-5 text-slate-400 font-medium">{log.driver || 'Unknown driver'}</td>
                        <td className="py-4 px-5 font-black text-blue-400">
                          ⛽ {log.fuelEconomy}
                        </td>
                        <td className="py-4 px-5 font-black text-emerald-400">
                          ▲ {log.fuelUsed}
                        </td>
                        <td className="py-4 px-5 font-black text-slate-200 flex items-center justify-between gap-2">
                          <span>{log.distance}</span>
                          <div className="flex gap-2">
                            {log.receiptUrl && (
                              <button 
                                onClick={async (e) => { 
                                  e.stopPropagation(); 
                                  try {
                                    const url = await getFuelReceiptUrl(log.id);
                                    window.open(url, '_blank');
                                  } catch(err) {
                                    console.error(err);
                                    alert('Failed to open receipt');
                                  }
                                }}
                                className="text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                              >
                                View Receipt
                              </button>
                            )}
                            <span className="text-[10px] text-blue-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                              View Telemetry &rarr;
                            </span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot className="bg-slate-950/80 border-t-2 border-slate-800">
                  {(() => {
                     const devLogs = telemetryReport.filter(item => (item.device || 'Unknown Vehicle') === selectedDeviceView);
                     const totalVol = devLogs.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);
                     
                     if (devLogs.length === 0) return null;

                     return (
                        <tr>
                          <td colSpan={6} className="py-4 px-5 text-right font-black text-slate-300 uppercase tracking-wider text-xs">
                            Total Volume Added for {selectedDeviceView}:
                          </td>
                          <td className="py-4 px-5 font-black text-emerald-400 text-sm">
                            ▲ {Math.round(totalVol)} L
                          </td>
                          <td></td>
                        </tr>
                     )
                  })()}
                </tfoot>
              </table>
            </div>

            {/* Pagination Controls Bar (10 per page) */}
            {(() => {
              const devLogs = telemetryReport.filter(item => (item.device || 'Unknown Vehicle') === selectedDeviceView);
              const totalCount = devLogs.length;
              const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

              return (
                <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div className="text-slate-400 font-medium">
                    Showing <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
                    <span className="text-white font-bold">{totalCount}</span> fill-up logs for {selectedDeviceView}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 font-bold transition-all flex items-center gap-1.5"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-xl font-bold transition-all border ${
                          currentPage === page
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 font-bold transition-all flex items-center gap-1.5"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">

        {/* Top Performers */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-400" /> Optimal Consumption Rank
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {isInitialLoad || (performersLoading && topPerformers.length === 0) ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-slate-800/50 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-slate-800/50 rounded"></div>
                      <div className="h-3 w-16 bg-slate-800/50 rounded"></div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-4 w-16 bg-slate-800/50 rounded ml-auto"></div>
                    <div className="h-3 w-12 bg-slate-800/50 rounded ml-auto"></div>
                  </div>
                </div>
              ))
            ) : topPerformers.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <Users className="h-8 w-8 mx-auto text-slate-700 mb-3" />
                <p className="font-bold text-slate-400">Telemetry array unallocated</p>
                <p className="text-xs mt-1 text-slate-500">Awaiting live J1939 engine parameter parsing</p>
              </div>
            ) : (
              topPerformers.map((performer: Record<string, unknown>, index: number) => (
                <div key={performer.driver_id} className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-black">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{performer.driver_name}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{performer.vehicle_number || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-200">{performer.averageMPG} MPG</p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">${performer.fuelSavings} saved</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fuel Station Network Array */}
      <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-400" /> Lowest Refueling Network Distribution
          </h3>
          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20 flex items-center gap-1">
            <Search className="h-3 w-3" /> Live Carrier Contract Pricing
          </span>
        </div>

        {/* FIX 2: Fixed mixed states configuration. If fuel metrics are empty, hide dummy pricing cards seamlessly */}
        <div className="p-6">
          {!hasFuelData ? (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
              <MapPin className="h-8 w-8 mx-auto text-slate-700 mb-3" />
              <p className="font-bold text-slate-400">Carrier Station Sync Offline</p>
              <p className="text-xs mt-1 text-slate-500">Refueling nodes map will instantiate once a connection pipeline is synced</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fuelStations.map((station, index) => (
                <div key={index} className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all group flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <h4 className="font-bold text-white text-base tracking-tight">{station.name}</h4>
                      <span className="text-xl font-black text-emerald-400">{station.price}</span>
                    </div>
                    <div className="space-y-2 text-xs font-medium text-slate-400">
                      <div className="flex items-center"><MapPin className="h-4 w-4 mr-2 text-slate-600" />{station.location}</div>
                      <div className="flex items-center"><Route className="h-4 w-4 mr-2 text-slate-600" />{station.distance} away</div>
                      <div className="flex items-center text-teal-400 font-bold"><DollarSign className="h-4 w-4 mr-2 text-teal-500/60" />{station.discount}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStation(station)}
                    className="w-full mt-5 px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    View Node Logistics
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STATION DETAILS MODAL */}
      {selectedStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

            <div className="p-6 text-white flex justify-between items-start border-b border-slate-800">
              <div>
                <h3 className="text-xl font-black tracking-tight">{selectedStation.name}</h3>
                <div className="flex items-center mt-1.5 text-slate-400 text-xs font-medium">
                  <MapPin className="h-3 w-3 mr-1" /> {selectedStation.location}
                </div>
              </div>
              <button
                onClick={() => setSelectedStation(null)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Contract Tariff</p>
                  <p className="text-2xl font-black text-white mt-1">{selectedStation.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Rebate Allocated</p>
                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1">
                    {selectedStation.discount}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <p className="text-slate-500 uppercase text-[10px] tracking-wide">Status</p>
                  <p className="text-emerald-400 mt-1">{selectedStation.status}</p>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <p className="text-slate-500 uppercase text-[10px] tracking-wide">Distance</p>
                  <p className="text-slate-200 mt-1">{selectedStation.distance}</p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Node Amenities</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-300">
                  {selectedStation.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800/40">
                      <div className="text-blue-400">
                        {amenity.includes('Wifi') ? <Wifi size={14} /> :
                          amenity.includes('Coffee') ? <Coffee size={14} /> :
                            amenity.includes('Truck') ? <Truck size={14} /> : <Zap size={14} />}
                      </div>
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedStation(null)}
                  className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-bold text-sm hover:bg-slate-700 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => alert(`Transmitting coordinates to vehicle router...`)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Navigation className="h-4 w-4" /> Route Vehicle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FuelEntryModal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={() => {
          loadTelemetry();
        }}
      />
    </div>
  );
};

export default FuelOptimization;