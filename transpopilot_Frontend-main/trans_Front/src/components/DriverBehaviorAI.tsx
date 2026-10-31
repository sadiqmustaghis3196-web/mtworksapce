import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, Award, TrendingUp, TrendingDown, Users, Zap,
  AlertCircle, CheckCircle, Brain, Target, Clock, Gauge, Fuel, Shield,
  Play, Pause, RefreshCw, X, Calendar, FileText, Trash2, Edit2, Link as LinkIcon
} from 'lucide-react';
import { getDriverBehaviorData, getTrainingAssignments, assignTraining, deleteTrainingAssignment } from '../api/driverBehaviorAI';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';

// --- Interfaces ---
interface DriverBehavior {
  id: string;
  driver_id?: string;
  name: string;
  email: string;
  behavior_score: number;
  safety_rating: number;
  fuel_efficiency_rating: number;
  acceleration_score: number;
  braking_score: number;
  speed_compliance: number;
  idle_time_score: number;
  total_miles: number;
  total_hours: number;
  scored_events_count: number;
  metrics: any;
  incidents: any[];
  has_data: boolean;
  has_score: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'none';
  recommendations: string[];
  improvement_trend: 'improving' | 'stable' | 'declining' | 'none';
}

interface TrainingSession {
  id: string;
  driver_id: string;
  driverName: string;
  module: string;
  date: string;
  status: string;
}

const TRAINING_MODULES = [
  { id: 'speed-management', title: 'Speed Management & Compliance' },
  { id: 'defensive-driving', title: 'Defensive Driving' },
  { id: 'hard-braking', title: 'Hard Braking Prevention' },
  { id: 'safe-following-distance', title: 'Safe Following Distance' },
  { id: 'seat-belt', title: 'Seat Belt Compliance' },
  { id: 'safe-cornering', title: 'Safe Cornering & Load Stability' },
  { id: 'distracted-driving', title: 'Distracted Driving Prevention' },
  { id: 'fuel-efficient-driving', title: 'Fuel Efficient Driving' },
  { id: 'fatigue-awareness', title: 'Hours of Service & Fatigue Awareness' },
  { id: 'pre-trip-inspection', title: 'Pre-Trip Safety Inspection' }
];

