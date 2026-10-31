import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, Truck, DollarSign, Calendar, Zap,
  Gauge, ThermometerSun, Brain, AlertCircle, Play, Pause, RefreshCw, X, ChevronRight
} from 'lucide-react';
import { getVehicleHealthData, generateVehicleHealthRecommendation } from '../api/vehicleHealthAI';
import jsPDF from 'jspdf';
import { getUpcomingMaintenance, MaintenanceRecord, getMaintenanceReceiptUrl } from '../api/maintenance';
import MaintenanceEntryModal from './MaintenanceEntryModal';
import { useAuth } from '../contexts/AuthContext';

// --- Types ---
interface VehicleHealth {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  overall_score: number | null;
  engine_score: number | null;
  cooling_score: number | null;
  pm_score: number | null;
  dpf_score: number | null;
  transmission_score: number | null;
  battery_score: number | null;
  has_critical_fault: boolean;
  has_warning_fault: boolean;
  ai_recommendation: string | null;
  estimated_repair_cost: number | null;
}

// --- Reusable Premium Components ---
const StatCard = ({ label, value, subtext, icon: Icon, color }: any) => (
  <div className="bg-brand-card backdrop-blur-xl p-6 rounded-2xl border border-brand-border shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-400 text-sm font-medium">{label}</p>
        <h3 className={`text-3xl font-bold mt-1 text-${color}-600`}>{value}</h3>
      </div>
      <div className={`p-3 bg-${color}-50 rounded-xl`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
    </div>
    <p className="text-xs text-gray-400">{subtext}</p>
  </div>
);

const HealthMetric = ({ label, value, icon: Icon, color }: any) => {
  if (value === null || value === undefined) {
    return (
      <div className="bg-brand-bg p-4 rounded-xl border border-brand-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 bg-gray-800 rounded-lg`}>
              <Icon className={`h-4 w-4 text-gray-500`} />
            </div>
            <span className="font-semibold text-slate-400">{label}</span>
          </div>
          <span className={`font-bold text-slate-500 text-sm uppercase`}>No Data</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full bg-gray-700 transition-all duration-500`} style={{ width: `0%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-bg p-4 rounded-xl border border-brand-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 bg-${color}-100 rounded-lg`}>
            <Icon className={`h-4 w-4 text-${color}-600`} />
          </div>
          <span className="font-semibold text-slate-300">{label}</span>
        </div>
        <span className={`font-bold text-${color}-700`}>{value}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full bg-${color}-500 transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

const VehicleHealthAI: React.FC = () => {
  const { isAdmin, isSuperAdmin, isFleetManager } = useAuth();
  const canEdit = isAdmin() || isSuperAdmin() || isFleetManager();

  const [vehicles, setVehicles] = useState<VehicleHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleHealth | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceRecord[]>([]);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  const handleGenerateAi = async () => {
    if (!selectedVehicle) return;
    setGeneratingAi(true);
    try {
      const rec = await generateVehicleHealthRecommendation(selectedVehicle.vehicle_id);
      if (rec) {
        setSelectedVehicle({ ...selectedVehicle, ai_recommendation: rec });
        setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? { ...v, ai_recommendation: rec } : v));
      } else {
        alert("Recommendation unavailable at this time. Please try again later.");
      }
    } catch (e) {
      alert("Recommendation unavailable at this time. Please try again later.");
    } finally {
      setGeneratingAi(false);
    }
  };

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Run health data and upcoming maintenance queries in parallel
      const [dataResult, upcomingResult] = await Promise.allSettled([
        getVehicleHealthData(),
        getUpcomingMaintenance()
      ]);

      const data = dataResult.status === 'fulfilled' ? dataResult.value : [];
      const mapped = data.map((v: any) => ({
        id: v.id,
        vehicle_id: v.vehicle_id,
        vehicle_name: v.vehicle_name || 'Unknown Vehicle',
        provider: v.provider,
        overall_score: v.overall_score,
        engine_score: v.engine_score,
        cooling_score: v.cooling_score,
        pm_score: v.pm_score,
        dpf_score: v.dpf_score,
        transmission_score: v.transmission_score,
        battery_score: v.battery_score,
        has_critical_fault: v.has_critical_fault,
        has_warning_fault: v.has_warning_fault,
        ai_recommendation: v.ai_recommendation,
        estimated_repair_cost: v.estimated_repair_cost
      }));
      setVehicles(mapped);
      if (!selectedVehicle && mapped.length > 0) setSelectedVehicle(mapped[0]);

      if (upcomingResult.status === 'fulfilled') {
        setUpcomingMaintenance(upcomingResult.value || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedVehicle]);

  useEffect(() => { loadData(); }, []);

  // PDF Generation was replaced by the real MaintenanceEntryModal


  // Helper colors
  const getHealthColor = (s: number) => s >= 90 ? 'text-green-600' : s >= 75 ? 'text-blue-600' : 'text-red-600';

  if (loading) return <div className="h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-brand-accent h-8 w-8" /></div>;

  const validScores = vehicles.filter(v => v.overall_score !== null);
  const stats = {
    avg: validScores.length > 0 ? `${Math.round(validScores.reduce((acc, v) => acc + (v.overall_score || 0), 0) / validScores.length)}%` : 'N/A',
    attention: validScores.length > 0 ? validScores.filter(v => (v.overall_score || 0) < 75).length : 'N/A',
    savings: validScores.length > 0 ? `$${validScores.reduce((acc, v) => acc + (v.estimated_repair_cost || 0), 0).toLocaleString()}` : 'N/A',
    alerts: validScores.length > 0 ? validScores.filter(v => v.has_critical_fault).length : 'N/A'
  };

  return (
    <div className="p-6 space-y-8 bg-brand-bg min-h-screen">
      
      {/* Premium Header */}
      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-brand-muted" /> Vehicle Health
          </h1>
          <p className="text-brand-muted mt-2 opacity-90">Predictive maintenance engine & fleet diagnostics</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="px-5 py-2.5 bg-brand-card backdrop-blur-xl/10 hover:bg-brand-card backdrop-blur-xl/20 rounded-xl backdrop-blur-md transition-all">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Fleet Health Score" value={stats.avg} subtext="Calculated Average" icon={Activity} color="green" />
        <StatCard label="Action Required" value={stats.attention} subtext="Vehicles at risk" icon={AlertTriangle} color="yellow" />
        <StatCard label="Cost Savings" value={stats.savings} subtext="Preventive ROI" icon={DollarSign} color="emerald" />
        <StatCard label="Critical Alerts" value={stats.alerts} subtext="Immediate Attention" icon={AlertCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar List */}
        <div className="lg:col-span-4 bg-brand-card backdrop-blur-xl rounded-2xl border border-brand-border shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 border-b border-brand-border bg-brand-bg/50">
            <h3 className="font-bold text-white flex items-center gap-2"><Truck size={18} className="text-brand-accent"/> Fleet Vehicles</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {vehicles.map(v => (
              <button 
                key={v.id} 
                onClick={() => setSelectedVehicle(v)}
                className={`w-full text-left p-4 rounded-xl transition-all border ${selectedVehicle?.id === v.id ? 'bg-brand-bg border-brand-accent shadow-sm' : 'border-transparent hover:bg-brand-bg'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{v.vehicle_name}</span>
                  {v.overall_score !== null ? (
                    <span className={`font-bold ${getHealthColor(v.overall_score)}`}>{v.overall_score}%</span>
                  ) : (
                    <span className="text-slate-500 text-xs font-semibold uppercase">No Data</span>
                  )}
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-400">
                  <span>{v.has_critical_fault ? 'Critical Faults' : v.has_warning_fault ? 'Warning Faults' : 'No Faults'}</span>
                  {selectedVehicle?.id === v.id && <ChevronRight size={14} className="text-brand-accent"/>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-8 space-y-6">
          {selectedVehicle ? (
            <>
              {/* Main Health Card */}
              <div className="bg-brand-card backdrop-blur-xl rounded-2xl p-8 border border-brand-border shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={100} className="text-brand-accent"/></div>
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div>
                    <h2 className="text-3xl font-bold text-white">{selectedVehicle.vehicle_name}</h2>
                  </div>
                  <div className="text-right">
                    {selectedVehicle.overall_score !== null ? (
                      <div className={`text-5xl font-bold ${getHealthColor(selectedVehicle.overall_score)}`}>{selectedVehicle.overall_score}%</div>
                    ) : (
                      <div className="text-2xl font-bold text-slate-500">--</div>
                    )}
                    <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Overall Health</span>
                  </div>
                </div>

                {selectedVehicle.overall_score !== null ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    <HealthMetric label="Engine" value={selectedVehicle.engine_score} icon={Zap} color="blue" />
                    <HealthMetric label="Cooling" value={selectedVehicle.cooling_score} icon={ThermometerSun} color="cyan" />
                    <HealthMetric label="PM Status" value={selectedVehicle.pm_score} icon={Calendar} color="emerald" />
                    <HealthMetric label="DPF" value={selectedVehicle.dpf_score} icon={Activity} color="amber" />
                    <HealthMetric label="Transmission" value={selectedVehicle.transmission_score} icon={Gauge} color="purple" />
                    <HealthMetric label="Battery" value={selectedVehicle.battery_score} icon={AlertCircle} color="red" />
                  </div>
                ) : (
                  <div className="py-8 text-center bg-brand-bg/50 rounded-xl border border-brand-border/50 px-6">
                    {(!selectedVehicle.provider || (selectedVehicle.provider !== 'geotab' && selectedVehicle.provider !== 'samsara')) ? (
                      <>
                        <p className="text-slate-400">This vehicle isn't connected to a telematics provider. A maintenance-based health estimate will be available once you log some service history.</p>
                        {/* TODO: manual-vehicle Maintenance Compliance score — deferred, see design discussion; data_source='manual_estimate', formula: 100 - overdue PM penalty - recent repair penalty. */}
                      </>
                    ) : (
                      <p className="text-slate-400">Not enough data yet to calculate a health score.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action & Predictions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-brand-card backdrop-blur-xl rounded-2xl p-6 border border-brand-border shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-white flex items-center gap-2"><Brain size={18} className="text-brand-accent"/> AI Recommendation</h4>
                    {canEdit && (
                      <button 
                        onClick={handleGenerateAi}
                        disabled={generatingAi}
                        className="text-xs px-3 py-1.5 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {generatingAi ? <><RefreshCw size={12} className="animate-spin" /> Generating...</> : "Generate Recommendation"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-3 flex-1">
                    {selectedVehicle.ai_recommendation ? (
                       <div className="text-slate-300 text-sm leading-relaxed">
                         {selectedVehicle.ai_recommendation}
                       </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 py-6">
                        <Brain size={32} className="opacity-20 mb-3" />
                        <p className="text-sm">No recommendation generated yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between border border-brand-accent/20">
                  <div>
                    <h4 className="font-bold text-lg mb-1 flex items-center gap-2"><DollarSign size={18} className="text-emerald-400"/> Repair Estimate</h4>
                    {selectedVehicle.estimated_repair_cost !== null ? (
                      <p className="text-3xl font-bold text-emerald-400 mt-2">${selectedVehicle.estimated_repair_cost.toLocaleString()}</p>
                    ) : (
                      <p className="text-slate-400 text-sm mt-2">Not enough data yet to estimate savings</p>
                    )}
                  </div>
                  {canEdit && (
                    <button 
                      onClick={() => setIsMaintenanceModalOpen(true)}
                      className="w-full bg-brand-bg0 hover:bg-brand-accent-hover text-white font-bold py-3 rounded-xl transition-all mt-6 shadow-lg shadow-brand-accent/20"
                    >
                      Log / Book Maintenance
                    </button>
                  )}
                </div>
              </div>
              
              {/* Upcoming Maintenance List */}
              <div className="bg-brand-card backdrop-blur-xl rounded-2xl p-6 border border-brand-border shadow-sm mt-6">
                <h4 className="font-bold text-white flex items-center gap-2 mb-4"><Calendar size={18} className="text-brand-accent"/> Recent & Upcoming Maintenance</h4>
                <div className="space-y-3">
                  {upcomingMaintenance.filter(m => m.vehicle_id === selectedVehicle.id).length > 0 ? (
                    upcomingMaintenance.filter(m => m.vehicle_id === selectedVehicle.id).map((m) => (
                      <div key={m.id} className="bg-brand-bg border border-brand-border p-4 rounded-xl flex flex-col gap-3 items-stretch">
                         <div className="flex justify-between items-center w-full">
                           <div>
                             <p className="font-bold text-white">{m.vehicles?.vehicle_number} <span className="text-sm font-normal text-slate-400">({m.service_type})</span></p>
                             <p className="text-xs text-slate-400 mt-1">Due: {new Date(m.service_date).toLocaleDateString()} {m.next_service_due_mileage && `or ${m.next_service_due_mileage} miles`}</p>
                           </div>
                           <div className="flex items-center gap-3">
                             {m.receipt_url && (
                               <button
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   try {
                                     const url = await getMaintenanceReceiptUrl(m.id);
                                     window.open(url, '_blank');
                                   } catch(err) {
                                     console.error(err);
                                     alert('Failed to open receipt');
                                   }
                                 }}
                                 className="px-3 py-1 text-[10px] font-bold rounded-lg uppercase bg-brand-accent/10 text-blue-400 border border-brand-accent/20 hover:bg-brand-accent/20 transition-colors"
                               >
                                 View Receipt
                               </button>
                             )}
                             <span className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase border ${
                               m.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                               m.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-brand-bg-secondary text-brand-muted border-brand-border'
                             }`}>
                               {m.status.replace('_', ' ')}
                             </span>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300 bg-brand-bg-secondary/50 p-3 rounded-lg border border-brand-border w-full mt-2">
                           <div><span className="text-slate-500 block font-semibold mb-1">Vendor</span>{m.vendor || 'N/A'}</div>
                           <div><span className="text-slate-500 block font-semibold mb-1">Technician</span>{m.technician || 'N/A'}</div>
                           <div><span className="text-slate-500 block font-semibold mb-1">Labor Cost</span>${m.labor_cost || '0.00'}</div>
                           <div><span className="text-slate-500 block font-semibold mb-1">Parts Cost</span>${m.parts_cost || '0.00'}</div>
                           <div><span className="text-slate-500 block font-semibold mb-1">Total Cost</span><span className="font-bold text-blue-400">${m.total_cost || '0.00'}</span></div>
                           <div><span className="text-slate-500 block font-semibold mb-1">Odometer</span>{m.odometer || 'N/A'}</div>
                           <div className="col-span-2 md:col-span-4"><span className="text-slate-500 block font-semibold mb-1">Notes</span><span className="line-clamp-2" title={m.notes || ''}>{m.notes || 'N/A'}</span></div>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-sm py-4">No upcoming maintenance scheduled.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">Select a vehicle to view health data</div>
          )}
        </div>
      </div>

      {/* --- REAL MODAL --- */}
      <MaintenanceEntryModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};

export default VehicleHealthAI;