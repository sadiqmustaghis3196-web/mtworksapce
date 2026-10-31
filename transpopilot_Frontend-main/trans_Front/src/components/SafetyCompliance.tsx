import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { getSafetyOverview, getSafetyIncidents, getDriverComplianceOverview, getDriverOnboardingDetails } from '../api/safety';
import { DriverDetailsModal } from './DriverDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';
import { API_BASE_URL } from '../lib/apiConfig';

interface ComplianceItem {
  id: string;
  type: string;
  entity: string;
  dueDate: string;
  status: 'overdue' | 'due-soon' | 'pending' | 'completed';
  priority: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  provider?: string;
}

interface SafetyIncident {
  id: string;
  type: string;
  driver: string;
  vehicle: string;
  date: string;
  severity: string;
  description: string;
  status: string;
  provider?: string;
}

interface TopPerformer {
  name: string;
  score: string;
  streak: string;
}

interface RiskManagementItem {
  id: string;
  geotabId?: string;
  vehicleName: string;
  distance: string;
  idlingTime: string;
  idlingOver5Mins: number;
  afterHoursTrips: number;
  provider?: string;
}

interface SpeedProfileData {
  provider: string;
  provider_event_id: string | null;
  vehicle_id: string;
  timestamp: string;
  speed: number;
  speed_unit: string;
  speed_limit: number | null;
  estimated_speed_limit: number | null;
  latitude: number | null;
  longitude: number | null;
}