const DriverBehaviorAI: React.FC = () => {
  const { user, profile, loading: authLoading, isAdmin, isSuperAdmin, isFleetManager } = useAuth();
  
  // Can edit if Admin, Super Admin, or Fleet Manager (Dispatchers are read-only)
  const canEdit = isAdmin() || isSuperAdmin() || isFleetManager();

  // Data States
  const [drivers, setDrivers] = useState<DriverBehavior[]>([]);
  const [scheduledTrainings, setScheduledTrainings] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<DriverBehavior | null>(null);
  
  // Integration State (NEW)
  const [integrationProvider, setIntegrationProvider] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);

  // UI States
  const [sortBy, setSortBy] = useState<'score' | 'safety' | 'fuel'>('score');
  
  // Modal & Form States
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null);
  const [trainingModuleId, setTrainingModuleId] = useState('');
  const [trainingDate, setTrainingDate] = useState('');
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [modulesError, setModulesError] = useState(false);
  const [isCustomTraining, setIsCustomTraining] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [toastMsg, setToastMsg] = useState<{title: string, type: 'error' | 'success' | 'warning'} | null>(null);

  const showToast = (title: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setToastMsg({ title, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // --- Initial Load ---
  useEffect(() => {
    if (authLoading) return;
    checkIntegrationStatus(); // Check if Geotab/Samsara is connected
    loadTrainings();
  }, [user?.id, authLoading]);

  // --- 0. Check Integration Status (Automatic Switch) ---
  const checkIntegrationStatus = async () => {
    try {
      const currentUserId = user?.id;
      if (!currentUserId) {
        loadDriverBehavior(false);
        return;
      }

      const { data } = await supabase
        .from('fleet_integrations')
        .select('provider_id, status')
        .eq('user_id', currentUserId)
        .eq('status', 'connected')
        .limit(1);

      if (data && data.length > 0) {
        setIntegrationProvider(data[0].provider_id); // e.g., 'geotab'
        setIsLiveMode(true);
        // If connected, load real data immediately without simulation
        loadDriverBehavior(true); 
      } else {
        // Fallback to demo mode
        loadDriverBehavior(false);
      }
    } catch (err) {
      console.error("Integration check failed", err);
      loadDriverBehavior(false);
    }
  };

  const [errorState, setErrorState] = useState<string | null>(null);

  // --- 1. Load Drivers (Dynamic: Real or Demo) ---
  const loadDriverBehavior = useCallback(async (forceRealData = false) => {
    try {
      setLoading(true);
      setErrorState(null);
      // Pass a flag to API if we are in Live Mode (logic handled in API wrapper usually)
      const data = await getDriverBehaviorData(forceRealData); 
      
      const mappedData = data.map(d => ({
        ...d,
        id: d.driver_id || d.id 
      }));
      setDrivers(mappedData);
      
      if (mappedData.length > 0 && !selectedDriver) {
        setSelectedDriver(mappedData[0]);
      }
    } catch (error: any) {
      console.error('Failed to load drivers:', error);
      setErrorState(error.message || 'API mapping/auth failure.');
    } finally {
      setLoading(false);
    }
  }, [selectedDriver]);

  // --- 2. Load Trainings from Supabase ---
  const loadTrainings = async (force: boolean = false) => {
    try {
      const assignments = await getTrainingAssignments();
      
      const mapped = (assignments || []).map((a: any) => ({
        id: a.id,
        driverId: a.driver_id,
        module: a.training_modules?.title || a.custom_title || 'Unknown Module',
        status: a.status,
        date: a.due_date ? a.due_date.split('T')[0] : ''
      }));
      setScheduledTrainings(mapped);
      
    } catch (err: any) {
      console.error('Error loading trainings:', err);
      showToast("Unable to load trainings", "warning");
    }
  };

  useEffect(() => {
    if (showTrainingModal) {
      loadTrainings(true);
    }
  }, [showTrainingModal]);

  // --- 3. Save/Update Training ---
  const handleConfirmTraining = async () => {
    if (!trainingDate || !selectedDriver) return alert("Please select a due date.");
    if (isCustomTraining && !customTitle.trim()) return alert("Please enter a custom training title.");
    if (!isCustomTraining && !trainingModuleId) return alert("Please select a training module.");

    setIsSaving(true);
    try {
      if (editingTrainingId) {
        alert("Editing is not supported yet.");
      } else {
        let payload;
        
        if (isCustomTraining) {
          payload = { custom_title: customTitle, custom_description: customDescription, training_module_id: null };
        } else {
          const selectedModule = TRAINING_MODULES.find(m => m.id === trainingModuleId);
          payload = {
            custom_title: selectedModule?.title || 'Training Module',
            custom_description: '',
            training_module_id: null
          };
        }
        
        await assignTraining(selectedDriver.id, trainingDate, payload);
        await loadTrainings();
      }
      setShowTrainingModal(false);
      showToast("Training assigned successfully", "success");
    } catch (err: any) {
      console.error("Save failed:", err);
      showToast("Training assignment could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- 4. Delete Training ---
  const handleDeleteTraining = async (id: string) => {
    if (!window.confirm("Delete this training?")) return;

    try {
      await deleteTrainingAssignment(id);
      await loadTrainings();
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    }
  };

  // --- 5. Edit Handler ---
  const handleEditTraining = (training: TrainingSession) => {
    const driver = drivers.find(d => d.id === training.driver_id);
    if (driver) setSelectedDriver(driver);

    setEditingTrainingId(training.id);
    setTrainingModuleId(training.moduleId || '');
    setTrainingDate(training.date);
    setShowTrainingModal(true);
  };

  const closeModal = () => {
    setShowTrainingModal(false);
    setEditingTrainingId(null);
    setTrainingDate('');
    setCustomTitle('');
    setCustomDescription('');
    setIsCustomTraining(false);
    if (availableModules.length > 0) {
      setTrainingModuleId(availableModules[0].id);
    }
  };


  // --- PDF Report ---
  const handleViewReport = () => {
    if (!selectedDriver) return;
    const doc = new jsPDF();
    doc.setFillColor(16, 185, 129); doc.rect(0, 0, 220, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22);
    doc.text('Driver Performance Report', 14, 25);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(12);
    doc.text(`Driver Name: ${selectedDriver.name}`, 14, 55);
    doc.text(`Current Score: ${selectedDriver.behavior_score}/100`, 14, 62);

    autoTable(doc, {
      startY: 70,
      head: [['Metric', 'Score']],
      body: [
        ['Overall Behavior', `${selectedDriver.behavior_score}%`],
        ['Safety Rating', `${selectedDriver.safety_rating}%`],
        ['Fuel Efficiency', `${selectedDriver.fuel_efficiency_rating}%`],
        ['Braking Score', `${selectedDriver.braking_score}%`],
      ],
      headStyles: { fillColor: [16, 185, 129] }
    });
    doc.save(`${selectedDriver.name}_Report.pdf`);
  };

  // Sorting
  const sortedDrivers = [...drivers].sort((a, b) => {
    if (sortBy === 'score') return (b.behavior_score || 0) - (a.behavior_score || 0);
    if (sortBy === 'safety') return (b.safety_rating || 0) - (a.safety_rating || 0);
    return (b.fuel_efficiency_rating || 0) - (a.fuel_efficiency_rating || 0);
  });

  const getScoreColor = (s: number | null) => s === null ? 'text-brand-muted' : s >= 90 ? 'text-green-400' : s >= 75 ? 'text-blue-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400';
  const getScoreBg = (s: number | null) => s === null ? 'bg-white/5 border-white/10' : s >= 90 ? 'bg-green-500/10 border-green-500/20' : s >= 75 ? 'bg-blue-500/10 border-blue-500/20' : s >= 60 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';

  if (loading) return <div className="h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-brand-accent h-10 w-10"/></div>;

  if (errorState) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-brand-bg-secondary">
        <AlertTriangle className="text-red-400 h-16 w-16" />
        <div className="text-white font-bold text-2xl">Integration Error</div>
        <div className="text-red-400 max-w-md text-center">{errorState}</div>
        <button onClick={() => loadDriverBehavior(isLiveMode)} className="bg-brand-accent hover:bg-brand-accent-hover text-white px-6 py-2 rounded-lg font-bold tracking-tight transition">Try Again</button>
      </div>
    );
  }

  const validDrivers = drivers.filter(d => d.has_data);
  const fleetStats = {
    avgBehaviorScore: Math.round(validDrivers.reduce((s, d) => s + (d.behavior_score || 0), 0) / (validDrivers.length || 1)) || 0,
    avgSafetyRating: Math.round(validDrivers.reduce((s, d) => s + (d.safety_rating || 0), 0) / (validDrivers.length || 1)) || 0,
    highRiskDrivers: validDrivers.filter(d => d.risk_level === 'high').length,
    topPerformers: validDrivers.filter(d => (d.behavior_score || 0) >= 90).length
  };

  return (
    <div className="p-6 space-y-6 bg-brand-bg-secondary min-h-screen relative">
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 flex items-center p-4 rounded-xl shadow-2xl backdrop-blur-xl border border-brand-border ${
            toastMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 
            toastMsg.type === 'warning' ? 'bg-yellow-500/10 text-yellow-400' : 
            'bg-red-500/10 text-red-400'
          }`}>
          <span className="font-bold text-sm tracking-tight">{toastMsg.title}</span>
          <button onClick={() => setToastMsg(null)} className="ml-4 hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-[2rem] p-6 sm:p-8 shadow-xl text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Brain className="h-8 w-8 bg-white/20 p-1.5 rounded-lg" />
            <h1 className="text-3xl font-bold tracking-tight">Driver Behavior</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-brand-muted">Advanced analytics & coaching platform</p>
            {/* Connection Indicator */}
            {isLiveMode && (
              <span className="bg-white/20 px-3 py-0.5 rounded-full text-xs font-bold tracking-tight flex items-center gap-1 border border-white/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/> 
                Connected: {integrationProvider === 'geotab' ? 'Geotab' : integrationProvider}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => loadDriverBehavior(isLiveMode)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition"><RefreshCw size={16}/> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Driver List */}
        <div className="lg:col-span-4 bg-brand-card backdrop-blur-xl shadow-xl border border-brand-border rounded-[2rem] overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-brand-border bg-brand-bg-secondary flex justify-between items-center">
            <h3 className="font-bold tracking-tight text-white flex items-center gap-2"><Users size={18} className="text-brand-accent"/> Drivers</h3>
            <select value={sortBy} onChange={(e:any) => setSortBy(e.target.value)} className="text-xs border border-brand-border bg-brand-bg-secondary text-white rounded p-1 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none">
              <option value="score">Score</option>
              <option value="safety">Safety</option>
            </select>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {sortedDrivers.map(d => (
              <button key={d.id} onClick={() => setSelectedDriver(d)} className={`w-full text-left p-3 rounded-lg border transition-all ${selectedDriver?.id === d.id ? 'bg-brand-bg border-brand-accent shadow-sm' : 'border-transparent hover:bg-brand-bg-secondary'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">{d.name}</span>
                  <div className={`text-sm font-bold tracking-tight px-2 py-0.5 rounded ${getScoreBg(d.behavior_score)} ${getScoreColor(d.behavior_score)}`}>{d.has_score ? `${d.behavior_score}` : 'N/A'}</div>
                </div>
                <div className="flex justify-between mt-1 text-xs text-brand-muted">
                  <span>{d.total_miles ? `${d.total_miles.toFixed(1)} mi` : '0 mi'}</span>
                  <span className="capitalize">{!d.has_score ? 'Not enough data' : d.risk_level === 'none' ? 'No Risk' : `${d.risk_level} Risk`}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="lg:col-span-8 space-y-6">
          {selectedDriver ? (
            <>
              {/* Score Card */}
              <div className="bg-brand-card backdrop-blur-xl shadow-xl border border-brand-border rounded-[2rem] p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">{selectedDriver.name}</h2>
                    <p className="text-brand-muted text-sm">{selectedDriver.email}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-5xl font-bold tracking-tight ${getScoreColor(selectedDriver.behavior_score)}`}>{selectedDriver.has_score ? selectedDriver.behavior_score : 'N/A'}</div>
                    <span className="text-xs text-brand-muted uppercase tracking-wide">Overall Score</span>
                  </div>
                </div>

                {selectedDriver.has_score ? (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-brand-bg-secondary p-4 rounded-xl border border-brand-border text-center">
                      <Shield className="mx-auto h-6 w-6 text-blue-400 mb-1"/>
                      <div className="text-2xl font-bold tracking-tight text-white">{selectedDriver.safety_rating}</div>
                      <div className="text-xs text-blue-400/80 font-bold tracking-tight uppercase">Safety</div>
                    </div>
                    <div className="bg-brand-bg-secondary p-4 rounded-xl border border-brand-border text-center">
                      <Fuel className="mx-auto h-6 w-6 text-green-400 mb-1"/>
                      <div className="text-2xl font-bold tracking-tight text-white">{selectedDriver.fuel_efficiency_rating}</div>
                      <div className="text-xs text-green-400/80 font-bold tracking-tight uppercase">Fuel</div>
                    </div>
                    <div className={`${getScoreBg(selectedDriver.braking_score)} p-4 rounded-xl border text-center`}>
                      <AlertCircle className={`mx-auto h-6 w-6 ${getScoreColor(selectedDriver.braking_score)} mb-1`}/>
                      <div className={`text-2xl font-bold tracking-tight ${getScoreColor(selectedDriver.braking_score)}`}>{selectedDriver.braking_score}</div>
                      <div className={`text-xs font-bold tracking-tight uppercase ${getScoreColor(selectedDriver.braking_score)} opacity-80`}>Smooth Braking</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-brand-muted italic py-6 text-center bg-brand-bg-secondary rounded-xl mb-6">
                    Not enough driving data to calculate a score.
                  </div>
                )}

                {/* Show available metrics even if score is N/A */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-brand-bg-secondary p-3 rounded-lg border border-brand-border">
                    <div className="text-xs text-brand-muted uppercase mb-1">Distance</div>
                    <div className="font-bold text-white text-lg">{selectedDriver.total_miles ? selectedDriver.total_miles.toFixed(1) : 0} mi</div>
                  </div>
                  <div className="bg-brand-bg-secondary p-3 rounded-lg border border-brand-border">
                    <div className="text-xs text-brand-muted uppercase mb-1">Drive Time</div>
                    <div className="font-bold text-white text-lg">{selectedDriver.total_hours ? selectedDriver.total_hours.toFixed(1) : 0} h</div>
                  </div>
                  <div className="bg-brand-bg-secondary p-3 rounded-lg border border-brand-border" title={`Speeding: ${selectedDriver.metrics?.speed_violations || 0}\nHard Braking: ${selectedDriver.metrics?.harsh_braking || 0}\nHard Accel: ${selectedDriver.metrics?.harsh_acceleration || 0}`}>
                    <div className="text-xs text-brand-muted uppercase mb-1">Scored Events</div>
                    <div className="font-bold text-white text-lg">{selectedDriver.scored_events_count || 0}</div>
                  </div>
                  <div className="bg-brand-bg-secondary p-3 rounded-lg border border-brand-border">
                    <div className="text-xs text-brand-muted uppercase mb-1">Risk Level</div>
                    <div className="font-bold text-white text-lg capitalize">{!selectedDriver.has_score ? 'N/A' : selectedDriver.risk_level === 'none' ? 'No Risk' : selectedDriver.risk_level}</div>
                  </div>
                </div>

                {/* AI Coaching Insight */}
                <div className="bg-brand-accent/10 border border-brand-accent/20 p-4 rounded-xl mb-6">
                  <div className="flex items-start gap-3">
                    <Brain className="text-brand-accent mt-1 h-5 w-5 shrink-0" />
                    <div>
                      <h4 className="font-bold tracking-tight text-brand-accent mb-1">AI Coaching Insight</h4>
                      <p className="text-sm text-brand-accent/90">
                        {!selectedDriver.has_data ? (
                          `No safety events or trips detected across 0 miles this period.`
                        ) : selectedDriver.scored_events_count === 0 ? (
                          `No safety events detected across ${selectedDriver.total_miles.toFixed(1)} miles this period. Driver performance is strong.`
                        ) : (
                          `${selectedDriver.name} has ${selectedDriver.scored_events_count} scored safety events over ${selectedDriver.total_miles.toFixed(1)} miles. Focus coaching on ${selectedDriver.metrics?.speed_violations > 0 ? 'speed compliance' : 'defensive driving'}.`
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {canEdit && (
                    <button onClick={() => { setEditingTrainingId(null); setTrainingDate(''); setShowTrainingModal(true); }} className="flex-1 bg-brand-accent text-white py-2.5 rounded-lg font-bold tracking-tight hover:bg-brand-accent-hover transition flex justify-center items-center gap-2 shadow-sm">
                      <Calendar size={18}/> Assign New Training
                    </button>
                  )}
                  <button onClick={handleViewReport} className="flex-1 bg-brand-bg-secondary border border-brand-border text-white py-2.5 rounded-lg font-bold tracking-tight hover:bg-white/5 transition flex justify-center items-center gap-2 shadow-sm">
                    <FileText size={18}/> Download Report
                  </button>
                </div>
              </div>

              {/* TRAINING DASHBOARD (UPDATED) */}
              <div className="bg-brand-card backdrop-blur-xl shadow-xl border border-brand-border rounded-[2rem] p-6">
                <h3 className="font-bold tracking-tight text-lg mb-4 flex items-center gap-2"><Target size={20} className="text-brand-accent"/> Scheduled Trainings</h3>
                
                {scheduledTrainings.length === 0 ? (
                  <p className="text-brand-muted text-sm text-center py-4">No trainings scheduled yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-brand-bg-secondary text-brand-muted font-medium">
                        <tr>
                          <th className="px-4 py-2">Driver</th>
                          <th className="px-4 py-2">Module</th>
                          <th className="px-4 py-2">Due Date</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {scheduledTrainings.map((t) => (
                          <tr key={t.id} className="hover:bg-brand-bg-secondary">
                            <td className="px-4 py-3 font-medium text-white">{t.driverName}</td>
                            <td className="px-4 py-3 text-slate-300">{t.module}</td>
                            <td className="px-4 py-3 text-slate-300">{t.date}</td>
                            <td className="px-4 py-3"><span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded text-xs font-bold tracking-tight">{t.status}</span></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {canEdit && (
                                  <>
                                    <button onClick={() => handleEditTraining(t)} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded bg-blue-500/10"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDeleteTraining(t.id)} className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/20 rounded bg-red-500/10"><Trash2 size={16}/></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : <div className="h-full flex items-center justify-center text-brand-muted">Select a driver</div>}
        </div>
      </div>

      {/* MODAL */}
      {showTrainingModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-card backdrop-blur-2xl border border-brand-border rounded-[2rem] w-full max-w-md p-6 shadow-2xl text-left">
            <div className="flex justify-between mb-4"><h3 className="font-bold tracking-tight text-white text-lg">{editingTrainingId ? 'Edit' : 'Assign'} Training</h3><button onClick={closeModal} className="text-slate-400 hover:text-white"><X/></button></div>
            <div className="space-y-4">
               <div><label className="text-xs font-bold tracking-tight text-brand-muted">Driver</label><input value={selectedDriver.name} disabled className="w-full border border-brand-border rounded-lg px-3 py-2 bg-brand-bg-secondary text-white opacity-70"/></div>
               
               <div>
                 <label className="text-xs font-bold tracking-tight text-brand-muted mb-2 block">Training Type</label>
                 <div className="flex bg-brand-bg-secondary p-1 rounded-lg">
                   <button onClick={() => setIsCustomTraining(false)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${!isCustomTraining ? 'bg-brand-accent text-white shadow' : 'text-brand-muted hover:text-white'}`}>Module</button>
                   <button onClick={() => setIsCustomTraining(true)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${isCustomTraining ? 'bg-brand-accent text-white shadow' : 'text-brand-muted hover:text-white'}`}>Custom</button>
                 </div>
               </div>

               {!isCustomTraining ? (
                 <div><label className="text-xs font-bold tracking-tight text-brand-muted mb-1 block">Module</label>
                 <select
                   value={trainingModuleId}
                   onChange={(e) => setTrainingModuleId(e.target.value)}
                   className="w-full border border-brand-border rounded-lg px-3 py-2 bg-brand-bg-secondary text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
                 >
                   <option value="">Select training module</option>
                   
                   {TRAINING_MODULES.map((m) => (
                     <option
                       key={m.id}
                       value={m.id}
                       className="bg-slate-900 text-white"
                     >
                       {m.title}
                     </option>
                   ))}
                 </select></div>
               ) : (
                 <>
                   <div><label className="text-xs font-bold tracking-tight text-brand-muted mb-1 block">Training Title *</label><input placeholder="e.g. Speed Compliance Coaching" value={customTitle} onChange={e=>setCustomTitle(e.target.value)} className="w-full border border-brand-border rounded-lg px-3 py-2 bg-brand-bg-secondary text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none placeholder:text-slate-500"/></div>
                   <div><label className="text-xs font-bold tracking-tight text-brand-muted mb-1 block">Instructions / Notes</label><textarea placeholder="Review speeding incidents..." value={customDescription} onChange={e=>setCustomDescription(e.target.value)} rows={3} className="w-full border border-brand-border rounded-lg px-3 py-2 bg-brand-bg-secondary text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none placeholder:text-slate-500"/></div>
                 </>
               )}

               <div><label className="text-xs font-bold tracking-tight text-brand-muted mb-1 block">Due Date *</label><input type="date" value={trainingDate} onChange={e=>setTrainingDate(e.target.value)} className="w-full border border-brand-border rounded-lg px-3 py-2 bg-brand-bg-secondary text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"/></div>
               
               <button 
                 onClick={handleConfirmTraining} 
                 disabled={isSaving || !trainingDate || (isCustomTraining ? !customTitle.trim() : !trainingModuleId)} 
                 className="w-full bg-brand-accent text-white py-2 rounded-lg font-bold tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-accent-hover transition"
               >
                 {isSaving ? 'Assigning...' : 'Confirm'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverBehaviorAI;