const SafetyCompliance: React.FC = () => {
  const { profile } = useAuth();
  // API_BASE_URL imported from config
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false); // Global initial loading can just be false since tabs have their own
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({
    overview: true,
    compliance: true,
    incidents: true,
    'risk-management': true,
    'speed-profile': true
  });
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Record<string, number | null>>({
    overview: null,
    'risk-management': null
  });
  const [overviewFilter, setOverviewFilter] = useState<'all' | 'geotab' | 'samsara'>('all');
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'geotab' | 'samsara'>('all');
  const [incidentsFilter, setIncidentsFilter] = useState<'all' | 'geotab' | 'samsara'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'geotab' | 'samsara'>('all');
  const [speedFilter, setSpeedFilter] = useState<'all' | 'geotab' | 'samsara'>('all');
  const [riskSort, setRiskSort] = useState('a-z');
  const [speedProfileSort, setSpeedProfileSort] = useState('a-z');
  const [riskPage, setRiskPage] = useState(1);
  const [speedPage, setSpeedPage] = useState(1);
  const cardsPerPage = 6;

  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [incidentsThisMonth, setIncidentsThisMonth] = useState(0);
  const [complianceRate, setComplianceRate] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [incidentsChange, setIncidentsChange] = useState(0);

  const [complianceItems, setComplianceItems] = useState<any[]>([]);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<any>(null); // Keep for backwards compatibility if needed elsewhere
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<SafetyIncident[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [riskManagementData, setRiskManagementData] = useState<RiskManagementItem[]>([]);
  const [milesDriven, setMilesDriven] = useState<number | null>(0);
  const [violationsCount, setViolationsCount] = useState(0);

  const [providerStatus, setProviderStatus] = useState<Record<string, { success: boolean, error?: string, count?: number }>>({});
  const [partialSuccess, setPartialSuccess] = useState(false);

  // Speed Profile Modal state
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>('');
  const [selectedGeotabId, setSelectedGeotabId] = useState<string>('');
  const [speedProfileTimeframe, setSpeedProfileTimeframe] = useState<string>('24h');
  const [speedProfileData, setSpeedProfileData] = useState<SpeedProfileData[]>([]);
  const [speedProfileModalOpen, setSpeedProfileModalOpen] = useState(false);
  const [loadingSpeedProfile, setLoadingSpeedProfile] = useState(false);
  const [speedProfileError, setSpeedProfileError] = useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const [currentCompliancePage, setCurrentCompliancePage] = useState(1);
  const [currentIncidentPage, setCurrentIncidentPage] = useState(1);
  const [totalIncidentsCount, setTotalIncidentsCount] = useState<number | null>(null);
  const [incidentFilter, setIncidentFilter] = useState('All');
  const itemsPerPage = 10;

  // Base data like vehicles/drivers that are globally used
  const fetchBaseData = async (orgId: string) => {
    let drivers: any[] = [];
    let vehicles: any[] = [];
    try {
      const [{ data: dData }, { data: vData }] = await Promise.all([
        supabase.from('drivers').select('id, first_name, last_name, safety_score').eq('organization_id', orgId),
        supabase.from('vehicles').select('id, vehicle_number, current_mileage').eq('organization_id', orgId)
      ]);
      drivers = dData || [];
      vehicles = vData || [];
    } catch (err) {}
    return { drivers, vehicles };
  };

  useEffect(() => {
    if (!profile?.organization_id) return;
    const orgId = profile.organization_id;

    if (activeTab === 'overview' && !loadedTabs.overview) {
      setTabLoading(prev => ({ ...prev, overview: true }));
      fetchBaseData(orgId).then(({ drivers, vehicles }) => {
        getSafetyOverview(orgId).then(overviewData => { if (overviewData) { setSafetyScore(overviewData.safetyScore); setIncidentsThisMonth(overviewData.incidentsThisMonth); setIncidentsChange(overviewData.incidentsThisMonth - overviewData.incidentsLastMonth); setMilesDriven(overviewData.milesDriven); setViolationsCount(overviewData.violationsCount); setTopPerformers(overviewData.topPerformers); setLastUpdated(prev => ({ ...prev, overview: Date.now() }));  } }).catch(() => {}).finally(() => { setTabLoading(prev => ({ ...prev, overview: false })); setLoadedTabs(prev => ({ ...prev, overview: true })); });
      });
    }

    if (activeTab === 'compliance' && !loadedTabs.compliance) {
      setTabLoading(prev => ({ ...prev, compliance: true }));
      getDriverComplianceOverview().then(data => {
        setComplianceItems(data);
        
      }).catch(err => {
        console.error('Failed to load compliance items', err);
      }).finally(() => {
        setTabLoading(prev => ({ ...prev, compliance: false }));
        setLoadedTabs(prev => ({ ...prev, compliance: true }));
      });
    }

    if (activeTab === 'incidents' && !loadedTabs.incidents) {
      setTabLoading(prev => ({ ...prev, incidents: true }));
      getSafetyIncidents(orgId).then(data => { setRecentIncidents(data || []); setTotalIncidentsCount((data || []).length);  }).catch(() => {}).finally(() => { setTabLoading(prev => ({ ...prev, incidents: false })); setLoadedTabs(prev => ({ ...prev, incidents: true })); });
    }

    if ((activeTab === 'risk-management' && !loadedTabs['risk-management']) || (activeTab === 'speed-profile' && !loadedTabs['speed-profile'])) {
      setTabLoading(prev => ({ ...prev, [activeTab]: true }));
      
      const fetchRiskAndSpeedProfileVehicles = async () => {
        try {
          // Fetch vehicles
          const { data: vehiclesData, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('organization_id', orgId);
            
          if (error) throw error;
          
          if (vehiclesData && vehiclesData.length > 0) {
            // Fetch past 30 days trips for real distance and idling
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { data: tripsData } = await supabase
              .from('vehicle_trips')
              .select('vehicle_id, distance, idle_duration, start_time')
              .eq('organization_id', orgId)
              .gte('start_time', thirtyDaysAgo.toISOString());
              
            const { data: incidentsData } = await supabase
              .from('safety_incident_reports')
              .select('vehicle_id, description')
              .eq('organization_id', orgId)
              .gte('date', thirtyDaysAgo.toISOString());

            const mappedVehicles: RiskManagementItem[] = vehiclesData.map((v: any) => {
              const vTrips = (tripsData || []).filter(t => t.vehicle_id === v.vehicle_number || t.vehicle_id === v.id);
              const vInc = (incidentsData || []).filter(i => i.vehicle_id === v.id);
              
              let totalDistance = vTrips.reduce((acc, t) => acc + (Number(t.distance) || 0), 0);
              let totalIdlingSeconds = vTrips.reduce((acc, t) => acc + (Number(t.idle_duration) || 0), 0);
              let idlingEvents = vInc.filter(i => i.description && i.description.toLowerCase().includes('idling')).length;
              
              let afterHours = vTrips.filter(t => {
                if (!t.start_time) return false;
                const h = new Date(t.start_time).getHours();
                return h < 6 || h >= 18;
              }).length;

              const idleHours = Math.floor(totalIdlingSeconds / 3600);
              const idleMins = Math.floor((totalIdlingSeconds % 3600) / 60);
              const formattedIdling = totalIdlingSeconds > 0 ? `${idleHours}h ${idleMins}m` : '0h 0m';

              return {
                id: v.vehicle_number || v.id,
                geotabId: v.vehicle_number || v.id,
                vehicleName: v.name || v.vehicle_number || v.make || 'Unknown Vehicle',
                distance: totalDistance > 0 ? `${totalDistance.toFixed(1)} mi` : String(v.current_mileage || 0),
                idlingTime: formattedIdling,
                idlingOver5Mins: idlingEvents,
                afterHoursTrips: afterHours,
                provider: 'geotab'
              };
            });
            
            setRiskManagementData(mappedVehicles);
          } else {
            setRiskManagementData([]);
          }
        } catch (err) {
          console.error("Failed to fetch risk management data:", err);
          setRiskManagementData([]);
        } finally {
          setTabLoading(prev => ({ ...prev, 'risk-management': false, 'speed-profile': false }));
          setLoadedTabs(prev => ({ ...prev, 'risk-management': true, 'speed-profile': true }));
        }
      };
      
      fetchRiskAndSpeedProfileVehicles();
    }
  }, [profile, activeTab, loadedTabs, riskManagementData]);

  const openSpeedProfile = async (geotabId: string, deviceName: string) => {
    setSelectedDeviceName(deviceName);
    setSelectedGeotabId(geotabId);
    setSpeedProfileModalOpen(true);
    if (speedProfileTimeframe === '24h') {
      fetchSpeedProfile(geotabId, '24h');
    } else {
      setSpeedProfileTimeframe('24h');
    }
  };

  const fetchSpeedProfile = async (geotabId: string, timeframe: string) => {
    if (!geotabId) return;
    setLoadingSpeedProfile(true);
    setSpeedProfileData([]);
    setSpeedProfileError(null);
    
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const requestPayload = { 
        organizationId: profile?.organization_id, 
        deviceId: geotabId,
        timeframe: timeframe
    };

    console.log(`📈 [FRONTEND SPEED PROFILE FETCH] Request payload:`, requestPayload);

    try {
        const res = await fetch(`${API_BASE_URL}/api/geotab-speed-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: abortController.signal
        });
        
        const json = await res.json();
        console.log(`📥 [FRONTEND SPEED PROFILE RESPONSE] Status: ${res.status}`, json);
        
        if (!res.ok) {
            throw new Error(json.error || `HTTP error! status: ${res.status}`);
        }

        if (json.success && Array.isArray(json.data)) {
            console.log(`📊 [FRONTEND SPEED PROFILE RECHARTS] response.data.length: ${json.data.length}`);
            if (json.data.length > 0) {
                console.log(`📋 [FRONTEND SPEED PROFILE RECHARTS] First 3 records immediately before rendering:`, json.data.slice(0, 3));
            }
            setSpeedProfileData(json.data);
            if (json.data.length === 0) {
                console.log("ℹ️ Speed profile data array is empty for device:", geotabId);
            }
        } else {
            throw new Error(json.error || "Unknown error occurred while fetching speed profile data.");
        }
    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.log("Fetch aborted due to new request.");
        } else {
            console.error("❌ Failed to load speed profile:", err);
            setSpeedProfileError(err.message || "Failed to load speed profile.");
        }
    } finally {
        if (abortControllerRef.current === abortController) {
            setLoadingSpeedProfile(false);
        }
    }
  };

  const handleDownloadSpeedProfilePDF = async () => {
      const graphElement = document.getElementById('speed-profile-graph');
      if (!graphElement) return;

      try {
          const canvas = await html2canvas(graphElement, { scale: 2, backgroundColor: '#020617' });
          const imgData = canvas.toDataURL('image/png');
          
          const doc = new jsPDF({ orientation: 'landscape' });
          doc.setFontSize(18);
          doc.setTextColor(41, 128, 185);
          doc.text(`Speed Profile Report: ${selectedDeviceName}`, 14, 20);

          doc.setFontSize(12);
          doc.setTextColor(100);
          doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
          doc.text(`Timeframe: ${speedProfileTimeframe}`, 14, 34);

          const speeds = speedProfileData.map(d => d.speed).filter(s => s != null);
          const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
          const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((a,b)=>a+b, 0) / speeds.length) : 0;

          doc.setTextColor(0);
          doc.text(`Total Records: ${speedProfileData.length}`, 14, 45);
          doc.text(`Max Speed: ${maxSpeed} mph`, 80, 45);
          doc.text(`Average Speed: ${avgSpeed} mph`, 140, 45);

          const imgProps = doc.getImageProperties(imgData);
          const pdfWidth = doc.internal.pageSize.getWidth() - 28;
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

          doc.addImage(imgData, 'PNG', 14, 55, pdfWidth, pdfHeight);
          doc.save(`Speed_Profile_${selectedDeviceName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (err) {
          console.error("Failed to generate PDF:", err);
      }
  };

  // Dynamic filtered states
  const filteredCompliance = complianceItems.filter(item => complianceFilter === 'all' || item.provider?.toLowerCase() === complianceFilter.toLowerCase());
  const filteredIncidents = recentIncidents.filter(item => incidentsFilter === 'all' || item.provider?.toLowerCase() === incidentsFilter.toLowerCase());
  const filteredRisk = riskManagementData.filter(item => riskFilter === 'all' || item.provider?.toLowerCase() === riskFilter.toLowerCase());
  const filteredSpeed = riskManagementData.filter(item => speedFilter === 'all' || item.provider?.toLowerCase() === speedFilter.toLowerCase());

  // Re-calculate Stats dynamically based on selected provider (overviewFilter)
  const overviewCompliance = complianceItems.filter(item => overviewFilter === 'all' || item.provider?.toLowerCase() === overviewFilter.toLowerCase());
  const overviewIncidents = recentIncidents.filter(item => overviewFilter === 'all' || item.provider?.toLowerCase() === overviewFilter.toLowerCase());

  const dynamicComplianceRate = (() => {
    if (overviewCompliance.length === 0) return null;
    let totalItems = 0;
    let approvedItems = 0;
    
    overviewCompliance.forEach(driver => {
      const ob = driver.onboarding?.[0] || {};
      const statuses = [
        ob.cdl_status, ob.medical_status, ob.drug_screen_status,
        ob.mvr_check_status, ob.background_check_status, ob.clearinghouse_status
      ];
      // assuming all 6 items are required per driver for this metric
      totalItems += statuses.length;
      approvedItems += statuses.filter(s => s === 'approved' || s === 'verified').length;
    });
    
    return totalItems > 0 ? (approvedItems / totalItems) * 100 : 0;
  })();

  const dynamicOverdueCount = (() => {
    let overdue = 0;
    overviewCompliance.forEach(driver => {
      const ob = driver.onboarding?.[0] || {};
      const statuses = [
        ob.cdl_status, ob.medical_status, ob.drug_screen_status,
        ob.mvr_check_status, ob.background_check_status, ob.clearinghouse_status
      ];
      overdue += statuses.filter(s => s === 'expired' || s === 'overdue').length;
    });
    return overdue;
  })();
  
  const dynamicIncidentsCount = incidentsThisMonth;

  const safetyStats = [
    {
      name: 'Safety Score',
      value: tabLoading.overview ? '...' : (safetyScore != null ? `${safetyScore.toFixed(1)}%` : 'N/A'),
      icon: Shield,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      glowColor: 'from-emerald-500/10'
    },
    {
      name: 'Incidents This Month',
      value: tabLoading.overview ? '...' : `${dynamicIncidentsCount}`,
      change: incidentsChange === 0 ? "0" : (incidentsChange < 0 ? `${incidentsChange}` : `+${incidentsChange}`),
      changeType: incidentsChange <= 0 ? 'decrease' : 'increase',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      glowColor: 'from-amber-500/10'
    },
    {
      name: 'Compliance Rate',
      value: tabLoading.overview ? '...' : (dynamicComplianceRate != null ? `${dynamicComplianceRate.toFixed(1)}%` : '—'),
      icon: CheckCircle,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
      glowColor: 'from-blue-500/10'
    },
    {
      name: 'Overdue Items',
      value: tabLoading.overview ? '...' : `${dynamicOverdueCount}`,
      icon: Clock,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      glowColor: 'from-rose-500/10'
    },
  ];

  const safetyMetrics = [
    { name: 'Miles Driven', value: tabLoading.overview ? '...' : (milesDriven != null ? milesDriven.toLocaleString() : '—') },
    { name: 'Violations Logged', value: tabLoading.overview ? '...' : `${violationsCount}` },
  ];

  // --- PDF GENERATION LOGIC ---
  const handleGenerateReport = () => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.text('TranspoPilot - Safety & Compliance Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Report ID: REF-${crypto.randomUUID().split('-')[0].toUpperCase()}`, 14, 33);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Executive Summary', 14, 45);

    let yPos = 55;
    safetyStats.forEach((stat) => {
      doc.setFontSize(12);
      doc.text(`${stat.name}: ${stat.value}`, 14, yPos);
      yPos += 7;
    });

    doc.setFontSize(14);
    doc.text('Compliance Issues', 14, yPos + 10);

    autoTable(doc, {
      startY: yPos + 15,
      head: [['Type', 'Entity', 'Due Date', 'Status', 'Priority']],
      body: complianceItems.map(item => [
        item.type,
        item.entity,
        new Date(item.dueDate).toLocaleDateString(),
        item.status.toUpperCase(),
        item.priority.toUpperCase()
      ]),
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;

    doc.setFontSize(14);
    doc.text('Recent Safety Incidents', 14, finalY + 15);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Date', 'Type', 'Driver', 'Vehicle', 'Severity', 'Status']],
      body: recentIncidents.map(inc => [
        new Date(inc.date).toLocaleDateString(),
        inc.type,
        inc.driver,
        inc.vehicle,
        inc.severity.toUpperCase(),
        inc.status.toUpperCase()
      ]),
      theme: 'striped',
      headStyles: { fillColor: [192, 57, 43] },
    });

    doc.save(`Safety_Compliance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Safety & Compliance</h1>
          <p className="text-slate-400 mt-1">Monitor safety performance and regulatory compliance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-bold shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
          >
            <FileText className="h-4 w-4" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-900">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'compliance', name: 'Compliance Items' },
            { id: 'incidents', name: 'Recent Incidents' },
            { id: 'risk-management', name: 'Risk Management' },
            { id: 'speed-profile', name: 'Speed Profile' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-350 hover:border-slate-800'
                }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {safetyStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all group relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.glowColor} to-transparent rounded-bl-full opacity-30 transition-transform group-hover:scale-110`}></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.name}</p>
                  <p className="text-3xl font-black text-white mt-2 tracking-tight">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl border ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
              {'change' in stat && (
                <div className="mt-4 flex items-center relative z-10">
                  {stat.changeType === 'increase' ? (
                    <TrendingUp className="h-4 w-4 mr-1" style={{ color: stat.changeType === 'increase' ? '#f43f5e' : '#10b981' }} />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" style={{ color: '#10b981' }} />
                  )}
                  <span className={`text-xs font-black ${stat.changeType === 'increase' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {stat.change}
                  </span>
                  <span className="text-xs text-slate-500 font-medium ml-1.5">vs last month</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Tab-specific Provider Filter */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {tabLoading.overview ? (
                <span className="text-xs text-slate-500 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Syncing live data...
                </span>
              ) : lastUpdated.overview ? (
                <span className="text-xs text-slate-500 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Last updated: {Math.max(0, Math.floor((Date.now() - lastUpdated.overview) / 60000))} minutes ago
                </span>
              ) : null}
            </div>
            <select
              value={overviewFilter}
              onChange={(e) => setOverviewFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
            >
              <option value="all">All Providers</option>
              <option value="geotab">Geotab Only</option>
              <option value="samsara">Samsara Only</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Safety Metrics */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-blue-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
            <div className="pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white tracking-tight">Fleet Safety Metrics</h3>
            </div>
            <div className="mt-4 space-y-4">
              {tabLoading.overview ? (
                <>
                  {[1, 2].map(i => (
                    <div key={i} className="flex items-center justify-between py-2 animate-pulse">
                      <div className="h-4 bg-slate-800 rounded w-24"></div>
                      <div className="h-4 bg-slate-800 rounded w-16"></div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {safetyMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-slate-900/50 last:border-0">
                      <span className="text-sm font-semibold text-slate-400">{metric.name}</span>
                      <span className="text-sm font-black text-white">{metric.value}</span>
                    </div>
                  ))}
                  {safetyMetrics.length === 0 && (
                    <p className="text-sm text-slate-500">No metrics available yet.</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Top Safety Performers */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-emerald-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
            <div className="pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white tracking-tight">Top Safety Performers</h3>
            </div>
            <div className="mt-4 space-y-4">
              {tabLoading.overview ? (
                <>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center justify-between py-2.5 animate-pulse">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-slate-800 rounded-xl"></div>
                        <div className="h-4 bg-slate-800 rounded w-24"></div>
                      </div>
                      <div className="h-4 bg-slate-800 rounded w-12"></div>
                    </div>
                  ))}
                </>
              ) : topPerformers.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  No driver safety scores recorded yet.
                </p>
              ) : (
                topPerformers.map((driver, index) => (
                  <div key={index} className="flex items-center justify-between py-2.5 last:border-0 border-b border-slate-900/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Award className="h-5 w-5" style={{ color: '#10b981' }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white tracking-tight">{driver.name}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-400">{driver.score}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

            {activeTab === 'compliance' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-lg font-black text-white tracking-tight">Per-Driver Compliance</h3>
          </div>
          {tabLoading.compliance ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex animate-pulse">
                  <div className="h-10 bg-slate-800 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : complianceItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No driver compliance data found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-900">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Driver</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle</th>
                      <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">CDL</th>
                      <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Medical</th>
                      <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Drug Test</th>
                      <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">MVR</th>
                      <th className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Background</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 bg-slate-900/40">
                    {(() => {
                      const paginatedItems = complianceItems.slice((currentCompliancePage - 1) * itemsPerPage, currentCompliancePage * itemsPerPage);
                      return paginatedItems.map((driver) => {
                        const ob = (driver.onboarding && driver.onboarding.length > 0) ? driver.onboarding[0] : {};
                        const assignedVehicle = (driver.vehicle && driver.vehicle.length > 0) ? driver.vehicle[0].vehicle_number : 'Unassigned';
                        
                        const renderStatusIcon = (status) => {
                          if (status === 'approved') return <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />;
                          if (status === 'rejected') return <AlertTriangle className="h-4 w-4 text-rose-400 mx-auto" />;
                          return <Clock className="h-4 w-4 text-amber-400 mx-auto" />;
                        };

                        return (
                          <tr key={driver.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                              {driver.first_name} {driver.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-350">
                              {assignedVehicle}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {renderStatusIcon(ob.cdl_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {renderStatusIcon(ob.medical_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {renderStatusIcon(ob.drug_screen_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {renderStatusIcon(ob.mvr_check_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {renderStatusIcon(ob.background_check_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                              <button 
                                onClick={() => {
                                  setSelectedDriverId(driver.id);
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1 rounded"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {(() => {
                const totalCount = complianceItems.length;
                const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
                if (totalCount === 0) return null;

                return (
                  <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <div className="text-slate-400 font-medium">
                      Showing <span className="text-white font-bold">{(currentCompliancePage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="text-white font-bold">{Math.min(currentCompliancePage * itemsPerPage, totalCount)}</span> of{' '}
                      <span className="text-white font-bold">{totalCount}</span> drivers
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentCompliancePage === 1}
                        onClick={() => setCurrentCompliancePage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentCompliancePage(page)}
                          className={`w-7 h-7 rounded font-bold border ${currentCompliancePage === page
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        disabled={currentCompliancePage >= totalPages}
                        onClick={() => setCurrentCompliancePage(prev => Math.min(prev + 1, totalPages))}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-900/50">
            <h3 className="text-lg font-black text-white tracking-tight">Recent Incidents</h3>
            <div className="flex items-center gap-3">
              <select
                value={incidentsFilter}
                onChange={(e) => { setIncidentsFilter(e.target.value as any); setCurrentIncidentPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="all">All Providers</option>
                <option value="geotab">Geotab Only</option>
                <option value="samsara">Samsara Only</option>
              </select>

              <select
                value={incidentFilter}
                onChange={(e) => { setIncidentFilter(e.target.value); setCurrentIncidentPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 transition-colors"
              >
                <option value="All">All Types</option>
                <option value="Speed Violation">Speed Violation</option>
                <option value="Hard Braking">Hard Braking</option>
                <option value="Hard Acceleration">Hard Acceleration</option>
                <option value="Seatbelt Violation">Seatbelt Violation</option>
                <option value="Excessive Idling">Excessive Idling</option>
              </select>
              <button className="text-xs text-rose-400 hover:text-rose-350 font-bold bg-rose-500/5 px-2.5 py-2 rounded border border-rose-500/10 hover:bg-rose-500/10">
                Report Incident
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {tabLoading.incidents ? (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} className="border border-slate-800 rounded-xl p-4.5 bg-slate-950/40 animate-pulse">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-slate-800 rounded-lg"></div>
                        <div>
                          <div className="h-4 bg-slate-800 rounded w-32 mb-2"></div>
                          <div className="h-3 bg-slate-800 rounded w-24"></div>
                        </div>
                      </div>
                      <div className="h-4 bg-slate-800 rounded w-16"></div>
                    </div>
                    <div className="h-3 bg-slate-800 rounded w-full mt-2"></div>
                  </div>
                ))}
              </>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No safety incidents recorded.
              </div>
            ) : (
              (() => {
                const finalIncidents = incidentFilter === 'All'
                  ? filteredIncidents
                  : filteredIncidents.filter(inc => inc.type === incidentFilter);

                if (finalIncidents.length === 0) {
                  return (
                    <div className="text-center text-slate-500 py-8">
                      No incidents match the selected filter "{incidentFilter}".
                    </div>
                  );
                }

                const paginatedIncidents = finalIncidents.slice((currentIncidentPage - 1) * itemsPerPage, currentIncidentPage * itemsPerPage);
                return paginatedIncidents.map((incident) => (
                  <div key={incident.id} className="border border-slate-800 rounded-xl p-4.5 bg-slate-950/40 hover:bg-slate-950/80 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg border ${incident.severity === 'high' ? 'bg-rose-500/10 border-rose-500/20' :
                            incident.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/20' :
                              'bg-blue-500/10 border-blue-500/20'
                          }`}>
                          <AlertTriangle className={`h-4.5 w-4.5 ${incident.severity === 'high' ? 'text-rose-400' :
                              incident.severity === 'medium' ? 'text-amber-400' :
                                'text-blue-400'
                            }`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                            {incident.type}
                            {incident.provider === 'geotab' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                🟢 Geotab
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                🔵 Samsara
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">{incident.driver} • {incident.vehicle}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${incident.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                            'bg-amber-500/10 text-amber-450 border border-amber-500/20'
                          }`}>
                          {incident.status}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">{new Date(incident.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-350 leading-relaxed pl-1.5 border-l-2 border-slate-800 mt-2">{incident.description}</p>
                  </div>
                ));
              })()
            )}
          </div>

          {/* Incidents Pagination Controls */}
          {filteredIncidents.length > 0 && (() => {
            const finalIncidents = incidentFilter === 'All'
              ? filteredIncidents
              : filteredIncidents.filter(inc => inc.type === incidentFilter);
            const totalCount = filteredIncidents.length;
            const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

            if (totalCount === 0) return null;

            return (
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="text-slate-400 font-medium">
                  Showing <span className="text-white font-bold">{(currentIncidentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="text-white font-bold">{Math.min(currentIncidentPage * itemsPerPage, filteredIncidents.length)}</span> of{' '}
                  <span className="text-white font-bold">{totalIncidentsCount ?? filteredIncidents.length}</span> incidents
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentIncidentPage === 1}
                    onClick={() => setCurrentIncidentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentIncidentPage(page)}
                      className={`w-7 h-7 rounded font-bold border ${currentIncidentPage === page
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    disabled={currentIncidentPage >= totalPages}
                    onClick={() => setCurrentIncidentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'risk-management' && (() => {
        let sortedRiskData = [...filteredRisk];
        if (riskSort === 'a-z') {
            sortedRiskData.sort((a, b) => String(a.vehicleName || '').localeCompare(String(b.vehicleName || ''), undefined, { numeric: true }));
        } else if (riskSort === '1-10') {
            // Sort by highest distance as a numeric metric
            sortedRiskData.sort((a, b) => parseFloat(b.distance) - parseFloat(a.distance));
        }

        return (
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-rose-500 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 relative z-10">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-rose-500" />
                Risk Management
              </h2>
              <p className="text-sm text-slate-400 mt-1">Live telematics risk data from the last 30 days.</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={riskFilter}
                onChange={(e) => { setRiskFilter(e.target.value as any); setRiskPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="all">All Providers</option>
                <option value="geotab">Geotab Only</option>
                <option value="samsara">Samsara Only</option>
              </select>

              <select
                value={riskSort}
                onChange={(e) => setRiskSort(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-rose-500/50 transition-colors"
              >
                <option value="a-z">Sort: A to Z</option>
                <option value="1-10">Sort: Highest Distance (1-10)</option>
              </select>
              <span className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold flex items-center gap-2">
                {tabLoading['risk-management'] ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    Syncing...
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Updated {lastUpdated['risk-management'] ? Math.max(0, Math.floor((Date.now() - lastUpdated['risk-management']) / 60000)) : 0}m ago
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {tabLoading['risk-management'] ? (
              <>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 animate-pulse h-48 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="h-5 bg-slate-800 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-slate-800 rounded w-24"></div>
                      </div>
                      <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
                    </div>
                    <div className="space-y-3 mt-4">
                      <div className="h-3 bg-slate-800 rounded w-full"></div>
                      <div className="h-3 bg-slate-800 rounded w-full"></div>
                      <div className="h-3 bg-slate-800 rounded w-full"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : sortedRiskData.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 font-medium">
                No Geotab risk data available.
              </div>
            ) : sortedRiskData.slice((riskPage - 1) * cardsPerPage, riskPage * cardsPerPage).map((item) => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group">
                <div className="mb-4 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      {item.vehicleName}
                      {item.provider === 'geotab' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          🟢 Geotab
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          🔵 Samsara
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Distance: <span className="font-bold text-slate-300">{item.distance}</span></p>
                  </div>
                  <div className="p-2 bg-rose-500/10 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  </div>
                </div>
                
                <div className="space-y-3 mt-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Total Idling</span>
                    <span className="text-amber-400 font-bold">{item.idlingTime}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Idling &gt; 5m</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.idlingOver5Mins > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}`}>
                      {item.idlingOver5Mins} events
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-slate-800/50 pt-3">
                    <span className="text-slate-500 font-medium">After Hours Trips</span>
                    <span className={`font-bold ${item.afterHoursTrips > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {item.afterHoursTrips}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Risk Pagination Controls */}
          {sortedRiskData.length > 0 && (() => {
            const totalCount = sortedRiskData.length;
            const totalPages = Math.ceil(totalCount / cardsPerPage) || 1;
            if (totalCount <= cardsPerPage) return null;
            return (
              <div className="mt-6 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs relative z-10">
                <div className="text-slate-400 font-medium">
                  Showing <span className="text-white font-bold">{(riskPage - 1) * cardsPerPage + 1}</span> to{' '}
                  <span className="text-white font-bold">{Math.min(riskPage * cardsPerPage, totalCount)}</span> of{' '}
                  <span className="text-white font-bold">{totalCount}</span> vehicles
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={riskPage === 1} onClick={() => setRiskPage(prev => Math.max(prev - 1, 1))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold">
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button key={page} onClick={() => setRiskPage(page)} className={`w-7 h-7 rounded font-bold border ${riskPage === page ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                      {page}
                    </button>
                  ))}
                  <button disabled={riskPage >= totalPages} onClick={() => setRiskPage(prev => Math.min(prev + 1, totalPages))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold">
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
        );
      })()}

      {activeTab === 'speed-profile' && (() => {
        // Use riskManagementData if available, otherwise map from available vehicles
        let speedDataList = filteredSpeed.length > 0 ? filteredSpeed : [];
        let sortedSpeedData = [...speedDataList];

        if (speedProfileSort === 'a-z') {
            sortedSpeedData.sort((a, b) => (a.vehicleName || '').localeCompare(b.vehicleName || '', undefined, { numeric: true }));
        } else if (speedProfileSort === '1-10') {
            sortedSpeedData.sort((a, b) => parseFloat(b.distance || '0') - parseFloat(a.distance || '0'));
        }

        return (
        <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 relative z-10">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-blue-500" />
                Speed Profiles
              </h2>
              <p className="text-sm text-slate-400 mt-1">View historical speed graphs against speed limits.</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={speedFilter}
                onChange={(e) => { setSpeedFilter(e.target.value as any); setSpeedPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="all">All Providers</option>
                <option value="geotab">Geotab Only</option>
                <option value="samsara">Samsara Only</option>
              </select>

              <select
                value={speedProfileSort}
                onChange={(e) => setSpeedProfileSort(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 transition-colors"
              >
                <option value="a-z">Sort: A to Z</option>
                <option value="1-10">Sort: Highest Distance (1-10)</option>
              </select>
              <span className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                Live Sync
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {tabLoading['speed-profile'] ? (
              <>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 animate-pulse h-32 flex flex-col justify-between">
                    <div>
                      <div className="h-5 bg-slate-800 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-slate-800 rounded w-24"></div>
                    </div>
                    <div className="h-10 bg-slate-800 rounded-xl w-full mt-4"></div>
                  </div>
                ))}
              </>
            ) : sortedSpeedData.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 font-medium">
                No vehicles found in Geotab sync.
              </div>
            ) : sortedSpeedData.slice((speedPage - 1) * cardsPerPage, speedPage * cardsPerPage).map((item) => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group">
                  <div className="mb-4">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      {item.vehicleName}
                      {item.provider === 'geotab' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          🟢 Geotab
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          🔵 Samsara
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Total Distance: {item.distance}</p>
                  </div>
                  <button
                    onClick={() => {
                        console.log("📍 [FRONTEND SPEED PROFILE MODAL] Selected Vehicle Object:", item);
                        openSpeedProfile(item.id, item.vehicleName);
                    }}
                    className="w-full py-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl border border-blue-600/30 transition-all font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    View Graph
                  </button>
                </div>
              ))}
          </div>

          {/* Speed Pagination Controls */}
          {sortedSpeedData.length > 0 && (() => {
            const totalCount = sortedSpeedData.length;
            const totalPages = Math.ceil(totalCount / cardsPerPage) || 1;
            if (totalCount <= cardsPerPage) return null;
            return (
              <div className="mt-6 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs relative z-10">
                <div className="text-slate-400 font-medium">
                  Showing <span className="text-white font-bold">{(speedPage - 1) * cardsPerPage + 1}</span> to{' '}
                  <span className="text-white font-bold">{Math.min(speedPage * cardsPerPage, totalCount)}</span> of{' '}
                  <span className="text-white font-bold">{totalCount}</span> vehicles
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={speedPage === 1} onClick={() => setSpeedPage(prev => Math.max(prev - 1, 1))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold">
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button key={page} onClick={() => setSpeedPage(page)} className={`w-7 h-7 rounded font-bold border ${speedPage === page ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                      {page}
                    </button>
                  ))}
                  <button disabled={speedPage >= totalPages} onClick={() => setSpeedPage(prev => Math.min(prev + 1, totalPages))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-slate-200 font-bold">
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
        );
      })()}

      {/* Speed Profile Modal */}
      {speedProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-5xl border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-32 -mr-32 w-64 h-64 bg-blue-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Speed Profile</h3>
                <p className="text-sm text-slate-400 mt-1">Vehicle: <span className="text-blue-400 font-bold">{selectedDeviceName}</span></p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setSpeedProfileTimeframe('24h')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      speedProfileTimeframe === '24h'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1 Day
                  </button>
                  <button
                    onClick={() => setSpeedProfileTimeframe('7d')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      speedProfileTimeframe === '7d'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1 Week
                  </button>
                  <button
                    onClick={() => setSpeedProfileTimeframe('30d')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      speedProfileTimeframe === '30d'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1 Month
                  </button>
                </div>
                
                <button
                  onClick={() => setSpeedProfileModalOpen(false)}
                  className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
          </div>

            <div id="speed-profile-graph" className="h-[480px] w-full relative z-10 bg-slate-950/60 rounded-2xl border border-slate-800 p-6">
              {loadingSpeedProfile ? (
                <div className="flex h-full items-center justify-center text-slate-400 font-medium">Loading Geotab GPS LogRecords...</div>
              ) : speedProfileError ? (
                <div className="flex flex-col h-full items-center justify-center text-red-400">
                    <AlertTriangle className="h-8 w-8 mb-2 opacity-80" />
                    <p className="font-bold">{speedProfileError}</p>
                    <p className="text-xs text-slate-500 mt-2">Check backend terminal for raw API logs.</p>
                </div>
              ) : speedProfileData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-400">No speed data recorded for the selected period.</div>
              ) : speedProfileData.length === 1 ? (
                <div className="flex flex-col h-full items-center justify-center text-amber-400">
                    <AlertTriangle className="h-8 w-8 mb-2 opacity-80" />
                    <p className="font-bold">Not enough data to draw graph</p>
                    <p className="text-sm mt-1">Found exactly 1 GPS log, which cannot form a line.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={speedProfileData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        if (isNaN(date.getTime())) return '';
                        // TODO: Timezone is temporarily hardcoded to US Central (America/Chicago).
                        // Must be updated to read dynamically from organization.timezone for multi-tenant support.
                        return date.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour12: false, hour: '2-digit', minute: '2-digit' });
                      }}
                      minTickGap={30}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      label={{ value: 'Speed (mph)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { textAnchor: 'middle' } }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        if (isNaN(d.getTime())) return 'Invalid Time';
                        // TODO: Make timeZone dynamic from organization context instead of hardcoding America/Chicago
                        return d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (CT)';
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Speed') return [`${value} mph`, name];
                        if (name === 'Speed Limit') return [`${value} mph`, name];
                        return [value, name];
                      }}
                    />
                    <Legend verticalAlign="top" align="left" content={(props: any) => {
                      const { payload } = props;
                      let dateRangeText = "";
                      if (speedProfileData && speedProfileData.length > 0) {
                        const firstDate = new Date(speedProfileData[0].timestamp);
                        const lastDate = new Date(speedProfileData[speedProfileData.length - 1].timestamp);
                        const formatDate = (d: Date) => {
                          return d.toLocaleString('en-US', {
                            // TODO: Multi-tenant requirement: read timeZone from organization settings
                            timeZone: 'America/Chicago',
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          }).replace(',', '');
                        };
                        dateRangeText = `${formatDate(firstDate)} to ${formatDate(lastDate)} (CT)`;
                      }
                      return (
                        <div className="flex justify-between w-full pb-4">
                          <div className="flex gap-4">
                            {payload.map((entry: any, index: number) => (
                              <div key={`item-${index}`} className="flex items-center gap-1.5 text-sm font-medium">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-slate-300">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs font-semibold text-slate-500 bg-slate-900 px-3 py-1 rounded-md border border-slate-800">
                            {dateRangeText}
                          </div>
                        </div>
                      );
                    }}/>
                    
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="speed" 
                      name="Speed"
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fill="url(#colorSpeed)" 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }}
                    />

                    {speedProfileData.some(d => d.speed_limit != null) && (
                      <Line 
                        yAxisId="left"
                        type="stepAfter" 
                        dataKey="speed_limit" 
                        name="Speed Limit"
                        stroke="#ef4444" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={false}
                      />
                    )}

                    <defs>
                      <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Brush 
                      dataKey="timestamp" 
                      height={30} 
                      stroke="#3b82f6" 
                      fill="#0f172a" 
                      tickFormatter={() => ''}
                      startIndex={Math.max(0, speedProfileData.length - 250)}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center">
                <button 
                  onClick={handleDownloadSpeedProfilePDF} 
                  disabled={loadingSpeedProfile || speedProfileData.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" /> Download Report
                </button>
                <button onClick={() => setSpeedProfileModalOpen(false)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">
                    Close
                </button>
            </div>
          </div>
        </div>
      )}

      {selectedDriverId && (
        <DriverDetailsModal 
          driverId={selectedDriverId} 
          onClose={() => setSelectedDriverId(null)} 
        />
      )}
    </div>
  );
};

export default SafetyCompliance;